import { cn } from '@/lib/utils';

export interface TabItem<T extends string> {
  value: T;
  label: string;
  count?: number;
}

export function Tabs<T extends string>({ items, value, onChange }: { items: TabItem<T>[]; value: T; onChange: (value: T) => void }) {
  return (
    <div role="tablist" className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1">
      {items.map((item) => (
        <button
          key={item.value}
          role="tab"
          type="button"
          aria-selected={item.value === value}
          onClick={() => onChange(item.value)}
          className={cn(
            'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            item.value === value ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900',
          )}
        >
          {item.label}
          {item.count !== undefined && <span className="ml-1.5 text-xs text-slate-400">{item.count}</span>}
        </button>
      ))}
    </div>
  );
}
