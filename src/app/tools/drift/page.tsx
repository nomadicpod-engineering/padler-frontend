'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { PadlerShell } from '@/app/components/PadlerShell';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader, StatePanel } from '@/components/ui/page';
import { fetchDriftHub } from '@/lib/api/drift-tools';
import { isForbiddenError } from '@/lib/api';

export default function DriftHubPage() {
  const [hub, setHub] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setForbidden(false);
    try {
      setHub(await fetchDriftHub());
    } catch (e) {
      if (isForbiddenError(e)) setForbidden(true);
      else setError(e instanceof Error ? e.message : 'Unable to load Drift hub');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <PadlerShell>
      <PageHeader
        eyebrow="Fix problems"
        title="Npod Rider"
        subtitle="Dispatch companies and riders — accept ride, payment, withdrawals."
        actions={
          <Button type="button" onClick={() => void load()} disabled={loading}>
            {loading ? 'Loading…' : 'Refresh'}
          </Button>
        }
      />

      <p className="mb-4 text-sm text-slate-500">
        <Link href="/tools" className="font-semibold text-blue-700 hover:underline">
          ← Tools
        </Link>
      </p>

      {forbidden ? <StatePanel kind="forbidden" /> : null}
      {loading ? <StatePanel kind="loading" skeleton="cards" /> : null}
      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {error}
        </div>
      ) : null}

      {!loading && !forbidden && hub ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Link href="/tools/drift/dispatch" className="group block">
            <Card className="h-full transition duration-200 group-hover:-translate-y-0.5 group-hover:border-blue-200 group-hover:shadow-md motion-reduce:transform-none">
              <CardHeader>
                <CardTitle>Dispatch parties</CardTitle>
                <CardDescription>
                  {String(hub.companyCount ?? 0)} companies · {String(hub.individualCount ?? 0)} individuals
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
          <Link href="/tools/drift/stuck" className="group block">
            <Card className="h-full transition duration-200 group-hover:-translate-y-0.5 group-hover:border-blue-200 group-hover:shadow-md motion-reduce:transform-none">
              <CardHeader>
                <CardTitle>Stuck payments</CardTitle>
                <CardDescription>
                  {(() => {
                    const stuck = (hub.stuckPayments ?? {}) as Record<string, unknown>;
                    const flow = Number(stuck.paymentFlowStalledCount ?? 0);
                    const unpaid = Number(stuck.deliveredDispatchUnpaidCount ?? 0);
                    if (stuck.error) return 'Queue unavailable';
                    return `${flow} flow stalled · ${unpaid} delivered unpaid`;
                  })()}
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
          <Link href="/tools/drift/queues" className="group block">
            <Card className="h-full transition duration-200 group-hover:-translate-y-0.5 group-hover:border-blue-200 group-hover:shadow-md motion-reduce:transform-none">
              <CardHeader>
                <CardTitle>Queues</CardTitle>
                <CardDescription>SOS outbox · payment / withdraw links</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        </div>
      ) : null}

      {hub?.note ? <p className="mt-4 text-sm text-slate-500">{String(hub.note)}</p> : null}
    </PadlerShell>
  );
}
