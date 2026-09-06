import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function StatCard({ label, value, hint, accent = 'slate', children }: { label: string; value: ReactNode; hint?: ReactNode; accent?: 'slate' | 'blue' | 'amber' | 'emerald' | 'rose' | 'indigo'; children?: ReactNode }) {
  const accents = {
    slate: 'border-slate-200',
    blue: 'border-blue-200',
    amber: 'border-amber-200',
    emerald: 'border-emerald-200',
    rose: 'border-rose-200',
    indigo: 'border-indigo-200',
  };
  return (
    <div className={cn('rounded-xl border bg-white p-4 shadow-xs', accents[accent])}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      {children}
    </div>
  );
}
