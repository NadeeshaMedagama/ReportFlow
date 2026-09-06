'use client';

import type { Role } from '@weekly-report/shared';
import { LinkButton } from '@/components/ui/button';
import { homeFor, useAuth } from '@/lib/auth-context';

/** Client-side guard for role-specific pages (the API enforces the real rules). */
export function RequireRole({ roles, children }: { roles: Role[]; children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return null;
  if (!roles.includes(user.role)) {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <h1 className="text-xl font-semibold text-slate-900">You do not have access to this page</h1>
        <p className="mt-2 text-sm text-slate-500">This area is available to {roles.map((r) => r.toLowerCase().replace('_', ' ')).join(' / ')} accounts only.</p>
        <LinkButton href={homeFor(user)} className="mt-6">
          Go to your home page
        </LinkButton>
      </div>
    );
  }
  return <>{children}</>;
}
