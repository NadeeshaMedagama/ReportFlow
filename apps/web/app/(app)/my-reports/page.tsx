'use client';

import { REPORT_STATUS_LABELS, ReportStatus, Role, type ReportSummary } from '@weekly-report/shared';
import Link from 'next/link';
import { useState } from 'react';
import { RequireRole } from '@/components/layout/require-role';
import { ReportTable } from '@/components/reports/report-table';
import { Alert } from '@/components/ui/alert';
import { Button, LinkButton } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Select } from '@/components/ui/input';
import { ErrorBlock, LoadingBlock } from '@/components/ui/loading';
import { ConfirmDialog } from '@/components/ui/modal';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { StatCard } from '@/components/ui/stat-card';
import { errorMessage } from '@/lib/api-client';
import { useReportMutations, useReports } from '@/lib/hooks/use-reports';

const PAGE_SIZE = 10;

/** Report history page (team member): every report by week with its status. */
export default function MyReportsPage() {
  return (
    <RequireRole roles={[Role.TEAM_MEMBER]}>
      <MyReports />
    </RequireRole>
  );
}

function MyReports() {
  const [status, setStatus] = useState<ReportStatus | ''>('');
  const [page, setPage] = useState(1);
  const [toDelete, setToDelete] = useState<ReportSummary | null>(null);
  const reports = useReports({ page, limit: PAGE_SIZE, status });
  const { remove } = useReportMutations();

  // Small per-status counters for the header cards.
  const counts = {
    DRAFT: useReports({ limit: 1, status: ReportStatus.DRAFT }).data?.total ?? 0,
    SUBMITTED: useReports({ limit: 1, status: ReportStatus.SUBMITTED }).data?.total ?? 0,
    NEEDS_CORRECTION: useReports({ limit: 1, status: ReportStatus.NEEDS_CORRECTION }).data?.total ?? 0,
    APPROVED: useReports({ limit: 1, status: ReportStatus.APPROVED }).data?.total ?? 0,
  };

  return (
    <div>
      <PageHeader
        title="My weekly reports"
        description="Your report history, organised by week. Drafts and reports sent back for correction can still be edited."
        actions={<LinkButton href="/my-reports/new">+ New report</LinkButton>}
      />

      {counts.NEEDS_CORRECTION > 0 && (
        <Alert
          tone="warning"
          title={`${counts.NEEDS_CORRECTION} report${counts.NEEDS_CORRECTION > 1 ? 's need' : ' needs'} correction`}
          className="mb-6"
          actions={
            <Button size="sm" variant="secondary" onClick={() => { setStatus(ReportStatus.NEEDS_CORRECTION); setPage(1); }}>
              Show
            </Button>
          }
        >
          Your manager left a comment. Open the report, make the changes and resubmit it.
        </Alert>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Drafts" value={counts.DRAFT} accent="slate" />
        <StatCard label="Awaiting review" value={counts.SUBMITTED} accent="blue" />
        <StatCard label="Needs correction" value={counts.NEEDS_CORRECTION} accent="amber" />
        <StatCard label="Approved" value={counts.APPROVED} accent="emerald" />
      </div>

      <Card
        title="Report history"
        flush
        actions={
          <Select value={status} onChange={(e) => { setStatus(e.target.value as ReportStatus | ''); setPage(1); }} className="w-44" aria-label="Filter by status">
            <option value="">All statuses</option>
            {Object.values(ReportStatus).map((s) => (
              <option key={s} value={s}>{REPORT_STATUS_LABELS[s]}</option>
            ))}
          </Select>
        }
      >
        {reports.isLoading ? (
          <LoadingBlock />
        ) : reports.isError ? (
          <div className="p-5"><ErrorBlock message={errorMessage(reports.error)} onRetry={() => reports.refetch()} /></div>
        ) : reports.data && reports.data.items.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon="📝"
              title={status ? 'No reports with this status' : 'No reports yet'}
              description={status ? 'Try another status filter.' : 'Create your first weekly report to get started.'}
              action={!status && <LinkButton href="/my-reports/new">Create a report</LinkButton>}
            />
          </div>
        ) : (
          reports.data && (
            <>
              <ReportTable
                reports={reports.data.items}
                actions={(report) => (
                  <>
                    <Link href={`/reports/${report.id}`} className="text-sm font-medium text-brand-600 hover:underline">View</Link>
                    {report.permissions.canEdit && (
                      <Link href={`/my-reports/${report.id}/edit`} className="text-sm font-medium text-slate-600 hover:underline">Edit</Link>
                    )}
                    {report.permissions.canDelete && (
                      <button type="button" onClick={() => setToDelete(report)} className="text-sm font-medium text-rose-600 hover:underline">Delete</button>
                    )}
                  </>
                )}
              />
              <Pagination page={reports.data.page} totalPages={reports.data.totalPages} total={reports.data.total} limit={reports.data.limit} onChange={setPage} />
            </>
          )
        )}
      </Card>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title="Delete this draft?"
        description="The draft and everything you typed in it will be removed. This cannot be undone."
        confirmLabel="Delete draft"
        loading={remove.isPending}
        onConfirm={() => {
          if (!toDelete) return;
          remove.mutate(toDelete.id, { onSettled: () => setToDelete(null) });
        }}
      />
    </div>
  );
}
