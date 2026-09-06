'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { AuthCard } from '@/components/layout/auth-card';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { FullPageLoading } from '@/components/ui/loading';
import { errorMessage } from '@/lib/api-client';
import { homeFor, useAuth } from '@/lib/auth-context';
import { issuesToMap, loginSchema } from '@/lib/validation';

const DEMO_ACCOUNTS = [
  { label: 'Manager', email: 'manager@reportflow.dev' },
  { label: 'Admin', email: 'admin@reportflow.dev' },
  { label: 'Team member', email: 'ava@reportflow.dev' },
  { label: 'Team member', email: 'noah@reportflow.dev' },
];
const DEMO_PASSWORD = 'Password123!';

export default function LoginPage() {
  return (
    <Suspense fallback={<FullPageLoading />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const { login, status, user } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Already signed in: skip the form.
  useEffect(() => {
    if (status === 'authenticated' && user) router.replace(next || homeFor(user));
  }, [status, user, router, next]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) return setErrors(issuesToMap(parsed.error));
    setErrors({});
    setSubmitting(true);
    try {
      const me = await login(parsed.data.email, parsed.data.password);
      router.replace(next || homeFor(me));
    } catch (error) {
      setFormError(errorMessage(error));
      setSubmitting(false);
    }
  }

  return (
    <AuthCard
      title="Sign in"
      subtitle="Submit your weekly report or review your team's work."
      footer={
        <>
          No account yet? <Link href="/register" className="font-medium text-brand-600 hover:underline">Create one</Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {formError && <Alert tone="danger">{formError}</Alert>}
        <Field label="Email" htmlFor="email" error={errors.email} required>
          <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} invalid={!!errors.email} />
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password} required>
          <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} invalid={!!errors.password} />
        </Field>
        <Button type="submit" className="w-full" loading={submitting}>
          Sign in
        </Button>
      </form>

      <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Demo accounts</p>
        <p className="mt-1 text-xs text-slate-500">
          Password for every demo account: <code className="rounded bg-white px-1 py-0.5">{DEMO_PASSWORD}</code>
        </p>
        <ul className="mt-2 space-y-1">
          {DEMO_ACCOUNTS.map((account) => (
            <li key={account.email} className="flex items-center justify-between gap-2 text-xs">
              <span className="text-slate-600">
                <span className="font-medium text-slate-800">{account.label}</span> - {account.email}
              </span>
              <button
                type="button"
                className="font-medium text-brand-600 hover:underline"
                onClick={() => {
                  setEmail(account.email);
                  setPassword(DEMO_PASSWORD);
                  setErrors({});
                }}
              >
                Use
              </button>
            </li>
          ))}
        </ul>
      </div>
    </AuthCard>
  );
}
