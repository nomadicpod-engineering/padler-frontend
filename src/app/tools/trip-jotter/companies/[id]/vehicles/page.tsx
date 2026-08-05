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
  fetchTripJotterCompanyVehicles,
  TRIP_JOTTER_PAGE_SIZE
} from '@/lib/api/trip-jotter';
import { isForbiddenError } from '@/lib/api';

type VehicleRow = Record<string, unknown>;

export default function TripJotterCompanyVehiclesPage() {
  const params = useParams();
  const companyId = String(params?.id ?? '');
  const [label, setLabel] = useState('');
  const [rows, setRows] = useState<VehicleRow[]>([]);
  const [page, setPage] = useState(0);
  const [q, setQ] = useState('');
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [sort, setSort] = useState('plateAsc');
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
        fetchTripJotterCompanyVehicles(companyId, page, TRIP_JOTTER_PAGE_SIZE, q)
      ]);
      setLabel(company.companyName || company.email || companyId);
      setRows(list.content ?? []);
      setTotalPages(list.totalPages ?? 0);
      setTotalElements(list.totalElements ?? 0);
      setSort(list.sort ?? 'plateAsc');
    } catch (e) {
      if (isForbiddenError(e)) setForbidden(true);
      else setError(e instanceof Error ? e.message : 'Unable to load vehicles');
    } finally {
      setLoading(false);
    }
  }, [companyId, page, q]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns = useMemo<DataTableColumn<VehicleRow>[]>(
    () => [
      serialColumn<VehicleRow>({ page, pageSize: TRIP_JOTTER_PAGE_SIZE }),
      {
        header: 'Plate / type',
        id: 'plate',
        cell: ({ row }) => (
          <div>
            <div>{String(row.original.licensePlate ?? row.original.plateNumber ?? '—')}</div>
            <div className="text-xs text-slate-500">{String(row.original.type ?? row.original.vehicleType ?? '')}</div>
          </div>
        )
      },
      {
        header: 'Capacity',
        id: 'capacity',
        cell: ({ row }) => String(row.original.capacity ?? row.original.seats ?? '—')
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
        <h1 className="mb-2 text-xl font-semibold text-slate-950">Vehicles</h1>
        <p className="mb-4 text-sm text-slate-500">Fleet for this company (sorted by plate).</p>
        <ToolsListSearch
          value={q}
          onChange={(value) => {
            setQ(value);
            setPage(0);
          }}
          placeholder="Search plate, type, id"
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
              <DataTable columns={columns} data={rows} emptyMessage="No vehicles for this company yet." />
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
