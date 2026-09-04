import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Tone = 'info' | 'success' | 'warning' | 'danger';

const tones: Record<Tone, string> = {
  info: 'border-blue-200 bg-blue-50 text-blue-900',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  warning: 'border-amber-300 bg-amber-50 text-amber-900',
  danger: 'border-rose-200 bg-rose-50 text-rose-900',
};

export function Alert({ tone = 'info', title, children, className, actions }: { tone?: Tone; title?: ReactNode; children?: ReactNode; className?: string; actions?: ReactNode }) {
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cn('rounded-xl border px-4 py-3 text-sm', tones[tone], className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {title && <p className="font-semibold">{title}</p>}
          {children && <div className={cn(title ? 'mt-1' : undefined)}>{children}</div>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
