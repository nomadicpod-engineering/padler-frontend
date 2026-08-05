'use client';

import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { PadlerShell } from '@/app/components/PadlerShell';
import { Card } from '@/components/ui/card';
import { DataTable, serialColumn, type DataTableColumn } from '@/components/ui/data-table';
import { StatePanel } from '@/components/ui/page';
import { TripJotterCompanyShell } from '@/components/tripjotter/TripJotterCompanyShell';
import { TripJotterListPager } from '@/components/tripjotter/TripJotterListPager';
import { ToolsListSearch } from '@/components/tools/ToolsListSearch';
import {
  fetchTripJotterCompanyTerminals,
  fetchTripJotterCompany,
  TRIP_JOTTER_PAGE_SIZE
} from '@/lib/api/trip-jotter';
import { isForbiddenError } from '@/lib/api';

type TerminalRow = Record<string, unknown>;

export default function TripJotterCompanyTerminalsPage() {
  const params = useParams();
  const companyId = String(params?.id ?? '');
  const [label, setLabel] = useState('');
  const [rows, setRows] = useState<TerminalRow[]>([]);
  const [page, setPage] = useState(0);
  const [q, setQ] = useState('');
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [sort, setSort] = useState('nameAsc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    setForbidden(false);
    try {
      const [company, list] = await Promise.all([
        fetchTripJotterCompany(companyId),
        fetchTripJotterCompanyTerminals(companyId, page, TRIP_JOTTER_PAGE_SIZE, q)
      ]);
      setLabel(company.companyName || company.email || companyId);
      setRows(list.content ?? []);
      setTotalPages(list.totalPages ?? 0);
      setTotalElements(list.totalElements ?? 0);
      setSort(list.sort ?? 'nameAsc');
    } catch (e) {
      if (isForbiddenError(e)) setForbidden(true);
      else setError(e instanceof Error ? e.message : 'Unable to load terminals');
    } finally {
      setLoading(false);
    }
  }, [companyId, page, q]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns = useMemo<DataTableColumn<TerminalRow>[]>(
    () => [
      serialColumn<TerminalRow>({ page, pageSize: TRIP_JOTTER_PAGE_SIZE }),
      {
        header: 'Name / location',
        id: 'name',
        cell: ({ row }) => (
          <div>
            <div>{String(row.original.name ?? row.original.terminalName ?? row.original.location ?? '—')}</div>
            {row.original.address ? (
              <div className="text-xs text-slate-500">{String(row.original.address)}</div>
            ) : null}
          </div>
        )
      },
      {
        header: 'Status',
        id: 'status',
        cell: ({ row }) => String(row.original.status ?? '—')
      },
      {
        header: 'Id',
        id: 'id',
        cell: ({ row }) => <code>{String(row.original.id ?? '—')}</code>
      }
    ],
    [page]
  );

  return (
    <PadlerShell>
      <TripJotterCompanyShell companyLabel={label}>
        <h1 className="mb-2 text-xl font-semibold text-slate-950">Terminals</h1>
        <p className="mb-4 text-sm text-slate-500">
          Company terminals (sorted by name). If empty and KYB is incomplete, approve KYB from the
          journey first.
        </p>
        <ToolsListSearch
          value={q}
          onChange={(value) => {
            setQ(value);
            setPage(0);
          }}
          placeholder="Search name, location, id"
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
              <DataTable columns={columns} data={rows} emptyMessage="No terminals for this company yet." />
            </Card>
            <TripJotterListPager
              page={page}
              totalPages={totalPages}
              totalElements={totalElements}
              pageSize={TRIP_JOTTER_PAGE_SIZE}
              sortLabel={sort}
              loading={loading}
              onPrev={() => setPage((p) => Math.max(0, p - 1))}
              onNext={() => setPage((p) => p + 1)}
            />
          </>
        ) : null}
      </TripJotterCompanyShell>
    </PadlerShell>
  );
}
