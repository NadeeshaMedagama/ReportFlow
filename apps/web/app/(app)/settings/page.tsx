'use client';

import { ROLE_LABELS } from '@weekly-report/shared';
import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { RoleBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { authApi } from '@/lib/api/auth';
import { errorMessage } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { formatDate } from '@/lib/format';
import { changePasswordSchema, issuesToMap } from '@/lib/validation';

/** Account settings: profile details and password. */
export default function SettingsPage() {
  const { user, setUser } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [jobTitle, setJobTitle] = useState(user?.jobTitle ?? '');
  const [profileState, setProfileState] = useState<{ saving: boolean; message?: string; error?: string }>({ saving: false });

  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});
  const [passwordState, setPasswordState] = useState<{ saving: boolean; message?: string; error?: string }>({ saving: false });

  if (!user) return null;

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    if (name.trim().length < 2) return setProfileState({ saving: false, error: 'Name must be at least 2 characters' });
    setProfileState({ saving: true });
    try {
      const updated = await authApi.updateProfile({ name: name.trim(), jobTitle: jobTitle.trim() });
      setUser(updated);
      setProfileState({ saving: false, message: 'Profile updated.' });
    } catch (e) {
      setProfileState({ saving: false, error: errorMessage(e) });
    }
  }

  async function savePassword(event: React.FormEvent) {
    event.preventDefault();
    const parsed = changePasswordSchema.safeParse(passwords);
    if (!parsed.success) return setPasswordErrors(issuesToMap(parsed.error));
    setPasswordErrors({});
    setPasswordState({ saving: true });
    try {
      await authApi.changePassword({ currentPassword: parsed.data.currentPassword, newPassword: parsed.data.newPassword });
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPasswordState({ saving: false, message: 'Password changed.' });
    } catch (e) {
      setPasswordState({ saving: false, error: errorMessage(e) });
    }
  }

  return (
    <div>
      <PageHeader title="Account settings" description="Manage your profile and password." />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Profile">
            <form onSubmit={saveProfile} className="space-y-4" noValidate>
              {profileState.message && <Alert tone="success">{profileState.message}</Alert>}
              {profileState.error && <Alert tone="danger">{profileState.error}</Alert>}
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Full name" htmlFor="name" required>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
                </Field>
                <Field label="Job title" htmlFor="jobTitle">
                  <Input id="jobTitle" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="e.g. Backend Engineer" />
                </Field>
              </div>
              <div className="flex justify-end">
                <Button type="submit" loading={profileState.saving}>Save profile</Button>
              </div>
            </form>
          </Card>

          <Card title="Change password">
            <form onSubmit={savePassword} className="space-y-4" noValidate>
              {passwordState.message && <Alert tone="success">{passwordState.message}</Alert>}
              {passwordState.error && <Alert tone="danger">{passwordState.error}</Alert>}
              <Field label="Current password" htmlFor="currentPassword" error={passwordErrors.currentPassword} required>
                <Input id="currentPassword" type="password" autoComplete="current-password" value={passwords.currentPassword} onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })} invalid={!!passwordErrors.currentPassword} />
              </Field>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="New password" htmlFor="newPassword" error={passwordErrors.newPassword} hint="At least 8 characters with a letter and a number" required>
                  <Input id="newPassword" type="password" autoComplete="new-password" value={passwords.newPassword} onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })} invalid={!!passwordErrors.newPassword} />
                </Field>
                <Field label="Confirm new password" htmlFor="confirmPassword" error={passwordErrors.confirmPassword} required>
                  <Input id="confirmPassword" type="password" autoComplete="new-password" value={passwords.confirmPassword} onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })} invalid={!!passwordErrors.confirmPassword} />
                </Field>
              </div>
              <div className="flex justify-end">
                <Button type="submit" loading={passwordState.saving}>Change password</Button>
              </div>
            </form>
          </Card>
        </div>

        <Card title="Account">
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Email</dt>
              <dd className="mt-0.5 text-slate-900">{user.email}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Role</dt>
              <dd className="mt-1"><RoleBadge role={user.role} /></dd>
              <dd className="mt-1 text-xs text-slate-500">
                {user.role === 'TEAM_MEMBER' ? 'Ask an admin if you need manager access.' : `${ROLE_LABELS[user.role]}s can review reports and see team analytics.`}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Member since</dt>
              <dd className="mt-0.5 text-slate-900">{formatDate(user.createdAt)}</dd>
            </div>
          </dl>
        </Card>
      </div>
    </div>
  );
}
