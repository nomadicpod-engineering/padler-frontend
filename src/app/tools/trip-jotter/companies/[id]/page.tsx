'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { PadlerShell } from '@/app/components/PadlerShell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DataTable, serialColumn, type DataTableColumn } from '@/components/ui/data-table';
import { StatePanel } from '@/components/ui/page';
import { TripJotterCompanyShell } from '@/components/tripjotter/TripJotterCompanyShell';
import {
  fetchTripJotterCompanyUsage,
  tripJotterKybAction,
  type TripJotterCompanyUsage,
  type TripJotterUsageStep
} from '@/lib/api/trip-jotter';
import { isForbiddenError } from '@/lib/api';

function formatCount(step: TripJotterUsageStep): string {
  if (step.key === 'KYB' || step.count == null) return '—';
  return String(step.count);
}

export default function TripJotterCompanyJourneyPage() {
  const params = useParams();
  const companyId = String(params?.id ?? '');
  const [usage, setUsage] = useState<TripJotterCompanyUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [kybBusy, setKybBusy] = useState<string | null>(null);
  const [kybMessage, setKybMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    setForbidden(false);
    try {
      setUsage(await fetchTripJotterCompanyUsage(companyId));
    } catch (e) {
      if (isForbiddenError(e)) setForbidden(true);
      else setError(e instanceof Error ? e.message : 'Unable to load usage');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const base = `/tools/trip-jotter/companies/${encodeURIComponent(companyId)}`;

  const runKyb = async (action: 'approve' | 'reject' | 'allow-resubmit') => {
    if (!companyId) return;
    let reason: string | undefined;
    if (action === 'reject') {
      const entered = window.prompt('Rejection reason (required)');
      if (!entered?.trim()) {
        setError('Rejection reason is required');
        return;
      }
      reason = entered.trim();
    }
    setKybBusy(action);
    setError(null);
    setKybMessage(null);
    try {
      await tripJotterKybAction(companyId, action, reason);
      setKybMessage(`KYB ${action} succeeded`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : `KYB ${action} failed`);
    } finally {
      setKybBusy(null);
    }
  };

  const kybStep = (usage?.steps ?? []).find((s) => s.key === 'KYB');
  const countSteps = (usage?.steps ?? []).filter((s) => s.key !== 'KYB');

  const columns = useMemo<DataTableColumn<TripJotterUsageStep>[]>(
    () => [
      serialColumn<TripJotterUsageStep>(),
      {
        header: 'Step',
        id: 'step',
        cell: ({ row }) => <strong>{row.original.label}</strong>
      },
      {
        header: 'Status',
        id: 'status',
        cell: ({ row }) => row.original.status ?? '—'
      },
      {
        header: 'Count',
        id: 'count',
        cell: ({ row }) => <code>{formatCount(row.original)}</code>
      },
      {
        header: 'Note',
        id: 'note',
        cell: ({ row }) => <span className="text-slate-500">{row.original.errorMessage ?? '—'}</span>
      },
      {
        header: '',
        id: 'open',
        cell: ({ row }) =>
          row.original.featurePath ? (
            <Link className="font-semibold text-blue-700 hover:underline" href={`${base}/${row.original.featurePath}`}>
              Open
            </Link>
          ) : null
      }
    ],
    [base]
  );

  return (
    <PadlerShell>
      <TripJotterCompanyShell companyLabel={usage?.companyName || usage?.email}>
        <h1 className="mb-2 text-xl font-semibold text-slate-950">Usage journey</h1>
        <p className="mb-4 text-sm text-slate-500">
          Company onboarding (KYB) plus counts for fleet and bookings. Open each feature tab for
          full lists. Heal stuck payments from{' '}
          <Link href="/tools/trip-jotter/stuck" className="font-semibold text-blue-700 hover:underline">
            Stuck checkouts
          </Link>
          .
        </p>
        {forbidden ? <StatePanel kind="forbidden" /> : null}
        {loading ? <StatePanel kind="loading" /> : null}
        {error ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
            {error}
          </div>
        ) : null}
        {kybMessage ? <p className="mb-4 text-sm text-slate-500">{kybMessage}</p> : null}
        {!loading && usage ? (
          <>
            <section className="mb-6">
              <h2 className="mb-2 text-base font-semibold text-slate-950">Company onboarding</h2>
              <p className="mb-3 text-sm text-slate-500">
                KYB: {usage.verificationStatus ?? '—'}
                {usage.verified ? ' · verified' : ''}
                {usage.kybRejectionReason ? ` · ${usage.kybRejectionReason}` : ''}
              </p>
              {kybStep ? (
                <div>
                  <p className="text-sm">
                    <strong>{kybStep.label}</strong> · {kybStep.status}
                  </p>
                  {kybStep.errorMessage ? (
                    <p className="mt-1 text-sm text-slate-500">{kybStep.errorMessage}</p>
                  ) : null}
                  {(kybStep.actions ?? []).length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(kybStep.actions ?? []).includes('APPROVE') ? (
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          disabled={kybBusy != null}
                          onClick={() => void runKyb('approve')}
                        >
                          {kybBusy === 'approve' ? 'Approving…' : 'Approve KYB'}
                        </Button>
                      ) : null}
                      {(kybStep.actions ?? []).includes('REJECT') ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={kybBusy != null}
                          onClick={() => void runKyb('reject')}
                        >
                          {kybBusy === 'reject' ? 'Rejecting…' : 'Reject'}
                        </Button>
                      ) : null}
                      {(kybStep.actions ?? []).includes('ALLOW_RESUBMIT') ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={kybBusy != null}
                          onClick={() => void runKyb('allow-resubmit')}
                        >
                          {kybBusy === 'allow-resubmit' ? 'Updating…' : 'Allow resubmit'}
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </section>

            <section>
              <h2 className="mb-2 text-base font-semibold text-slate-950">Feature counts</h2>
              <p className="mb-3 text-sm text-slate-500">
                Pending payment (platform): {String(usage.pendingPaymentCount ?? 0)} · GDS pending:{' '}
                {String(usage.gdsPendingCount ?? 0)}
              </p>
              <Card className="overflow-hidden p-0">
                <DataTable columns={columns} data={countSteps} emptyMessage="No feature steps." />
              </Card>
            </section>
          </>
        ) : null}
      </TripJotterCompanyShell>
    </PadlerShell>
  );
}
