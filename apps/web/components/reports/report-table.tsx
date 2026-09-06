import type { ReportSummary } from '@weekly-report/shared';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { StatusBadge } from '@/components/ui/badge';
import { Table, TBody, Td, Th, THead, Tr } from '@/components/ui/table';
import { formatDateTime, formatWeek } from '@/lib/format';

interface ReportTableProps {
  reports: ReportSummary[];
  showMember?: boolean;
  actions: (report: ReportSummary) => ReactNode;
}

/** Shared list rendering for "My reports", team reports and member profiles. */
export function ReportTable({ reports, showMember, actions }: ReportTableProps) {
  return (
    <Table>
      <THead>
        <tr>
          {showMember && <Th>Team member</Th>}
          <Th>Week</Th>
          <Th>Project</Th>
          <Th>Status</Th>
          <Th className="text-right">Version</Th>
          <Th className="text-right">Tasks</Th>
          <Th>Submitted</Th>
          <Th>Updated</Th>
          <Th className="text-right">Actions</Th>
        </tr>
      </THead>
      <TBody>
        {reports.map((report) => (
          <Tr key={report.id}>
            {showMember && (
              <Td>
                <Link href={`/team/${report.user.id}`} className="font-medium text-slate-900 hover:text-brand-600">
                  {report.user.name}
                </Link>
              </Td>
            )}
            <Td className="whitespace-nowrap font-medium text-slate-900">{formatWeek(report.weekStart.slice(0, 10))}</Td>
            <Td>{report.project?.name ?? '-'}</Td>
            <Td><StatusBadge status={report.status} /></Td>
            <Td className="text-right tabular-nums">{report.currentVersion > 0 ? `v${report.currentVersion}` : '-'}</Td>
            <Td className="text-right tabular-nums">{report._count.tasks}</Td>
            <Td className="whitespace-nowrap text-slate-500">{report.submittedAt ? formatDateTime(report.submittedAt) : '-'}</Td>
            <Td className="whitespace-nowrap text-slate-500">{formatDateTime(report.updatedAt)}</Td>
            <Td className="text-right">
              <div className="flex justify-end gap-2">{actions(report)}</div>
            </Td>
          </Tr>
        ))}
      </TBody>
    </Table>
  );
}
