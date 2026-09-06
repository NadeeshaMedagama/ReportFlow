import type { SectionKey, SectionOverviewEntry } from '@weekly-report/shared';
import Link from 'next/link';
import { TaskTable } from '@/components/reports/report-view';
import { Avatar } from '@/components/ui/avatar';
import { StatusBadge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';

export const SECTION_LABELS: Record<SectionKey, string> = {
  BLOCKERS: 'Blockers / challenges',
  ACHIEVEMENTS: 'Achievements / highlights',
  NEXT_WEEK: 'Planned for next week',
  TASKS: 'Tasks completed',
};

/** One section of every member's report for a week, side by side. */
export function SectionOverview({ section, entries }: { section: SectionKey; entries: SectionOverviewEntry[] }) {
  if (entries.length === 0) return <EmptyState title="No submitted reports for this week" description="Drafts are not included." />;
  const wide = section === 'TASKS';
  return (
    <div className={wide ? 'space-y-4' : 'grid gap-4 md:grid-cols-2 xl:grid-cols-3'}>
      {entries.map((entry) => (
        <article key={entry.reportId} className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <header className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Avatar name={entry.user.name} size="sm" />
              <div>
                <Link href={`/reports/${entry.reportId}`} className="text-sm font-semibold text-slate-900 hover:text-brand-600">{entry.user.name}</Link>
                <p className="text-xs text-slate-500">{entry.project.name}</p>
              </div>
            </div>
            <StatusBadge status={entry.status} />
          </header>
          {section === 'TASKS' ? (
            <TaskTable tasks={entry.tasks} />
          ) : section === 'NEXT_WEEK' ? (
            <p className="whitespace-pre-line text-sm text-slate-700">{entry.text?.trim() || <span className="italic text-slate-400">Nothing planned</span>}</p>
          ) : entry.items.length === 0 ? (
            <p className="text-sm italic text-slate-400">None reported</p>
          ) : (
            <ul className="space-y-1.5">
              {entry.items.map((item, i) => (
                <li key={i} className={`flex gap-2 text-sm ${item.isKey ? 'font-medium text-amber-900' : 'text-slate-700'}`}>
                  <span aria-hidden>{item.isKey ? '★' : '•'}</span>
                  <span>{item.description}</span>
                </li>
              ))}
            </ul>
          )}
        </article>
      ))}
    </div>
  );
}
