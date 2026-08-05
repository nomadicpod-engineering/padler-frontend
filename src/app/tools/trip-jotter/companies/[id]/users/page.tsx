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
  fetchTripJotterCompany,
  fetchTripJotterCompanyUsers,
  TRIP_JOTTER_PAGE_SIZE
} from '@/lib/api/trip-jotter';
import { isForbiddenError } from '@/lib/api';

type UserRow = Record<string, unknown>;

export default function TripJotterCompanyUsersPage() {
  const params = useParams();
  const companyId = String(params?.id ?? '');
  const [label, setLabel] = useState('');
  const [rows, setRows] = useState<UserRow[]>([]);
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
        fetchTripJotterCompanyUsers(companyId, page, TRIP_JOTTER_PAGE_SIZE, q)
      ]);
      setLabel(company.companyName || company.email || companyId);
      setRows(list.content ?? []);
      setTotalPages(list.totalPages ?? 0);
      setTotalElements(list.totalElements ?? 0);
      setSort(list.sort ?? 'nameAsc');
    } catch (e) {
      if (isForbiddenError(e)) setForbidden(true);
      else setError(e instanceof Error ? e.message : 'Unable to load users');
    } finally {
      setLoading(false);
    }
  }, [companyId, page, q]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns = useMemo<DataTableColumn<UserRow>[]>(
    () => [
      serialColumn<UserRow>({ page, pageSize: TRIP_JOTTER_PAGE_SIZE }),
      {
        header: 'Name / email',
        id: 'name',
        cell: ({ row }) => (
          <div>
            <div>{String(row.original.fullName ?? row.original.name ?? row.original.email ?? '—')}</div>
            {row.original.email ? (
              <div className="text-xs text-slate-500">{String(row.original.email)}</div>
            ) : null}
          </div>
        )
      },
      {
        header: 'Role',
        id: 'role',
        cell: ({ row }) => String(row.original.role ?? row.original.roles ?? '—')
      },
      {
        header: 'Status',
        id: 'status',
        cell: ({ row }) => String(row.original.status ?? '—')
      },
      {
        header: 'User id',
        id: 'userId',
        cell: ({ row }) => <code>{String(row.original.userId ?? '—')}</code>
      }
    ],
    [page]
  );

  return (
    <PadlerShell>
      <TripJotterCompanyShell companyLabel={label}>
        <h1 className="mb-2 text-xl font-semibold text-slate-950">Users</h1>
        <p className="mb-4 text-sm text-slate-500">Staff for this transport company (sorted by name).</p>
        <ToolsListSearch
          value={q}
          onChange={(value) => {
            setQ(value);
            setPage(0);
          }}
          placeholder="Search name, email, user id"
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
              <DataTable columns={columns} data={rows} emptyMessage="No users returned." />
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
