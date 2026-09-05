import type { ReactNode } from 'react';
import {
  REPORT_STATUS_LABELS,
  ROLE_LABELS,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  TIMING_LABELS,
  type Role,
  type SubmissionStatus,
  type SubmissionTiming,
  type TaskPriority,
  type TaskStatus,
} from '@weekly-report/shared';
import { cn } from '@/lib/utils';

export type Tone = 'slate' | 'blue' | 'amber' | 'emerald' | 'rose' | 'violet' | 'indigo' | 'orange';

const toneClasses: Record<Tone, string> = {
  slate: 'bg-slate-100 text-slate-700 ring-slate-200',
  blue: 'bg-blue-50 text-blue-700 ring-blue-200',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200',
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  rose: 'bg-rose-50 text-rose-700 ring-rose-200',
  violet: 'bg-violet-50 text-violet-700 ring-violet-200',
  indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  orange: 'bg-orange-50 text-orange-700 ring-orange-200',
};

export function Badge({ tone = 'slate', children, className, dot }: { tone?: Tone; children: ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset', toneClasses[tone], className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}

export const STATUS_TONES: Record<SubmissionStatus, Tone> = {
  DRAFT: 'slate',
  SUBMITTED: 'blue',
  NEEDS_CORRECTION: 'amber',
  APPROVED: 'emerald',
  NOT_STARTED: 'rose',
};

export function StatusBadge({ status, className }: { status: SubmissionStatus; className?: string }) {
  return (
    <Badge tone={STATUS_TONES[status]} className={className} dot>
      {REPORT_STATUS_LABELS[status]}
    </Badge>
  );
}

const TIMING_TONES: Record<SubmissionTiming, Tone> = { ON_TIME: 'emerald', LATE: 'orange', PENDING: 'slate', OVERDUE: 'rose' };

export function TimingBadge({ timing }: { timing: SubmissionTiming }) {
  return <Badge tone={TIMING_TONES[timing]}>{TIMING_LABELS[timing]}</Badge>;
}

const ROLE_TONES: Record<Role, Tone> = { TEAM_MEMBER: 'slate', MANAGER: 'indigo', ADMIN: 'violet' };

export function RoleBadge({ role }: { role: Role }) {
  return <Badge tone={ROLE_TONES[role]}>{ROLE_LABELS[role]}</Badge>;
}

const PRIORITY_TONES: Record<TaskPriority, Tone> = { LOW: 'slate', MEDIUM: 'blue', HIGH: 'amber', CRITICAL: 'rose' };

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  return <Badge tone={PRIORITY_TONES[priority]}>{TASK_PRIORITY_LABELS[priority]}</Badge>;
}

const TASK_STATUS_TONES: Record<TaskStatus, Tone> = { NOT_STARTED: 'slate', IN_PROGRESS: 'blue', COMPLETED: 'emerald', BLOCKED: 'rose' };

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return <Badge tone={TASK_STATUS_TONES[status]}>{TASK_STATUS_LABELS[status]}</Badge>;
}
