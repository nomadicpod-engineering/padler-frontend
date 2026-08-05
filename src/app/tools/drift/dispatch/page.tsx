'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { PadlerShell } from '@/app/components/PadlerShell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DataTable, serialColumn, type DataTableColumn } from '@/components/ui/data-table';
import { PageHeader, StatePanel } from '@/components/ui/page';
import { ToolsListSearch } from '@/components/tools/ToolsListSearch';
import { fetchDriftDispatch } from '@/lib/api/drift-tools';
import { isForbiddenError } from '@/lib/api';

type DispatchRow = Record<string, unknown>;

export default function DriftDispatchListPage() {
  const [rows, setRows] = useState<DispatchRow[]>([]);
  const [q, setQ] = useState('');
  const [partyType, setPartyType] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    const initialQuery = new URLSearchParams(window.location.search).get('q');
    if (initialQuery) setQ(initialQuery);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setForbidden(false);
    try {
      setRows(await fetchDriftDispatch({ partyType, q }));
    } catch (e) {
      if (isForbiddenError(e)) setForbidden(true);
      else setError(e instanceof Error ? e.message : 'Unable to load dispatch parties');
    } finally {
      setLoading(false);
    }
  }, [partyType, q]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns = useMemo<DataTableColumn<DispatchRow>[]>(
    () => [
      serialColumn<DispatchRow>(),
      {
        header: 'Name',
        id: 'name',
        cell: ({ row }) => {
          const id = String(row.original.id ?? '');
          const type = String(row.original.partyType ?? 'COMPANY').toLowerCase();
          return (
            <Link
              className="font-medium text-blue-700 hover:underline"
              href={`/tools/drift/dispatch/${type}/${encodeURIComponent(id)}`}
            >
              {String(row.original.name ?? row.original.email ?? id)}
            </Link>
          );
        }
      },
      {
        header: 'Type',
        id: 'partyType',
        cell: ({ row }) => String(row.original.partyType ?? '—')
      },
      {
        header: 'Status',
        id: 'status',
        cell: ({ row }) => String(row.original.verificationStatus ?? '—')
      },
      {
        header: 'Email',
        id: 'email',
        cell: ({ row }) => String(row.original.email ?? row.original.userId ?? '—')
      }
    ],
    []
  );

  return (
    <PadlerShell>
      <PageHeader
        eyebrow="Drift"
        title="Dispatch parties"
        subtitle="Companies and individuals — open journey for KYB and money steps."
      />

      <p className="mb-4 text-sm text-slate-500">
        <Link href="/tools/drift" className="font-semibold text-blue-700 hover:underline">
          ← Drift hub
        </Link>
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        {(['ALL', 'COMPANY', 'INDIVIDUAL'] as const).map((t) => (
          <Button
            key={t}
            type="button"
            variant={partyType === t ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setPartyType(t)}
          >
            {t}
          </Button>
        ))}
      </div>

      <ToolsListSearch value={q} onChange={setQ} placeholder="Search name, email, user id, status" />

      {forbidden ? <StatePanel kind="forbidden" /> : null}
      {loading && rows.length === 0 ? <StatePanel kind="loading" /> : null}
      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {error}
        </div>
      ) : null}

      {!loading && !forbidden ? (
        <Card className="overflow-hidden p-0">
          <DataTable columns={columns} data={rows} emptyMessage="No dispatch parties." />
        </Card>
      ) : null}
    </PadlerShell>
  );
}
