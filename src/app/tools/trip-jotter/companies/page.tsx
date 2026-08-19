'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { PadlerShell } from '@/app/components/PadlerShell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/badge';
import { DataTable, serialColumn, type DataTableColumn } from '@/components/ui/data-table';
import { ListSearch, PageHeader, StatePanel } from '@/components/ui/page';
import { CompanyLogo } from '@/components/ui/company-logo';
import { fetchTripJotterCompanies, type TripJotterCompany } from '@/lib/api/trip-jotter';
import { isForbiddenError } from '@/lib/api';

export default function TripJotterCompaniesPage() {
  const [rows, setRows] = useState<TripJotterCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setForbidden(false);
    try {
      setRows(await fetchTripJotterCompanies());
    } catch (e) {
      if (isForbiddenError(e)) setForbidden(true);
      else setError(e instanceof Error ? e.message : 'Unable to load companies');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((c) =>
      [c.companyName, c.email, c.userId, String(c.id ?? '')]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle))
    );
  }, [rows, q]);

  const columns = useMemo<DataTableColumn<TripJotterCompany>[]>(
    () => [
      serialColumn<TripJotterCompany>(),
      {
        header: 'Company',
        id: 'company',
        cell: ({ row }) => {
          const name = row.original.companyName || row.original.userId || '—';
          return (
            <div className="flex min-w-0 items-center gap-2">
              <CompanyLogo logoUrl={row.original.companyLogo} name={name} size="sm" />
              <span className="truncate">{name}</span>
            </div>
          );
        }
      },
      {
        header: 'Email',
        id: 'email',
        cell: ({ row }) => row.original.email || '—'
      },
      {
        header: 'KYB',
        id: 'kyb',
        cell: ({ row }) => {
          const status =
            row.original.verificationStatus ||
            (row.original.isTransportCompanyVerified ? 'VERIFIED' : undefined);
          return status ? <StatusBadge status={status} /> : '—';
        }
      },
      {
        header: '',
        id: 'open',
        cell: ({ row }) =>
          row.original.id != null ? (
            <Link
              className="font-semibold text-blue-700 hover:underline"
              href={`/tools/trip-jotter/companies/${encodeURIComponent(String(row.original.id))}`}
            >
              Open
            </Link>
          ) : (
            '—'
          )
      }
    ],
    []
  );

  return (
    <PadlerShell>
      <PageHeader
        eyebrow="Trip Jotter"
        title="Companies"
        subtitle="Open a company for journey, users, terminals, and bookings."
        actions={
          <Button type="button" onClick={() => void load()} disabled={loading}>
            {loading ? 'Loading…' : 'Refresh'}
          </Button>
        }
      />

      <p className="mb-4 text-sm text-slate-500">
        <Link href="/tools/trip-jotter" className="font-semibold text-blue-700 hover:underline">
          ← Trip Jotter hub
        </Link>
      </p>

      <ListSearch
        value={q}
        onChange={setQ}
        placeholder="Search name, email, user id"
        hint={`${filtered.length} of ${rows.length}`}
      />

      {forbidden ? <StatePanel kind="forbidden" /> : null}
      {loading && rows.length === 0 ? <StatePanel kind="loading" /> : null}
      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {error}
        </div>
      ) : null}

      {!loading && !forbidden ? (
        <Card className="overflow-hidden p-0">
          <DataTable columns={columns} data={filtered} emptyMessage="No companies found." />
        </Card>
      ) : null}
    </PadlerShell>
  );
}
