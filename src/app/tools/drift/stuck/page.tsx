'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { PadlerShell } from '@/app/components/PadlerShell';
import {
  StuckRiderHealDrawer,
  toDriftStuckRow,
  type DriftStuckRow
} from '@/components/drift/StuckRiderHealDrawer';
import { ToolsListSearch } from '@/components/tools/ToolsListSearch';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DataTable, serialColumn, type DataTableColumn } from '@/components/ui/data-table';
import { PageHeader, StatePanel } from '@/components/ui/page';
import { isForbiddenError } from '@/lib/api';
import { fetchDriftStuckPayments } from '@/lib/api/drift-tools';
import { formatDateTime } from '@/lib/utils';

type StuckSampleRow = Record<string, unknown>;

export default function DriftStuckPage() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [healRow, setHealRow] = useState<DriftStuckRow | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    const initialQuery = new URLSearchParams(window.location.search).get('q');
    if (initialQuery) setQ(initialQuery);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setForbidden(false);
    try {
      setData(await fetchDriftStuckPayments());
    } catch (e) {
      if (isForbiddenError(e)) setForbidden(true);
      else setError(e instanceof Error ? e.message : 'Unable to load stuck payments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const samples = Array.isArray(data?.samples) ? (data?.samples as StuckSampleRow[]) : [];
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return samples;
    return samples.filter((row) =>
      [
        row.orderId,
        row.id,
        row.kind,
        row.status,
        row.paymentStatus,
        row.paymentReference,
        row.customerEmail,
        row.customerUserId,
        row.driftDispatchReference
      ]
        .filter((v) => v != null && String(v).trim() !== '')
        .some((v) => String(v).toLowerCase().includes(needle))
    );
  }, [samples, q]);

  const columns = useMemo<DataTableColumn<StuckSampleRow>[]>(
    () => [
      serialColumn<StuckSampleRow>(),
      {
        header: 'Order',
        id: 'order',
        cell: ({ row }) => <code>{String(row.original.orderId ?? row.original.id ?? '')}</code>
      },
      {
        header: 'Kind',
        id: 'kind',
        cell: ({ row }) => String(row.original.kind ?? '—')
      },
      {
        header: 'Status',
        id: 'status',
        cell: ({ row }) =>
          `${String(row.original.status ?? '—')} / ${String(row.original.paymentStatus ?? '—')}`
      },
      {
        header: 'Payment ref',
        id: 'paymentReference',
        cell: ({ row }) => <code>{String(row.original.paymentReference ?? '—')}</code>
      },
      {
        header: 'Customer',
        id: 'customer',
        cell: ({ row }) =>
          String(row.original.customerEmail ?? row.original.customerUserId ?? '—')
      },
      {
        header: 'Updated',
        id: 'updated',
        cell: ({ row }) =>
          formatDateTime(row.original.updatedAt != null ? String(row.original.updatedAt) : undefined)
      },
      {
        header: 'Fix',
        id: 'fix',
        cell: ({ row }) => {
          const mapped = toDriftStuckRow(row.original);
          return (
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={!mapped.orderId}
              onClick={() => setHealRow(mapped)}
            >
              Open fix
            </Button>
          );
        }
      }
    ],
    []
  );

  return (
    <PadlerShell>
      <PageHeader
        eyebrow="Npod Rider"
        title="Stuck payments"
        subtitle="Paid orders that failed to continue, or delivered orders whose dispatcher was not paid."
        actions={
          <Button type="button" onClick={() => void load()} disabled={loading}>
            {loading ? 'Loading…' : 'Refresh'}
          </Button>
        }
      />

      <p className="mb-4 text-sm text-slate-500">
        <Link href="/tools/drift" className="font-semibold text-blue-700 hover:underline">
          ← Npod Rider hub
        </Link>
        {' · '}
        <Link href="/tools/payment" className="font-semibold text-blue-700 hover:underline">
          Wallet payments
        </Link>
      </p>

      <ToolsListSearch
        value={q}
        onChange={setQ}
        placeholder="Search order, payment ref, customer, status"
        hint={q.trim() ? `${filtered.length} of ${samples.length}` : undefined}
      />

      {forbidden ? <StatePanel kind="forbidden" /> : null}
      {loading && !data ? <StatePanel kind="loading" /> : null}
      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {error}
        </div>
      ) : null}

      {!loading && !forbidden ? (
        <>
          <p className="mb-4 text-sm text-slate-500">
            Payment flow stalled: {String(data?.paymentFlowStalledCount ?? 0)} · Delivered unpaid:{' '}
            {String(data?.deliveredDispatchUnpaidCount ?? 0)}
          </p>
          <Card className="overflow-hidden p-0">
            <DataTable
              columns={columns}
              data={filtered}
              emptyMessage={
                samples.length === 0 ? 'No stuck payment samples.' : 'No samples match this search.'
              }
            />
          </Card>
        </>
      ) : null}

      {healRow ? (
        <StuckRiderHealDrawer
          key={healRow.orderId}
          open
          row={healRow}
          onClose={() => setHealRow(null)}
          onResolved={() => void load()}
        />
      ) : null}
    </PadlerShell>
  );
}
