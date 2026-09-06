import type { ReviewEntry } from '@weekly-report/shared';
import { ReviewAction } from '@weekly-report/shared';
import { Badge } from '@/components/ui/badge';
import { formatDateTime } from '@/lib/format';

/** Every manager decision on a report, newest first, with the version it targeted. */
export function ReviewTimeline({ reviews }: { reviews: ReviewEntry[] }) {
  if (reviews.length === 0) return <p className="text-sm text-slate-500">No review actions yet.</p>;
  return (
    <ol className="space-y-4">
      {reviews.map((review) => {
        const approved = review.action === ReviewAction.APPROVED;
        return (
          <li key={review.id} className="relative border-l-2 border-slate-200 pl-4">
            <span className={`absolute -left-[7px] top-1 h-3 w-3 rounded-full ${approved ? 'bg-emerald-500' : 'bg-amber-500'}`} aria-hidden />
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={approved ? 'emerald' : 'amber'}>{approved ? 'Approved' : 'Changes requested'}</Badge>
              {review.version && <span className="text-xs text-slate-500">on version {review.version.versionNumber}</span>}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {review.reviewer.name} · {formatDateTime(review.createdAt)}
            </p>
            {review.comment && <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">{review.comment}</p>}
          </li>
        );
      })}
    </ol>
  );
}
