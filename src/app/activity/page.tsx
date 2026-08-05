'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { PadlerShell } from '@/app/components/PadlerShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable, serialColumn, type DataTableColumn } from '@/components/ui/data-table';
import { FieldLabel, Input } from '@/components/ui/field';
import { FilterBar, PageHeader, StatePanel } from '@/components/ui/page';
import { getCrmTimeline, isForbiddenError, listCommandExecutions, searchCases } from '@/lib/api';
import type { CaseSummary, CommandExecution, TimelineItem } from '@/lib/types';
import { formatDateTime } from '@/lib/utils';


export default function ActivityPage() {
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [executions, setExecutions] = useState<CommandExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [execNote, setExecNote] = useState<string | null>(null);

  const [caseNumber, setCaseNumber] = useState('');
  const [customerUserId, setCustomerUserId] = useState('');
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [timelineBusy, setTimelineBusy] = useState(false);
  const [timelineError, setTimelineError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      setForbidden(false);
      setExecNote(null);
      try {
        const recent = await searchCases({ page: 0, size: 15 });
        if (cancelled) return;
        setCases(recent.content);

        try {
          const execs = await listCommandExecutions();
          if (!cancelled) setExecutions(execs.slice(0, 20));
        } catch (e) {
          if (isForbiddenError(e)) {
            if (!cancelled) setExecNote('Command executions not available for your role.');
          } else if (!cancelled) {
            setExecNote(e instanceof Error ? e.message : 'Unable to load command executions');
          }
        }
      } catch (e) {
        if (cancelled) return;
        if (isForbiddenError(e)) setForbidden(true);
        else setError(e instanceof Error ? e.message : 'Unable to load activity');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onTimeline = async (e: FormEvent) => {
    e.preventDefault();
    setTimelineBusy(true);
    setTimelineError(null);
    try {
      const result = await getCrmTimeline({
        caseNumber: caseNumber.trim() || undefined,
        customerUserId: customerUserId.trim() || undefined
      });
      setTimeline(result.items ?? []);
    } catch (err) {
      setTimeline([]);
      setTimelineError(err instanceof Error ? err.message : 'Timeline lookup failed');
    } finally {
      setTimelineBusy(false);
    }
  };

  const empty = !loading && !forbidden && !error && cases.length === 0 && executions.length === 0;

  const executionColumns = useMemo<DataTableColumn<CommandExecution>[]>(
    () => [
      serialColumn<CommandExecution>(),
      {
        header: 'Execution',
        accessorKey: 'executionNumber',
        cell: ({ row }) =>
          row.original.executionNumber ? (
            <Link
              href={`/actions/runs/${encodeURIComponent(row.original.executionNumber)}`}
              className="font-medium text-blue-700 hover:underline"
            >
              {row.original.executionNumber}
            </Link>
          ) : (
            '—'
          )
      },
      {
        header: 'Command',
        accessorKey: 'commandKey',
        cell: ({ row }) => row.original.commandKey ?? '—'
      },
      {
        header: 'Status',
        accessorKey: 'status',
        cell: ({ row }) => row.original.status ?? '—'
      },
      {
        header: 'Case',
        accessorKey: 'caseNumber',
        cell: ({ row }) =>
          row.original.caseNumber ? (
            <Link
              href={`/cases/${encodeURIComponent(row.original.caseNumber)}`}
              className="font-medium text-blue-700 hover:underline"
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
        eyebrow="Ops"
        title="Activity"
        subtitle="Recent cases, commands, and CRM timeline lookup"
        actions={
          <>
            <Button asChild>
              <Link href="/ops/logins/staff">Staff logins</Link>
            </Button>
            <Button asChild>
              <Link href="/ops/logins/customers">Customer logins</Link>
            </Button>
            <Button asChild>
              <Link href="/ops/audit">Audit ops</Link>
            </Button>
          </>
        }
      />

      {loading && executions.length === 0 ? <StatePanel kind="loading" /> : null}
      {forbidden ? <StatePanel kind="forbidden" /> : null}
      {error ? <StatePanel kind="error" message={error} /> : null}
      {empty ? (
        <StatePanel
          kind="empty"
          title="No recent activity"
          message="No cases or command executions were returned."
        />
      ) : null}

      {!loading && !forbidden && !error && cases.length > 0 ? (
        <Card className="mb-5">
          <CardHeader>
            <CardTitle>Recently updated cases</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {cases.map((c) => (
                <li
                  key={c.caseNumber}
                  className="rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3 text-sm"
                >
                  <div className="text-xs text-slate-500">
                    {c.status ?? '—'} · {formatDateTime(c.updatedAt ?? c.createdAt)}
                  </div>
                  <Link
                    href={`/cases/${encodeURIComponent(c.caseNumber)}`}
                    className="font-medium text-blue-700 hover:underline"
                  >
                    {c.caseNumber}
                  </Link>
                  {' — '}
                  {c.subject ?? 'Untitled'}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {!loading && !forbidden && !error ? (
        <Card className="mb-5">
          <CardHeader>
            <CardTitle>Command executions</CardTitle>
          </CardHeader>
          <CardContent>
            {execNote ? <p className="mb-4 text-sm text-slate-500">{execNote}</p> : null}
            {executions.length === 0 && !execNote ? (
              <p className="text-sm text-slate-500">No command executions yet.</p>
            ) : null}
            {executions.length > 0 ? (
              <DataTable columns={executionColumns} data={executions} className="border-0 shadow-none" />
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>CRM timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <FilterBar onSubmit={onTimeline}>
            <FieldLabel className="min-w-[180px]">
              Case number
              <Input value={caseNumber} onChange={(e) => setCaseNumber(e.target.value)} />
            </FieldLabel>
            <FieldLabel className="min-w-[220px] flex-1">
              Customer user id
              <Input value={customerUserId} onChange={(e) => setCustomerUserId(e.target.value)} />
            </FieldLabel>
            <Button type="submit" variant="primary" disabled={timelineBusy}>
              Lookup
            </Button>
          </FilterBar>
          {timelineError ? <StatePanel kind="error" message={timelineError} /> : null}
          {timelineBusy ? <StatePanel kind="loading" /> : null}
          {!timelineBusy && timeline.length > 0 ? (
            <ul className="space-y-3">
              {timeline.map((item) => (
                <li
                  key={item.id ?? item.envelopeId ?? `${item.occurredAt}-${item.eventType}`}
                  className="rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3 text-sm"
                >
                  <div className="text-xs text-slate-500">
                    {item.eventType ?? item.category ?? 'event'} · {formatDateTime(item.occurredAt)}
                  </div>
                  <strong className="text-slate-900">{item.title ?? 'Event'}</strong>
                  {item.summary ? <div className="mt-1 text-slate-700">{item.summary}</div> : null}
                </li>
              ))}
            </ul>
          ) : null}
        </CardContent>
      </Card>
    </PadlerShell>
  );
}
