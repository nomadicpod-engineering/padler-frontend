'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PadlerShell } from '@/app/components/PadlerShell';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { FieldLabel, Input, Select } from '@/components/ui/field';
import { FilterBar, PageHeader, Pagination, StatePanel } from '@/components/ui/page';
import { PaymentRow, type PaymentStatus } from '@/lib/types';
import { fetchPaymentsPage, PAYMENTS_PAGE_SIZE } from '@/lib/api';
import { formatDateTime, formatMoney } from '@/lib/utils';

const ALL_PAYMENT_STATUSES: (PaymentStatus | 'ALL')[] = [
  'ALL',
  'PENDING',
  'INITIATED',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
  'SUCCESSFUL'
];


function paymentMatchesQuery(row: PaymentRow, q: string): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  const hay = [
    row.reference,
    row.currency,
    row.service,
    row.paymentProcessor,
    row.purpose,
    row.message,
    row.email,
    row.payerUserId,
    row.status,
    String(row.amount),
    row.createdAt
  ]
    .join(' ')
    .toLowerCase();
  return hay.includes(s);
}

export default function PaymentPage() {
  const router = useRouter();
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | 'ALL'>('ALL');

  const displayRows = useMemo(() => {
    const filtered = rows.filter((row) => {
      if (statusFilter !== 'ALL' && String(row.status).toUpperCase() !== statusFilter) {
        return false;
      }
      return paymentMatchesQuery(row, searchQuery);
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
      const result = await fetchPaymentsPage({ page, size: PAYMENTS_PAGE_SIZE });
      setRows(result.rows);
      setTotalPages(result.totalPages);
      setTotalElements(result.totalElements);
    } catch (err) {
      setRows([]);
      setTotalPages(0);
      setTotalElements(0);
      setLoadError(err instanceof Error ? err.message : 'Failed to load payments');
    } finally {
      setLoading(false);
    }
  }, [page, reloadNonce]);

  useEffect(() => {
    void runLoad();
  }, [runLoad]);

  const columns = useMemo<DataTableColumn<PaymentRow>[]>(
    () => [
      {
        header: 'S/N',
        id: 'sn',
        cell: ({ row }) => (
          <span className="tabular-nums text-slate-500">
            {page * PAYMENTS_PAGE_SIZE + row.index + 1}
          </span>
        )
      },
      {
        header: 'Reference',
        accessorKey: 'reference',
        cell: ({ row }) =>
          row.original.id != null ? (
            <Link
              href={`/tools/payment/${row.original.id}`}
              className="font-medium text-blue-700 hover:underline"
            >
              {row.original.reference}
            </Link>
          ) : (
            row.original.reference
          )
      },
      {
        header: 'Amount',
        id: 'amount',
        cell: ({ row }) => (
          <span className="tabular-nums font-medium">
            {formatMoney(row.original.amount, row.original.currency)}{' '}
            <span className="text-slate-500">{row.original.currency || ''}</span>
          </span>
        )
      },
      {
        header: 'Status',
        accessorKey: 'status',
        cell: ({ row }) => <StatusBadge status={row.original.status} />
      },
      {
        header: 'Service',
        accessorKey: 'service',
        cell: ({ row }) => row.original.service || '—'
      },
      {
        header: 'Processor',
        accessorKey: 'paymentProcessor',
        cell: ({ row }) => row.original.paymentProcessor || '—'
      },
      {
        header: 'Payer',
        id: 'payer',
        cell: ({ row }) => (
          <div>
            <div>{row.original.email && row.original.email !== '—' ? row.original.email : '—'}</div>
            {row.original.payerUserId && row.original.payerUserId !== '—' ? (
              <div className="text-xs text-slate-500">{row.original.payerUserId}</div>
            ) : null}
          </div>
        )
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
        title="Payments"
        subtitle={`${totalElements.toLocaleString()} wallet payments`}
        actions={
          <>
            <Button asChild>
              <Link href="/payments">Care payments list</Link>
            </Button>
            <Button type="button" variant="primary" onClick={() => setReloadNonce((n) => n + 1)} disabled={loading}>
              {loading ? 'Loading…' : 'Refresh'}
            </Button>
          </>
        }
      />

      <FilterBar>
        <FieldLabel className="min-w-[220px] flex-1">
          Search this page
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Reference, service, email, amount…"
            disabled={loading}
          />
        </FieldLabel>
        <FieldLabel className="min-w-[160px]">
          Status
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as PaymentStatus | 'ALL')}
            disabled={loading}
          >
            {ALL_PAYMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s === 'ALL' ? 'All statuses' : s.replaceAll('_', ' ')}
              </option>
            ))}
          </Select>
        </FieldLabel>
      </FilterBar>

      {searchQuery.trim() || statusFilter !== 'ALL' ? (
        <p className="mb-4 text-xs text-slate-500">
          Search and status apply to the current page only ({PAYMENTS_PAGE_SIZE} rows from the server).
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
                  ? 'Loading payments…'
                  : 'No payments returned.'
                : 'No rows match your search or status on this page.'
            }
            onRowClick={(row) => {
              if (row.id != null) router.push(`/tools/payment/${row.id}`);
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
