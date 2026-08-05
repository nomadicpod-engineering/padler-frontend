'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PadlerShell } from '@/app/components/PadlerShell';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable, serialColumn, type DataTableColumn } from '@/components/ui/data-table';
import { FieldLabel, Input, Select, Textarea } from '@/components/ui/field';
import { FilterBar, PageHeader, Pagination, StatePanel } from '@/components/ui/page';
import { createIncident, isForbiddenError, listIncidents } from '@/lib/api';
import { getAuthSession } from '@/lib/auth';
import type { IncidentSummary } from '@/lib/types';
import {
  canManageCases,
  INCIDENT_SEVERITIES,
  INCIDENT_STATUSES
} from '@/lib/types';
import { formatDateTime } from '@/lib/utils';


const PAGE_SIZE = 20;

export default function IncidentsPage() {
  const router = useRouter();
  const [status, setStatus] = useState('');
  const [rows, setRows] = useState<IncidentSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [severity, setSeverity] = useState('HIGH');
  const [productKey, setProductKey] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    setCanManage(canManageCases(getAuthSession()?.designation));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setForbidden(false);
    try {
      const result = await listIncidents({
        status: status || undefined,
        page,
        size: PAGE_SIZE
      });
      setRows(result.content);
      setTotal(result.totalElements);
    } catch (e) {
      setRows([]);
      if (isForbiddenError(e)) setForbidden(true);
      else setError(e instanceof Error ? e.message : 'Unable to list incidents');
    } finally {
      setLoading(false);
    }
  }, [status, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      const created = await createIncident({
        title: title.trim(),
        summary: summary.trim(),
        severity,
        productKey: productKey.trim() || undefined
      });
      setCreateOpen(false);
      setTitle('');
      setSummary('');
      router.push(`/incidents/${encodeURIComponent(created.incidentNumber)}`);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setCreating(false);
    }
  };

  const columns = useMemo<DataTableColumn<IncidentSummary>[]>(
    () => [
      serialColumn<IncidentSummary>({ page, pageSize: PAGE_SIZE }),
      {
        header: 'Incident',
        accessorKey: 'incidentNumber',
        cell: ({ row }) => (
          <Link
            href={`/incidents/${encodeURIComponent(row.original.incidentNumber)}`}
            className="font-medium text-blue-700 hover:underline"
          >
            {row.original.incidentNumber}
          </Link>
        )
      },
      {
        header: 'Title',
        accessorKey: 'title',
        cell: ({ row }) => row.original.title ?? '—'
      },
      {
        header: 'Status',
        accessorKey: 'status',
        cell: ({ row }) => <StatusBadge status={row.original.status} />
      },
      {
        header: 'Severity',
        accessorKey: 'severity',
        cell: ({ row }) => row.original.severity ?? '—'
      },
      {
        header: 'Linked cases',
        id: 'linked',
        cell: ({ row }) => (row.original.linkedCaseNumbers ?? []).length || '—'
      },
      {
        header: 'Started',
        id: 'started',
        cell: ({ row }) => formatDateTime(row.original.startedAt ?? row.original.createdAt)
      }
    ],
    [page]
  );

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <PadlerShell>
      <PageHeader
        eyebrow="Outages"
        title="Incidents"
        subtitle="Track outages and the customer cases they affect"
        actions={
          <>
            <Button type="button" onClick={() => void load()}>
              Refresh
            </Button>
            {canManage ? (
              <Button
                type="button"
                variant="primary"
                onClick={() => setCreateOpen((v) => !v)}
              >
                {createOpen ? 'Cancel' : 'New incident'}
              </Button>
            ) : null}
          </>
        }
      />

      <FilterBar
        onSubmit={() => {
          setPage(0);
          void load();
        }}
      >
        <FieldLabel className="min-w-[160px]">
          Status
          <Select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(0);
            }}
          >
            <option value="">All</option>
            {INCIDENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replaceAll('_', ' ')}
              </option>
            ))}
          </Select>
        </FieldLabel>
        <Button type="submit" disabled={loading}>
          Filter
        </Button>
      </FilterBar>

      {createOpen ? (
        <Card className="mb-5">
          <CardHeader>
            <CardTitle>Create incident</CardTitle>
          </CardHeader>
          <CardContent>
            {createError ? (
              <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
                {createError}
              </div>
            ) : null}
            <form onSubmit={onCreate} className="grid gap-3 sm:grid-cols-2">
              <FieldLabel className="sm:col-span-2">
                Title
                <Input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={240} />
              </FieldLabel>
              <FieldLabel className="sm:col-span-2">
                Summary
                <Textarea
                  rows={3}
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  required
                  maxLength={4000}
                />
              </FieldLabel>
              <FieldLabel>
                Severity
                <Select value={severity} onChange={(e) => setSeverity(e.target.value)}>
                  {INCIDENT_SEVERITIES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </FieldLabel>
              <FieldLabel>
                Product (optional)
                <Input
                  value={productKey}
                  onChange={(e) => setProductKey(e.target.value)}
                  placeholder="e.g. trip-jotter"
                />
              </FieldLabel>
              <div className="sm:col-span-2">
                <Button type="submit" variant="primary" disabled={creating}>
                  {creating ? 'Creating…' : 'Create'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {loading && rows.length === 0 ? <StatePanel kind="loading" /> : null}
      {forbidden ? <StatePanel kind="forbidden" /> : null}
      {error ? <StatePanel kind="error" message={error} /> : null}
      {!loading && !forbidden && !error && rows.length === 0 ? (
        <StatePanel kind="empty" message="No incidents match this filter." />
      ) : null}

      {!loading && !forbidden && !error && rows.length > 0 ? (
        <Card className="overflow-hidden p-0">
          <DataTable columns={columns} data={rows} />
          <div className="border-t border-slate-100 px-4 py-3">
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        </Card>
      ) : null}
    </PadlerShell>
  );
}
