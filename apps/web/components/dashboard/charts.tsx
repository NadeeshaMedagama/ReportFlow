'use client';

import { REPORT_STATUS_LABELS, type StatusByMemberRow, type TasksTrendResponse, type TimeByCategoryResponse, type WorkloadRow } from '@weekly-report/shared';
import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { EmptyState } from '@/components/ui/empty-state';
import { Tabs } from '@/components/ui/tabs';
import { AXIS_TICK, GRID_STROKE, seriesColor, STATUS_COLORS, TOOLTIP_STYLE, WORK_CATEGORY_ORDER } from './chart-theme';

/** Accessible fallback: the same numbers as a plain table. */
function DataTable({ columns, rows }: { columns: string[]; rows: Array<Array<string | number>> }) {
  return (
    <details className="mt-3 text-xs text-slate-500">
      <summary className="cursor-pointer select-none hover:text-slate-800">View data as table</summary>
      <div className="mt-2 overflow-x-auto">
        <table className="min-w-full text-left text-xs">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c} className="border-b border-slate-200 px-2 py-1 font-semibold text-slate-600">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j} className="border-b border-slate-100 px-2 py-1 tabular-nums text-slate-700">{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

// ---------------------------------------------------------------------------
// Tasks completed trend (team-wide line, or stacked per member)
// ---------------------------------------------------------------------------

export function TasksTrendChart({ data }: { data: TasksTrendResponse }) {
  const [mode, setMode] = useState<'team' | 'members'>('team');
  const hasData = data.rows.some((r) => r.tasks > 0);
  if (!hasData) return <EmptyState title="No submitted reports in this window" />;

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Tabs items={[{ value: 'team', label: 'Team total' }, { value: 'members', label: 'Per member' }]} value={mode} onChange={setMode} />
      </div>
      <ResponsiveContainer width="100%" height={260}>
        {mode === 'team' ? (
          <LineChart data={data.rows} margin={{ top: 10, right: 12, left: -16, bottom: 0 }}>
            <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} />
            <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value) => [`${value} tasks`, 'Completed']} />
            <Line type="monotone" dataKey="completed" name="Completed tasks" stroke={seriesColor(0)} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 6 }} />
          </LineChart>
        ) : (
          <BarChart data={data.rows} margin={{ top: 10, right: 12, left: -16, bottom: 0 }} barCategoryGap="30%">
            <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} />
            <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {data.series.map((name, index) => (
              <Bar key={name} dataKey={name} stackId="tasks" fill={seriesColor(index)} stroke="#fff" strokeWidth={1} radius={index === data.series.length - 1 ? [4, 4, 0, 0] : 0} />
            ))}
          </BarChart>
        )}
      </ResponsiveContainer>
      <DataTable
        columns={['Week', 'Completed', 'All tasks', 'Hours', ...data.series]}
        rows={data.rows.map((r) => [r.label, r.completed, r.tasks, r.hours, ...data.series.map((s) => Number(r[s] ?? 0))])}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Report status by team member (horizontal stacked bars)
// ---------------------------------------------------------------------------

const STATUS_ORDER = ['APPROVED', 'SUBMITTED', 'NEEDS_CORRECTION', 'DRAFT', 'NOT_STARTED'] as const;

export function StatusByMemberChart({ rows }: { rows: StatusByMemberRow[] }) {
  if (rows.length === 0) return <EmptyState title="No team members yet" />;
  const height = Math.max(200, rows.length * 44 + 60);
  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 12, left: 8, bottom: 0 }} barCategoryGap="35%">
          <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} />
          <YAxis type="category" dataKey="name" tick={AXIS_TICK} axisLine={false} tickLine={false} width={130} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {STATUS_ORDER.map((status, index) => (
            <Bar key={status} dataKey={status} name={REPORT_STATUS_LABELS[status]} stackId="status" fill={STATUS_COLORS[status]} stroke="#fff" strokeWidth={1} radius={index === STATUS_ORDER.length - 1 ? [0, 4, 4, 0] : 0} />
          ))}
        </BarChart>
      </ResponsiveContainer>
      <DataTable
        columns={['Member', ...STATUS_ORDER.map((s) => REPORT_STATUS_LABELS[s])]}
        rows={rows.map((r) => [r.name, ...STATUS_ORDER.map((s) => r[s])])}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Workload by project (hours, one measure)
// ---------------------------------------------------------------------------

export function WorkloadChart({ rows }: { rows: WorkloadRow[] }) {
  if (rows.length === 0) return <EmptyState title="No submitted work in this window" />;
  const height = Math.max(200, rows.length * 44 + 40);
  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 48, left: 8, bottom: 0 }} barCategoryGap="35%">
          <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" tick={AXIS_TICK} axisLine={false} tickLine={false} unit=" h" />
          <YAxis type="category" dataKey="name" tick={AXIS_TICK} axisLine={false} tickLine={false} width={150} />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(value, _name, item) => {
              const row = item.payload as WorkloadRow;
              return [`${value} h · ${row.tasks} tasks (${row.completedTasks} done) · ${row.members} people · ${row.reports} reports`, 'Workload'];
            }}
          />
          <Bar dataKey="hours" name="Hours spent" fill={seriesColor(0)} radius={[0, 4, 4, 0]}>
            <LabelList dataKey="hours" position="right" formatter={(value) => `${value} h`} style={{ fill: '#334155', fontSize: 12 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <DataTable
        columns={['Project', 'Hours', 'Tasks', 'Completed', 'People', 'Reports']}
        rows={rows.map((r) => [r.name, r.hours, r.tasks, r.completedTasks, r.members, r.reports])}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Time spent by task type (donut + labelled list)
// ---------------------------------------------------------------------------

export function TimeByCategoryChart({ data }: { data: TimeByCategoryResponse }) {
  if (data.rows.length === 0) return <EmptyState title="No hours breakdown submitted yet" description="Members fill this section optionally." />;
  const colorFor = (category: string) => seriesColor(Math.max(0, WORK_CATEGORY_ORDER.indexOf(category)));
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="h-56 w-full sm:w-1/2">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data.rows} dataKey="hours" nameKey="label" innerRadius={55} outerRadius={90} paddingAngle={2} stroke="#fff" strokeWidth={2}>
              {data.rows.map((row) => (
                <Cell key={row.category} fill={colorFor(row.category)} />
              ))}
            </Pie>
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value) => [`${value} h`, 'Hours']} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="w-full space-y-2 sm:w-1/2">
        {data.rows.map((row) => (
          <li key={row.category} className="flex items-center gap-3 text-sm">
            <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: colorFor(row.category) }} aria-hidden />
            <span className="flex-1 text-slate-700">{row.label}</span>
            <span className="tabular-nums text-slate-900">{row.hours} h</span>
            <span className="w-10 text-right tabular-nums text-slate-500">{row.share}%</span>
          </li>
        ))}
        <li className="flex justify-between border-t border-slate-200 pt-2 text-xs text-slate-500">
          <span>Total over {data.weeks} weeks</span>
          <span className="tabular-nums">{data.total} h</span>
        </li>
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Member profile: hours per week coloured by report status
// ---------------------------------------------------------------------------

export function MemberWeeklyChart({ weekly }: { weekly: Array<{ label: string; hours: number; tasksCompleted: number; status: string }> }) {
  if (!weekly.some((w) => w.hours > 0)) return <EmptyState title="No submitted reports in the last weeks" />;
  return (
    <div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={weekly} margin={{ top: 16, right: 12, left: -16, bottom: 0 }} barCategoryGap="30%">
          <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={{ ...AXIS_TICK, fontSize: 11 }} axisLine={false} tickLine={false} interval={0} tickFormatter={(label: string) => label.split(' - ')[0]} />
          <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} unit=" h" />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(value, _name, item) => {
              const row = item.payload as { tasksCompleted: number; status: string };
              return [`${value} h · ${row.tasksCompleted} tasks completed · ${REPORT_STATUS_LABELS[row.status as keyof typeof REPORT_STATUS_LABELS]}`, 'Week'];
            }}
          />
          <Bar dataKey="hours" name="Hours" radius={[4, 4, 0, 0]}>
            {weekly.map((w, i) => (
              <Cell key={i} fill={STATUS_COLORS[w.status] ?? '#94a3b8'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
        {STATUS_ORDER.map((s) => (
          <span key={s} className="inline-flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: STATUS_COLORS[s] }} aria-hidden /> {REPORT_STATUS_LABELS[s]}
          </span>
        ))}
      </div>
    </div>
  );
}
