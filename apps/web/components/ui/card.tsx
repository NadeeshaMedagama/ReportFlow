import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface CardProps {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  /** Remove body padding (for tables). */
  flush?: boolean;
}

export function Card({ title, description, actions, children, className, bodyClassName, flush }: CardProps) {
  return (
    <section className={cn('min-w-0 rounded-xl border border-slate-200 bg-white shadow-xs', className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            {title && <h2 className="text-base font-semibold text-slate-900">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn(!flush && 'p-5', bodyClassName)}>{children}</div>
    </section>
  );
}
