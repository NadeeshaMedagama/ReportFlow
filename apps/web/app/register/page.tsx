'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AuthCard } from '@/components/layout/auth-card';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { errorMessage } from '@/lib/api-client';
import { homeFor, useAuth } from '@/lib/auth-context';
import { issuesToMap, registerSchema } from '@/lib/validation';

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', jobTitle: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: event.target.value }));

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    const parsed = registerSchema.safeParse(form);
    if (!parsed.success) return setErrors(issuesToMap(parsed.error));
    setErrors({});
    setSubmitting(true);
    try {
      const me = await register({
        name: parsed.data.name,
        email: parsed.data.email,
        password: parsed.data.password,
        jobTitle: parsed.data.jobTitle || undefined,
      });
      router.replace(homeFor(me));
    } catch (error) {
      setFormError(errorMessage(error));
      setSubmitting(false);
    }
  }

  return (
    <AuthCard
      title="Create your account"
      subtitle="New accounts start as team members. An admin can promote you to manager later."
      footer={
        <>
          Already registered? <Link href="/login" className="font-medium text-brand-600 hover:underline">Sign in</Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {formError && <Alert tone="danger">{formError}</Alert>}
        <Field label="Full name" htmlFor="name" error={errors.name} required>
          <Input id="name" autoComplete="name" value={form.name} onChange={set('name')} invalid={!!errors.name} />
        </Field>
        <Field label="Email" htmlFor="email" error={errors.email} required>
          <Input id="email" type="email" autoComplete="email" value={form.email} onChange={set('email')} invalid={!!errors.email} />
        </Field>
        <Field label="Job title" htmlFor="jobTitle" error={errors.jobTitle} hint="Optional, e.g. Frontend Engineer">
          <Input id="jobTitle" value={form.jobTitle} onChange={set('jobTitle')} />
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password} hint="At least 8 characters with a letter and a number" required>
          <Input id="password" type="password" autoComplete="new-password" value={form.password} onChange={set('password')} invalid={!!errors.password} />
        </Field>
        <Field label="Confirm password" htmlFor="confirmPassword" error={errors.confirmPassword} required>
          <Input id="confirmPassword" type="password" autoComplete="new-password" value={form.confirmPassword} onChange={set('confirmPassword')} invalid={!!errors.confirmPassword} />
        </Field>
        <Button type="submit" className="w-full" loading={submitting}>
          Create account
        </Button>
      </form>
    </AuthCard>
  );
}
