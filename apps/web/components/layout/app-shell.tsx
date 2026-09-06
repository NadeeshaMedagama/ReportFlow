'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ChatWidget } from '@/components/assistant/chat-widget';
import { Avatar } from '@/components/ui/avatar';
import { RoleBadge } from '@/components/ui/badge';
import { FullPageLoading } from '@/components/ui/loading';
import { isManager, useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';
import { navFor } from './nav';

/**
 * Authenticated application frame: sidebar (collapsible on mobile), top bar
 * and content area. Redirects anonymous visitors to the login page.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, status, sessionEnd, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Anonymous visitors go to the login page. After an explicit sign-out we
  // drop the `next` parameter so the user is not bounced straight back.
  useEffect(() => {
    if (status !== 'anonymous') return;
    router.replace(sessionEnd === 'logout' ? '/login' : `/login?next=${encodeURIComponent(pathname)}`);
  }, [status, sessionEnd, router, pathname]);

  // Close the mobile drawer on navigation.
  useEffect(() => setOpen(false), [pathname]);

  if (status !== 'authenticated' || !user) return <FullPageLoading />;

  const items = navFor(user);
  const isActive = (href: string) => (href === '/my-reports' ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-5 py-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">RF</span>
        <div>
          <p className="text-sm font-semibold text-white">ReportFlow</p>
          <p className="text-[11px] text-slate-400">Weekly reports</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 px-3" aria-label="Main">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              isActive(item.href) ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white',
            )}
            aria-current={isActive(item.href) ? 'page' : undefined}
          >
            <span aria-hidden className="text-base">
              {item.icon}
            </span>
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="border-t border-white/10 p-4">
        <div className="flex items-center gap-3">
          <Avatar name={user.name} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{user.name}</p>
            <p className="truncate text-xs text-slate-400">{user.email}</p>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <RoleBadge role={user.role} />
          <button type="button" onClick={logout} className="text-xs font-medium text-slate-300 hover:text-white">
            Sign out
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 lg:flex">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 bg-slate-900 lg:fixed lg:inset-y-0 lg:block">{sidebar}</aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/60" onClick={() => setOpen(false)} aria-hidden />
          <aside className="absolute inset-y-0 left-0 w-72 bg-slate-900 shadow-xl">{sidebar}</aside>
        </div>
      )}

      <div className="flex min-h-screen flex-1 flex-col lg:pl-64">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur lg:hidden">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
            aria-label="Open navigation"
          >
            <span aria-hidden className="text-lg">&#9776;</span>
          </button>
          <span className="text-sm font-semibold text-slate-900">ReportFlow</span>
        </header>
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>

      {isManager(user) && <ChatWidget />}
    </div>
  );
}
