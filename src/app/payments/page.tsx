'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DataTableColumn } from '@/components/ui/data-table';
import { PadlerShell } from '@/app/components/PadlerShell';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { DataTable, serialColumn } from '@/components/ui/data-table';
import { PageHeader, Pagination, StatePanel } from '@/components/ui/page';
import { fetchPaymentsPage, isForbiddenError, PAYMENTS_PAGE_SIZE } from '@/lib/api';
import type { PaymentRow } from '@/lib/types';
import { formatDateTime } from '@/lib/utils';


export default function PaymentsPage() {
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setForbidden(false);
    try {
      const result = await fetchPaymentsPage({ page, size: PAYMENTS_PAGE_SIZE });
      setRows(result.rows);
      setTotalPages(result.totalPages);
      setTotalElements(result.totalElements);
    } catch (e) {
      setRows([]);
      setTotalPages(0);
      setTotalElements(0);
      if (isForbiddenError(e)) setForbidden(true);
      else setError(e instanceof Error ? e.message : 'Unable to load payments');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns = useMemo<DataTableColumn<PaymentRow>[]>(
    () => [
      serialColumn<PaymentRow>({ page, pageSize: PAYMENTS_PAGE_SIZE }),
      {
        header: 'Reference',
        accessorKey: 'reference',
        cell: ({ row }) =>
          row.original.id ? (
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
          <span className="tabular-nums">
            {row.original.currency} {row.original.amount}
          </span>
        )
      },
      {
        header: 'Status',
        accessorKey: 'status',
        cell: ({ row }) => <StatusBadge status={row.original.status} />
      },
      {
        header: 'Email',
        accessorKey: 'email',
        cell: ({ row }) => row.original.email || '—'
      },
      {
        header: 'Service',
        accessorKey: 'service',
        cell: ({ row }) => row.original.service || '—'
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
        eyebrow="Care"
        title="Payments"
        subtitle={`${totalElements} wallet payments`}
        actions={
          <>
            <Button asChild>
              <Link href="/tools/payment">Full payments tools</Link>
            </Button>
            <Button type="button" onClick={() => void load()}>
              Refresh
            </Button>
          </>
        }
      />

      {loading && rows.length === 0 ? <StatePanel kind="loading" /> : null}
      {forbidden ? <StatePanel kind="forbidden" /> : null}
      {error ? <StatePanel kind="error" message={error} /> : null}
      {!loading && !forbidden && !error && rows.length === 0 ? (
        <StatePanel kind="empty" message="No payments returned." />
      ) : null}

      {!loading && !forbidden && !error && rows.length > 0 ? (
        <Card className="overflow-hidden p-0">
          <DataTable columns={columns} data={rows} />
          <div className="border-t border-slate-100 px-4 py-3">
            <Pagination
              page={page}
              totalPages={Math.max(totalPages, 1)}
              onPageChange={setPage}
            />
          </div>
        </Card>
      ) : null}
    </PadlerShell>
  );
}
