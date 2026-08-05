'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { PadlerShell } from '@/app/components/PadlerShell';
import { StatePanel } from '@/components/ui/page';
import { ToolsJourneyTable } from '@/components/tools/ToolsJourneyTable';
import { ToolsProductShell } from '@/components/tools/ToolsProductShell';
import { fetchNpodTravellerUsage, type ToolsUsage } from '@/lib/api/npod-tools';
import { isForbiddenError } from '@/lib/api';

const FEATURES = [
  { slug: '', label: 'Journey' },
  { slug: 'stuck', label: 'Stuck' }
] as const;

export default function NpodTravellerJourneyPage() {
  const params = useParams();
  const userId = String(params?.userId ?? '');
  const [usage, setUsage] = useState<ToolsUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    setForbidden(false);
    try {
      setUsage(await fetchNpodTravellerUsage(userId));
    } catch (e) {
      if (isForbiddenError(e)) setForbidden(true);
      else setError(e instanceof Error ? e.message : 'Unable to load traveller usage');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const base = `/tools/npod/travellers/${encodeURIComponent(userId)}`;

  return (
    <PadlerShell>
      <ToolsProductShell
        productLabel="NPod"
        productHref="/tools/npod"
        listLabel="Travellers"
        listHref="/tools/npod"
        entityLabel={usage?.displayName || userId}
        basePath={base}
        features={FEATURES}
      >
        <h1 className="mb-2 text-xl font-semibold text-slate-950">Traveller journey</h1>
        <p className="mb-4 text-sm text-slate-500">
          {usage?.note ?? 'Signup → code → services → rewards.'}
        </p>
        {forbidden ? <StatePanel kind="forbidden" /> : null}
        {loading ? <StatePanel kind="loading" /> : null}
        {error ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
            {error}
          </div>
        ) : null}
        {message ? <p className="mb-4 text-sm text-slate-500">{message}</p> : null}
        {!loading && usage ? (
          <ToolsJourneyTable
            steps={usage.steps ?? []}
            onAction={(_step, action) => {
              if (action === 'RESEND_HINT') {
                setMessage(
                  'Resend traveller code: use Ops onboarding / invite tools until NPod exposes an audited admin resend API.'
                );
              }
            }}
          />
        ) : null}
        <p className="mt-4 text-sm text-slate-500">
          Customer 360:{' '}
          <Link className="font-semibold text-blue-700 hover:underline" href={`/customers/${encodeURIComponent(userId)}`}>
            /customers/{userId}
          </Link>
        </p>
      </ToolsProductShell>
    </PadlerShell>
  );
}
