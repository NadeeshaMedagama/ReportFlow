'use client';

import { REPORT_STATUS_LABELS, ReportStatus, Role, type SectionKey } from '@weekly-report/shared';
import Link from 'next/link';
import { useState } from 'react';
import { SECTION_LABELS, SectionOverview } from '@/components/dashboard/section-overview';
import { SubmissionStatusTable } from '@/components/dashboard/submission-status-table';
import { RequireRole } from '@/components/layout/require-role';
import { ReportTable } from '@/components/reports/report-table';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Field, Input, Select } from '@/components/ui/input';
import { ErrorBlock, LoadingBlock } from '@/components/ui/loading';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { Tabs } from '@/components/ui/tabs';
import { WeekPicker } from '@/components/ui/week-picker';
import { errorMessage } from '@/lib/api-client';
import { addWeeks, currentWeekStart } from '@/lib/format';
import { useSectionOverview, useSubmissionStatus } from '@/lib/hooks/use-dashboard';
import { useProjects } from '@/lib/hooks/use-projects';
import { useReports } from '@/lib/hooks/use-reports';
import { useUsers } from '@/lib/hooks/use-users';

type View = 'reports' | 'status' | 'sections';
type RangeMode = 'week' | 'range';
const PAGE_SIZE = 15;

/** Team dashboard (manager view): all reports with filters, submission tracking and side-by-side sections. */
export default function TeamReportsPage() {
  return (
    <RequireRole roles={[Role.MANAGER, Role.ADMIN]}>
      <TeamReports />
    </RequireRole>
  );
}

function TeamReports() {
  const [view, setView] = useState<View>('reports');
  const [rangeMode, setRangeMode] = useState<RangeMode>('week');
  const [weekStart, setWeekStart] = useState(currentWeekStart());
  const [from, setFrom] = useState(addWeeks(currentWeekStart(), -4));
  const [to, setTo] = useState(currentWeekStart());
  const [memberId, setMemberId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [status, setStatus] = useState<ReportStatus | ''>('');
  const [section, setSection] = useState<SectionKey>('BLOCKERS');
  const [page, setPage] = useState(1);

  const members = useUsers({ role: Role.TEAM_MEMBER });
  const projects = useProjects(true);
  const reports = useReports(
    rangeMode === 'week'
      ? { page, limit: PAGE_SIZE, weekStart, memberId, projectId, status }
      : { page, limit: PAGE_SIZE, from, to, memberId, projectId, status },
    view === 'reports',
  );
  const submissionStatus = useSubmissionStatus(weekStart, view === 'status');
  const overview = useSectionOverview(section, weekStart, view === 'sections');

  const resetPage = () => setPage(1);
  const clearFilters = () => {
    setMemberId('');
    setProjectId('');
    setStatus('');
    resetPage();
  };
  const hasFilters = memberId || projectId || status;

  return (
    <div>
      <PageHeader title="Team reports" description="Every team member's reports for a week or a date range. Open any submitted report to review it." />

      <Card className="mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <p className="mb-1.5 text-sm font-medium text-slate-700">Period</p>
            <Tabs items={[{ value: 'week', label: 'Single week' }, { value: 'range', label: 'Date range' }]} value={rangeMode} onChange={(m) => { setRangeMode(m); resetPage(); }} />
          </div>
          {rangeMode === 'week' ? (
            <WeekPicker value={weekStart} onChange={(w) => { setWeekStart(w); resetPage(); }} />
          ) : (
            <div className="flex flex-wrap items-end gap-3">
              <Field label="From (week start)" htmlFor="from"><Input id="from" type="date" value={from} onChange={(e) => { setFrom(e.target.value); resetPage(); }} className="w-auto" /></Field>
              <Field label="To (week start)" htmlFor="to"><Input id="to" type="date" value={to} onChange={(e) => { setTo(e.target.value); resetPage(); }} className="w-auto" /></Field>
            </div>
          )}
        </div>
        {view === 'reports' && (
          <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-slate-100 pt-4">
            <Field label="Team member" htmlFor="member">
              <Select id="member" value={memberId} onChange={(e) => { setMemberId(e.target.value); resetPage(); }} className="w-48">
                <option value="">All members</option>
                {members.data?.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </Select>
            </Field>
            <Field label="Project / category" htmlFor="project">
              <Select id="project" value={projectId} onChange={(e) => { setProjectId(e.target.value); resetPage(); }} className="w-52">
                <option value="">All projects</option>
                {projects.data?.map((p) => <option key={p.id} value={p.id}>{p.name}{!p.active ? ' (archived)' : ''}</option>)}
              </Select>
            </Field>
            <Field label="Status" htmlFor="status">
              <Select id="status" value={status} onChange={(e) => { setStatus(e.target.value as ReportStatus | ''); resetPage(); }} className="w-44">
                <option value="">All statuses</option>
                {Object.values(ReportStatus).map((s) => <option key={s} value={s}>{REPORT_STATUS_LABELS[s]}</option>)}
              </Select>
            </Field>
            {hasFilters && <Button variant="ghost" size="sm" onClick={clearFilters}>Clear filters</Button>}
          </div>
        )}
      </Card>

      <div className="mb-4">
        <Tabs
          items={[
            { value: 'reports', label: 'Reports', count: reports.data?.total },
            { value: 'status', label: 'Submission status' },
            { value: 'sections', label: 'Side by side' },
          ]}
          value={view}
          onChange={setView}
        />
      </div>

      {view === 'reports' && (
        <Card flush>
          {reports.isLoading ? (
            <LoadingBlock />
          ) : reports.isError ? (
            <div className="p-5"><ErrorBlock message={errorMessage(reports.error)} onRetry={() => reports.refetch()} /></div>
          ) : reports.data && reports.data.items.length === 0 ? (
            <div className="p-5"><EmptyState icon="🗂️" title="No reports match" description="Try another week, range or filter." /></div>
          ) : (
            reports.data && (
              <>
                <ReportTable
                  reports={reports.data.items}
                  showMember
                  actions={(report) =>
                    report.permissions.canReview ? (
                      <Link href={`/review/${report.id}`} className="text-sm font-medium text-brand-600 hover:underline">Review</Link>
                    ) : report.permissions.canView ? (
                      <Link href={`/reports/${report.id}`} className="text-sm font-medium text-slate-600 hover:underline">View</Link>
                    ) : (
                      <span className="text-xs text-slate-400" title="Drafts are private to their author">Draft (private)</span>
                    )
                  }
                />
                <Pagination page={reports.data.page} totalPages={reports.data.totalPages} total={reports.data.total} limit={reports.data.limit} onChange={setPage} />
              </>
            )
          )}
        </Card>
      )}

      {view === 'status' && (
        <Card title="Submission status per team member" description={rangeMode === 'range' ? 'Tracking is per week - showing the selected week start.' : submissionStatus.data ? `Week of ${submissionStatus.data.week.label}` : undefined} flush>
          {submissionStatus.isLoading ? <LoadingBlock /> : submissionStatus.isError ? <div className="p-5"><ErrorBlock message={errorMessage(submissionStatus.error)} /></div> : submissionStatus.data && <SubmissionStatusTable rows={submissionStatus.data.rows} />}
        </Card>
      )}

      {view === 'sections' && (
        <div>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <Field label="Section" htmlFor="section">
              <Select id="section" value={section} onChange={(e) => setSection(e.target.value as SectionKey)} className="w-60">
                {(Object.keys(SECTION_LABELS) as SectionKey[]).map((key) => <option key={key} value={key}>{SECTION_LABELS[key]}</option>)}
              </Select>
            </Field>
            {overview.data && <p className="pt-5 text-sm text-slate-500">Week of {overview.data.week.label} · {overview.data.entries.length} submitted report{overview.data.entries.length === 1 ? '' : 's'}</p>}
          </div>
          {overview.isLoading ? <LoadingBlock /> : overview.isError ? <ErrorBlock message={errorMessage(overview.error)} /> : overview.data && <SectionOverview section={section} entries={overview.data.entries} />}
        </div>
      )}
    </div>
  );
}
