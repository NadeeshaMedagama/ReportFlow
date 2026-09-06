'use client';

import { REPORT_STATUS_LABELS, ReportStatus, Role } from '@weekly-report/shared';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { MemberWeeklyChart } from '@/components/dashboard/charts';
import { RequireRole } from '@/components/layout/require-role';
import { ReportTable } from '@/components/reports/report-table';
import { Avatar } from '@/components/ui/avatar';
import { Badge, RoleBadge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Select } from '@/components/ui/input';
import { ErrorBlock, LoadingBlock } from '@/components/ui/loading';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { StatCard } from '@/components/ui/stat-card';
import { errorMessage } from '@/lib/api-client';
import { useReports } from '@/lib/hooks/use-reports';
import { useMemberProfile } from '@/lib/hooks/use-users';

/** Team member profile (manager view): stats plus the member's full report history. */
export default function MemberProfilePage() {
  return (
    <RequireRole roles={[Role.MANAGER, Role.ADMIN]}>
      <MemberProfile />
    </RequireRole>
  );
}

function MemberProfile() {
  const { id } = useParams<{ id: string }>();
  const profile = useMemberProfile(id);
  const [status, setStatus] = useState<ReportStatus | ''>('');
  const [page, setPage] = useState(1);
  const reports = useReports({ memberId: id, status, page, limit: 10 });

  if (profile.isLoading) return <LoadingBlock />;
  if (profile.isError) return <ErrorBlock message={errorMessage(profile.error)} onRetry={() => profile.refetch()} />;
  if (!profile.data) return null;
  const { user, stats, weekly } = profile.data;

  return (
    <div>
      <PageHeader
        backHref="/team"
        backLabel="Team"
        title={
          <span className="flex items-center gap-3">
            <Avatar name={user.name} size="lg" />
            <span>
              {user.name}
              <span className="block text-base font-normal text-slate-500">{user.jobTitle ?? 'Team member'} · {user.email}</span>
            </span>
          </span>
        }
        meta={
          <>
            <RoleBadge role={user.role} />
            {!user.active && <Badge tone="rose">Deactivated</Badge>}
            {user.projects.map((p) => <Badge key={p.id}>{p.name}</Badge>)}
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <StatCard label="Reports" value={stats.totalReports} hint={`${stats.byStatus.APPROVED} approved`} />
        <StatCard label="Approval rate" value={`${stats.approvalRate}%`} hint="of submitted reports" accent="emerald" />
        <StatCard label="On-time rate" value={`${stats.onTimeRate}%`} hint="first submission before deadline" accent="blue" />
        <StatCard label="Avg hours / week" value={stats.avgHoursPerWeek} hint={`${stats.totalHours} h in total`} accent="indigo" />
        <StatCard label="Tasks completed" value={stats.tasksCompleted} />
        <StatCard label="Correction cycles" value={stats.correctionCycles} hint={`${stats.byStatus.NEEDS_CORRECTION} open now`} accent="amber" />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Hours per week" description="Last 8 weeks, coloured by report status" className="xl:col-span-2">
          <MemberWeeklyChart weekly={weekly} />
        </Card>
        <Card title="Status breakdown">
          <ul className="space-y-2">
            {Object.values(ReportStatus).map((s) => (
              <li key={s} className="flex items-center justify-between text-sm">
                <span className="text-slate-600">{REPORT_STATUS_LABELS[s]}</span>
                <span className="font-semibold tabular-nums text-slate-900">{stats.byStatus[s]}</span>
              </li>
            ))}
            <li className="flex items-center justify-between border-t border-slate-100 pt-2 text-sm">
              <span className="text-slate-600">Open blockers</span>
              <span className="font-semibold tabular-nums text-slate-900">{stats.openBlockers}</span>
            </li>
          </ul>
        </Card>
      </div>

      <Card
        title="Report history"
        className="mt-6"
        flush
        actions={
          <Select value={status} onChange={(e) => { setStatus(e.target.value as ReportStatus | ''); setPage(1); }} className="w-44" aria-label="Filter by status">
            <option value="">All statuses</option>
            {Object.values(ReportStatus).map((s) => <option key={s} value={s}>{REPORT_STATUS_LABELS[s]}</option>)}
          </Select>
        }
      >
        {reports.isLoading ? (
          <LoadingBlock />
        ) : reports.isError ? (
          <div className="p-5"><ErrorBlock message={errorMessage(reports.error)} /></div>
        ) : reports.data && reports.data.items.length === 0 ? (
          <div className="p-5"><EmptyState title="No reports" /></div>
        ) : (
          reports.data && (
            <>
              <ReportTable
                reports={reports.data.items}
                actions={(report) =>
                  report.permissions.canReview ? (
                    <Link href={`/review/${report.id}`} className="text-sm font-medium text-brand-600 hover:underline">Review</Link>
                  ) : report.permissions.canView ? (
                    <Link href={`/reports/${report.id}`} className="text-sm font-medium text-slate-600 hover:underline">View</Link>
                  ) : (
                    <span className="text-xs text-slate-400">Draft (private)</span>
                  )
                }
              />
              <Pagination page={reports.data.page} totalPages={reports.data.totalPages} total={reports.data.total} limit={reports.data.limit} onChange={setPage} />
            </>
          )
        )}
      </Card>
    </div>
  );
}
