'use client';

import {
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  TaskPriority,
  TaskStatus,
  WORK_CATEGORY_LABELS,
  WorkCategory,
  type Project,
  type ReportDetail,
  type ReportInput,
} from '@weekly-report/shared';
import { useMemo, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { currentWeekStart, formatWeek, mondayOf } from '@/lib/format';
import { cn } from '@/lib/utils';
import { issuesToMap, reportDraftSchema, reportSubmitSchema, type ReportFormValues } from '@/lib/validation';

// ---------------------------------------------------------------------------
// Form state (numbers are kept as strings while typing)
// ---------------------------------------------------------------------------

interface TaskRow {
  name: string;
  priority: TaskPriority;
  status: TaskStatus;
  plannedPercent: string;
  actualPercent: string;
  plannedHours: string;
  actualHours: string;
  output: string;
}
interface ListRow {
  description: string;
  isKey: boolean;
}
interface FormState {
  weekStart: string;
  projectId: string;
  tasks: TaskRow[];
  nextWeekPlan: string;
  blockers: ListRow[];
  achievements: ListRow[];
  hours: Record<WorkCategory, string>;
  notes: string;
  links: string;
}

const CATEGORIES = Object.values(WorkCategory);

const emptyTask = (): TaskRow => ({
  name: '',
  priority: TaskPriority.MEDIUM,
  status: TaskStatus.COMPLETED,
  plannedPercent: '100',
  actualPercent: '100',
  plannedHours: '',
  actualHours: '',
  output: '',
});

function initialState(report?: ReportDetail): FormState {
  return {
    weekStart: report ? report.weekStart.slice(0, 10) : currentWeekStart(),
    projectId: report?.projectId ?? '',
    tasks: report
      ? report.tasks.map((t) => ({
          name: t.name,
          priority: t.priority,
          status: t.status,
          plannedPercent: String(t.plannedPercent),
          actualPercent: String(t.actualPercent),
          plannedHours: String(t.plannedHours),
          actualHours: String(t.actualHours),
          output: t.output ?? '',
        }))
      : [emptyTask()],
    nextWeekPlan: report?.nextWeekPlan ?? '',
    blockers: report?.blockers.map((b) => ({ description: b.description, isKey: b.isKey })) ?? [],
    achievements: report?.achievements.map((a) => ({ description: a.description, isKey: a.isKey })) ?? [],
    hours: Object.fromEntries(
      CATEGORIES.map((c) => [c, String(report?.hours.find((h) => h.category === c)?.hours ?? '')]),
    ) as Record<WorkCategory, string>,
    notes: report?.notes ?? '',
    links: report?.links ?? '',
  };
}

const isBlankTask = (t: TaskRow) => !t.name.trim() && !t.output.trim() && !t.plannedHours && !t.actualHours;

/** Convert the UI state into the shape validated by zod / sent to the API. */
function toValues(state: FormState) {
  return {
    ...state,
    tasks: state.tasks.filter((t) => !isBlankTask(t)),
    hours: CATEGORIES.filter((c) => state.hours[c] !== '').map((c) => ({ category: c, hours: state.hours[c] })),
  };
}

function toInput(values: ReportFormValues): ReportInput {
  return {
    weekStart: values.weekStart,
    projectId: values.projectId,
    tasks: values.tasks.map((t) => ({
      name: t.name,
      priority: t.priority,
      status: t.status,
      plannedPercent: t.plannedPercent,
      actualPercent: t.actualPercent,
      plannedHours: t.plannedHours,
      actualHours: t.actualHours,
      output: t.output || undefined,
    })),
    nextWeekPlan: values.nextWeekPlan,
    blockers: values.blockers,
    achievements: values.achievements,
    hours: values.hours.filter((h) => h.hours > 0),
    notes: values.notes || undefined,
    links: values.links || undefined,
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ReportFormProps {
  mode: 'create' | 'edit';
  initial?: ReportDetail;
  projects: Project[];
  /** Once a report has been submitted its week can no longer change. */
  weekLocked?: boolean;
  onSaveDraft: (input: ReportInput) => Promise<void>;
  onSubmit: (input: ReportInput) => Promise<void>;
  onDelete?: () => void;
  saving?: boolean;
  submitting?: boolean;
  error?: string | null;
}

export function ReportForm({ mode, initial, projects, weekLocked, onSaveDraft, onSubmit, onDelete, saving, submitting, error }: ReportFormProps) {
  const [state, setState] = useState<FormState>(() => initialState(initial));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [attempted, setAttempted] = useState<'draft' | 'submit' | null>(null);

  const patch = (changes: Partial<FormState>) => setState((prev) => ({ ...prev, ...changes }));
  const busy = !!saving || !!submitting;

  // Show the current project even if it was archived after the report was created.
  const projectOptions = useMemo(() => {
    const list = projects.filter((p) => p.active || p.id === initial?.projectId);
    if (initial?.project && !list.some((p) => p.id === initial.projectId)) {
      list.push({ ...initial.project, active: false } as Project);
    }
    return list;
  }, [projects, initial]);

  function validate(kind: 'draft' | 'submit'): ReportFormValues | null {
    const schema = kind === 'submit' ? reportSubmitSchema : reportDraftSchema;
    const parsed = schema.safeParse(toValues(state));
    setAttempted(kind);
    if (!parsed.success) {
      setErrors(issuesToMap(parsed.error));
      return null;
    }
    setErrors({});
    return parsed.data;
  }

  const handleSave = async () => {
    const values = validate('draft');
    if (values) await onSaveDraft(toInput(values));
  };
  const handleSubmit = async () => {
    const values = validate('submit');
    if (values) await onSubmit(toInput(values));
  };

  const errorCount = Object.keys(errors).length;

  return (
    <form
      className="space-y-6"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void handleSubmit();
      }}
    >
      {error && <Alert tone="danger" title="Could not save the report">{error}</Alert>}
      {errorCount > 0 && (
        <Alert tone="warning" title={attempted === 'submit' ? 'The report cannot be submitted yet' : 'Please fix the highlighted fields'}>
          {errorCount} field{errorCount > 1 ? 's need' : ' needs'} attention.
        </Alert>
      )}

      {/* 1. Week */}
      <Card title="1. Week" description="Reports cover one Monday-to-Sunday week. Pick any day and it snaps to that week.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Week starting (Monday)" htmlFor="weekStart" error={errors.weekStart} required>
            <Input
              id="weekStart"
              type="date"
              value={state.weekStart}
              disabled={weekLocked || busy}
              max={currentWeekStart()}
              onChange={(event) => {
                if (!event.target.value) return;
                const [y, m, d] = event.target.value.split('-').map(Number);
                patch({ weekStart: mondayOf(new Date(y, m - 1, d)) });
              }}
              invalid={!!errors.weekStart}
            />
          </Field>
          <div className="flex items-end pb-2 text-sm text-slate-600">
            {formatWeek(state.weekStart)}
            {weekLocked && <span className="ml-2 text-xs text-slate-400">(locked after first submission)</span>}
          </div>
        </div>
      </Card>

      {/* 2. Project */}
      <Card title="2. Project / category">
        <Field label="Project" htmlFor="projectId" error={errors.projectId} required className="max-w-md">
          <Select id="projectId" value={state.projectId} onChange={(e) => patch({ projectId: e.target.value })} invalid={!!errors.projectId} disabled={busy}>
            <option value="">Select a project...</option>
            {projectOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {!p.active ? ' (archived)' : ''}
              </option>
            ))}
          </Select>
        </Field>
      </Card>

      {/* 3. Tasks */}
      <Card
        title="3. Tasks completed"
        description="One row per task worked on this week."
        actions={
          <Button variant="secondary" size="sm" onClick={() => patch({ tasks: [...state.tasks, emptyTask()] })} disabled={busy}>
            + Add task
          </Button>
        }
      >
        {errors.tasks && <p className="mb-3 text-sm text-rose-600">{errors.tasks}</p>}
        <TaskTableEditor
          tasks={state.tasks}
          errors={errors}
          disabled={busy}
          onChange={(tasks) => patch({ tasks })}
        />
      </Card>

      {/* 4. Next week */}
      <Card title="4. Tasks planned for next week">
        <Field htmlFor="nextWeekPlan" error={errors.nextWeekPlan} hint="Required to submit. One task per line works well.">
          <Textarea id="nextWeekPlan" value={state.nextWeekPlan} onChange={(e) => patch({ nextWeekPlan: e.target.value })} invalid={!!errors.nextWeekPlan} disabled={busy} rows={4} />
        </Field>
      </Card>

      {/* 5. Blockers */}
      <Card title="5. Blockers / challenges" description="Flag one as the key issue of the week with the star.">
        <ListEditor
          items={state.blockers}
          prefix="blockers"
          addLabel="+ Add blocker"
          placeholder="What slowed you down or is at risk?"
          errors={errors}
          disabled={busy}
          onChange={(blockers) => patch({ blockers })}
        />
      </Card>

      {/* 6. Achievements */}
      <Card title="6. Achievements / highlights" description="Flag one as the key achievement of the week with the star.">
        <ListEditor
          items={state.achievements}
          prefix="achievements"
          addLabel="+ Add achievement"
          placeholder="What went well?"
          errors={errors}
          disabled={busy}
          onChange={(achievements) => patch({ achievements })}
        />
      </Card>

      {/* 7. Hours */}
      <Card title="7. Hours worked by task type" description="Optional. Leave blank if you do not track this.">
        <HoursEditor hours={state.hours} errors={errors} disabled={busy} onChange={(hours) => patch({ hours })} />
      </Card>

      {/* 8. Notes */}
      <Card title="8. Notes and links" description="Optional.">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Notes" htmlFor="notes" error={errors.notes}>
            <Textarea id="notes" value={state.notes} onChange={(e) => patch({ notes: e.target.value })} disabled={busy} rows={3} />
          </Field>
          <Field label="Links" htmlFor="links" error={errors.links} hint="Pull requests, documents... one per line">
            <Textarea id="links" value={state.links} onChange={(e) => patch({ links: e.target.value })} disabled={busy} rows={3} />
          </Field>
        </div>
      </Card>

      {/* Actions */}
      <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border">
        <div>
          {mode === 'edit' && onDelete && (
            <Button variant="ghost" className="text-rose-600 hover:bg-rose-50" onClick={onDelete} disabled={busy}>
              Delete draft
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={handleSave} loading={saving} disabled={submitting}>
            Save draft
          </Button>
          <Button type="submit" loading={submitting} disabled={saving}>
            {initial && initial.currentVersion > 0 ? 'Resubmit for review' : 'Submit for review'}
          </Button>
        </div>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Sub-editors
// ---------------------------------------------------------------------------

const cell = 'input h-9 px-2 py-1 text-xs';

function TaskTableEditor({ tasks, errors, disabled, onChange }: { tasks: TaskRow[]; errors: Record<string, string>; disabled: boolean; onChange: (tasks: TaskRow[]) => void }) {
  const update = (index: number, changes: Partial<TaskRow>) => onChange(tasks.map((t, i) => (i === index ? { ...t, ...changes } : t)));
  const remove = (index: number) => onChange(tasks.filter((_, i) => i !== index));
  const err = (index: number, field: keyof TaskRow) => errors[`tasks.${index}.${field}`];
  const numberProps = { type: 'number' as const, inputMode: 'decimal' as const, min: 0 };

  if (tasks.length === 0) {
    return <p className="text-sm text-slate-500">No tasks yet. Use &quot;Add task&quot; to add the first row.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[64rem] text-sm">
        <thead className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <th className="pb-2 pr-2 w-8">#</th>
            <th className="pb-2 pr-2">Task name</th>
            <th className="pb-2 pr-2 w-28">Priority</th>
            <th className="pb-2 pr-2 w-32">Status</th>
            <th className="pb-2 pr-2 w-24">Planned %</th>
            <th className="pb-2 pr-2 w-24">Actual %</th>
            <th className="pb-2 pr-2 w-24">Planned h</th>
            <th className="pb-2 pr-2 w-24">Spent h</th>
            <th className="pb-2 pr-2">Output / deliverable</th>
            <th className="pb-2 w-10" />
          </tr>
        </thead>
        <tbody>
          {tasks.map((task, index) => (
            <tr key={index} className="align-top">
              <td className="py-1 pr-2 pt-3 text-xs text-slate-400">{index + 1}</td>
              <td className="py-1 pr-2">
                <input className={cn(cell, err(index, 'name') && 'input-error')} value={task.name} onChange={(e) => update(index, { name: e.target.value })} placeholder="e.g. Implement onboarding flow" disabled={disabled} aria-label={`Task ${index + 1} name`} />
                {err(index, 'name') && <p className="mt-1 text-xs text-rose-600">{err(index, 'name')}</p>}
              </td>
              <td className="py-1 pr-2">
                <select className={cell} value={task.priority} onChange={(e) => update(index, { priority: e.target.value as TaskPriority })} disabled={disabled} aria-label="Priority">
                  {Object.values(TaskPriority).map((p) => (
                    <option key={p} value={p}>{TASK_PRIORITY_LABELS[p]}</option>
                  ))}
                </select>
              </td>
              <td className="py-1 pr-2">
                <select className={cell} value={task.status} onChange={(e) => update(index, { status: e.target.value as TaskStatus })} disabled={disabled} aria-label="Status">
                  {Object.values(TaskStatus).map((s) => (
                    <option key={s} value={s}>{TASK_STATUS_LABELS[s]}</option>
                  ))}
                </select>
              </td>
              {(['plannedPercent', 'actualPercent', 'plannedHours', 'actualHours'] as const).map((field) => (
                <td key={field} className="py-1 pr-2">
                  <input
                    {...numberProps}
                    max={field.endsWith('Percent') ? 100 : 168}
                    step={field.endsWith('Percent') ? 1 : 0.5}
                    className={cn(cell, 'text-right', err(index, field) && 'input-error')}
                    value={task[field]}
                    onChange={(e) => update(index, { [field]: e.target.value })}
                    disabled={disabled}
                    aria-label={field}
                  />
                  {err(index, field) && <p className="mt-1 text-xs text-rose-600">{err(index, field)}</p>}
                </td>
              ))}
              <td className="py-1 pr-2">
                <input className={cn(cell, err(index, 'output') && 'input-error')} value={task.output} onChange={(e) => update(index, { output: e.target.value })} placeholder="PR merged, doc published..." disabled={disabled} aria-label="Output" />
              </td>
              <td className="py-1">
                <button type="button" onClick={() => remove(index)} disabled={disabled} className="mt-1 rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label={`Remove task ${index + 1}`}>
                  <span aria-hidden>&times;</span>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ListEditor({ items, prefix, addLabel, placeholder, errors, disabled, onChange }: { items: ListRow[]; prefix: 'blockers' | 'achievements'; addLabel: string; placeholder: string; errors: Record<string, string>; disabled: boolean; onChange: (items: ListRow[]) => void }) {
  const update = (index: number, changes: Partial<ListRow>) => onChange(items.map((item, i) => (i === index ? { ...item, ...changes } : item)));
  const toggleKey = (index: number) => onChange(items.map((item, i) => ({ ...item, isKey: i === index ? !item.isKey : false })));
  return (
    <div className="space-y-2">
      {errors[prefix] && <p className="text-sm text-rose-600">{errors[prefix]}</p>}
      {items.map((item, index) => {
        const error = errors[`${prefix}.${index}.description`];
        return (
          <div key={index} className="flex items-start gap-2">
            <button
              type="button"
              onClick={() => toggleKey(index)}
              disabled={disabled}
              className={cn('mt-1.5 rounded p-1 text-lg leading-none', item.isKey ? 'text-amber-500' : 'text-slate-300 hover:text-amber-400')}
              aria-pressed={item.isKey}
              aria-label={item.isKey ? 'Unset as key item' : 'Set as key item'}
              title={item.isKey ? 'Key item of the week' : 'Mark as key item'}
            >
              {item.isKey ? '★' : '☆'}
            </button>
            <div className="flex-1">
              <Input value={item.description} onChange={(e) => update(index, { description: e.target.value })} placeholder={placeholder} invalid={!!error} disabled={disabled} />
              {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
            </div>
            <button type="button" onClick={() => onChange(items.filter((_, i) => i !== index))} disabled={disabled} className="mt-2 rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Remove item">
              <span aria-hidden>&times;</span>
            </button>
          </div>
        );
      })}
      <Button variant="secondary" size="sm" onClick={() => onChange([...items, { description: '', isKey: false }])} disabled={disabled}>
        {addLabel}
      </Button>
    </div>
  );
}

function HoursEditor({ hours, errors, disabled, onChange }: { hours: Record<WorkCategory, string>; errors: Record<string, string>; disabled: boolean; onChange: (hours: Record<WorkCategory, string>) => void }) {
  const total = CATEGORIES.reduce((sum, c) => sum + (Number(hours[c]) || 0), 0);
  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {CATEGORIES.map((category) => (
          <Field key={category} label={WORK_CATEGORY_LABELS[category]} htmlFor={`hours-${category}`}>
            <Input id={`hours-${category}`} type="number" min={0} max={168} step={0.5} inputMode="decimal" value={hours[category]} onChange={(e) => onChange({ ...hours, [category]: e.target.value })} disabled={disabled} placeholder="0" />
          </Field>
        ))}
      </div>
      {errors.hours && <p className="mt-2 text-sm text-rose-600">{errors.hours}</p>}
      <p className="mt-3 text-sm text-slate-600">
        Total: <span className="font-semibold text-slate-900">{Math.round(total * 10) / 10} h</span>
      </p>
    </div>
  );
}
