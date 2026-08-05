'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { PadlerShell } from '@/app/components/PadlerShell';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ListSearch, PageHeader, StatePanel } from '@/components/ui/page';
import {
  fetchTripJotterCompanies,
  fetchTripJotterCompanyUsage,
  fetchTripJotterStuckCheckouts,
  type TripJotterCompany,
  type TripJotterCompanyUsage
} from '@/lib/api/trip-jotter';
import { isForbiddenError } from '@/lib/api';

type CompanyCardCounts = {
  users?: number | null;
  terminals?: number | null;
  vehicles?: number | null;
  trips?: number | null;
  bookings?: number | null;
  unfinished?: number | null;
};

function stepCount(usage: TripJotterCompanyUsage | undefined, key: string): number | null {
  const step = (usage?.steps ?? []).find((s) => s.key === key);
  return step?.count ?? null;
}

function companyTitle(c: TripJotterCompany): string {
  return String(c.companyName || c.email || c.userId || c.id || 'Company');
}

function CountChip({ label, value }: { label: string; value?: number | null }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
      <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums text-slate-950">
        {value == null ? '—' : value.toLocaleString()}
      </div>
    </div>
  );
}

export default function TripJotterHubPage() {
  const [companies, setCompanies] = useState<TripJotterCompany[]>([]);
  const [usageById, setUsageById] = useState<Record<string, TripJotterCompanyUsage>>({});
  const [stuck, setStuck] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [countsLoading, setCountsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setForbidden(false);
    try {
      const [c, s] = await Promise.all([
        fetchTripJotterCompanies(),
        fetchTripJotterStuckCheckouts().catch(() => null)
      ]);
      setCompanies(c);
      setStuck(s);

      setCountsLoading(true);
      const settled = await Promise.allSettled(
        c
          .filter((row) => row.id != null)
          .map(async (row) => {
            const usage = await fetchTripJotterCompanyUsage(row.id!);
            return [String(row.id), usage] as const;
          })
      );
      const next: Record<string, TripJotterCompanyUsage> = {};
      for (const result of settled) {
        if (result.status === 'fulfilled') {
          const [id, usage] = result.value;
          next[id] = usage;
        }
      }
      setUsageById(next);
    } catch (e) {
      if (isForbiddenError(e)) setForbidden(true);
      else setError(e instanceof Error ? e.message : 'Unable to load Trip Jotter hub');
    } finally {
      setLoading(false);
      setCountsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const pending = Number(stuck?.pendingPaymentCount ?? 0);
  const gds = Number(stuck?.gdsPendingCount ?? 0);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return companies;
    return companies.filter((c) =>
      [c.companyName, c.email, c.userId, c.verificationStatus, String(c.id ?? '')]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle))
    );
  }, [companies, q]);

  return (
    <PadlerShell>
      <PageHeader
        eyebrow="Fix problems"
        title="Trip Jotter"
        subtitle="Companies, journeys, bookings, and unfinished booking payments."
        actions={
          <Button type="button" onClick={() => void load()} disabled={loading}>
            {loading ? 'Loading…' : 'Refresh'}
          </Button>
        }
      />

      {forbidden ? <StatePanel kind="forbidden" /> : null}
      {loading ? <StatePanel kind="loading" skeleton="cards" /> : null}
      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {error}
        </div>
      ) : null}

      {!loading && !forbidden ? (
        <div className="mb-5 grid gap-3 sm:grid-cols-2">
          <Link href="/tools/trip-jotter/companies" className="group block">
            <Card className="h-full transition duration-200 group-hover:-translate-y-0.5 group-hover:border-blue-200 group-hover:shadow-md motion-reduce:transform-none">
              <CardHeader>
                <div>
                  <CardTitle>All companies</CardTitle>
                  <CardDescription>{companies.length} transport companies</CardDescription>
                </div>
              </CardHeader>
            </Card>
          </Link>
          <Link href="/tools/trip-jotter/stuck" className="group block">
            <Card className="h-full transition duration-200 group-hover:-translate-y-0.5 group-hover:border-blue-200 group-hover:shadow-md motion-reduce:transform-none">
              <CardHeader>
                <div>
                  <CardTitle>Unfinished payments</CardTitle>
                  <CardDescription>
                    {pending} pending payment · {gds} GDS pending
                  </CardDescription>
                </div>
              </CardHeader>
            </Card>
          </Link>
        </div>
      ) : null}

      {!loading && !forbidden ? (
        <>
          <div className="mb-2 flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-base font-semibold text-slate-950">Companies</h2>
            {countsLoading ? (
              <span className="text-xs text-slate-500">Loading counts…</span>
            ) : null}
          </div>
          <ListSearch
            value={q}
            onChange={setQ}
            placeholder="Search company name, email, user id…"
            hint={`${filtered.length} of ${companies.length}`}
          />
        </>
      ) : null}

      {!loading && !forbidden && filtered.length === 0 ? (
        <StatePanel
          kind="empty"
          message={q.trim() ? 'No companies match this search.' : 'No transport companies found.'}
        />
      ) : null}

      {!loading && !forbidden && filtered.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c) => {
            const id = c.id != null ? String(c.id) : '';
            const usage = id ? usageById[id] : undefined;
            const counts: CompanyCardCounts = {
              users: stepCount(usage, 'USERS'),
              terminals: stepCount(usage, 'TERMINALS'),
              vehicles: stepCount(usage, 'VEHICLES'),
              trips: stepCount(usage, 'TRIPS'),
              bookings: stepCount(usage, 'BOOKINGS'),
              unfinished:
                usage?.pendingPaymentCount != null || usage?.gdsPendingCount != null
                  ? Number(usage?.pendingPaymentCount ?? 0) + Number(usage?.gdsPendingCount ?? 0)
                  : null
            };
            const href = id
              ? `/tools/trip-jotter/companies/${encodeURIComponent(id)}`
              : '/tools/trip-jotter/companies';

            return (
              <Link key={id || companyTitle(c)} href={href} className="group block">
                <Card className="h-full transition duration-200 group-hover:-translate-y-0.5 group-hover:border-blue-200 group-hover:shadow-md motion-reduce:transform-none">
                  <CardHeader className="mb-3">
                    <div className="min-w-0">
                      <CardTitle className="truncate">{companyTitle(c)}</CardTitle>
                      <CardDescription className="truncate">
                        {c.email || c.userId || '—'}
                      </CardDescription>
                    </div>
                    {c.verificationStatus ? (
                      <StatusBadge status={c.verificationStatus} />
                    ) : c.isTransportCompanyVerified ? (
                      <Badge tone="success">Verified</Badge>
                    ) : (
                      <Badge tone="neutral">Unknown</Badge>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-2">
                      <CountChip label="Users" value={counts.users} />
                      <CountChip label="Terminals" value={counts.terminals} />
                      <CountChip label="Vehicles" value={counts.vehicles} />
                      <CountChip label="Trips" value={counts.trips} />
                      <CountChip label="Bookings" value={counts.bookings} />
                      <CountChip label="Unfinished" value={counts.unfinished} />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : null}
    </PadlerShell>
  );
}
