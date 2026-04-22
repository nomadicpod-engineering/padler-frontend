'use client';

import { PadlerShell } from '@/app/components/PadlerShell';
import { NewBookingFlowDrawer } from '@/components/booking/NewBookingFlowDrawer';
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
import {
  ArrowUpRight,
  Bell,
  CalendarCheck2,
  CalendarClock,
  CheckCircle2,
  MoreVertical,
  Plus,
  Search,
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

function TrendBars({ bars }: { bars: TrendBar[] }) {
  const maxVal = Math.max(1, ...bars.map((b) => b.value));
  const chartHeight = 200;
  const chartWidth = 560;
  const padLeft = 40;
  const gridY = [0, 0.25, 0.5, 0.75, 1];
  const barWidth = 34;
  const n = Math.max(1, bars.length);
  const step = (chartWidth - padLeft - 20) / n;

  return (
    <svg width="100%" height={chartHeight + 30} viewBox={`0 0 ${chartWidth} ${chartHeight + 30}`}>
      <defs>
        <pattern id="padler-stripes" x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse">
          <rect width="8" height="8" fill="#fbbf24" />
          <path d="M0 0 L8 8" stroke="#b45309" strokeWidth="1.4" />
        </pattern>
      </defs>

      {gridY.map((g, i) => {
        const y = chartHeight - g * chartHeight;
        return (
          <g key={i}>
            <line
              x1={padLeft}
              x2={chartWidth - 10}
              y1={y}
              y2={y}
              stroke="#E2E8F0"
              strokeDasharray="3 4"
              strokeWidth="1"
            />
            <text
              x={padLeft - 8}
              y={y + 4}
              fontSize="10"
              fill="rgba(15,23,42,0.5)"
              textAnchor="end"
              fontFamily="Raleway, sans-serif"
            >
              {Math.round(g * maxVal)}
            </text>
          </g>
        );
      })}

      {bars.map((b, i) => {
        const h = (b.value / maxVal) * chartHeight;
        const x = padLeft + 10 + i * step;
        const y = chartHeight - h;
        return (
          <g key={`${b.month}-${i}`}>
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={h}
              rx="6"
              fill={b.highlight ? 'url(#padler-stripes)' : '#fbbf24'}
            />
            <text
              x={x + barWidth / 2}
              y={chartHeight + 20}
              fontSize="11"
              fill="rgba(15,23,42,0.55)"
              textAnchor="middle"
              fontFamily="Raleway, sans-serif"
            >
              {b.month}
            </text>
          </g>
        );
      })}
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

  const canMutate = role === 'SUPER_ADMIN' || role === 'ADMIN';

  useEffect(() => {
    const s = getAuthSession();
    setCanViewAllCompanies(s?.designation === 'SUPER_ADMIN');
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
      <section className="padler-hero">
        <div className="padler-hero-topbar">
          <div className="padler-hero-title">
            Padler Console
            <small>Welcome back, {firstName} · {todayLabel}</small>
          </div>

          <div className="padler-hero-search" role="search">
            <Search size={16} color="rgba(15,23,42,0.55)" />
            <input placeholder="Search bookings, customers, refunds..." />
            <button
              type="button"
              aria-label="Filter"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgba(15,23,42,0.55)' }}
            >
              <Settings size={16} />
            </button>
          </div>

          <div className="padler-hero-actions">
            <button type="button" className="padler-icon-btn" aria-label="Calendar">
              <CalendarClock size={18} />
            </button>
            <button type="button" className="padler-icon-btn" aria-label="Notifications" style={{ position: 'relative' }}>
              <Bell size={18} />
              <span className="padler-badge-dot" />
            </button>
            <div className="padler-avatar" title={firstName}>
              {firstName.charAt(0).toUpperCase()}
            </div>
          </div>
        </div>
      </section>

      <section className="padler-metrics">
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

        <div className="padler-quick-actions">
          <div className="padler-quick-actions-title">Quick actions</div>
          <div className="padler-quick-actions-buttons">
            {canMutate ? (
              <button
                type="button"
                className="padler-pill-btn"
                onClick={() => setNewBookingOpen(true)}
                disabled={loading}
              >
                <Plus size={14} /> New booking
              </button>
            ) : null}
            <button type="button" className="padler-pill-btn">
              <Plus size={14} /> Invite Padler
            </button>
            <button type="button" className="padler-pill-btn">
              <Wallet size={14} /> Issue refund
            </button>
          </div>
        </div>
      </section>

      <div
        className="padler-panel"
        style={{
          margin: '40px 0 20px 0',
          padding: '16px 20px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 16,
          alignItems: 'flex-end',
          maxWidth: '1520px',
          minWidth: '1520px',
          alignSelf: 'center',
        }}
      >
        <div style={{ flex: '1 1 220px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--padler-ink-muted)' }}>
            Transport company
          </div>
          {companyOptions.length > 0 || canViewAllCompanies ? (
            <select
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
              style={{
                width: '100%',
                maxWidth: 420,
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid var(--padler-border)',
                fontFamily: 'inherit',
                background: '#fff'
              }}
            >
              <option value="">{canViewAllCompanies ? 'Select scope…' : 'Select a company…'}</option>
              {canViewAllCompanies ? <option value={ALL_COMPANIES_VALUE}>All companies</option> : null}
              {companyOptions.map((o) => (
                <option key={o.email} value={o.email}>
                  {o.displayName} · {o.email}
                </option>
              ))}
            </select>
          ) : null}
        </div>
        <div style={{ flex: '1 1 200px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--padler-ink-muted)' }}>Stats year</div>
          <input
            type="number"
            min={2000}
            max={3000}
            value={dashboardYear}
            onChange={(e) => setDashboardYear(Number(e.target.value) || new Date().getFullYear())}
            disabled={loading}
            style={{
              width: '100%',
              maxWidth: 120,
              padding: '10px 12px',
              borderRadius: 8,
              border: '1px solid var(--padler-border)',
              fontFamily: 'inherit'
            }}
          />
        </div>
        <button
          type="button"
          className="padler-action padler-action--primary"
          onClick={() => setReloadNonce((n) => n + 1)}
          disabled={loading}
        >
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {loadError ? (
        <div
          role="alert"
          style={{
            marginBottom: 16,
            padding: '12px 16px',
            borderRadius: 8,
            background: '#fef2f2',
            color: '#991b1b',
            border: '1px solid #fecaca',
            fontSize: 14
          }}
        >
          {loadError}
        </div>
      ) : null}

      <section className="padler-bento">
        <div className="padler-card padler-card--growth">
          <div className="padler-card-head" style={{ width: '100%' }}>
            <div>
              <div className="padler-card-title">Completion rate</div>
              <div className="padler-card-subtitle">Bookings completed vs total</div>
            </div>
            <span className="padler-chip">Monthly</span>
          </div>
          <div className="padler-growth-ring">
            <ProgressRing percent={completionRate} />
            <div className="padler-growth-percent">{completionRate}%</div>
          </div>
          <div className="padler-growth-label">Trip fulfillment (completed / total)</div>
          <button type="button" className="padler-growth-gear" aria-label="Configure">
            <Settings size={14} />
          </button>
        </div>

        <div className="padler-card padler-card--trend">
          <div className="padler-card-head">
            <div>
              <div className="padler-card-title">Monthly bookings</div>
              <div className="padler-card-subtitle">New booking rows by month (created in {dashboardYear})</div>
            </div>
            <span className="padler-chip">Last {Math.min(9, trendBars.length) || 9} months</span>
          </div>
          <div className="padler-trend-chart">
            {trendBars.length > 0 ? (
              <TrendBars bars={trendBars} />
            ) : (
              <div style={{ padding: 24, color: 'var(--padler-ink-muted)', fontSize: 14 }}>No data for this scope.</div>
            )}
          </div>
        </div>

        <div className="padler-card padler-card--upcoming">
          <div className="padler-card-head">
            <div>
              <div className="padler-card-title">Upcoming trips</div>
              <div className="padler-card-subtitle">Next departures (confirmed / pending)</div>
            </div>
            <button type="button" className="padler-view-all">
              View all
            </button>
          </div>
          <div className="padler-upcoming-list">
            {upcoming.length === 0 ? (
              <div style={{ padding: 20, color: 'var(--padler-ink-muted)', fontSize: 14 }}>No upcoming trips in this scope.</div>
            ) : (
              upcoming.map((u) => (
                <div className="padler-upcoming-row" key={u.id}>
                  <div className="padler-upcoming-date">{u.when}</div>
                  <div className="padler-upcoming-body">
                    <div className="padler-upcoming-title">{u.title}</div>
                    <div className="padler-upcoming-meta">{u.meta}</div>
                  </div>
                  <button
                    type="button"
                    aria-label="More"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'rgba(15,23,42,0.45)'
                    }}
                  >
                    <MoreVertical size={18} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="padler-card padler-card--announcement">
          <div className="padler-announcement-eyebrow">Operations note</div>
          <div className="padler-announcement-title">{summary.pendingApprovals} bookings await review</div>
          <div className="padler-announcement-text">
            Clear the queue to keep the SLA below four hours. Approvals sync instantly to TripJotter and NPOD customer apps.
          </div>
          <div className="padler-announcement-dots">
            {Array.from({ length: 16 }).map((_, i) => (
              <span key={i} className={`padler-dot ${i < Math.min(summary.pendingApprovals, 16) ? 'is-active' : ''}`} />
            ))}
          </div>
        </div>

        <div className="padler-card padler-card--top">
          <div className="padler-card-head">
            <div>
              <div className="padler-card-title">Top customers</div>
              <div className="padler-card-subtitle" style={{ color: 'rgba(255,255,255,0.6)' }}>
                Highest booking volume
              </div>
            </div>
            <div className="padler-tabs">
              <button
                type="button"
                className={`padler-tab ${topTab === 'all' ? 'is-active' : ''}`}
                onClick={() => setTopTab('all')}
              >
                All time
              </button>
              <button
                type="button"
                className={`padler-tab ${topTab === 'year' ? 'is-active' : ''}`}
                onClick={() => setTopTab('year')}
              >
                This year
              </button>
            </div>
          </div>
          <div className="padler-top-list">
            {topRows.length === 0 ? (
              <div style={{ padding: 20, color: 'rgba(255,255,255,0.75)', fontSize: 14 }}>No customers in this scope.</div>
            ) : (
              topRows.map((c) => (
                <div className="padler-top-row" key={c.id}>
                  <div className="padler-top-avatar">{c.name.charAt(0)}</div>
                  <div className="padler-top-body">
                    <div className="padler-top-name">{c.name}</div>
                    <div className="padler-top-role">{c.role}</div>
                  </div>
                  <ArrowUpRight size={16} color="rgba(255,255,255,0.65)" />
                </div>
              ))
            )}
          </div>
        </div>
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
  tone: 'grey' | 'green' | 'blue' | 'amber';
  icon: React.ReactNode;
  label: string;
  value: number | string;
  delta?: string;
}) {
  return (
    <div className={`padler-metric-card padler-metric-card--${tone}`}>
      <div className="padler-metric-head">
        <div className="padler-metric-head-left">
          {icon}
          <span>{label}</span>
        </div>
        <button
          type="button"
          aria-label="Options"
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgba(15,23,42,0.55)' }}
        >
          <MoreVertical size={16} />
        </button>
      </div>
      <div className="padler-metric-body">
        <div>
          <div className="padler-metric-value">{typeof value === 'number' ? value.toLocaleString() : value}</div>
          {delta ? <div className="padler-metric-delta">{delta}</div> : null}
        </div>
        <button type="button" className="padler-metric-arrow" aria-label="View details">
          <ArrowUpRight size={16} />
        </button>
      </div>
    </div>
  );
}
