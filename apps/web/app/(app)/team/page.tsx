'use client';

import { Role } from '@weekly-report/shared';
import Link from 'next/link';
import { RequireRole } from '@/components/layout/require-role';
import { Avatar } from '@/components/ui/avatar';
import { Badge, RoleBadge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorBlock, LoadingBlock } from '@/components/ui/loading';
import { PageHeader } from '@/components/ui/page-header';
import { errorMessage } from '@/lib/api-client';
import { useUsers } from '@/lib/hooks/use-users';

/** Team directory (manager view). Click a member for their full history and stats. */
export default function TeamPage() {
  return (
    <RequireRole roles={[Role.MANAGER, Role.ADMIN]}>
      <Team />
    </RequireRole>
  );
}

function Team() {
  const users = useUsers();
  if (users.isLoading) return <LoadingBlock />;
  if (users.isError) return <ErrorBlock message={errorMessage(users.error)} onRetry={() => users.refetch()} />;
  const members = users.data?.filter((u) => u.role === Role.TEAM_MEMBER) ?? [];
  const managers = users.data?.filter((u) => u.role !== Role.TEAM_MEMBER) ?? [];

  return (
    <div>
      <PageHeader title="Team" description={`${members.length} team members · ${managers.length} managers and admins`} />
      {members.length === 0 ? (
        <EmptyState icon="👥" title="No team members yet" description="Team members appear here once they register." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {members.map((member) => (
            <Link key={member.id} href={`/team/${member.id}`} className="group rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition hover:border-brand-300 hover:shadow-md">
              <div className="flex items-center gap-3">
                <Avatar name={member.name} />
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900 group-hover:text-brand-600">{member.name}</p>
                  <p className="truncate text-sm text-slate-500">{member.jobTitle ?? 'Team member'}</p>
                </div>
              </div>
              <p className="mt-3 truncate text-xs text-slate-500">{member.email}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {member.projects.length === 0 ? <span className="text-xs text-slate-400">No project assignments</span> : member.projects.map((p) => <Badge key={p.id}>{p.name}</Badge>)}
              </div>
              <p className="mt-3 text-xs text-slate-500">{member.reportCount} report{member.reportCount === 1 ? '' : 's'}</p>
            </Link>
          ))}
        </div>
      )}

      {managers.length > 0 && (
        <Card title="Managers and admins" className="mt-8">
          <ul className="divide-y divide-slate-100">
            {managers.map((user) => (
              <li key={user.id} className="flex items-center gap-3 py-3">
                <Avatar name={user.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900">{user.name}</p>
                  <p className="text-xs text-slate-500">{user.jobTitle ? `${user.jobTitle} · ` : ''}{user.email}</p>
                </div>
                <RoleBadge role={user.role} />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
