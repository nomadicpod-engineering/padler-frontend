'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PadlerShell } from '@/app/components/PadlerShell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader, StatePanel } from '@/components/ui/page';
import { fetchGovernanceCadence, isForbiddenError } from '@/lib/api';
import type { GovernanceCadence } from '@/lib/types';

function dueTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
  switch (status) {
    case 'ON_TRACK':
      return 'success';
    case 'DUE_SOON':
      return 'warning';
    case 'OVERDUE':
      return 'danger';
    default:
      return 'neutral';
  }
}

function severityTone(severity: string): 'success' | 'warning' | 'danger' | 'neutral' {
  switch (severity) {
    case 'OK':
      return 'success';
    case 'WARN':
      return 'warning';
    case 'CRITICAL':
      return 'danger';
    default:
      return 'neutral';
  }
}

function apiToHref(api: string): string | null {
  const a = api.toLowerCase();
  if (a.includes('/reports')) return '/reports';
  if (a.includes('/approvals')) return '/approvals';
  if (a.includes('/actions')) return '/actions';
  if (a.includes('/incidents')) return '/incidents';
  if (a.includes('/audit')) return '/ops/audit';
  if (a.includes('/acceptance')) return '/acceptance';
  if (a.includes('/governance') || a.includes('/cadence')) return '/governance';
  if (a.includes('/cases')) return '/cases';
  if (a.includes('/crm') || a.includes('customer')) return '/customers';
  if (a.includes('/rollout') || a.includes('/invite')) return '/settings';
  return null;
}

function checklistStorageKey(reviewId: string, code: string): string {
  return `padler.gov.check.${reviewId}.${code}`;
}

export default function GovernancePage() {
  const [data, setData] = useState<GovernanceCadence | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cadence = await fetchGovernanceCadence();
        if (!cancelled) {
          setData(cadence);
          setError(null);
          setForbidden(false);
          const next: Record<string, boolean> = {};
          for (const review of cadence.reviews) {
            for (const item of review.checklist) {
              const key = checklistStorageKey(review.id, item.code);
              next[key] = typeof window !== 'undefined' && localStorage.getItem(key) === '1';
            }
          }
          setChecked(next);
        }
      } catch (e) {
        if (cancelled) return;
        if (isForbiddenError(e)) setForbidden(true);
        else setError(e instanceof Error ? e.message : 'Unable to load governance');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleCheck = (reviewId: string, code: string) => {
    const key = checklistStorageKey(reviewId, code);
    setChecked((prev) => {
      const nextVal = !prev[key];
      try {
        localStorage.setItem(key, nextVal ? '1' : '0');
      } catch {
        /* ignore */
      }
      return { ...prev, [key]: nextVal };
    });
  };

  return (
    <PadlerShell>
      <PageHeader
        eyebrow="Program"
        title="Governance"
        subtitle="Plan §11 review cadence with live ops signals"
        actions={
          <>
            <Button asChild>
              <Link href="/reports">Ops reports</Link>
            </Button>
            <Button asChild>
              <Link href="/acceptance">Acceptance</Link>
            </Button>
          </>
        }
      />

      {forbidden ? <StatePanel kind="forbidden" /> : null}
      {error ? <StatePanel kind="error" message={error} /> : null}
      {!data && !forbidden && !error ? <StatePanel kind="loading" /> : null}

      {data ? (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Live signals</CardTitle>
              <CardDescription>
                Phase {data.phase}
                {data.rolloutMode ? ` · rollout ${data.rolloutMode}` : ''}
                {data.highRiskCommandsAllowed ? ' · high-risk allowed' : ' · high-risk blocked'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {data.liveSignals.map((s) => (
                  <Link key={s.code} href="/reports" title={s.code}>
                    <Badge tone={severityTone(s.severity)}>
                      {s.label}: {s.value}
                    </Badge>
                  </Link>
                ))}
              </div>
              {data.note ? <p className="mt-3 text-sm text-slate-500">{data.note}</p> : null}
            </CardContent>
          </Card>

          {data.reviews.map((review) => (
            <Card key={review.id}>
              <CardHeader>
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <CardTitle>{review.cadence}</CardTitle>
                  <Badge tone={dueTone(review.dueStatus)}>{review.dueStatus}</Badge>
                </div>
                <CardDescription>{review.title}</CardDescription>
              </CardHeader>
              <CardContent>
                <dl className="mb-4 grid gap-4 sm:grid-cols-3">
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Owner</dt>
                    <dd className="mt-1 text-sm text-slate-900">{review.owner ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Period start</dt>
                    <dd className="mt-1 text-sm text-slate-900">{review.periodStart ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Next due</dt>
                    <dd className="mt-1 text-sm text-slate-900">{review.nextDueDate ?? '—'}</dd>
                  </div>
                </dl>
                <ul className="space-y-2">
                  {review.checklist.map((item) => {
                    const key = checklistStorageKey(review.id, item.code);
                    return (
                      <li key={item.code}>
                        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3 text-sm">
                          <input
                            type="checkbox"
                            className="mt-1"
                            checked={Boolean(checked[key])}
                            onChange={() => toggleCheck(review.id, item.code)}
                          />
                          <span>
                            <strong className="text-slate-900">{item.code}</strong> {item.label}
                            {item.evidenceHint ? (
                              <span className="text-slate-500"> — {item.evidenceHint}</span>
                            ) : null}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
                {review.relatedApis && review.relatedApis.length > 0 ? (
                  <p className="mt-4 text-sm text-slate-500">
                    Surfaces:{' '}
                    {review.relatedApis.map((a) => {
                      const href = apiToHref(a);
                      return href ? (
                        <Link
                          key={a}
                          href={href}
                          className="mr-2 font-medium text-blue-700 hover:underline"
                        >
                          {href}
                        </Link>
                      ) : (
                        <code key={a} className="mr-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs">
                          {a}
                        </code>
                      );
                    })}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}
    </PadlerShell>
  );
}
