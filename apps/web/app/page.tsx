'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { FullPageLoading } from '@/components/ui/loading';
import { homeFor, useAuth } from '@/lib/auth-context';

/** Entry point: send the visitor to login or to their role's home page. */
export default function IndexPage() {
  const { user, status } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (status === 'loading') return;
    router.replace(status === 'authenticated' ? homeFor(user) : '/login');
  }, [status, user, router]);
  return <FullPageLoading />;
}
