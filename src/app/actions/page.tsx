'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { PadlerShell } from '@/app/components/PadlerShell';
import { Button } from '@/components/ui/button';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable, serialColumn, type DataTableColumn } from '@/components/ui/data-table';
import { PageHeader, StatePanel } from '@/components/ui/page';
import { isForbiddenError, listCommands, listCommandExecutions } from '@/lib/api';
import type { CommandDefinition, CommandExecution } from '@/lib/types';
import { formatDateTime } from '@/lib/utils';


export default function ActionsPage() {
  const [commands, setCommands] = useState<CommandDefinition[]>([]);
  const [executions, setExecutions] = useState<CommandExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setForbidden(false);
      setError(null);
      try {
        const [defs, execs] = await Promise.all([
          listCommands({ uiSafeOnly: true }),
          listCommandExecutions()
        ]);
        if (cancelled) return;
        setCommands(defs);
        setExecutions(execs.slice(0, 25));
      } catch (e) {
        if (cancelled) return;
        if (isForbiddenError(e)) setForbidden(true);
        else setError(e instanceof Error ? e.message : 'Unable to load actions');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const catalogColumns = useMemo<DataTableColumn<CommandDefinition>[]>(
    () => [
      serialColumn<CommandDefinition>(),
      {
        header: 'Action',
        accessorKey: 'displayName',
        cell: ({ row }) => (
          <div>
            <div className="font-medium text-slate-900">
              {row.original.displayName ?? row.original.commandKey}
            </div>
            {row.original.description ? (
              <div className="mt-0.5 text-xs text-slate-500">{row.original.description}</div>
            ) : null}
          </div>
        )
      },
      {
        header: 'Risk',
        accessorKey: 'riskClass',
        cell: ({ row }) => <Badge tone="warning">{row.original.riskClass ?? '—'}</Badge>
      },
      {
        header: 'Approval',
        accessorKey: 'requiresApproval',
        cell: ({ row }) => (row.original.requiresApproval ? 'Needs approval' : 'Direct')
      }
    ],
    []
  );

  const executionColumns = useMemo<DataTableColumn<CommandExecution>[]>(
    () => [
      serialColumn<CommandExecution>(),
      {
        header: 'Result',
        accessorKey: 'executionNumber',
        cell: ({ row }) => (
          <Link
            className="font-medium text-blue-700 hover:underline"
            href={`/actions/runs/${encodeURIComponent(row.original.executionNumber)}`}
          >
            {row.original.executionNumber}
          </Link>
        )
      },
      {
        header: 'Action',
        accessorKey: 'commandKey',
        cell: ({ row }) => row.original.commandKey ?? '—'
      },
      {
        header: 'Status',
        accessorKey: 'status',
        cell: ({ row }) => <StatusBadge status={row.original.status} />
      },
      {
        header: 'Case',
        accessorKey: 'caseNumber',
        cell: ({ row }) =>
          row.original.caseNumber ? (
            <Link
              className="text-blue-700 hover:underline"
              href={`/cases/${encodeURIComponent(row.original.caseNumber)}`}
            >
              {row.original.caseNumber}
            </Link>
          ) : (
            '—'
          )
      },
      {
        header: 'Started',
        accessorKey: 'startedAt',
        cell: ({ row }) => formatDateTime(row.original.startedAt)
      }
    ],
    []
  );

  return (
    <PadlerShell>
      <PageHeader
        eyebrow="Actions"
        title="Actions"
        subtitle="Safe actions you can request from a case. Open a case to start one."
        actions={
          <>
            <Button asChild>
              <Link href="/approvals">Approvals</Link>
            </Button>
            <Button asChild variant="primary">
              <Link href="/cases">Open a case</Link>
            </Button>
          </>
        }
      />
      {loading && executions.length === 0 ? <StatePanel kind="loading" /> : null}
      {forbidden ? <StatePanel kind="forbidden" /> : null}
      {error ? <StatePanel kind="error" message={error} /> : null}
      {!loading && !forbidden && !error ? (
        <div className="grid gap-5 xl:grid-cols-2">
          <Card className="overflow-hidden p-0">
            <CardHeader className="px-5 pt-5">
              <div>
                <CardTitle>Available actions ({commands.length})</CardTitle>
                <CardDescription>Request these from a case workspace.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <DataTable
                columns={catalogColumns}
                data={commands}
                emptyMessage="No enabled safe actions."
              />
            </CardContent>
          </Card>
          <Card className="overflow-hidden p-0">
            <CardHeader className="px-5 pt-5">
              <div>
                <CardTitle>Recent results</CardTitle>
                <CardDescription>Latest action runs across cases.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <DataTable
                columns={executionColumns}
                data={executions}
                emptyMessage="No recent action results."
              />
            </CardContent>
          </Card>
        </div>
      ) : null}
    </PadlerShell>
  );
}
