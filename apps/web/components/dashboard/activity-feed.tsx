import type { ActivityEntry } from '@weekly-report/shared';
import Link from 'next/link';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { formatRelative } from '@/lib/format';

const ICONS: Partial<Record<ActivityEntry['type'], string>> = {
  REPORT_APPROVED: '✅',
  REPORT_CHANGES_REQUESTED: '↩️',
  REPORT_SUBMITTED: '📤',
  REPORT_RESUBMITTED: '🔁',
  REPORT_CREATED: '📝',
};

export function ActivityFeed({ entries }: { entries: ActivityEntry[] }) {
  if (entries.length === 0) return <EmptyState title="No activity yet" />;
  return (
    <ol className="divide-y divide-slate-100">
      {entries.map((entry) => (
        <li key={entry.id} className="flex items-start gap-3 py-3">
          {entry.actor ? <Avatar name={entry.actor.name} size="sm" /> : <span className="h-7 w-7 rounded-full bg-slate-200" />}
          <div className="min-w-0 flex-1">
            <p className="text-sm text-slate-700">
              <span aria-hidden className="mr-1">{ICONS[entry.type] ?? '•'}</span>
              {entry.message}
            </p>
            <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <span>{formatRelative(entry.createdAt)}</span>
              {entry.report && entry.report.status !== 'DRAFT' && (
                <Link href={`/reports/${entry.report.id}`} className="text-brand-600 hover:underline">
                  Open report
                </Link>
              )}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
