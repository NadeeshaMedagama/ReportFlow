'use client';

import { ReportStatus, ReviewDecision, Role } from '@weekly-report/shared';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { RequireRole } from '@/components/layout/require-role';
import { ReportView, toContent } from '@/components/reports/report-view';
import { ReviewTimeline } from '@/components/reports/review-timeline';
import { VersionHistory } from '@/components/reports/version-history';
import { Alert } from '@/components/ui/alert';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button, LinkButton } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field, Textarea } from '@/components/ui/input';
import { ErrorBlock, LoadingBlock } from '@/components/ui/loading';
import { PageHeader } from '@/components/ui/page-header';
import { errorMessage } from '@/lib/api-client';
import { formatDateTime, formatWeek } from '@/lib/format';
import { useReport, useReportMutations } from '@/lib/hooks/use-reports';
import { cn } from '@/lib/utils';

/** Manager review page: read the submitted version and approve or request changes. */
export default function ReviewPage() {
  return (
    <RequireRole roles={[Role.MANAGER, Role.ADMIN]}>
      <Review />
    </RequireRole>
  );
}

function Review() {
  const { id } = useParams<{ id: string }>();
  const report = useReport(id);
  const { review } = useReportMutations();
  const [decision, setDecision] = useState<ReviewDecision>(ReviewDecision.APPROVE);
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<ReviewDecision | null>(null);

  if (report.isLoading) return <LoadingBlock />;
  if (report.isError) return <ErrorBlock message={errorMessage(report.error)} onRetry={() => report.refetch()} />;
  if (!report.data) return null;
  const data = report.data;
  const reviewable = data.status === ReportStatus.SUBMITTED;
  const needsComment = decision === ReviewDecision.REQUEST_CHANGES;

  function submitDecision(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (needsComment && comment.trim().length < 5) {
      setError('Describe what needs to change (at least 5 characters).');
      return;
    }
    review.mutate(
      { id, decision, comment: comment.trim() || undefined },
      {
        onSuccess: () => {
          setDone(decision);
          setComment('');
        },
        onError: (e) => setError(errorMessage(e)),
      },
    );
  }

  return (
    <div>
      <PageHeader
        title={`Review: ${data.user.name}`}
        description={`Week of ${formatWeek(data.weekStart.slice(0, 10))} · ${data.project?.name ?? ''}`}
        backHref="/team-reports"
        backLabel="Team reports"
        meta={
          <>
            <StatusBadge status={data.status} />
            {data.currentVersion > 0 && <Badge tone="indigo">Version {data.currentVersion}</Badge>}
            {data.submittedAt && <span className="text-xs text-slate-500">Submitted {formatDateTime(data.submittedAt)}</span>}
            <Link href={`/team/${data.user.id}`} className="text-xs text-brand-600 hover:underline">View profile</Link>
          </>
        }
      />

      {done && (
        <Alert tone={done === ReviewDecision.APPROVE ? 'success' : 'warning'} className="mb-6" actions={<LinkButton href="/team-reports" size="sm" variant="secondary">Back to team reports</LinkButton>}>
          {done === ReviewDecision.APPROVE ? 'Report approved.' : 'Report sent back for correction. The team member can now edit and resubmit it.'}
        </Alert>
      )}
      {!reviewable && !done && (
        <Alert tone="info" className="mb-6">
          This report is not awaiting review (status: {data.status.toLowerCase().replace('_', ' ')}). You can still read it and its history below.
        </Alert>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="min-w-0">
          <Card title={`Version ${data.currentVersion} - content under review`}>
            <ReportView content={toContent(data)} />
          </Card>
        </div>
        <div className="space-y-6 xl:sticky xl:top-6 xl:self-start">
          {reviewable && (
            <Card title="Your decision">
              <form onSubmit={submitDecision} className="space-y-4">
                <div className="grid gap-2">
                  {[
                    { value: ReviewDecision.APPROVE, label: 'Approve', hint: 'The report is complete and accurate.' },
                    { value: ReviewDecision.REQUEST_CHANGES, label: 'Request changes', hint: 'Send it back with one general comment.' },
                  ].map((option) => (
                    <label
                      key={option.value}
                      className={cn(
                        'flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2',
                        decision === option.value ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:bg-slate-50',
                      )}
                    >
                      <input type="radio" name="decision" className="mt-1" checked={decision === option.value} onChange={() => setDecision(option.value)} />
                      <span>
                        <span className="block text-sm font-medium text-slate-900">{option.label}</span>
                        <span className="block text-xs text-slate-500">{option.hint}</span>
                      </span>
                    </label>
                  ))}
                </div>
                <Field label={needsComment ? 'What needs to change?' : 'Comment (optional)'} htmlFor="comment" required={needsComment} error={error ?? undefined}>
                  <Textarea id="comment" value={comment} onChange={(e) => setComment(e.target.value)} rows={5} placeholder={needsComment ? 'Be specific: which section, what is missing, what to fix.' : 'Nice work on...'} invalid={!!error} />
                </Field>
                <Button type="submit" className="w-full" variant={needsComment ? 'primary' : 'success'} loading={review.isPending}>
                  {needsComment ? 'Send back for correction' : 'Approve report'}
                </Button>
              </form>
            </Card>
          )}
          <Card title="Review history">
            <ReviewTimeline reviews={data.reviews} />
          </Card>
          <Card title="Version history" description="Compare with what was submitted before">
            <VersionHistory report={data} />
          </Card>
        </div>
      </div>
    </div>
  );
}
