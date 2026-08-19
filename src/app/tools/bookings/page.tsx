'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PadlerShell } from '@/app/components/PadlerShell';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { CompanyLogo } from '@/components/ui/company-logo';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { FieldLabel, Input, Select } from '@/components/ui/field';
import { FilterBar, PageHeader, Pagination, StatePanel } from '@/components/ui/page';
import { BookingItem, type BookingStatus } from '@/lib/types';
import { BOOKINGS_PAGE_SIZE, fetchBookingsPage } from '@/lib/api';
import { formatDateTime, formatMoney } from '@/lib/utils';

const ALL_BOOKING_STATUSES: (BookingStatus | 'ALL')[] = [
  'ALL',
  'PENDING',
  'CONFIRMED',
  'CANCELLED',
  'COMPLETED',
  'REFUNDED',
  'FAILED'
];

function bookingMatchesQuery(row: BookingItem, q: string): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  const hay = [
    row.bookingReference,
    row.customerName,
    row.routeLabel,
    row.companyName,
    row.status,
    String(row.amount),
    row.departureTime,
    row.createdAt
  ]
    .join(' ')
    .toLowerCase();
  return hay.includes(s);
}

export default function BookingsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<BookingItem[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<BookingStatus | 'ALL'>('ALL');

  const displayRows = useMemo(() => {
    const filtered = rows.filter((row) => {
      if (statusFilter !== 'ALL' && String(row.status).toUpperCase() !== statusFilter) {
        return false;
      }
      return bookingMatchesQuery(row, searchQuery);
    });
    return [...filtered].sort((a, b) => {
      const ta = Date.parse(a.createdAt);
      const tb = Date.parse(b.createdAt);
      const aOk = !Number.isNaN(ta);
      const bOk = !Number.isNaN(tb);
      if (aOk && bOk) return tb - ta;
      return 0;
    });
  }, [rows, searchQuery, statusFilter]);

  const runLoad = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await fetchBookingsPage({
        allCompanies: true,
        transportCompanyEmail: '',
        page,
        size: BOOKINGS_PAGE_SIZE
      });
      setRows(result.rows);
      setTotalPages(result.totalPages);
      setTotalElements(result.totalElements);
    } catch (err) {
      setRows([]);
      setTotalPages(0);
      setTotalElements(0);
      setLoadError(err instanceof Error ? err.message : 'Failed to load bookings');
    } finally {
      setLoading(false);
    }
  }, [page, reloadNonce]);

  useEffect(() => {
    void runLoad();
  }, [runLoad]);

  const columns = useMemo<DataTableColumn<BookingItem>[]>(
    () => [
      {
        header: 'S/N',
        id: 'sn',
        cell: ({ row }) => (
          <span className="tabular-nums text-slate-500">
            {page * BOOKINGS_PAGE_SIZE + row.index + 1}
          </span>
        )
      },
      {
        header: 'Reference',
        accessorKey: 'bookingReference',
        cell: ({ row }) =>
          row.original.id != null ? (
            <Link
              href={`/tools/bookings/${row.original.id}?allCompanies=true`}
              className="font-medium text-blue-700 hover:underline"
            >
              {row.original.bookingReference}
            </Link>
          ) : (
            row.original.bookingReference
          )
      },
      {
        header: 'Company',
        id: 'company',
        cell: ({ row }) => (
          <div className="flex min-w-0 items-center gap-2">
            <CompanyLogo
              logoUrl={row.original.companyLogoUrl}
              name={row.original.companyName}
              size="sm"
            />
            <span className="truncate">{row.original.companyName || '—'}</span>
          </div>
        )
      },
      {
        header: 'Passenger',
        accessorKey: 'customerName',
        cell: ({ row }) => row.original.customerName || '—'
      },
      {
        header: 'Route',
        accessorKey: 'routeLabel',
        cell: ({ row }) => row.original.routeLabel || '—'
      },
      {
        header: 'Amount',
        id: 'amount',
        cell: ({ row }) => (
          <span className="tabular-nums font-medium">{formatMoney(row.original.amount)}</span>
        )
      },
      {
        header: 'Status',
        accessorKey: 'status',
        cell: ({ row }) => <StatusBadge status={row.original.status} />
      },
      {
        header: 'Departure',
        id: 'departure',
        cell: ({ row }) =>
          row.original.departureTime ? formatDateTime(row.original.departureTime) : '—'
      },
      {
        header: 'Created',
        accessorKey: 'createdAt',
        cell: ({ row }) => formatDateTime(row.original.createdAt)
      }
    ],
    [page]
  );

  return (
    <PadlerShell>
      <PageHeader
        eyebrow="Fix problems"
        title="Bookings"
        subtitle={`${totalElements.toLocaleString()} Trip Jotter bookings across all companies`}
        actions={
          <Button type="button" variant="primary" onClick={() => setReloadNonce((n) => n + 1)} disabled={loading}>
            {loading ? 'Loading…' : 'Refresh'}
          </Button>
        }
      />

      <FilterBar>
        <FieldLabel className="min-w-[220px] flex-1">
          Search this page
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Reference, company, passenger, route, amount…"
            disabled={loading}
          />
        </FieldLabel>
        <FieldLabel className="min-w-[160px]">
          Status
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as BookingStatus | 'ALL')}
            disabled={loading}
          >
            {ALL_BOOKING_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s === 'ALL' ? 'All statuses' : s.replaceAll('_', ' ')}
              </option>
            ))}
          </Select>
        </FieldLabel>
      </FilterBar>

      {searchQuery.trim() || statusFilter !== 'ALL' ? (
        <p className="mb-4 text-xs text-slate-500">
          Search and status apply to the current page only ({BOOKINGS_PAGE_SIZE} rows from the server).
        </p>
      ) : null}

      {loadError ? <StatePanel kind="error" message={loadError} /> : null}
      {loading && rows.length === 0 ? <StatePanel kind="loading" /> : null}

      {!loadError ? (
        <Card className="overflow-hidden p-0">
          <DataTable
            columns={columns}
            data={displayRows}
            emptyMessage={
              rows.length === 0
                ? loading
                  ? 'Loading bookings…'
                  : 'No bookings returned.'
                : 'No rows match your search or status on this page.'
            }
            onRowClick={(row) => {
              if (row.id != null) {
                router.push(`/tools/bookings/${row.id}?allCompanies=true`);
              }
            }}
          />
          {(rows.length > 0 || totalElements > 0) && totalPages > 1 ? (
            <div className="border-t border-slate-100 px-4 py-3">
              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
            </div>
          ) : null}
        </Card>
      ) : null}
    </PadlerShell>
  );
}
