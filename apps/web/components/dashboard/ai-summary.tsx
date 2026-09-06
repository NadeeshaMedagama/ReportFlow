'use client';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SimpleMarkdown } from '@/components/ui/simple-markdown';
import { errorMessage } from '@/lib/api-client';
import { formatDateTime } from '@/lib/format';
import { useAssistantStatus, useTeamSummary } from '@/lib/hooks/use-assistant';

/** AI-generated weekly team summary (completed work, recurring blockers, workload imbalance). */
export function AiSummaryCard({ weekStart }: { weekStart: string }) {
  const status = useAssistantStatus();
  const summary = useTeamSummary();
  const enabled = status.data?.enabled ?? false;

  return (
    <Card
      title="AI team summary"
      description="Generated from this week's submitted reports"
      actions={
        <Button size="sm" onClick={() => summary.mutate(weekStart)} loading={summary.isPending} disabled={!enabled}>
          {summary.data ? 'Regenerate' : 'Generate summary'}
        </Button>
      }
    >
      {status.data && !enabled ? (
        <Alert tone="info">
          Set <code>ANTHROPIC_API_KEY</code> on the API to enable AI summaries and the chat assistant.
        </Alert>
      ) : summary.isError ? (
        <Alert tone="danger">{errorMessage(summary.error)}</Alert>
      ) : summary.data ? (
        <div>
          <SimpleMarkdown text={summary.data.summary} />
          <p className="mt-4 text-xs text-slate-400">
            {summary.data.model} · {formatDateTime(summary.data.generatedAt)} · week of {summary.data.weekLabel}
          </p>
        </div>
      ) : (
        <p className="text-sm text-slate-500">Click &quot;Generate summary&quot; to get a short digest of completed work, recurring blockers and workload imbalances for the selected week.</p>
      )}
    </Card>
  );
}
