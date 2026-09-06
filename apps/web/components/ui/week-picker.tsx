'use client';

import { addWeeks, currentWeekStart, formatWeek, mondayOf } from '@/lib/format';
import { Button } from './button';
import { Input } from './input';

/** Select a Monday. Any date typed in snaps to the Monday of its week. */
export function WeekPicker({ value, onChange, allowFuture = false }: { value: string; onChange: (weekStart: string) => void; allowFuture?: boolean }) {
  const thisWeek = currentWeekStart();
  const atCurrent = value >= thisWeek;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="secondary" size="sm" onClick={() => onChange(addWeeks(value, -1))} aria-label="Previous week">
        &larr;
      </Button>
      <Input
        type="date"
        className="w-auto"
        value={value}
        max={allowFuture ? undefined : thisWeek}
        onChange={(event) => {
          if (!event.target.value) return;
          const [y, m, d] = event.target.value.split('-').map(Number);
          onChange(mondayOf(new Date(y, m - 1, d)));
        }}
      />
      <Button variant="secondary" size="sm" onClick={() => onChange(addWeeks(value, 1))} disabled={!allowFuture && atCurrent} aria-label="Next week">
        &rarr;
      </Button>
      <span className="text-sm text-slate-600">{formatWeek(value)}</span>
      {value !== thisWeek && (
        <Button variant="ghost" size="sm" onClick={() => onChange(thisWeek)}>
          This week
        </Button>
      )}
    </div>
  );
}
