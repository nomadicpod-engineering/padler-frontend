'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { PadlerShell } from '@/app/components/PadlerShell';
import { Button } from '@/components/ui/button';
import { PageHeader, StatePanel } from '@/components/ui/page';
import { fetchNpodStuckOps } from '@/lib/api/npod-tools';
import { isForbiddenError } from '@/lib/api';

export default function NpodStuckPage() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [userId, setUserId] = useState('');

  useEffect(() => {
    setUserId(new URLSearchParams(window.location.search).get('userId') ?? '');
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setForbidden(false);
    try {
      setData(await fetchNpodStuckOps());
    } catch (e) {
      if (isForbiddenError(e)) setForbidden(true);
      else setError(e instanceof Error ? e.message : 'Unable to load stuck ops');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const displayData = useMemo(() => {
    if (!data || !userId || !Array.isArray(data.samples)) return data;
    const samples = data.samples.filter((sample) => {
      if (!sample || typeof sample !== 'object') return false;
      const row = sample as Record<string, unknown>;
      return [row.customerUserId, row.resolvedUserId, row.userId].some(
        (value) => String(value ?? '') === userId
      );
    });
    return { ...data, samples, filteredForUserId: userId };
  }, [data, userId]);

  return (
    <PadlerShell>
      <PageHeader
        eyebrow="NPod"
        title="Stuck ops"
        subtitle="Cross-product stuck counts. Heal via Trip Jotter / ClassyCar / Drift Tools hubs."
        actions={
          <Button type="button" onClick={() => void load()} disabled={loading}>
            {loading ? 'Loading…' : 'Refresh'}
          </Button>
        }
      />

      <p className="mb-4 text-sm text-slate-500">
        <Link href="/tools/npod" className="font-semibold text-blue-700 hover:underline">
          ← NPod hub
        </Link>
      </p>

      {forbidden ? <StatePanel kind="forbidden" /> : null}
      {loading && !data ? <StatePanel kind="loading" /> : null}
      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {error}
        </div>
      ) : null}

      {!loading && displayData ? (
        <>
          <pre className="whitespace-pre-wrap rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            {JSON.stringify(displayData, null, 2)}
          </pre>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="secondary" asChild>
              <Link href="/tools/trip-jotter/stuck">Trip Jotter stuck</Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link href="/tools/classycar/stuck">ClassyCar stuck</Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link href="/tools/drift/stuck">Npod Rider stuck</Link>
            </Button>
          </div>
        </>
      ) : null}
    </PadlerShell>
  );
}
