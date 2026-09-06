'use client';

import { Role, type ReportInput } from '@weekly-report/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { RequireRole } from '@/components/layout/require-role';
import { ReportForm } from '@/components/reports/report-form';
import { ErrorBlock, LoadingBlock } from '@/components/ui/loading';
import { PageHeader } from '@/components/ui/page-header';
import { errorMessage } from '@/lib/api-client';
import { useProjects } from '@/lib/hooks/use-projects';
import { useReportMutations } from '@/lib/hooks/use-reports';

/** Personal weekly report page: create a new report (saved as a draft or submitted directly). */
export default function NewReportPage() {
  return (
    <RequireRole roles={[Role.TEAM_MEMBER]}>
      <NewReport />
    </RequireRole>
  );
}

function NewReport() {
  const router = useRouter();
  const projects = useProjects();
  const { create, submit } = useReportMutations();
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<'idle' | 'saving' | 'submitting'>('idle');

  async function saveDraft(input: ReportInput) {
    setError(null);
    setPhase('saving');
    try {
      const report = await create.mutateAsync(input);
      router.push(`/reports/${report.id}`);
    } catch (e) {
      setError(errorMessage(e));
      setPhase('idle');
    }
  }

  async function submitForReview(input: ReportInput) {
    setError(null);
    setPhase('submitting');
    try {
      const report = await create.mutateAsync(input);
      await submit.mutateAsync(report.id);
      router.push(`/reports/${report.id}`);
    } catch (e) {
      setError(errorMessage(e));
      setPhase('idle');
    }
  }

  return (
    <div>
      <PageHeader
        title="New weekly report"
        description="The structure is the same for everyone so reports stay comparable across the team."
        backHref="/my-reports"
        backLabel="My reports"
      />
      {projects.isLoading ? (
        <LoadingBlock />
      ) : projects.isError ? (
        <ErrorBlock message={errorMessage(projects.error)} onRetry={() => projects.refetch()} />
      ) : (
        <ReportForm
          mode="create"
          projects={projects.data ?? []}
          onSaveDraft={saveDraft}
          onSubmit={submitForReview}
          saving={phase === 'saving'}
          submitting={phase === 'submitting'}
          error={error}
        />
      )}
    </div>
  );
}
