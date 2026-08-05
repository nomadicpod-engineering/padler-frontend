'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { PadlerShell } from '@/app/components/PadlerShell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader, StatePanel } from '@/components/ui/page';
import { fetchDriftQueues } from '@/lib/api/drift-tools';
import { isForbiddenError } from '@/lib/api';

export default function DriftQueuesPage() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setForbidden(false);
    try {
      setData(await fetchDriftQueues());
    } catch (e) {
      if (isForbiddenError(e)) setForbidden(true);
      else setError(e instanceof Error ? e.message : 'Unable to load queues');
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
        eyebrow="Drift"
        title="Queues"
        subtitle="SOS outbox and links for payment / withdrawal heal until native Drift admin mutate APIs exist."
      />

      <p className="mb-4 text-sm text-slate-500">
        <Link href="/tools/drift" className="font-semibold text-blue-700 hover:underline">
          ← Drift hub
        </Link>
      </p>

      {forbidden ? <StatePanel kind="forbidden" /> : null}
      {loading && !data ? <StatePanel kind="loading" /> : null}
      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {error}
        </div>
      ) : null}

      {!loading && data ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>SOS outbox</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="whitespace-pre-wrap text-xs text-slate-600">
                {JSON.stringify(data.sosOutbox ?? {}, null, 2)}
              </pre>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Ride accept</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600">{JSON.stringify(data.rideAccept ?? {})}</p>
            </CardContent>
          </Card>
          <Link href="/tools/drift/stuck" className="group block">
            <Card className="h-full transition duration-200 group-hover:-translate-y-0.5 group-hover:border-blue-200 group-hover:shadow-md motion-reduce:transform-none">
              <CardHeader>
                <CardTitle>Stuck payments</CardTitle>
                <CardDescription>
                  {(() => {
                    const stuck = (data.stuckPayments ?? {}) as Record<string, unknown>;
                    if (stuck.error) return 'Queue unavailable — open stuck heal';
                    const flow = Number(stuck.paymentFlowStalledCount ?? 0);
                    const unpaid = Number(stuck.deliveredDispatchUnpaidCount ?? 0);
                    return `${flow} flow stalled · ${unpaid} delivered unpaid`;
                  })()}
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
          <Link href="/tools/wallet" className="group block">
            <Card className="h-full transition duration-200 group-hover:-translate-y-0.5 group-hover:border-blue-200 group-hover:shadow-md motion-reduce:transform-none">
              <CardHeader>
                <CardTitle>Withdrawals</CardTitle>
                <CardDescription>Open Tools → Wallet</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        </div>
      ) : null}
    </PadlerShell>
  );
}
