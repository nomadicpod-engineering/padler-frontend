'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { PadlerShell } from '@/app/components/PadlerShell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DataTable, serialColumn, type DataTableColumn } from '@/components/ui/data-table';
import { PageHeader, StatePanel } from '@/components/ui/page';
import { ToolsListSearch } from '@/components/tools/ToolsListSearch';
import { confirmClassycarBooking, fetchClassycarBookings } from '@/lib/api/classycar-tools';
import { isForbiddenError } from '@/lib/api';

type BookingRow = Record<string, unknown>;

export default function ClassycarBookingsPage() {
  const [rows, setRows] = useState<BookingRow[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const initialQuery = new URLSearchParams(window.location.search).get('q');
    if (initialQuery) setQ(initialQuery);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setForbidden(false);
    try {
      setRows(await fetchClassycarBookings(q));
    } catch (e) {
      if (isForbiddenError(e)) setForbidden(true);
      else setError(e instanceof Error ? e.message : 'Unable to load bookings');
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    void load();
  }, [load]);

  const confirm = async (id: string) => {
    setBusyId(id);
    setError(null);
    setMessage(null);
    try {
      await confirmClassycarBooking(id);
      setMessage(`Booking ${id} confirmed`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Confirm failed');
    } finally {
      setBusyId(null);
    }
  };

  const columns = useMemo<DataTableColumn<BookingRow>[]>(
    () => [
      serialColumn<BookingRow>(),
      {
        header: 'Id',
        id: 'id',
        cell: ({ row }) => <code>{String(row.original.id ?? '')}</code>
      },
      {
        header: 'Status',
        id: 'status',
        cell: ({ row }) => String(row.original.status ?? '—')
      },
      {
        header: 'Customer',
        id: 'customer',
        cell: ({ row }) => String(row.original.customerName ?? row.original.customerEmail ?? '—')
      },
      {
        header: 'Heal',
        id: 'heal',
        cell: ({ row }) => {
          const id = String(row.original.id ?? '');
          const status = String(row.original.status ?? '');
          if (status.toUpperCase() !== 'PENDING') return '—';
          return (
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={busyId === id}
              onClick={() => void confirm(id)}
            >
              {busyId === id ? 'Confirming…' : 'Confirm'}
            </Button>
          );
        }
      }
    ],
    [busyId]
  );

  return (
    <PadlerShell>
      <PageHeader
        eyebrow="ClassyCar"
        title="Bookings"
        subtitle="Confirm pending bookings (heal). Search applies to loaded list."
      />

      <p className="mb-4 text-sm text-slate-500">
        <Link href="/tools/classycar" className="font-semibold text-blue-700 hover:underline">
          ← ClassyCar hub
        </Link>
      </p>

      <ToolsListSearch value={q} onChange={setQ} placeholder="Search id, status, passenger" />

      {forbidden ? <StatePanel kind="forbidden" /> : null}
      {loading && rows.length === 0 ? <StatePanel kind="loading" /> : null}
      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {error}
        </div>
      ) : null}
      {message ? <p className="mb-4 text-sm text-slate-500">{message}</p> : null}

      {!loading && !forbidden ? (
        <Card className="overflow-hidden p-0">
          <DataTable columns={columns} data={rows} emptyMessage="No bookings." />
        </Card>
      ) : null}
    </PadlerShell>
  );
}
