'use client';

import { ROLE_LABELS, Role } from '@weekly-report/shared';
import { useState } from 'react';
import { RequireRole } from '@/components/layout/require-role';
import { Alert } from '@/components/ui/alert';
import { Avatar } from '@/components/ui/avatar';
import { Badge, RoleBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox, Field, Input, Select } from '@/components/ui/input';
import { ErrorBlock, LoadingBlock } from '@/components/ui/loading';
import { ConfirmDialog } from '@/components/ui/modal';
import { PageHeader } from '@/components/ui/page-header';
import { Table, TBody, Td, Th, THead, Tr } from '@/components/ui/table';
import { errorMessage } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { formatDate } from '@/lib/format';
import { useUserMutations, useUsers } from '@/lib/hooks/use-users';
import { inviteUserSchema, issuesToMap } from '@/lib/validation';

/** User management (admin): invite users, assign roles, deactivate / reactivate accounts. */
export default function UsersPage() {
  return (
    <RequireRole roles={[Role.ADMIN]}>
      <Users />
    </RequireRole>
  );
}

function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < 10; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return `${out}1a`;
}

const emptyInvite = { name: '', email: '', jobTitle: '', role: Role.TEAM_MEMBER as Role, password: '' };

function Users() {
  const { user: me } = useAuth();
  const [includeInactive, setIncludeInactive] = useState(false);
  const [search, setSearch] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invite, setInvite] = useState(emptyInvite);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [toDeactivate, setToDeactivate] = useState<{ id: string; name: string } | null>(null);

  const users = useUsers({ includeInactive, search: search.trim() || undefined });
  const { create, update, deactivate } = useUserMutations();

  async function submitInvite(event: React.FormEvent) {
    event.preventDefault();
    const parsed = inviteUserSchema.safeParse(invite);
    if (!parsed.success) return setErrors(issuesToMap(parsed.error));
    setErrors({});
    setFormError(null);
    try {
      const created = await create.mutateAsync({ ...parsed.data, jobTitle: parsed.data.jobTitle || undefined });
      setNotice(`${created.name} was added as ${ROLE_LABELS[created.role].toLowerCase()}. Share the temporary password with them: ${parsed.data.password}`);
      setInvite(emptyInvite);
      setInviteOpen(false);
    } catch (e) {
      setFormError(errorMessage(e));
    }
  }

  function changeRole(id: string, role: Role) {
    setActionError(null);
    update.mutate({ id, input: { role } }, { onError: (e) => setActionError(errorMessage(e)) });
  }

  return (
    <div>
      <PageHeader
        title="User management"
        description="Invite team members, assign roles and deactivate accounts. Deactivated users keep their report history but can no longer sign in."
        actions={<Button onClick={() => setInviteOpen((v) => !v)}>{inviteOpen ? 'Close' : '+ Invite user'}</Button>}
      />

      {notice && <Alert tone="success" className="mb-4" actions={<Button variant="ghost" size="sm" onClick={() => setNotice(null)}>Dismiss</Button>}>{notice}</Alert>}
      {actionError && <Alert tone="danger" className="mb-4">{actionError}</Alert>}

      {inviteOpen && (
        <Card title="Invite a user" description="Creates the account immediately with a temporary password." className="mb-6">
          <form onSubmit={submitInvite} className="space-y-4" noValidate>
            {formError && <Alert tone="danger">{formError}</Alert>}
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Full name" htmlFor="inv-name" error={errors.name} required>
                <Input id="inv-name" value={invite.name} onChange={(e) => setInvite({ ...invite, name: e.target.value })} invalid={!!errors.name} />
              </Field>
              <Field label="Email" htmlFor="inv-email" error={errors.email} required>
                <Input id="inv-email" type="email" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} invalid={!!errors.email} />
              </Field>
              <Field label="Job title" htmlFor="inv-title" error={errors.jobTitle}>
                <Input id="inv-title" value={invite.jobTitle} onChange={(e) => setInvite({ ...invite, jobTitle: e.target.value })} />
              </Field>
              <Field label="Role" htmlFor="inv-role" error={errors.role} required>
                <Select id="inv-role" value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value as Role })}>
                  {Object.values(Role).map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}
                </Select>
              </Field>
              <Field label="Temporary password" htmlFor="inv-password" error={errors.password} hint="At least 8 characters with a letter and a number" required>
                <div className="flex gap-2">
                  <Input id="inv-password" value={invite.password} onChange={(e) => setInvite({ ...invite, password: e.target.value })} invalid={!!errors.password} />
                  <Button variant="secondary" onClick={() => setInvite({ ...invite, password: generatePassword() })}>Generate</Button>
                </div>
              </Field>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setInviteOpen(false)} disabled={create.isPending}>Cancel</Button>
              <Button type="submit" loading={create.isPending}>Create account</Button>
            </div>
          </form>
        </Card>
      )}

      <Card
        title="All users"
        flush
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <Input placeholder="Search name or email" value={search} onChange={(e) => setSearch(e.target.value)} className="w-56" aria-label="Search users" />
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <Checkbox checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} /> Show deactivated
            </label>
          </div>
        }
      >
        {users.isLoading ? (
          <LoadingBlock />
        ) : users.isError ? (
          <div className="p-5"><ErrorBlock message={errorMessage(users.error)} onRetry={() => users.refetch()} /></div>
        ) : (
          <Table>
            <THead>
              <tr>
                <Th>User</Th>
                <Th>Role</Th>
                <Th>Projects</Th>
                <Th className="text-right">Reports</Th>
                <Th>Joined</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </THead>
            <TBody>
              {users.data?.map((user) => {
                const isMe = user.id === me?.id;
                return (
                  <Tr key={user.id} className={!user.active ? 'opacity-60' : undefined}>
                    <Td>
                      <div className="flex items-center gap-3">
                        <Avatar name={user.name} size="sm" />
                        <div>
                          <p className="font-medium text-slate-900">{user.name}{isMe && <span className="ml-1 text-xs text-slate-400">(you)</span>}</p>
                          <p className="text-xs text-slate-500">{user.email}{user.jobTitle ? ` · ${user.jobTitle}` : ''}</p>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      {isMe ? (
                        <RoleBadge role={user.role} />
                      ) : (
                        <Select value={user.role} onChange={(e) => changeRole(user.id, e.target.value as Role)} className="w-40" aria-label={`Role of ${user.name}`} disabled={!user.active}>
                          {Object.values(Role).map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}
                        </Select>
                      )}
                    </Td>
                    <Td className="text-xs text-slate-600">{user.projects.length ? user.projects.map((p) => p.name).join(', ') : '-'}</Td>
                    <Td className="text-right tabular-nums">{user.reportCount}</Td>
                    <Td className="whitespace-nowrap text-slate-500">{formatDate(user.createdAt)}</Td>
                    <Td>{user.active ? <Badge tone="emerald">Active</Badge> : <Badge tone="rose">Deactivated</Badge>}</Td>
                    <Td className="text-right">
                      {isMe ? (
                        <span className="text-xs text-slate-400">-</span>
                      ) : user.active ? (
                        <button type="button" onClick={() => setToDeactivate({ id: user.id, name: user.name })} className="text-sm font-medium text-rose-600 hover:underline">Deactivate</button>
                      ) : (
                        <button type="button" onClick={() => update.mutate({ id: user.id, input: { active: true } })} className="text-sm font-medium text-slate-600 hover:underline">Reactivate</button>
                      )}
                    </Td>
                  </Tr>
                );
              })}
            </TBody>
          </Table>
        )}
      </Card>

      <ConfirmDialog
        open={!!toDeactivate}
        onClose={() => setToDeactivate(null)}
        title={`Deactivate ${toDeactivate?.name}?`}
        description="They will be signed out and unable to log in. Their reports and review history are kept. You can reactivate the account later."
        confirmLabel="Deactivate"
        loading={deactivate.isPending}
        onConfirm={() => {
          if (!toDeactivate) return;
          deactivate.mutate(toDeactivate.id, {
            onError: (e) => setActionError(errorMessage(e)),
            onSettled: () => setToDeactivate(null),
          });
        }}
      />
    </div>
  );
}
