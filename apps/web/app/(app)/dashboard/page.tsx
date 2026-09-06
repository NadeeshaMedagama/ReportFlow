'use client';

import { Role } from '@weekly-report/shared';
import { useState } from 'react';
import { ActivityFeed } from '@/components/dashboard/activity-feed';
import { AiSummaryCard } from '@/components/dashboard/ai-summary';
import { StatusByMemberChart, TasksTrendChart, TimeByCategoryChart, WorkloadChart } from '@/components/dashboard/charts';
import { SubmissionStatusTable } from '@/components/dashboard/submission-status-table';
import { RequireRole } from '@/components/layout/require-role';
import { LinkButton } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/input';
import { ErrorBlock, LoadingBlock } from '@/components/ui/loading';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { WeekPicker } from '@/components/ui/week-picker';
import { errorMessage } from '@/lib/api-client';
import { currentWeekStart } from '@/lib/format';
import {
  useActivity,
  useDashboardSummary,
  useStatusByMember,
  useSubmissionStatus,
  useTasksTrend,
  useTimeByCategory,
  useWorkloadByProject,
} from '@/lib/hooks/use-dashboard';

/** Manager dashboard: summary metrics, visual insights and the activity feed. */
export default function DashboardPage() {
  return (
    <RequireRole roles={[Role.MANAGER, Role.ADMIN]}>
      <Dashboard />
    </RequireRole>
  );
}

function Dashboard() {
  const [weekStart, setWeekStart] = useState(currentWeekStart());
  const [weeks, setWeeks] = useState(8);

  const summary = useDashboardSummary(weekStart);
  const submissionStatus = useSubmissionStatus(weekStart);
  const trend = useTasksTrend(weeks);
  const statusByMember = useStatusByMember(weeks);
  const workload = useWorkloadByProject(weeks);
  const timeByCategory = useTimeByCategory(weeks);
  const activity = useActivity(15);

  const s = summary.data;

  return (
    <div>
      <PageHeader
        title="Team dashboard"
        description="How the team is doing this week and over the last few weeks."
        actions={<LinkButton href="/team-reports" variant="secondary">Open team reports</LinkButton>}
      />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <WeekPicker value={weekStart} onChange={setWeekStart} />
        <label className="flex items-center gap-2 text-sm text-slate-600">
          Charts window
          <Select value={weeks} onChange={(e) => setWeeks(Number(e.target.value))} className="w-32">
            <option value={4}>4 weeks</option>
            <option value={8}>8 weeks</option>
            <option value={12}>12 weeks</option>
          </Select>
        </label>
      </div>

      {summary.isError ? (
        <ErrorBlock message={errorMessage(summary.error)} onRetry={() => summary.refetch()} />
      ) : (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Reports submitted" value={s ? `${s.submitted} / ${s.totalMembers}` : '-'} hint={s ? `${s.complianceRate}% compliance this week` : undefined} accent="indigo" />
          <StatCard label="On time / late / pending" value={s ? `${s.onTime} · ${s.late} · ${s.pending}` : '-'} hint={s ? (s.week.deadlinePassed ? 'Deadline has passed' : `Due ${new Date(s.week.deadline).toLocaleDateString()}`) : undefined} accent="blue">
            {s && s.totalMembers > 0 && (
              <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden>
                <span className="bg-emerald-500" style={{ width: `${(s.onTime / s.totalMembers) * 100}%` }} />
                <span className="bg-orange-400" style={{ width: `${(s.late / s.totalMembers) * 100}%` }} />
              </div>
            )}
          </StatCard>
          <StatCard label="Awaiting review" value={s?.awaitingReview ?? '-'} hint={s ? `${s.awaitingReviewTotal} across all weeks` : undefined} accent="blue" />
          <StatCard label="Needs correction" value={s?.needsCorrection ?? '-'} hint={s ? `${s.needsCorrectionTotal} across all weeks` : undefined} accent="amber" />
          <StatCard label="Open blockers" value={s?.openBlockers ?? '-'} hint={s ? `${s.keyBlockers} flagged as key issues` : undefined} accent="rose" />
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Tasks completed over time" description={`Last ${weeks} weeks, submitted reports only`}>
          {trend.isLoading ? <LoadingBlock /> : trend.isError ? <ErrorBlock message={errorMessage(trend.error)} /> : trend.data && <TasksTrendChart data={trend.data} />}
        </Card>
        <Card title="Report status by team member" description={`Last ${weeks} weeks`}>
          {statusByMember.isLoading ? <LoadingBlock /> : statusByMember.isError ? <ErrorBlock message={errorMessage(statusByMember.error)} /> : statusByMember.data && <StatusByMemberChart rows={statusByMember.data.rows} />}
        </Card>
        <Card title="Workload by project" description="Hours spent on tasks per project">
          {workload.isLoading ? <LoadingBlock /> : workload.isError ? <ErrorBlock message={errorMessage(workload.error)} /> : workload.data && <WorkloadChart rows={workload.data.rows} />}
        </Card>
        <Card title="Time spent by task type" description="Team-wide hours breakdown">
          {timeByCategory.isLoading ? <LoadingBlock /> : timeByCategory.isError ? <ErrorBlock message={errorMessage(timeByCategory.error)} /> : timeByCategory.data && <TimeByCategoryChart data={timeByCategory.data} />}
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card title="Submission status" description={submissionStatus.data ? `Week of ${submissionStatus.data.week.label}` : undefined} flush className="xl:col-span-2">
          {submissionStatus.isLoading ? <LoadingBlock /> : submissionStatus.isError ? <div className="p-5"><ErrorBlock message={errorMessage(submissionStatus.error)} /></div> : submissionStatus.data && <SubmissionStatusTable rows={submissionStatus.data.rows} compact />}
        </Card>
        <Card title="Recent activity" description="Submissions and review decisions">
          {activity.isLoading ? <LoadingBlock /> : activity.isError ? <ErrorBlock message={errorMessage(activity.error)} /> : activity.data && <ActivityFeed entries={activity.data} />}
        </Card>
      </div>

      <div className="mt-6">
        <AiSummaryCard weekStart={weekStart} />
      </div>
    </div>
  );
}
