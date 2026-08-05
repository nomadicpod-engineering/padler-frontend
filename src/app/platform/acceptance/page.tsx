'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { PadlerShell } from '@/app/components/PadlerShell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { serialNumber } from '@/components/ui/data-table';
import { PageHeader, StatePanel } from '@/components/ui/page';
import { fetchAcceptanceCriteria, isForbiddenError } from '@/lib/api';
import type { AcceptanceCriteriaMatrix, AcceptanceCriterion } from '@/lib/types';

function statusTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
  switch (status) {
    case 'PASS':
      return 'success';
    case 'PARTIAL':
      return 'warning';
    case 'OPS_PENDING':
      return 'neutral';
    case 'FAIL':
      return 'danger';
    default:
      return 'neutral';
  }
}

function actionHref(row: AcceptanceCriterion): string {
  const blob = `${row.category} ${row.criterion} ${row.evidence ?? ''} ${row.owner ?? ''}`.toLowerCase();
  if (blob.includes('approval') || blob.includes('maker')) return '/approvals';
  if (blob.includes('command') || blob.includes('execution') || blob.includes('reconcile'))
    return '/actions';
  if (blob.includes('incident')) return '/incidents';
  if (blob.includes('audit') || blob.includes('dead')) return '/ops/audit';
  if (blob.includes('rollout') || blob.includes('invite') || blob.includes('team')) return '/settings';
  if (blob.includes('report') || blob.includes('sla') || blob.includes('backlog')) return '/reports';
  if (blob.includes('customer') || blob.includes('adapter') || blob.includes('360'))
    return '/customers';
  if (blob.includes('governance')) return '/governance';
  return '/reports';
}

const ACTIONABLE = new Set(['OPS_PENDING', 'PARTIAL', 'FAIL']);

export default function AcceptancePage() {
  const [matrix, setMatrix] = useState<AcceptanceCriteriaMatrix | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchAcceptanceCriteria();
        if (!cancelled) {
          setMatrix(data);
          setError(null);
          setForbidden(false);
        }
      } catch (e) {
        if (cancelled) return;
        if (isForbiddenError(e)) setForbidden(true);
        else setError(e instanceof Error ? e.message : 'Unable to load acceptance criteria');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const actionQueue = useMemo(() => {
    if (!matrix) return [] as AcceptanceCriterion[];
    return matrix.criteria.filter((c) => ACTIONABLE.has(c.status));
  }, [matrix]);

  const byCategory = useMemo(() => {
    if (!matrix) return [] as [string, AcceptanceCriterion[]][];
    const map = new Map<string, AcceptanceCriterion[]>();
    for (const row of matrix.criteria) {
      const list = map.get(row.category) ?? [];
      list.push(row);
      map.set(row.category, list);
    }
    return Array.from(map.entries());
  }, [matrix]);

  return (
    <PadlerShell>
      <PageHeader
        eyebrow="Program"
        title="Acceptance"
        subtitle="Plan §10 criteria — action queue first, full matrix below"
        actions={
          <>
            <Button asChild>
              <Link href="/governance">Governance</Link>
            </Button>
            <Button asChild>
              <Link href="/settings">Settings / rollout</Link>
            </Button>
          </>
        }
      />

      {forbidden ? <StatePanel kind="forbidden" /> : null}
      {error ? <StatePanel kind="error" message={error} /> : null}
      {!matrix && !forbidden && !error ? <StatePanel kind="loading" /> : null}

      {matrix ? (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
              <CardDescription>
                Phase {matrix.phase}
                {matrix.generatedAt ? ` · ${matrix.generatedAt}` : ''}
                {matrix.rolloutSnapshot?.rolloutMode
                  ? ` · rollout ${matrix.rolloutSnapshot.rolloutMode}`
                  : ''}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {Object.entries(matrix.statusCounts).map(([status, count]) => (
                  <Badge key={status} tone={statusTone(status)}>
                    {status}: {count}
                  </Badge>
                ))}
              </div>
              {matrix.note ? <p className="mt-3 text-sm text-slate-500">{matrix.note}</p> : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Action queue</CardTitle>
              <CardDescription>
                Criteria still needing ops attention (OPS_PENDING, PARTIAL, FAIL).
              </CardDescription>
            </CardHeader>
            <CardContent>
              {actionQueue.length === 0 ? (
                <StatePanel kind="empty" message="No open acceptance items — matrix is clear." />
              ) : (
                <ul className="space-y-3">
                  {actionQueue.map((row) => (
                    <li
                      key={row.id}
                      className="rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3 text-sm"
                    >
                      <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <Badge tone={statusTone(row.status)}>{row.status}</Badge>
                        <span>
                          {row.category} · {row.owner ?? 'unassigned'}
                        </span>
                      </div>
                      <strong className="text-slate-900">
                        <code className="rounded bg-white px-1.5 py-0.5 text-xs">{row.id}</code>{' '}
                        {row.criterion}
                      </strong>
                      {row.evidence ? (
                        <div className="mt-1 text-slate-500">{row.evidence}</div>
                      ) : null}
                      <div className="mt-2">
                        <Link href={actionHref(row)} className="font-medium text-blue-700 hover:underline">
                          Open related surface
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {byCategory.map(([category, rows]) => (
            <Card key={category} className="overflow-hidden p-0">
              <CardHeader className="p-5 pb-0">
                <CardTitle>{category}</CardTitle>
              </CardHeader>
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse whitespace-nowrap text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="whitespace-nowrap px-4 py-3 font-semibold">S/N</th>
                      <th className="whitespace-nowrap px-4 py-3 font-semibold">Id</th>
                      <th className="whitespace-nowrap px-4 py-3 font-semibold">Status</th>
                      <th className="whitespace-nowrap px-4 py-3 font-semibold">Criterion</th>
                      <th className="whitespace-nowrap px-4 py-3 font-semibold">Evidence</th>
                      <th className="whitespace-nowrap px-4 py-3 font-semibold">Owner</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, idx) => (
                      <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50/80">
                        <td className="px-4 py-3 tabular-nums text-slate-500">
                          {serialNumber(idx)}
                        </td>
                        <td className="px-4 py-3 align-middle text-slate-800">
                          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{row.id}</code>
                        </td>
                        <td className="px-4 py-3 align-middle text-slate-800">
                          <Badge tone={statusTone(row.status)}>{row.status}</Badge>
                        </td>
                        <td className="px-4 py-3 align-middle text-slate-800">{row.criterion}</td>
                        <td className="px-4 py-3 align-middle text-slate-800">{row.evidence ?? '—'}</td>
                        <td className="px-4 py-3 align-middle text-slate-800">{row.owner ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ))}
        </div>
      ) : null}
    </PadlerShell>
  );
}
