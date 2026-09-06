'use client';

import { ReportStatus, Role, type ReportInput } from '@weekly-report/shared';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { RequireRole } from '@/components/layout/require-role';
import { ReportForm } from '@/components/reports/report-form';
import { Alert } from '@/components/ui/alert';
import { LinkButton } from '@/components/ui/button';
import { ErrorBlock, LoadingBlock } from '@/components/ui/loading';
import { ConfirmDialog } from '@/components/ui/modal';
import { PageHeader } from '@/components/ui/page-header';
import { errorMessage } from '@/lib/api-client';
import { formatDateTime, formatWeek } from '@/lib/format';
import { useProjects } from '@/lib/hooks/use-projects';
import { useReport, useReportMutations } from '@/lib/hooks/use-reports';

/** Edit an existing report while it is a draft or needs correction. */
export default function EditReportPage() {
  return (
    <RequireRole roles={[Role.TEAM_MEMBER]}>
      <EditReport />
    </RequireRole>
  );
}

function EditReport() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const report = useReport(id);
  const projects = useProjects();
  const { update, submit, remove } = useReportMutations();
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<'idle' | 'saving' | 'submitting'>('idle');
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (report.isLoading || projects.isLoading) return <LoadingBlock />;
  if (report.isError) return <ErrorBlock message={errorMessage(report.error)} onRetry={() => report.refetch()} />;
  if (!report.data) return null;
  const data = report.data;

  if (!data.permissions.canEdit) {
    return (
      <div>
        <PageHeader title={`Week of ${formatWeek(data.weekStart.slice(0, 10))}`} backHref="/my-reports" backLabel="My reports" />
        <Alert tone="info" title="This report can no longer be edited">
          Reports can only be changed while they are drafts or after a manager has requested corrections. Its current status is {data.status.toLowerCase().replace('_', ' ')}.
        </Alert>
        <LinkButton href={`/reports/${data.id}`} variant="secondary" className="mt-4">View report</LinkButton>
      </div>
    );
  }

  const latestReview = data.reviews[0];

  async function saveDraft(input: ReportInput) {
    setError(null);
    setPhase('saving');
    try {
      await update.mutateAsync({ id, input });
      router.push(`/reports/${id}`);
    } catch (e) {
      setError(errorMessage(e));
      setPhase('idle');
    }
  }

  async function submitForReview(input: ReportInput) {
    setError(null);
    setPhase('submitting');
    try {
      await update.mutateAsync({ id, input });
      await submit.mutateAsync(id);
      router.push(`/reports/${id}`);
    } catch (e) {
      setError(errorMessage(e));
      setPhase('idle');
    }
  }

  return (
    <div>
      <PageHeader
        title={`Edit report - week of ${formatWeek(data.weekStart.slice(0, 10))}`}
        description={data.status === ReportStatus.NEEDS_CORRECTION ? 'Address the manager\'s comment below, then resubmit for another review.' : 'Save as a draft as often as you like, then submit when ready.'}
        backHref={`/reports/${id}`}
        backLabel="Report"
      />

      {data.status === ReportStatus.NEEDS_CORRECTION && data.latestReviewComment && (
        <Alert tone="warning" title="Your manager requested changes" className="mb-6">
          <p className="whitespace-pre-line">{data.latestReviewComment}</p>
          {latestReview && (
            <p className="mt-2 text-xs text-amber-800">
              {latestReview.reviewer.name} · {formatDateTime(latestReview.createdAt)}
              {latestReview.version && ` · on version ${latestReview.version.versionNumber}`}
            </p>
          )}
        </Alert>
      )}

      <ReportForm
        mode="edit"
        initial={data}
        projects={projects.data ?? []}
        weekLocked={data.currentVersion > 0}
        onSaveDraft={saveDraft}
        onSubmit={submitForReview}
        onDelete={data.permissions.canDelete ? () => setConfirmDelete(true) : undefined}
        saving={phase === 'saving'}
        submitting={phase === 'submitting'}
        error={error}
      />

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this draft?"
        description="The draft will be permanently removed."
        confirmLabel="Delete draft"
        loading={remove.isPending}
        onConfirm={() => remove.mutate(id, { onSuccess: () => router.push('/my-reports') })}
      />
    </div>
  );
}
