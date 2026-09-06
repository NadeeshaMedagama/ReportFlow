'use client';

import { ReportStatus } from '@weekly-report/shared';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { ReportView, toContent } from '@/components/reports/report-view';
import { ReviewTimeline } from '@/components/reports/review-timeline';
import { VersionHistory } from '@/components/reports/version-history';
import { Alert } from '@/components/ui/alert';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button, LinkButton } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ErrorBlock, LoadingBlock } from '@/components/ui/loading';
import { ConfirmDialog } from '@/components/ui/modal';
import { PageHeader } from '@/components/ui/page-header';
import { errorMessage } from '@/lib/api-client';
import { isManager, useAuth } from '@/lib/auth-context';
import { formatDateTime, formatWeek } from '@/lib/format';
import { useReport, useReportMutations } from '@/lib/hooks/use-reports';

/** Read-only report detail, used by team members and managers alike. */
export default function ReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const report = useReport(id);
  const { submit } = useReportMutations();
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (report.isLoading) return <LoadingBlock />;
  if (report.isError) return <ErrorBlock message={errorMessage(report.error)} onRetry={() => report.refetch()} />;
  if (!report.data) return null;
  const data = report.data;
  const manager = isManager(user);
  const owner = user?.id === data.userId;
  const backHref = manager ? '/team-reports' : '/my-reports';

  return (
    <div>
      <PageHeader
        title={`Week of ${formatWeek(data.weekStart.slice(0, 10))}`}
        backHref={backHref}
        backLabel={manager ? 'Team reports' : 'My reports'}
        meta={
          <>
            <StatusBadge status={data.status} />
            {data.currentVersion > 0 && <Badge tone="indigo">Version {data.currentVersion}</Badge>}
            <Badge>{data.project?.name}</Badge>
            {manager && (
              <Link href={`/team/${data.user.id}`} className="text-sm text-slate-600 hover:text-brand-600">
                {data.user.name}
              </Link>
            )}
            {data.submittedAt && <span className="text-xs text-slate-500">Submitted {formatDateTime(data.submittedAt)}</span>}
          </>
        }
        actions={
          <>
            {data.permissions.canReview && <LinkButton href={`/review/${data.id}`}>Review this report</LinkButton>}
            {data.permissions.canEdit && <LinkButton href={`/my-reports/${data.id}/edit`} variant="secondary">Edit</LinkButton>}
            {data.permissions.canSubmit && (
              <Button onClick={() => setConfirmSubmit(true)}>{data.currentVersion > 0 ? 'Resubmit for review' : 'Submit for review'}</Button>
            )}
          </>
        }
      />

      {actionError && <Alert tone="danger" className="mb-6">{actionError}</Alert>}

      {data.status === ReportStatus.NEEDS_CORRECTION && data.latestReviewComment && (
        <Alert tone="warning" title={owner ? 'Your manager requested changes' : 'Changes were requested'} className="mb-6">
          <p className="whitespace-pre-line">{data.latestReviewComment}</p>
          {data.reviews[0] && (
            <p className="mt-2 text-xs text-amber-800">
              {data.reviews[0].reviewer.name} · {formatDateTime(data.reviews[0].createdAt)}
            </p>
          )}
        </Alert>
      )}
      {data.status === ReportStatus.SUBMITTED && owner && (
        <Alert tone="info" className="mb-6">This report is awaiting your manager&apos;s review. It is locked until a decision is made.</Alert>
      )}
      {data.status === ReportStatus.APPROVED && (
        <Alert tone="success" className="mb-6">
          Approved{data.reviewedAt ? ` on ${formatDateTime(data.reviewedAt)}` : ''}. No further changes are expected.
        </Alert>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="min-w-0">
          <Card>
            <ReportView content={toContent(data)} />
          </Card>
        </div>
        <div className="space-y-6">
          <Card title="Review history" description="Manager decisions and comments">
            <ReviewTimeline reviews={data.reviews} />
          </Card>
          <Card title="Version history" description="Every submission is kept">
            <VersionHistory report={data} />
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={confirmSubmit}
        onClose={() => setConfirmSubmit(false)}
        title="Submit this report for review?"
        description="Your manager will be able to see it. You will not be able to edit it unless it is sent back for correction."
        confirmLabel="Submit"
        variant="primary"
        loading={submit.isPending}
        onConfirm={() => {
          setActionError(null);
          submit.mutate(id, {
            onSuccess: () => setConfirmSubmit(false),
            onError: (e) => {
              setActionError(errorMessage(e));
              setConfirmSubmit(false);
            },
          });
        }}
      />
    </div>
  );
}
