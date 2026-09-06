import { Button } from './button';

export function Pagination({ page, totalPages, total, limit, onChange }: { page: number; totalPages: number; total: number; limit: number; onChange: (page: number) => void }) {
  if (total === 0) return null;
  const from = (page - 1) * limit + 1;
  const to = Math.min(total, page * limit);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-sm text-slate-600">
      <span>
        Showing {from}-{to} of {total}
      </span>
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={() => onChange(page - 1)} disabled={page <= 1}>
          Previous
        </Button>
        <span className="text-xs text-slate-500">
          Page {page} / {totalPages}
        </span>
        <Button variant="secondary" size="sm" onClick={() => onChange(page + 1)} disabled={page >= totalPages}>
          Next
        </Button>
      </div>
    </div>
  );
}
