'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { PadlerShell } from '@/app/components/PadlerShell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DataTable, serialColumn, type DataTableColumn } from '@/components/ui/data-table';
import { StatePanel } from '@/components/ui/page';
import { NewBookingFlowDrawer } from '@/components/booking/NewBookingFlowDrawer';
import { TripJotterCompanyShell } from '@/components/tripjotter/TripJotterCompanyShell';
import { TripJotterListPager } from '@/components/tripjotter/TripJotterListPager';
import { ToolsListSearch } from '@/components/tools/ToolsListSearch';
import { isForbiddenError } from '@/lib/api';
import {
  fetchTripJotterCompany,
  fetchTripJotterCompanyBookings,
  TRIP_JOTTER_PAGE_SIZE
} from '@/lib/api/trip-jotter';
import type { BookingItem } from '@/lib/types';
import { formatDateTime } from '@/lib/utils';

function mapRow(row: Record<string, unknown>): BookingItem {
  const dep = row.departureTime;
  return {
    id: row.id != null ? Number(row.id) : undefined,
    bookingReference: String(row.bookingReference ?? ''),
    customerName: String(row.passengerName ?? row.customerName ?? ''),
    sourceChannel: 'TRIPJOTTER',
    routeLabel: String(row.route ?? row.routeLabel ?? 'N/A'),
    departureTime: dep != null && String(dep).trim() !== '' ? String(dep) : undefined,
    companyName:
      row.companyName != null && String(row.companyName).trim() !== ''
        ? String(row.companyName).trim()
        : undefined,
    status: String(row.status ?? 'PENDING').toUpperCase() as BookingItem['status'],
    amount: Number(row.price ?? row.amount ?? 0),
    createdAt: String(row.createdAt ?? new Date().toISOString())
  };
}

export default function TripJotterCompanyBookingsPage() {
  const params = useParams();
  const router = useRouter();
  const companyId = String(params?.id ?? '');
  const [label, setLabel] = useState('');
  const [email, setEmail] = useState('');
  const [rows, setRows] = useState<BookingItem[]>([]);
  const [page, setPage] = useState(0);
  const [q, setQ] = useState('');
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    setForbidden(false);
    try {
      const [company, result] = await Promise.all([
        fetchTripJotterCompany(companyId),
        fetchTripJotterCompanyBookings(companyId, page, TRIP_JOTTER_PAGE_SIZE, q)
      ]);
      const companyEmail = company.email?.trim() || '';
      setLabel(company.companyName || companyEmail || companyId);
      setEmail(companyEmail);
      setRows((result.rows ?? []).map(mapRow));
      setTotalPages(result.totalPages ?? 0);
      setTotalElements(result.totalElements ?? 0);
    } catch (e) {
      if (isForbiddenError(e)) setForbidden(true);
      else setError(e instanceof Error ? e.message : 'Unable to load bookings');
    } finally {
      setLoading(false);
    }
  }, [companyId, page, q]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns = useMemo<DataTableColumn<BookingItem>[]>(
    () => [
      serialColumn<BookingItem>({ page, pageSize: TRIP_JOTTER_PAGE_SIZE }),
      {
        header: 'Reference',
        id: 'reference',
        cell: ({ row }) => <code>{row.original.bookingReference ?? row.original.id}</code>
      },
      {
        header: 'Status',
        accessorKey: 'status',
        cell: ({ row }) => row.original.status ?? '—'
      },
      {
        header: 'Passenger',
        accessorKey: 'customerName',
        cell: ({ row }) => row.original.customerName ?? '—'
      },
      {
        header: 'Trip',
        id: 'trip',
        cell: ({ row }) =>
          row.original.departureTime
            ? formatDateTime(row.original.departureTime)
            : row.original.routeLabel ?? '—'
      }
    ],
    [page]
  );

  return (
    <PadlerShell>
      <TripJotterCompanyShell companyLabel={label}>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-950">Bookings</h1>
            <p className="mt-1 text-sm text-slate-500">
              Newest first (by company id). Stuck payments:{' '}
              <Link href="/tools/trip-jotter/stuck" className="font-semibold text-blue-700 hover:underline">
                Stuck checkouts
              </Link>
              .
            </p>
          </div>
          <Button
            type="button"
            variant="primary"
            disabled={!email}
            onClick={() => setDrawerOpen(true)}
            title={!email ? 'Company email needed to create a booking' : undefined}
          >
            New booking
          </Button>
        </div>
        <ToolsListSearch
          value={q}
          onChange={(value) => {
            setQ(value);
            setPage(0);
          }}
          placeholder="Search reference, passenger, status"
          hint="Search applies to the current page only"
        />
        {forbidden ? <StatePanel kind="forbidden" /> : null}
        {loading ? <StatePanel kind="loading" /> : null}
        {error ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
            {error}
          </div>
        ) : null}
        {!loading && !forbidden ? (
          <>
            <Card className="overflow-hidden p-0">
              <DataTable
                columns={columns}
                data={rows}
                emptyMessage="No bookings for this company."
                onRowClick={(row) => {
                  if (row.id != null) {
                    router.push(
                      `/tools/trip-jotter/companies/${encodeURIComponent(companyId)}/bookings/${row.id}`
                    );
                  }
                }}
              />
            </Card>
            <TripJotterListPager
              page={page}
              totalPages={totalPages}
              totalElements={totalElements}
              pageSize={TRIP_JOTTER_PAGE_SIZE}
              sortLabel="createdDesc"
              loading={loading}
              onPrev={() => setPage((p) => Math.max(0, p - 1))}
              onNext={() => setPage((p) => p + 1)}
            />
          </>
        ) : null}

        {drawerOpen && email ? (
          <NewBookingFlowDrawer
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            onBooked={() => {
              setDrawerOpen(false);
              setPage(0);
              void load();
            }}
            companyOptions={[{ email, displayName: label || email }]}
            allCompanies={false}
            pageTransportEmail={email}
            pageAllCompanies={false}
          />
        ) : null}
      </TripJotterCompanyShell>
    </PadlerShell>
  );
}
