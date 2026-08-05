'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { PadlerShell } from '@/app/components/PadlerShell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatePanel } from '@/components/ui/page';
import { ToolsProductShell } from '@/components/tools/ToolsProductShell';
import { fetchDriftQueues } from '@/lib/api/drift-tools';
import { isForbiddenError } from '@/lib/api';

const FEATURES = [
  { slug: '', label: 'Journey' },
  { slug: 'queues', label: 'Queues' }
] as const;

export default function DriftEntityQueuesPage() {
  const params = useParams();
  const partyType = String(params?.partyType ?? 'company');
  const id = String(params?.id ?? '');
  const base = `/tools/drift/dispatch/${encodeURIComponent(partyType)}/${encodeURIComponent(id)}`;
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
      <ToolsProductShell
        productLabel="Drift"
        productHref="/tools/drift"
        listLabel="Dispatch"
        listHref="/tools/drift/dispatch"
        entityLabel={id}
        basePath={base}
        features={FEATURES}
      >
        <h1 className="mb-2 text-xl font-semibold text-slate-950">Queues</h1>
        <p className="mb-4 text-sm text-slate-500">
          Platform SOS + payment/withdraw links. Per-party ride-accept heal ships when Drift exposes
          admin mutate APIs.
        </p>
        {forbidden ? <StatePanel kind="forbidden" /> : null}
        {loading ? <StatePanel kind="loading" /> : null}
        {error ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
            {error}
          </div>
        ) : null}
        {!loading && data ? (
          <div className="grid gap-3">
            <Card>
              <CardHeader>
                <CardTitle>SOS</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap text-xs text-slate-600">
                  {JSON.stringify(data.sosOutbox ?? {}, null, 2)}
                </pre>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Related tools</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <Link href="/tools/payment" className="font-semibold text-blue-700 hover:underline">
                  Payments
                </Link>
                <Link href="/tools/wallet" className="font-semibold text-blue-700 hover:underline">
                  Wallet / withdrawals
                </Link>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </ToolsProductShell>
    </PadlerShell>
  );
}
