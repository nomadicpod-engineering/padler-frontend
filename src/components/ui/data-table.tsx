'use client';

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef
} from '@tanstack/react-table';
import { cn } from '@/lib/utils';

export type DataTableColumn<T> = ColumnDef<T, unknown>;

type SerialColumnOptions = {
  /** 0-based page index for server-paginated lists. */
  page?: number;
  /** Page size for server-paginated lists; use 0 for non-paginated. */
  pageSize?: number;
};

/** First-column serial number helper: `page * pageSize + row.index + 1`. */
export function serialColumn<T>(options: SerialColumnOptions = {}): DataTableColumn<T> {
  const page = options.page ?? 0;
  const pageSize = options.pageSize ?? 0;
  return {
    id: 'sn',
    header: 'S/N',
    cell: ({ row }) => (
      <span className="tabular-nums text-slate-500">{page * pageSize + row.index + 1}</span>
    )
  };
}

/** Convenience for raw table loops (non-TanStack). */
export function serialNumber(rowIndex: number, page = 0, pageSize = 0): number {
  return page * pageSize + rowIndex + 1;
}

type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  data: T[];
  emptyMessage?: string;
  className?: string;
  onRowClick?: (row: T) => void;
};

export function DataTable<T>({
  columns,
  data,
  emptyMessage = 'Nothing to show yet.',
  className,
  onRowClick
}: DataTableProps<T>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel()
  });

  if (!data.length) {
    return <p className="text-sm text-slate-500">{emptyMessage}</p>;
  }

  return (
    <div className={cn('overflow-x-auto rounded-2xl border border-slate-200 bg-white', className)}>
      <table className="min-w-full border-collapse whitespace-nowrap text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id} className="px-4 py-3 font-semibold">
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              className={cn(
                'border-t border-slate-100 transition-colors hover:bg-slate-50/80',
                onRowClick && 'cursor-pointer focus-visible:bg-blue-50 focus-visible:outline-none'
              )}
              tabIndex={onRowClick ? 0 : undefined}
              onClick={onRowClick ? () => onRowClick(row.original) : undefined}
              onKeyDown={
                onRowClick
                  ? (event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onRowClick(row.original);
                      }
                    }
                  : undefined
              }
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-4 py-3 align-middle text-slate-800">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
