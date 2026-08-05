'use client';

import { PadlerShell } from '@/app/components/PadlerShell';
import { NewBookingFlowDrawer } from '@/components/booking/NewBookingFlowDrawer';
import { PadlerChart } from '@/components/charts/PadlerChart';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldLabel, Input, Select } from '@/components/ui/field';
import { FilterBar, PageHeader } from '@/components/ui/page';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  defaultTransportCompanyEmail,
  fetchDashboardOverview,
  fetchTransportCompanyOptions,
  mapDashboardSummaryFromCounts,
  type TransportCompanyOption
} from '@/lib/api';
import { getAuthSession } from '@/lib/auth';
import type { Role } from '@/lib/types';
import { canMutateBookings, canViewAllCompanies as roleCanViewAllCompanies } from '@/lib/types';
import {
  ArrowUpRight,
  CalendarCheck2,
  CheckCircle2,
  MoreVertical,
  Plus,
  Settings,
  Ticket,
  Wallet,
  XCircle
} from 'lucide-react';

type Summary = {
  totalBookings: number;
  pendingApprovals: number;
  cancelledBookings: number;
  completedBookings: number;
  totalRevenue: number;
};

type TrendBar = { month: string; value: number; highlight?: boolean };
type UpcomingRow = { id: string; title: string; meta: string; when: string };
type TopRow = { id: string; name: string; role: string };

const ALL_COMPANIES_VALUE = '__ALL__';

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const METRIC_TONES = {
  grey: 'border-slate-200/80 bg-slate-50',
  green: 'border-emerald-200/80 bg-emerald-50',
  blue: 'border-blue-200/80 bg-blue-50',
  amber: 'border-amber-200/80 bg-amber-50'
} as const;

function buildTrendFromMonthly(
  monthly: { month: number; count: number }[] | undefined,
  year: number
): TrendBar[] {
  const m = Array.isArray(monthly) ? monthly : [];
  const now = new Date();
  const curY = now.getFullYear();
  const curM = now.getMonth() + 1;
  const endM = year === curY ? curM : 12;
  const slice = m.filter((x) => x.month >= 1 && x.month <= endM);
  const last9 = slice.slice(Math.max(0, slice.length - 9));
  return last9.map((x) => ({
    month: MONTH_SHORT[x.month - 1] ?? String(x.month),
    value: x.count,
    highlight: year === curY && x.month === curM
  }));
}

function kpiBookingsLine(last7: number, prev7: number): string {
  if (prev7 === 0) {
    return last7 > 0 ? 'Up vs prior week' : 'No prior-week data';
  }
  const pct = ((last7 - prev7) / prev7) * 100;
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}% vs prior week`;
}

function ProgressRing({ percent }: { percent: number }) {
  const radius = 76;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (circumference * percent) / 100;
  return (
    <svg width="180" height="180" viewBox="0 0 180 180">
      <circle
        cx="90"
        cy="90"
        r={radius}
        fill="none"
        stroke="#E2E8F0"
        strokeWidth="12"
        strokeDasharray="6 8"
      />
      <circle
        cx="90"
        cy="90"
        r={radius}
        fill="none"
        stroke="url(#padler-grad)"
        strokeWidth="12"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 90 90)"
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
      <defs>
        <linearGradient id="padler-grad" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#1d4ed8" />
          <stop offset="100%" stopColor="#14b8a6" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary>({
    totalBookings: 0,
    pendingApprovals: 0,
    cancelledBookings: 0,
    completedBookings: 0,
    totalRevenue: 0
  });
  const [trendBars, setTrendBars] = useState<TrendBar[]>([]);
  const [upcoming, setUpcoming] = useState<UpcomingRow[]>([]);
  const [topRows, setTopRows] = useState<TopRow[]>([]);
  const [kpi, setKpi] = useState({ last7Days: 0, previous7Days: 0 });
  const [topTab, setTopTab] = useState<'all' | 'year'>('year');
  const [firstName, setFirstName] = useState('Padler');
  const [companyOptions, setCompanyOptions] = useState<TransportCompanyOption[]>([]);
  const [transportCompanyEmail, setTransportCompanyEmail] = useState(defaultTransportCompanyEmail);
  const [scopeAllCompanies, setScopeAllCompanies] = useState(true);
  const [canViewAllCompanies, setCanViewAllCompanies] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dashboardYear, setDashboardYear] = useState(() => new Date().getFullYear());
  const [reloadNonce, setReloadNonce] = useState(0);
  const [newBookingOpen, setNewBookingOpen] = useState(false);
  const [role, setRole] = useState<Role>('ADMIN');

  const selectValue = scopeAllCompanies
    ? ALL_COMPANIES_VALUE
    : companyOptions.some((o) => o.email === transportCompanyEmail)
      ? transportCompanyEmail
      : '';

  const runLoad = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      if (!scopeAllCompanies) {
        const resolved = (transportCompanyEmail || defaultTransportCompanyEmail).trim();
        if (!resolved) {
          setSummary({
            totalBookings: 0,
            pendingApprovals: 0,
            cancelledBookings: 0,
            completedBookings: 0,
            totalRevenue: 0
          });
          setTrendBars([]);
          setUpcoming([]);
          setTopRows([]);
          setKpi({ last7Days: 0, previous7Days: 0 });
          setLoadError('Choose a transport company to load the dashboard, or set NEXT_PUBLIC_PADLER_TRANSPORT_COMPANY_EMAIL.');
          return;
        }
      }
      const data = await fetchDashboardOverview({
        transportCompanyEmail,
        allCompanies: scopeAllCompanies,
        year: dashboardYear,
        upcomingLimit: 4,
        topLimit: 3,
        topScope: topTab === 'all' ? 'all' : 'year'
      });
      if (data == null) {
        setLoadError('Choose a transport company to load the dashboard.');
        return;
      }
      const c = data.counts as Record<string, unknown> | undefined;
      setSummary(mapDashboardSummaryFromCounts(c));
      setTrendBars(buildTrendFromMonthly(data.monthlyBookings, dashboardYear));
      setUpcoming(
        (data.upcomingTrips ?? []).map((u) => ({
          id: u.id,
          title: u.title,
          meta: u.meta,
          when: u.when
        }))
      );
      setTopRows(
        (data.topCustomers ?? []).map((t, i) => ({
          id: String(i) + t.name,
          name: t.name,
          role: t.roleLabel
        }))
      );
      setKpi(data.kpi ?? { last7Days: 0, previous7Days: 0 });
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [
    transportCompanyEmail,
    scopeAllCompanies,
    dashboardYear,
    topTab,
    reloadNonce
  ]);

  const canMutate = canMutateBookings(role);

  useEffect(() => {
    const s = getAuthSession();
    setCanViewAllCompanies(roleCanViewAllCompanies(s?.designation));
    if (s?.designation) {
      setRole(s.designation as Role);
    }
  }, []);

  useEffect(() => {
    fetchTransportCompanyOptions().then(setCompanyOptions).catch(() => setCompanyOptions([]));
  }, []);

  useEffect(() => {
    const session = getAuthSession();
    if (session?.email) {
      setFirstName(session.email.split('@')[0]);
    }
  }, []);

  useEffect(() => {
    void runLoad();
  }, [runLoad]);

  const completionRate = useMemo(() => {
    const total = summary.totalBookings || 0;
    if (!total) {
      return 0;
    }
    return Math.round((summary.completedBookings / total) * 100);
  }, [summary]);

  const todayLabel = useMemo(() => {
    const d = new Date();
    return d.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }, []);

  const totalDelta = kpiBookingsLine(kpi.last7Days, kpi.previous7Days);
  const completedShare = useMemo(() => {
    const t = summary.totalBookings || 0;
    if (!t) {
      return '—';
    }
    return `${Math.round((summary.completedBookings / t) * 100)}% of total`;
  }, [summary]);

  return (
    <PadlerShell>
      <PageHeader
        eyebrow="Tools"
        title="Dashboard"
        subtitle={`Welcome back, ${firstName} · ${todayLabel}`}
        actions={
          <Button type="button" variant="primary" onClick={() => setReloadNonce((n) => n + 1)} disabled={loading}>
            {loading ? 'Loading…' : 'Refresh'}
          </Button>
        }
      />

      <section className="mb-6 grid gap-4 lg:grid-cols-[repeat(4,minmax(0,1fr))_1.2fr]">
        <MetricCard
          tone="grey"
          icon={<Ticket size={16} />}
          label="Total Bookings"
          value={summary.totalBookings}
          delta={totalDelta}
        />
        <MetricCard
          tone="green"
          icon={<CalendarCheck2 size={16} />}
          label="Pending Approvals"
          value={summary.pendingApprovals}
          delta="Action required"
        />
        <MetricCard
          tone="blue"
          icon={<CheckCircle2 size={16} />}
          label="Completed"
          value={summary.completedBookings}
          delta={completedShare}
        />
        <MetricCard
          tone="amber"
          icon={<XCircle size={16} />}
          label="Cancelled"
          value={summary.cancelledBookings}
          delta="Review refunds"
        />

        <Card className="flex flex-col justify-between border-amber-200/80 bg-amber-50">
          <div className="text-lg font-semibold tracking-tight text-slate-950">Quick actions</div>
          <div className="mt-4 flex flex-wrap gap-2">
            {canMutate ? (
              <Button type="button" size="sm" onClick={() => setNewBookingOpen(true)} disabled={loading}>
                <Plus size={14} /> New booking
              </Button>
            ) : null}
            <Button type="button" size="sm">
              <Plus size={14} /> Invite Padler
            </Button>
            <Button type="button" size="sm">
              <Wallet size={14} /> Issue refund
            </Button>
          </div>
        </Card>
      </section>

      <FilterBar
        onSubmit={() => {
          setReloadNonce((n) => n + 1);
        }}
      >
        {companyOptions.length > 0 || canViewAllCompanies ? (
          <FieldLabel className="min-w-[220px] flex-1">
            Transport company
            <Select
              value={selectValue}
              onChange={(e) => {
                const v = e.target.value;
                if (v === ALL_COMPANIES_VALUE) {
                  setScopeAllCompanies(true);
                  return;
                }
                setScopeAllCompanies(false);
                setTransportCompanyEmail(v);
              }}
              disabled={loading}
            >
              <option value="">{canViewAllCompanies ? 'Select scope…' : 'Select a company…'}</option>
              {canViewAllCompanies ? <option value={ALL_COMPANIES_VALUE}>All companies</option> : null}
              {companyOptions.map((o) => (
                <option key={o.email} value={o.email}>
                  {o.displayName} · {o.email}
                </option>
              ))}
            </Select>
          </FieldLabel>
        ) : null}
        <FieldLabel className="min-w-[120px]">
          Stats year
          <Input
            type="number"
            min={2000}
            max={3000}
            value={dashboardYear}
            onChange={(e) => setDashboardYear(Number(e.target.value) || new Date().getFullYear())}
            disabled={loading}
            className="max-w-[120px]"
          />
        </FieldLabel>
        <Button type="submit" variant="primary" disabled={loading}>
          {loading ? 'Loading…' : 'Apply'}
        </Button>
      </FilterBar>

      {loadError ? (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {loadError}
        </div>
      ) : null}

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <Card className="relative flex flex-col items-center justify-center xl:col-span-3">
          <CardHeader className="w-full">
            <div>
              <CardTitle>Completion rate</CardTitle>
              <CardDescription>Bookings completed vs total</CardDescription>
            </div>
            <Badge tone="info">Monthly</Badge>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <div className="relative my-4 h-[180px] w-[180px]">
              <ProgressRing percent={completionRate} />
              <div className="absolute inset-0 flex items-center justify-center text-3xl font-bold tracking-tight text-slate-950">
                {completionRate}%
              </div>
            </div>
            <p className="text-sm text-slate-500">Trip fulfillment (completed / total)</p>
          </CardContent>
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className="absolute bottom-5 right-5 size-8 rounded-full"
            aria-label="Configure"
          >
            <Settings size={14} />
          </Button>
        </Card>

        <Card className="flex flex-col xl:col-span-5">
          <CardHeader>
            <div>
              <CardTitle>Monthly bookings</CardTitle>
              <CardDescription>
                New booking rows by month (created in {dashboardYear})
              </CardDescription>
            </div>
            <Badge tone="neutral">Last {Math.min(9, trendBars.length) || 9} months</Badge>
          </CardHeader>
          <CardContent className="min-h-[240px] flex-1">
            {trendBars.length > 0 ? (
              <PadlerChart
                type="bar"
                height={240}
                series={[{ name: 'Bookings', data: trendBars.map((b) => b.value) }]}
                options={{
                  colors: ['#f59e0b'],
                  xaxis: { categories: trendBars.map((b) => b.month) },
                  plotOptions: {
                    bar: { borderRadius: 6, columnWidth: '48%' }
                  },
                  yaxis: {
                    labels: { formatter: (v) => String(Math.round(Number(v))) }
                  }
                }}
              />
            ) : (
              <p className="py-6 text-sm text-slate-500">No data for this scope.</p>
            )}
          </CardContent>
        </Card>

        <Card className="flex flex-col xl:col-span-4 xl:row-span-2">
          <CardHeader>
            <div>
              <CardTitle>Upcoming trips</CardTitle>
              <CardDescription>Next departures (confirmed / pending)</CardDescription>
            </div>
            <Button type="button" size="sm" variant="secondary">
              View all
            </Button>
          </CardHeader>
          <CardContent className="divide-y divide-slate-100">
            {upcoming.length === 0 ? (
              <p className="py-5 text-sm text-slate-500">No upcoming trips in this scope.</p>
            ) : (
              upcoming.map((u) => (
                <div className="flex items-center gap-3.5 py-3.5 first:pt-0" key={u.id}>
                  <div className="min-w-[150px] text-xs font-medium text-slate-500">{u.when}</div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-slate-950">{u.title}</div>
                    <div className="text-xs text-slate-500">{u.meta}</div>
                  </div>
                  <Button type="button" variant="ghost" size="icon" aria-label="More">
                    <MoreVertical size={18} />
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="flex flex-col overflow-hidden border-amber-200 bg-gradient-to-br from-amber-100 to-amber-200 xl:col-span-3">
          <CardContent className="flex flex-1 flex-col pt-5">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
              Operations note
            </p>
            <p className="text-2xl font-bold tracking-tight text-slate-950">
              {summary.pendingApprovals} bookings await review
            </p>
            <p className="mt-2 text-sm text-slate-700/80">
              Clear the queue to keep the SLA below four hours. Approvals sync instantly to TripJotter and NPOD
              customer apps.
            </p>
            <div className="mt-auto flex flex-wrap gap-1.5 pt-4">
              {Array.from({ length: 16 }).map((_, i) => (
                <span
                  key={i}
                  className={`size-2 rounded-full ${
                    i < Math.min(summary.pendingApprovals, 16) ? 'bg-teal-600' : 'bg-slate-900/15'
                  }`}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="flex flex-col bg-slate-900 text-white xl:col-span-5">
          <CardHeader>
            <div>
              <CardTitle className="text-white">Top customers</CardTitle>
              <CardDescription className="text-white/60">Highest booking volume</CardDescription>
            </div>
            <div className="inline-flex rounded-lg bg-white/10 p-0.5">
              <button
                type="button"
                className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                  topTab === 'all' ? 'bg-amber-300 text-slate-900' : 'text-white/75'
                }`}
                onClick={() => setTopTab('all')}
              >
                All time
              </button>
              <button
                type="button"
                className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                  topTab === 'year' ? 'bg-amber-300 text-slate-900' : 'text-white/75'
                }`}
                onClick={() => setTopTab('year')}
              >
                This year
              </button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {topRows.length === 0 ? (
              <p className="py-5 text-sm text-white/75">No customers in this scope.</p>
            ) : (
              topRows.map((c) => (
                <div
                  className="flex items-center gap-3 rounded-xl bg-white/5 px-3.5 py-3 transition hover:bg-white/10"
                  key={c.id}
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-sm font-semibold">
                    {c.name.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">{c.name}</div>
                    <div className="text-xs text-white/60">{c.role}</div>
                  </div>
                  <ArrowUpRight size={16} className="shrink-0 text-white/65" />
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      <NewBookingFlowDrawer
        open={newBookingOpen}
        onClose={() => setNewBookingOpen(false)}
        onBooked={() => setReloadNonce((n) => n + 1)}
        companyOptions={companyOptions}
        allCompanies={canViewAllCompanies}
        pageTransportEmail={transportCompanyEmail}
        pageAllCompanies={scopeAllCompanies}
      />
    </PadlerShell>
  );
}

function MetricCard({
  tone,
  icon,
  label,
  value,
  delta
}: {
  tone: keyof typeof METRIC_TONES;
  icon: React.ReactNode;
  label: string;
  value: number | string;
  delta?: string;
}) {
  return (
    <Card className={`min-h-32 ${METRIC_TONES[tone]}`}>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          {icon}
          <span>{label}</span>
        </div>
        <Button type="button" variant="ghost" size="icon" className="size-8" aria-label="Options">
          <MoreVertical size={16} />
        </Button>
      </div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-3xl font-bold tracking-tight text-slate-950">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </div>
          {delta ? <div className="mt-1 text-xs text-slate-500">{delta}</div> : null}
        </div>
        <Button
          type="button"
          size="icon"
          variant="secondary"
          className="size-9 shrink-0 rounded-full"
          aria-label="View details"
        >
          <ArrowUpRight size={16} />
        </Button>
      </div>
    </Card>
  );
}
