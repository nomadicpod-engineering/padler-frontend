'use client';

import Link from 'next/link';
import type { DataTableColumn } from '@/components/ui/data-table';
import { useMemo } from 'react';
import type { CaseSummary } from '@/lib/types';
import { PADLER_QUEUES } from '@/lib/types';
import { StatusBadge } from '@/components/ui/badge';
import { DataTable, serialColumn } from '@/components/ui/data-table';
import { formatDateTime } from '@/lib/utils';


function queueLabel(key?: string | null): string {
  if (!key) return '—';
  return PADLER_QUEUES.find((q) => q.key === key)?.label ?? key;
}

type CaseTableProps = {
  rows: CaseSummary[];
  emptyMessage?: string;
  page?: number;
  pageSize?: number;
};

export function CaseTable({
  rows,
  emptyMessage = 'No cases found.',
  page = 0,
  pageSize = 0
}: CaseTableProps) {
  const columns = useMemo<DataTableColumn<CaseSummary>[]>(
    () => [
      serialColumn<CaseSummary>({ page, pageSize }),
      {
        header: 'Case',
        accessorKey: 'caseNumber',
        cell: ({ row }) => (
          <Link
            href={`/cases/${encodeURIComponent(row.original.caseNumber)}`}
            className="font-medium text-blue-700 hover:underline"
          >
            {row.original.caseNumber}
          </Link>
        )
      },
      {
        header: 'Subject',
        accessorKey: 'subject',
        cell: ({ row }) => row.original.subject ?? '—'
      },
      {
        header: 'Status',
        accessorKey: 'status',
        cell: ({ row }) => <StatusBadge status={row.original.status} />
      },
      {
        header: 'Queue',
        accessorKey: 'queueKey',
        cell: ({ row }) => queueLabel(row.original.queueKey)
      },
      {
        header: 'Priority',
        accessorKey: 'priority',
        cell: ({ row }) => row.original.priority ?? '—'
      },
      {
        header: 'Customer',
        id: 'customer',
        cell: ({ row }) =>
          row.original.customerName ||
          row.original.customerEmail ||
          row.original.customerUserId ||
          '—'
      },
      {
        header: 'Updated',
        id: 'updated',
        cell: ({ row }) => formatDateTime(row.original.updatedAt ?? row.original.createdAt)
      }
    ],
    [page, pageSize]
  );

  return <DataTable columns={columns} data={rows} emptyMessage={emptyMessage} />;
}
