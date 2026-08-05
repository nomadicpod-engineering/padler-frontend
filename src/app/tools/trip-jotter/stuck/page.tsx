'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { PadlerShell } from '@/app/components/PadlerShell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DataTable, serialColumn, type DataTableColumn } from '@/components/ui/data-table';
import { PageHeader, StatePanel } from '@/components/ui/page';
import {
  StuckCheckoutHealDrawer,
  toStuckCheckoutRow,
  type StuckCheckoutRow
} from '@/components/tripjotter/StuckCheckoutHealDrawer';
import { ToolsListSearch } from '@/components/tools/ToolsListSearch';
import { fetchTripJotterStuckCheckouts } from '@/lib/api/trip-jotter';
import { isForbiddenError } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';

type StuckSampleRow = Record<string, unknown>;

export default function TripJotterStuckPage() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [healRow, setHealRow] = useState<StuckCheckoutRow | null>(null);
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
      setData(await fetchTripJotterStuckCheckouts());
    } catch (e) {
      if (isForbiddenError(e)) setForbidden(true);
      else setError(e instanceof Error ? e.message : 'Unable to load stuck checkouts');
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
        row.bookingReference,
        row.status,
        row.companyName,
        row.transportCompanyEmail,
        row.transportCompanyId,
        row.passengerEmail,
        row.customerUserId
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
        cell: ({ row }) => <code>{String(row.original.bookingReference ?? '')}</code>
      },
      {
        header: 'Status',
        id: 'status',
        cell: ({ row }) => String(row.original.status ?? '—')
      },
      {
        header: 'Company',
        id: 'company',
        cell: ({ row }) =>
          String(row.original.companyName ?? row.original.transportCompanyEmail ?? row.original.transportCompanyId ?? '—')
      },
      {
        header: 'Passenger',
        id: 'passenger',
        cell: ({ row }) => String(row.original.passengerEmail ?? row.original.customerUserId ?? '—')
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
          const ref = String(row.original.bookingReference ?? '');
          return (
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={!ref}
              onClick={() => setHealRow(toStuckCheckoutRow(row.original))}
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
        eyebrow="Trip Jotter"
        title="Unfinished payments"
        subtitle="Bookings waiting on payment or ticket confirmation — open Fix to match or retry."
        actions={
          <Button type="button" onClick={() => void load()} disabled={loading}>
            {loading ? 'Loading…' : 'Refresh'}
          </Button>
        }
      />

      <p className="mb-4 text-sm text-slate-500">
        <Link href="/tools/trip-jotter" className="font-semibold text-blue-700 hover:underline">
          ← Trip Jotter hub
        </Link>
      </p>

      <ToolsListSearch
        value={q}
        onChange={setQ}
        placeholder="Search reference, company, passenger, status"
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
            Pending payment: {String(data?.pendingPaymentCount ?? 0)} · GDS pending:{' '}
            {String(data?.gdsPendingCount ?? 0)}
          </p>
          <Card className="overflow-hidden p-0">
            <DataTable
              columns={columns}
              data={filtered}
              emptyMessage={
                samples.length === 0 ? 'No stuck checkout samples.' : 'No samples match this search.'
              }
            />
          </Card>
        </>
      ) : null}

      {healRow ? (
        <StuckCheckoutHealDrawer
          key={healRow.bookingReference}
          open
          row={healRow}
          onClose={() => setHealRow(null)}
          onResolved={() => {
            setHealRow(null);
            void load();
          }}
        />
      ) : null}
    </PadlerShell>
  );
}
