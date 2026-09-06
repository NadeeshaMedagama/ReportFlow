import type { SubmissionStatusRow } from '@weekly-report/shared';
import Link from 'next/link';
import { Avatar } from '@/components/ui/avatar';
import { StatusBadge, TimingBadge } from '@/components/ui/badge';
import { Table, TBody, Td, Th, THead, Tr } from '@/components/ui/table';
import { formatDateTime } from '@/lib/format';

/** Every active team member for a week, including those who have not started. */
export function SubmissionStatusTable({ rows, compact }: { rows: SubmissionStatusRow[]; compact?: boolean }) {
  return (
    <Table>
      <THead>
        <tr>
          <Th>Team member</Th>
          <Th>Status</Th>
          <Th>Timing</Th>
          {!compact && <Th>Project</Th>}
          {!compact && <Th>Submitted</Th>}
          <Th className="text-right">Action</Th>
        </tr>
      </THead>
      <TBody>
        {rows.map((row) => (
          <Tr key={row.user.id}>
            <Td>
              <div className="flex items-center gap-3">
                <Avatar name={row.user.name} size="sm" />
                <div>
                  <Link href={`/team/${row.user.id}`} className="font-medium text-slate-900 hover:text-brand-600">{row.user.name}</Link>
                  {!compact && row.user.jobTitle && <p className="text-xs text-slate-500">{row.user.jobTitle}</p>}
                </div>
              </div>
            </Td>
            <Td><StatusBadge status={row.status} /></Td>
            <Td><TimingBadge timing={row.timing} /></Td>
            {!compact && <Td>{row.report?.project?.name ?? '-'}</Td>}
            {!compact && <Td className="whitespace-nowrap text-slate-500">{row.report?.submittedAt ? formatDateTime(row.report.submittedAt) : '-'}</Td>}
            <Td className="text-right">
              {row.report && row.status === 'SUBMITTED' ? (
                <Link href={`/review/${row.report.id}`} className="text-sm font-medium text-brand-600 hover:underline">Review</Link>
              ) : row.report && row.status !== 'DRAFT' ? (
                <Link href={`/reports/${row.report.id}`} className="text-sm font-medium text-slate-600 hover:underline">View</Link>
              ) : (
                <span className="text-xs text-slate-400">-</span>
              )}
            </Td>
          </Tr>
        ))}
      </TBody>
    </Table>
  );
}
