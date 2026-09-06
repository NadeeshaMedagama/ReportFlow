'use client';

import type { ReportDetail } from '@weekly-report/shared';
import { ReviewAction } from '@weekly-report/shared';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingBlock } from '@/components/ui/loading';
import { Modal } from '@/components/ui/modal';
import { formatDateTime } from '@/lib/format';
import { useReportVersion, useReportVersions } from '@/lib/hooks/use-reports';
import { ReportView } from './report-view';

/**
 * List of every submitted version of a report. Each one can be opened in a
 * modal that renders the immutable snapshot with the same read-only view.
 */
export function VersionHistory({ report }: { report: ReportDetail }) {
  const { data: versions, isLoading } = useReportVersions(report.id);
  const [openVersionId, setOpenVersionId] = useState<string | null>(null);

  if (isLoading) return <LoadingBlock label="Loading versions..." />;
  if (!versions || versions.length === 0) return <p className="text-sm text-slate-500">Not submitted yet - versions appear after the first submission.</p>;

  return (
    <>
      <ol className="space-y-3">
        {versions.map((version) => {
          const isCurrent = version.versionNumber === report.currentVersion;
          const decision = version.reviews[version.reviews.length - 1];
          return (
            <li key={version.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900">Version {version.versionNumber}</span>
                  {isCurrent && <Badge tone="indigo">current</Badge>}
                  {decision ? (
                    <Badge tone={decision.action === ReviewAction.APPROVED ? 'emerald' : 'amber'}>
                      {decision.action === ReviewAction.APPROVED ? 'Approved' : 'Sent back'}
                    </Badge>
                  ) : (
                    isCurrent && report.status === 'SUBMITTED' && <Badge tone="blue">Under review</Badge>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-slate-500">Submitted {formatDateTime(version.submittedAt)}</p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => setOpenVersionId(version.id)}>
                View
              </Button>
            </li>
          );
        })}
      </ol>
      <VersionModal reportId={report.id} versionId={openVersionId} onClose={() => setOpenVersionId(null)} />
    </>
  );
}

function VersionModal({ reportId, versionId, onClose }: { reportId: string; versionId: string | null; onClose: () => void }) {
  const { data, isLoading } = useReportVersion(reportId, versionId ?? undefined);
  return (
    <Modal
      open={!!versionId}
      onClose={onClose}
      size="xl"
      title={data ? `Version ${data.versionNumber}` : 'Version'}
      description={data ? `Snapshot taken when it was submitted on ${formatDateTime(data.submittedAt)}` : undefined}
    >
      {isLoading || !data ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          {data.reviews.length > 0 && (
            <div className="space-y-2">
              {data.reviews.map((review) => (
                <div key={review.id} className={`rounded-lg border px-3 py-2 text-sm ${review.action === ReviewAction.APPROVED ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
                  <p className="text-xs font-semibold uppercase tracking-wide">
                    {review.action === ReviewAction.APPROVED ? 'Approved' : 'Changes requested'} by {review.reviewer.name} · {formatDateTime(review.createdAt)}
                  </p>
                  {review.comment && <p className="mt-1">{review.comment}</p>}
                </div>
              ))}
            </div>
          )}
          <ReportView content={data.snapshot} />
        </div>
      )}
    </Modal>
  );
}
