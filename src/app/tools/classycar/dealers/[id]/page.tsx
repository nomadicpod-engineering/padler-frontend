'use client';

import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { PadlerShell } from '@/app/components/PadlerShell';
import { StatePanel } from '@/components/ui/page';
import { ToolsJourneyTable } from '@/components/tools/ToolsJourneyTable';
import { ToolsProductShell } from '@/components/tools/ToolsProductShell';
import { classycarKybAction, fetchClassycarUsage, type ToolsUsage } from '@/lib/api/classycar-tools';
import { isForbiddenError } from '@/lib/api';

const FEATURES = [
  { slug: '', label: 'Journey' },
  { slug: 'bookings', label: 'Bookings' },
  { slug: 'stuck', label: 'Stuck' }
] as const;

export default function ClassycarDealerJourneyPage() {
  const params = useParams();
  const id = String(params?.id ?? '');
  const [usage, setUsage] = useState<ToolsUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    setForbidden(false);
    try {
      setUsage(await fetchClassycarUsage(id));
    } catch (e) {
      if (isForbiddenError(e)) setForbidden(true);
      else setError(e instanceof Error ? e.message : 'Unable to load usage');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const base = `/tools/classycar/dealers/${encodeURIComponent(id)}`;

  const onAction = async (_step: { key?: string }, action: string) => {
    if (action === 'VIEW_STUCK' || action === 'CONFIRM') {
      window.location.href =
        action === 'VIEW_STUCK' ? '/tools/classycar/stuck' : '/tools/classycar/bookings';
      return;
    }
    const mapped =
      action === 'ALLOW_RESUBMIT'
        ? 'allow-resubmit'
        : action === 'REQUEST_INFORMATION'
          ? 'request-information'
          : action.toLowerCase();
    let reason: string | undefined;
    if (mapped === 'reject' || mapped === 'request-information') {
      const entered = window.prompt('Reason (required)');
      if (!entered?.trim()) {
        setError('Reason is required');
        return;
      }
      reason = entered.trim();
    }
    setBusy(action);
    setError(null);
    setMessage(null);
    try {
      await classycarKybAction(id, mapped, reason);
      setMessage(`KYB ${mapped} succeeded`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'KYB action failed');
    } finally {
      setBusy(null);
    }
  };

  return (
    <PadlerShell>
      <ToolsProductShell
        productLabel="ClassyCar"
        productHref="/tools/classycar"
        listLabel="Dealers"
        listHref="/tools/classycar/dealers"
        entityLabel={usage?.displayName || id}
        basePath={base}
        features={FEATURES}
      >
        <h1 className="mb-2 text-xl font-semibold text-slate-950">Usage journey</h1>
        <p className="mb-4 text-sm text-slate-500">
          {usage?.note ?? 'Confirm booking, payment, withdrawal.'}
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
            basePath={base}
            onAction={(step, action) => void onAction(step, action)}
            actionBusy={busy}
          />
        ) : null}
      </ToolsProductShell>
    </PadlerShell>
  );
}
