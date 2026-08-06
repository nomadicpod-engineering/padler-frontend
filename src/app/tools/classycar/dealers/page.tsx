'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { PadlerShell } from '@/app/components/PadlerShell';
import { Card } from '@/components/ui/card';
import { DataTable, serialColumn, type DataTableColumn } from '@/components/ui/data-table';
import { PageHeader, StatePanel } from '@/components/ui/page';
import { ToolsListSearch } from '@/components/tools/ToolsListSearch';
import { fetchClassycarDealers } from '@/lib/api/classycar-tools';
import { isForbiddenError } from '@/lib/api';

type DealerRow = Record<string, unknown>;

export default function ClassycarDealersPage() {
  const [rows, setRows] = useState<DealerRow[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setForbidden(false);
    try {
      setRows(await fetchClassycarDealers(q));
    } catch (e) {
      if (isForbiddenError(e)) setForbidden(true);
      else setError(e instanceof Error ? e.message : 'Unable to load dealers');
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns = useMemo<DataTableColumn<DealerRow>[]>(
    () => [
      serialColumn<DealerRow>(),
      {
        header: 'Email',
        id: 'email',
        cell: ({ row }) => {
          const id = String(row.original.id ?? '');
          return (
            <Link
              className="font-medium text-blue-700 hover:underline"
              href={`/tools/classycar/dealers/${encodeURIComponent(id)}`}
            >
              {String(row.original.email ?? id)}
            </Link>
          );
        }
      },
      {
        header: 'Status',
        id: 'status',
        cell: ({ row }) => String(row.original.status ?? '—')
      },
      {
        header: 'Type',
        id: 'type',
        cell: ({ row }) => String(row.original.dealerType ?? '—')
      },
      {
        header: 'User id',
        id: 'userId',
        cell: ({ row }) => <code>{String(row.original.userId ?? '—')}</code>
      }
    ],
    []
  );

  return (
    <PadlerShell>
      <PageHeader
        eyebrow="Npod-Auto"
        title="Dealers"
        subtitle="Open a dealer for KYB and booking/payment journey."
      />

      <p className="mb-4 text-sm text-slate-500">
        <Link href="/tools/classycar" className="font-semibold text-blue-700 hover:underline">
          ← Npod-Auto hub
        </Link>
      </p>

      <ToolsListSearch value={q} onChange={setQ} placeholder="Search email, user id, status" />

      {forbidden ? <StatePanel kind="forbidden" /> : null}
      {loading && rows.length === 0 ? <StatePanel kind="loading" /> : null}
      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {error}
        </div>
      ) : null}

      {!loading && !forbidden ? (
        <Card className="overflow-hidden p-0">
          <DataTable columns={columns} data={rows} emptyMessage="No dealers." />
        </Card>
      ) : null}
    </PadlerShell>
  );
}
