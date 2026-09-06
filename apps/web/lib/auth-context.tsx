'use client';

import type { PublicUser } from '@weekly-report/shared';
import { Role } from '@weekly-report/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi } from './api/auth';
import { tokenStore, UNAUTHORIZED_EVENT } from './api-client';

type AuthStatus = 'loading' | 'authenticated' | 'anonymous';
/** Why the current session ended - drives the redirect after sign-out vs. token expiry. */
type SessionEnd = 'logout' | 'expired' | null;

interface AuthContextValue {
  user: PublicUser | null;
  status: AuthStatus;
  sessionEnd: SessionEnd;
  login: (email: string, password: string) => Promise<PublicUser>;
  register: (input: { name: string; email: string; password: string; jobTitle?: string }) => Promise<PublicUser>;
  logout: () => void;
  refresh: () => Promise<void>;
  setUser: (user: PublicUser) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Where a user lands after signing in, based on their role. */
export function homeFor(user: PublicUser | null): string {
  if (!user) return '/login';
  return user.role === Role.TEAM_MEMBER ? '/my-reports' : '/dashboard';
}

export function isManager(user: PublicUser | null): boolean {
  return user?.role === Role.MANAGER || user?.role === Role.ADMIN;
}

export function isAdmin(user: PublicUser | null): boolean {
  return user?.role === Role.ADMIN;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [sessionEnd, setSessionEnd] = useState<SessionEnd>(null);
  const router = useRouter();
  const queryClient = useQueryClient();

  // Restore the session from the stored token on first load.
  useEffect(() => {
    let cancelled = false;
    if (!tokenStore.get()) {
      setStatus('anonymous');
      return;
    }
    authApi
      .me()
      .then((me) => {
        if (cancelled) return;
        setUser(me);
        setStatus('authenticated');
      })
      .catch(() => {
        if (cancelled) return;
        tokenStore.clear();
        setStatus('anonymous');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const endSession = useCallback(
    (reason: Exclude<SessionEnd, null>) => {
      tokenStore.clear();
      queryClient.clear();
      setUser(null);
      setSessionEnd(reason);
      setStatus('anonymous');
    },
    [queryClient],
  );

  const logout = useCallback(() => {
    endSession('logout');
    router.replace('/login');
  }, [endSession, router]);

  // Any 401 from the API ends the session.
  useEffect(() => {
    const onUnauthorized = () => endSession('expired');
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, [endSession]);

  const login = useCallback(async (email: string, password: string) => {
    const session = await authApi.login(email, password);
    tokenStore.set(session.accessToken);
    setUser(session.user);
    setSessionEnd(null);
    setStatus('authenticated');
    return session.user;
  }, []);

  const register = useCallback(async (input: { name: string; email: string; password: string; jobTitle?: string }) => {
    const session = await authApi.register(input);
    tokenStore.set(session.accessToken);
    setUser(session.user);
    setSessionEnd(null);
    setStatus('authenticated');
    return session.user;
  }, []);

  const refresh = useCallback(async () => {
    const me = await authApi.me();
    setUser(me);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, status, sessionEnd, login, register, logout, refresh, setUser }),
    [user, status, sessionEnd, login, register, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
