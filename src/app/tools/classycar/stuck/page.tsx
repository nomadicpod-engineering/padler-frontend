'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { PadlerShell } from '@/app/components/PadlerShell';
import {
  StuckClassycarHealDrawer,
  toClassycarStuckRow,
  type ClassycarStuckRow
} from '@/components/classycar/StuckClassycarHealDrawer';
import { ToolsListSearch } from '@/components/tools/ToolsListSearch';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DataTable, serialColumn, type DataTableColumn } from '@/components/ui/data-table';
import { PageHeader, StatePanel } from '@/components/ui/page';
import { isForbiddenError } from '@/lib/api';
import { fetchClassycarStuckPayments } from '@/lib/api/classycar-tools';
import { formatDateTime, formatMoney } from '@/lib/utils';

type StuckSampleRow = Record<string, unknown>;

export default function ClassycarStuckPage() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [healRow, setHealRow] = useState<ClassycarStuckRow | null>(null);
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
      setData(await fetchClassycarStuckPayments());
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
        row.kind,
        row.id,
        row.paymentReference,
        row.status,
        row.customerName,
        row.customerEmail,
        row.customerUserId,
        row.dealerId,
        row.dealerUserId,
        row.vehicleName
      ]
        .filter((v) => v != null && String(v).trim() !== '')
        .some((v) => String(v).toLowerCase().includes(needle))
    );
  }, [samples, q]);

  const columns = useMemo<DataTableColumn<StuckSampleRow>[]>(
    () => [
      serialColumn<StuckSampleRow>(),
      {
        header: 'Reference',
        id: 'reference',
        cell: ({ row }) => <code>{String(row.original.paymentReference ?? '—')}</code>
      },
      {
        header: 'Kind',
        id: 'kind',
        cell: ({ row }) => `${String(row.original.kind ?? '—')} #${String(row.original.id ?? '—')}`
      },
      {
        header: 'Status',
        id: 'status',
        cell: ({ row }) => String(row.original.status ?? '—')
      },
      {
        header: 'Customer',
        id: 'customer',
        cell: ({ row }) =>
          String(row.original.customerEmail ?? row.original.customerName ?? row.original.customerUserId ?? '—')
      },
      {
        header: 'Amount',
        id: 'amount',
        cell: ({ row }) =>
          row.original.amount != null && row.original.amount !== ''
            ? formatMoney(Number(row.original.amount), 'NGN')
            : '—'
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
          const mapped = toClassycarStuckRow(row.original);
          return (
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={!mapped}
              onClick={() => mapped && setHealRow(mapped)}
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
        eyebrow="ClassyCar"
        title="Stuck payments"
        subtitle="Pending bookings and initiated sales with a payment reference — match wallet settlement to confirm."
        actions={
          <Button type="button" onClick={() => void load()} disabled={loading}>
            {loading ? 'Loading…' : 'Refresh'}
          </Button>
        }
      />

      <p className="mb-4 text-sm text-slate-500">
        <Link href="/tools/classycar" className="font-semibold text-blue-700 hover:underline">
          ← ClassyCar hub
        </Link>
        {' · '}
        <Link href="/tools/payment" className="font-semibold text-blue-700 hover:underline">
          Wallet payments
        </Link>
        {' · '}
        <Link href="/tools/wallet" className="font-semibold text-blue-700 hover:underline">
          Withdrawals
        </Link>
      </p>

      <ToolsListSearch
        value={q}
        onChange={setQ}
        placeholder="Search payment ref, customer, dealer, status"
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
            Pending bookings: {String(data?.pendingBookingCount ?? 0)} · Initiated sales:{' '}
            {String(data?.initiatedSaleCount ?? 0)}
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
        <StuckClassycarHealDrawer
          key={`${healRow.kind}-${healRow.id}`}
          open
          row={healRow}
          onClose={() => setHealRow(null)}
          onResolved={() => void load()}
        />
      ) : null}
    </PadlerShell>
  );
}
