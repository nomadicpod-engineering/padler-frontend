'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { PadlerShell } from '@/app/components/PadlerShell';
import { PageHeader, StatePanel } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { fetchOpsReport, isForbiddenError } from '@/lib/api';
import { getAuthSession } from '@/lib/auth';
import type { OpsReport } from '@/lib/types';
import { canViewApprovals, PADLER_QUEUES } from '@/lib/types';
import { cn } from '@/lib/utils';

function queueLabel(key: string): string {
  return PADLER_QUEUES.find((q) => q.key === key)?.label ?? key;
}

type Signal = {
  href: string;
  label: string;
  value: number;
  warn?: boolean;
};

export default function TodayPage() {
  const [report, setReport] = useState<OpsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showApprovals, setShowApprovals] = useState(false);

  useEffect(() => {
    setShowApprovals(canViewApprovals(getAuthSession()?.designation));

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      setForbidden(false);
      try {
        const data = await fetchOpsReport();
        if (!cancelled) setReport(data);
      } catch (e) {
        if (cancelled) return;
        if (isForbiddenError(e)) setForbidden(true);
        else setError(e instanceof Error ? e.message : 'Unable to load today’s view');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const queueCards = useMemo(() => {
    const byKey = new Map((report?.backlogByQueue ?? []).map((r) => [r.name, r.count]));
    const known = PADLER_QUEUES.map((q) => ({
      key: q.key,
      label: q.label,
      open: byKey.get(q.key) ?? 0
    }));
    const extras = (report?.backlogByQueue ?? [])
      .filter((r) => !PADLER_QUEUES.some((q) => q.key === r.name))
      .map((r) => ({ key: r.name, label: queueLabel(r.name), open: r.count }));
    return [...known, ...extras];
  }, [report]);

  const signals: Signal[] = report
    ? [
        { href: '/cases', label: 'Open cases', value: report.openBacklog },
        { href: '/cases', label: 'Overdue', value: report.slaBreached, warn: report.slaBreached > 0 },
        { href: '/cases', label: 'Due soon', value: report.slaAtRisk, warn: report.slaAtRisk > 0 },
        ...(showApprovals
          ? [
              {
                href: '/approvals',
                label: 'Aging approvals',
                value: report.agingApprovalsOver24h,
                warn: report.agingApprovalsOver24h > 0
              }
            ]
          : []),
        {
          href: '/actions',
          label: 'Failed actions',
          value: report.failedExecutions,
          warn: report.failedExecutions > 0
        }
      ]
    : [];

  return (
    <PadlerShell>
      <PageHeader
        eyebrow="My day"
        title="Today"
        subtitle={
          report?.generatedAt
            ? `What needs attention now · updated ${report.generatedAt}`
            : 'What needs attention now across your queues'
        }
        actions={
          <>
            <Button asChild variant="primary">
              <Link href="/cases/mine">My cases</Link>
            </Button>
            <Button asChild>
              <Link href="/reports">Reports</Link>
            </Button>
            {showApprovals ? (
              <Button asChild>
                <Link href="/approvals">Approvals</Link>
              </Button>
            ) : null}
          </>
        }
      />

      {loading ? <StatePanel kind="loading" /> : null}
      {forbidden ? <StatePanel kind="forbidden" /> : null}
      {error ? <StatePanel kind="error" message={error} /> : null}

      {!loading && !forbidden && !error && report ? (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {signals.map((signal) => (
              <Link
                key={signal.label}
                href={signal.href}
                className={cn(
                  'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md motion-reduce:transform-none',
                  signal.warn && 'border-amber-200 bg-amber-50/60'
                )}
              >
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                  {signal.label}
                </div>
                <div
                  className={cn(
                    'mt-2 text-3xl font-semibold tabular-nums tracking-tight text-slate-950',
                    signal.warn && 'text-amber-900'
                  )}
                >
                  {signal.value}
                </div>
              </Link>
            ))}
          </div>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Queues</CardTitle>
                <CardDescription>Open a queue to see cases waiting there.</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {queueCards.map((q) => (
                  <Link
                    key={q.key}
                    href={`/cases?queueKey=${encodeURIComponent(q.key)}`}
                    className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 transition duration-200 hover:border-blue-200 hover:bg-blue-50/50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-sm font-semibold text-slate-900">{q.label}</div>
                      <Badge tone={q.open > 0 ? 'warning' : 'success'}>
                        {q.open > 0 ? 'Needs work' : 'Clear'}
                      </Badge>
                    </div>
                    <div className="mt-3 text-3xl font-semibold tabular-nums text-slate-950">
                      {q.open}
                    </div>
                    <div className="mt-1 text-sm text-slate-500">open cases</div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </PadlerShell>
  );
}
