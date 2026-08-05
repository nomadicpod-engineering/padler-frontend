'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { PadlerShell } from '@/app/components/PadlerShell';
import { PadlerChart } from '@/components/charts/PadlerChart';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader, StatePanel } from '@/components/ui/page';
import { fetchOpsReport, isForbiddenError } from '@/lib/api';
import type { NamedCount, OpsReport } from '@/lib/types';
import { cn } from '@/lib/utils';

function ChartCard({
  title,
  rows,
  href
}: {
  title: string;
  rows: NamedCount[];
  href?: string;
}) {
  const categories = rows.map((r) => r.name);
  const data = rows.map((r) => r.count);

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{rows.length ? `${rows.length} groups` : 'No data yet'}</CardDescription>
        </div>
        {href ? (
          <Button asChild size="sm" variant="link">
            <Link href={href}>Open</Link>
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <StatePanel kind="empty" message="No rows yet" />
        ) : (
          <PadlerChart
            type="bar"
            height={240}
            series={[{ name: 'Count', data }]}
            options={{
              xaxis: {
                categories,
                labels: { rotate: -35, style: { fontSize: '11px' } }
              },
              yaxis: { labels: { formatter: (v) => String(Math.round(Number(v))) } },
              plotOptions: {
                bar: { borderRadius: 6, columnWidth: '55%', distributed: false }
              }
            }}
          />
        )}
      </CardContent>
    </Card>
  );
}

export default function ReportsPage() {
  const [report, setReport] = useState<OpsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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
        else setError(e instanceof Error ? e.message : 'Unable to load reports');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const cards = useMemo(
    () =>
      report
        ? [
            { label: 'Open cases', count: report.openBacklog, meta: 'Not resolved or closed', href: '/cases' },
            { label: 'Overdue', count: report.slaBreached, meta: 'Past due time', href: '/cases' },
            { label: 'Due soon', count: report.slaAtRisk, meta: 'Due within 4 hours', href: '/cases' },
            {
              label: 'Reopened',
              count: report.casesWithReopen,
              meta: `${report.totalReopenEvents} reopen events`,
              href: '/cases'
            },
            {
              label: 'Escalations',
              count: report.escalationEvents,
              meta: 'Sent up from a case',
              href: '/incidents'
            },
            {
              label: 'Aging approvals',
              count: report.agingApprovalsOver24h,
              meta: `${report.pendingApprovals} waiting`,
              href: '/approvals'
            },
            {
              label: 'Failed actions',
              count: report.failedExecutions,
              meta: `${report.unknownExecutions} unclear`,
              href: '/actions'
            }
          ]
        : [],
    [report]
  );

  const statusDonut = useMemo(() => {
    if (!report?.executionsByStatus?.length) return null;
    return {
      labels: report.executionsByStatus.map((r) => r.name),
      series: report.executionsByStatus.map((r) => r.count)
    };
  }, [report]);

  return (
    <PadlerShell>
      <PageHeader
        eyebrow="Platform"
        title="Reports"
        subtitle={
          report?.generatedAt
            ? `Care and action numbers · updated ${report.generatedAt}`
            : 'Cases, due times, approvals, and action results'
        }
        actions={
          <Button asChild>
            <Link href="/today">Back to Today</Link>
          </Button>
        }
      />

      {loading && !report ? <StatePanel kind="loading" /> : null}
      {forbidden ? <StatePanel kind="forbidden" /> : null}
      {error ? <StatePanel kind="error" message={error} /> : null}

      {!loading && !forbidden && !error && report ? (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map((card) => (
              <Link
                key={card.label}
                href={card.href}
                className={cn(
                  'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition duration-200',
                  'hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md motion-reduce:transform-none'
                )}
              >
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                  {card.label}
                </div>
                <div className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-slate-950">
                  {card.count}
                </div>
                <div className="mt-1 text-sm text-slate-500">{card.meta}</div>
              </Link>
            ))}
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <ChartCard title="Cases by status" rows={report.backlogByStatus} href="/cases" />
            <ChartCard title="Open by queue" rows={report.backlogByQueue} href="/today" />
            <ChartCard title="Workload by assignee" rows={report.workloadByAssignee} href="/cases/mine" />
            <ChartCard title="Contacts by channel" rows={report.contactsByChannel} />
            <ChartCard title="Failed actions by error" rows={report.failedActionsByErrorCode} href="/actions" />
            {statusDonut ? (
              <Card>
                <CardHeader>
                  <div>
                    <CardTitle>Action results by status</CardTitle>
                    <CardDescription>Recent execution outcomes</CardDescription>
                  </div>
                  <Button asChild size="sm" variant="link">
                    <Link href="/actions">Open</Link>
                  </Button>
                </CardHeader>
                <CardContent>
                  <PadlerChart
                    type="donut"
                    height={260}
                    series={statusDonut.series}
                    options={{
                      labels: statusDonut.labels,
                      legend: { position: 'bottom' }
                    }}
                  />
                </CardContent>
              </Card>
            ) : (
              <ChartCard title="Action results by status" rows={report.executionsByStatus} href="/actions" />
            )}
          </div>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Quality sample</CardTitle>
                <CardDescription>Recently reopened cases to spot-check</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {report.qualitySampleCaseNumbers.length === 0 ? (
                <StatePanel kind="empty" message="No reopened cases to sample" />
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {report.qualitySampleCaseNumbers.map((num) => (
                    <li key={num}>
                      <Link
                        href={`/cases/${encodeURIComponent(num)}`}
                        className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-50"
                      >
                        {num}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </PadlerShell>
  );
}
