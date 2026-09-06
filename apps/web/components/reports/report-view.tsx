import type { HoursEntry, ProjectRef, ReportDetail, ReportListItem, ReportSnapshot, ReportTask } from '@weekly-report/shared';
import { WORK_CATEGORY_LABELS } from '@weekly-report/shared';
import { PriorityBadge, TaskStatusBadge } from '@/components/ui/badge';
import { Table, TBody, Td, Th, THead, Tr } from '@/components/ui/table';
import { formatHours, formatWeek } from '@/lib/format';
import { cn } from '@/lib/utils';

/** Member-authored content, either the live report or an immutable snapshot. */
export type ReportContent = ReportSnapshot;

export function toContent(report: ReportDetail): ReportContent {
  return {
    weekStart: report.weekStart.slice(0, 10),
    weekEnd: report.weekEnd.slice(0, 10),
    project: report.project as ProjectRef,
    tasks: report.tasks,
    nextWeekPlan: report.nextWeekPlan,
    blockers: report.blockers,
    achievements: report.achievements,
    hours: report.hours,
    notes: report.notes,
    links: report.links,
  };
}

function Section({ number, title, children, hint }: { number: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs text-slate-600">{number}</span>
        {title}
        {hint && <span className="text-xs font-normal text-slate-400">{hint}</span>}
      </h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm italic text-slate-400">{children}</p>;
}

function Paragraphs({ text }: { text: string }) {
  return (
    <div className="space-y-2 text-sm leading-relaxed text-slate-700">
      {text.split(/\n+/).map((line, i) => (
        <p key={i}>{line}</p>
      ))}
    </div>
  );
}

function ItemList({ items, keyLabel }: { items: ReportListItem[]; keyLabel: string }) {
  if (items.length === 0) return <Empty>None reported.</Empty>;
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li
          key={item.id ?? i}
          className={cn(
            'flex items-start gap-3 rounded-lg border px-3 py-2 text-sm',
            item.isKey ? 'border-amber-300 bg-amber-50 text-amber-950' : 'border-slate-200 bg-white text-slate-700',
          )}
        >
          <span aria-hidden className="mt-0.5">{item.isKey ? '★' : '•'}</span>
          <span className="flex-1">{item.description}</span>
          {item.isKey && <span className="shrink-0 rounded-full bg-amber-200 px-2 py-0.5 text-[11px] font-semibold uppercase text-amber-900">{keyLabel}</span>}
        </li>
      ))}
    </ul>
  );
}

export function TaskTable({ tasks }: { tasks: ReportTask[] }) {
  if (tasks.length === 0) return <Empty>No tasks recorded.</Empty>;
  const plannedTotal = tasks.reduce((s, t) => s + t.plannedHours, 0);
  const actualTotal = tasks.reduce((s, t) => s + t.actualHours, 0);
  return (
    <div className="rounded-lg border border-slate-200">
      <Table>
        <THead>
          <tr>
            <Th className="px-3">Task</Th>
            <Th className="px-3">Priority</Th>
            <Th className="px-3">Status</Th>
            <Th className="px-3 text-right">Plan %</Th>
            <Th className="px-3 text-right">Actual %</Th>
            <Th className="px-3 text-right">Plan h</Th>
            <Th className="px-3 text-right">Spent h</Th>
            <Th className="px-3">Output / deliverable</Th>
          </tr>
        </THead>
        <TBody>
          {tasks.map((task, i) => (
            <Tr key={task.id ?? i}>
              <Td className="min-w-[11rem] px-3 font-medium text-slate-900">{task.name}</Td>
              <Td className="px-3"><PriorityBadge priority={task.priority} /></Td>
              <Td className="px-3"><TaskStatusBadge status={task.status} /></Td>
              <Td className="px-3 text-right tabular-nums">{task.plannedPercent}%</Td>
              <Td className="px-3 text-right tabular-nums">
                <div className="flex items-center justify-end gap-2">
                  <span className="h-1.5 w-12 overflow-hidden rounded-full bg-slate-100" aria-hidden>
                    <span className="block h-full rounded-full bg-brand-500" style={{ width: `${task.actualPercent}%` }} />
                  </span>
                  {task.actualPercent}%
                </div>
              </Td>
              <Td className="px-3 text-right tabular-nums">{task.plannedHours}</Td>
              <Td className={cn('px-3 text-right tabular-nums', task.actualHours > task.plannedHours && 'text-amber-700')}>{task.actualHours}</Td>
              <Td className="min-w-[10rem] px-3 text-slate-600">{task.output || <span className="text-slate-400">-</span>}</Td>
            </Tr>
          ))}
          <tr className="bg-slate-50 text-xs font-semibold text-slate-600">
            <Td className="px-3" colSpan={5}>Total</Td>
            <Td className="px-3 text-right tabular-nums">{formatHours(plannedTotal)}</Td>
            <Td className="px-3 text-right tabular-nums">{formatHours(actualTotal)}</Td>
            <Td className="px-3" />
          </tr>
        </TBody>
      </Table>
    </div>
  );
}

function HoursBreakdown({ hours }: { hours: HoursEntry[] }) {
  const entries = hours.filter((h) => h.hours > 0);
  if (entries.length === 0) return <Empty>No hours breakdown provided.</Empty>;
  const total = entries.reduce((s, h) => s + h.hours, 0);
  return (
    <div className="space-y-2">
      {entries
        .slice()
        .sort((a, b) => b.hours - a.hours)
        .map((entry) => (
          <div key={entry.category} className="flex items-center gap-3 text-sm">
            <span className="w-32 shrink-0 text-slate-600">{WORK_CATEGORY_LABELS[entry.category]}</span>
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100" aria-hidden>
              <span className="block h-full rounded-full bg-slate-500" style={{ width: `${(entry.hours / total) * 100}%` }} />
            </span>
            <span className="w-14 text-right tabular-nums text-slate-900">{formatHours(entry.hours)}</span>
          </div>
        ))}
      <p className="text-right text-xs text-slate-500">Total {formatHours(total)}</p>
    </div>
  );
}

function Links({ links }: { links: string }) {
  const parts = links.split(/[\s,]+/).filter(Boolean);
  return (
    <ul className="space-y-1 text-sm">
      {parts.map((part, i) => (
        <li key={i}>
          {/^https?:\/\//.test(part) ? (
            <a href={part} target="_blank" rel="noreferrer" className="break-all text-brand-600 hover:underline">
              {part}
            </a>
          ) : (
            <span className="text-slate-700">{part}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Read-only rendering of the fixed report structure. */
export function ReportView({ content, showWeek = true }: { content: ReportContent; showWeek?: boolean }) {
  return (
    <div className="space-y-8">
      {showWeek && (
        <Section number={1} title="Week and project">
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Week</dt>
              <dd className="mt-0.5 text-sm font-medium text-slate-900">{formatWeek(content.weekStart)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Project / category</dt>
              <dd className="mt-0.5 text-sm font-medium text-slate-900">{content.project?.name ?? '-'}</dd>
            </div>
          </dl>
        </Section>
      )}
      <Section number={2} title="Tasks completed">
        <TaskTable tasks={content.tasks} />
      </Section>
      <Section number={3} title="Planned for next week">
        {content.nextWeekPlan.trim() ? <Paragraphs text={content.nextWeekPlan} /> : <Empty>Nothing planned yet.</Empty>}
      </Section>
      <Section number={4} title="Blockers / challenges" hint="★ = key issue of the week">
        <ItemList items={content.blockers} keyLabel="Key issue" />
      </Section>
      <Section number={5} title="Achievements / highlights" hint="★ = key achievement">
        <ItemList items={content.achievements} keyLabel="Key win" />
      </Section>
      <Section number={6} title="Hours worked by task type" hint="optional">
        <HoursBreakdown hours={content.hours} />
      </Section>
      <Section number={7} title="Notes and links" hint="optional">
        <div className="space-y-3">
          {content.notes ? <Paragraphs text={content.notes} /> : <Empty>No notes.</Empty>}
          {content.links && <Links links={content.links} />}
        </div>
      </Section>
    </div>
  );
}
