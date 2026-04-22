'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { PadlerShell } from '@/app/components/PadlerShell';
import { BookingItem, BookingStatus, Role } from '@/lib/types';
import { getAuthSession } from '@/lib/auth';
import { Bell, CalendarClock, Plus, Search, Settings } from 'lucide-react';
import {
  BOOKINGS_PAGE_SIZE,
  defaultTransportCompanyEmail,
  fetchBookingsPage,
  fetchTransportCompanyOptions,
  mutateBookingAction,
  type TransportCompanyOption
} from '@/lib/api';
import { NewBookingFlowDrawer } from '@/components/booking/NewBookingFlowDrawer';

const ALL_COMPANIES_VALUE = '__ALL__';

const STATUS_CLASS: Record<BookingStatus, string> = {
  PENDING: 'padler-status padler-status--pending',
  CONFIRMED: 'padler-status padler-status--confirmed',
  COMPLETED: 'padler-status padler-status--completed',
  CANCELLED: 'padler-status padler-status--cancelled',
  REFUNDED: 'padler-status padler-status--refunded',
  FAILED: 'padler-status padler-status--failed'
};

const ALL_STATUSES: (BookingStatus | 'ALL')[] = [
  'ALL',
  'PENDING',
  'CONFIRMED',
  'CANCELLED',
  'COMPLETED',
  'REFUNDED',
  'FAILED'
];

function formatTripDeparture(raw: string | undefined): string {
  if (!raw?.trim()) {
    return '—';
  }
  const t = raw.trim();
  const d = new Date(t);
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  }
  return t;
}

/** Not yet departed: missing or unparseable departure is treated as pre-departure (same as cancel/complete gating). */
function isNotYetDeparted(departureTime: string | undefined): boolean {
  if (!departureTime?.trim()) {
    return true;
  }
  const d = new Date(departureTime.trim());
  if (Number.isNaN(d.getTime())) {
    return true;
  }
  return Date.now() < d.getTime();
}

function canShowCancelForRow(departureTime: string | undefined): boolean {
  return isNotYetDeparted(departureTime);
}

/** Complete only for PENDING/FAILED and before departure. */
function canShowCompleteForRow(row: BookingItem): boolean {
  if (row.status !== 'PENDING' && row.status !== 'FAILED') {
    return false;
  }
  return isNotYetDeparted(row.departureTime);
}

const MS_24H = 24 * 60 * 60 * 1000;

/** Refund only for COMPLETED, while current time is still before (departure − 24h). */
function canShowRefundForRow(row: BookingItem): boolean {
  if (row.status !== 'COMPLETED') {
    return false;
  }
  if (!row.departureTime?.trim()) {
    return false;
  }
  const d = new Date(row.departureTime.trim());
  if (Number.isNaN(d.getTime())) {
    return false;
  }
  return Date.now() < d.getTime() - MS_24H;
}

function bookingMatchesQuery(row: BookingItem, q: string): boolean {
  const s = q.trim().toLowerCase();
  if (!s) {
    return true;
  }
  const hay = [
    row.bookingReference,
    row.customerName,
    row.sourceChannel,
    row.companyName,
    row.routeLabel,
    row.departureTime,
    row.status,
    String(row.amount),
    row.createdAt
  ]
    .join(' ')
    .toLowerCase();
  return hay.includes(s);
}

export default function BookingsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<BookingItem[]>([]);
  const [companyOptions, setCompanyOptions] = useState<TransportCompanyOption[]>([]);
  const [transportCompanyEmail, setTransportCompanyEmail] = useState(defaultTransportCompanyEmail);
  const [scopeAllCompanies, setScopeAllCompanies] = useState(true);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [canViewAllCompanies, setCanViewAllCompanies] = useState(false);
  const [firstName, setFirstName] = useState('Padler');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState<Role>('ADMIN');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<BookingStatus | 'ALL'>('ALL');
  const [newBookingOpen, setNewBookingOpen] = useState(false);
  const canMutate = role === 'SUPER_ADMIN' || role === 'ADMIN';

  const displayRows = useMemo(() => {
    return rows.filter((row) => {
      if (statusFilter !== 'ALL' && row.status !== statusFilter) {
        return false;
      }
      return bookingMatchesQuery(row, searchQuery);
    });
  }, [rows, searchQuery, statusFilter]);

  const todayLabel = useMemo(() => {
    const d = new Date();
    return d.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }, []);

  const selectValue = scopeAllCompanies
    ? ALL_COMPANIES_VALUE
    : companyOptions.some((o) => o.email === transportCompanyEmail)
      ? transportCompanyEmail
      : '';

  const runLoad = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await fetchBookingsPage({
        transportCompanyEmail,
        allCompanies: scopeAllCompanies,
        page,
        size: BOOKINGS_PAGE_SIZE
      });
      setRows(result.rows);
      setTotalPages(result.totalPages);
      setTotalElements(result.totalElements);
    } catch (err) {
      setRows([]);
      setTotalPages(0);
      setTotalElements(0);
      setLoadError(err instanceof Error ? err.message : 'Failed to load bookings');
    } finally {
      setLoading(false);
    }
  }, [transportCompanyEmail, scopeAllCompanies, page, reloadNonce]);

  useEffect(() => {
    const s = getAuthSession();
    setCanViewAllCompanies(s?.designation === 'SUPER_ADMIN');
    if (s?.email) {
      setFirstName(s.email.split('@')[0]);
    }
  }, []);

  useEffect(() => {
    fetchTransportCompanyOptions().then(setCompanyOptions).catch(() => setCompanyOptions([]));
  }, []);

  useEffect(() => {
    void runLoad();
  }, [runLoad]);

  const triggerAction = async (
    bookingReference: string,
    action: 'cancel' | 'complete' | 'refund'
  ) => {
    await mutateBookingAction(bookingReference, action, {
      reason: `Action ${action} from Padler`,
      sourceAction: 'PADLER_ADMIN_CONSOLE',
      idempotencyKey: `${bookingReference}-${action}`
    });
    setReloadNonce((n) => n + 1);
  };

  return (
    <PadlerShell>
      <section className="padler-hero">
        <div className="padler-hero-topbar">
          <div className="padler-hero-title">
            Bookings
            <small>
              Review and manage trip bookings · Welcome back, {firstName} · {todayLabel}
            </small>
          </div>

          <div className="padler-hero-search" role="search">
            <Search size={16} color="rgba(15,23,42,0.55)" />
            <input
              placeholder="Search reference, name, route, departure, amount…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={loading}
              aria-label="Search bookings on this page"
            />
            <button
              type="button"
              aria-label="Table filters (status below)"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgba(15,23,42,0.55)' }}
            >
              <Settings size={16} />
            </button>
          </div>

          <div className="padler-hero-actions">
            <button type="button" className="padler-icon-btn" aria-label="Calendar">
              <CalendarClock size={18} />
            </button>
            <button
              type="button"
              className="padler-icon-btn"
              aria-label="Notifications"
              style={{ position: 'relative' }}
            >
              <Bell size={18} />
              <span className="padler-badge-dot" />
            </button>
            <div className="padler-avatar" title={firstName}>
              {firstName.charAt(0).toUpperCase()}
            </div>
          </div>
        </div>
      </section>

      <div className="padler-page padler-page--below-hero">
        <div
          className="padler-panel padler-bookings-toolbar"
          style={{ marginBottom: 16, padding: '16px 20px' }}
        >
          <div className="padler-field-col">
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--padler-ink-muted)' }}>
              Transport company
            </div>
            {companyOptions.length > 0 || canViewAllCompanies ? (
              <select
                value={selectValue}
                onChange={(e) => {
                  const v = e.target.value;
                  setPage(0);
                  if (v === ALL_COMPANIES_VALUE) {
                    setScopeAllCompanies(true);
                    return;
                  }
                  setScopeAllCompanies(false);
                  setTransportCompanyEmail(v);
                }}
                disabled={loading}
                style={{
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid var(--padler-border)',
                  fontFamily: 'inherit',
                  background: '#fff'
                }}
              >
                <option value="">{canViewAllCompanies ? 'Select scope…' : 'Select a company…'}</option>
                {canViewAllCompanies ? (
                  <option value={ALL_COMPANIES_VALUE}>All companies</option>
                ) : null}
                {companyOptions.map((o) => (
                  <option key={o.email} value={o.email}>
                    {o.displayName} · {o.email}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
          <div className="padler-field-col">
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--padler-ink-muted)' }}>Status</div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as BookingStatus | 'ALL')}
              disabled={loading}
              style={{
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid var(--padler-border)',
                fontFamily: 'inherit',
                background: '#fff'
              }}
            >
              {ALL_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s === 'ALL' ? 'All statuses' : s}
                </option>
              ))}
            </select>
          </div>
          {canMutate ? (
            <button
              type="button"
              className="padler-action padler-action--primary"
              onClick={() => setNewBookingOpen(true)}
              disabled={loading}
              style={{ whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Plus size={16} />
              New booking
            </button>
          ) : null}
          <button
            type="button"
            className="padler-action"
            onClick={() => setReloadNonce((n) => n + 1)}
            disabled={loading}
            style={{ whiteSpace: 'nowrap' }}
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
        {searchQuery.trim() || statusFilter !== 'ALL' ? (
          <p style={{ fontSize: 12, color: 'var(--padler-ink-muted)', margin: '0 0 12px 0' }}>
            Search and status apply to the current page ({BOOKINGS_PAGE_SIZE} rows from the server). Use pagination to
            scan more.
          </p>
        ) : null}

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

        <div className="padler-panel">
          <table className="padler-table">
            <thead>
              <tr>
                {[
                  'S/N',
                  'Reference',
                  'Customer',
                  'Source',
                  'Transport company',
                  'Route',
                  'Departure',
                  'Status',
                  'Amount',
                  'Actions'
                ].map((col) => (
                  <th key={col}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: 48, color: 'var(--padler-ink-muted)' }}>
                    {loading
                      ? 'Loading bookings…'
                      : 'No bookings for this filter. Try another company, use “All companies” (super admin), or change page.'}
                  </td>
                </tr>
              ) : displayRows.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: 48, color: 'var(--padler-ink-muted)' }}>
                    No rows match your search or status on this page. Clear filters or go to another page.
                  </td>
                </tr>
              ) : (
                displayRows.map((row) => {
                  const idxInPage = rows.indexOf(row);
                  const serialNo =
                    idxInPage >= 0 ? page * BOOKINGS_PAGE_SIZE + idxInPage + 1 : '—';
                  const canNavigate = row.id != null;
                  const buildBookingDetailQuery = () => {
                    const q = new URLSearchParams();
                    q.set('allCompanies', String(scopeAllCompanies));
                    if (!scopeAllCompanies) {
                      q.set('transportCompanyEmail', (transportCompanyEmail || defaultTransportCompanyEmail).trim());
                    }
                    return q;
                  };
                  const goToDetail = () => {
                    if (!canNavigate) return;
                    const q = buildBookingDetailQuery();
                    router.push(`/bookings/${row.id}?${q.toString()}`);
                  };
                  const goToDetailWithTripDrawer = () => {
                    if (!canNavigate) return;
                    const q = buildBookingDetailQuery();
                    q.set('openTripDrawer', '1');
                    router.push(`/bookings/${row.id}?${q.toString()}`);
                  };
                  return (
                  <tr
                    key={
                      row.id != null
                        ? `id-${row.id}`
                        : `${row.bookingReference}-${row.createdAt}-${row.customerName}`
                    }
                    className={canNavigate ? 'padler-table-row--clickable' : undefined}
                    onClick={canNavigate ? goToDetail : undefined}
                    onKeyDown={
                      canNavigate
                        ? (e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              goToDetail();
                            }
                          }
                        : undefined
                    }
                    tabIndex={canNavigate ? 0 : undefined}
                    aria-label={canNavigate ? `View booking ${row.bookingReference}` : undefined}
                  >
                    <td
                      style={{
                        width: 48,
                        textAlign: 'right',
                        fontVariantNumeric: 'tabular-nums',
                        color: 'var(--padler-ink-muted)',
                        fontSize: 13
                      }}
                    >
                      {serialNo}
                    </td>
                    <td style={{ fontFamily: 'var(--padler-font-heading)', fontWeight: 600 }}>
                      {row.bookingReference}
                    </td>
                    <td>{row.customerName}</td>
                    <td style={{ color: 'var(--padler-ink-muted)' }}>{row.sourceChannel}</td>
                    <td style={{ maxWidth: 200, color: 'var(--padler-ink)' }} title={row.companyName ?? undefined}>
                      {row.companyName?.trim() ? row.companyName : '—'}
                    </td>
                    <td>{row.routeLabel}</td>
                    <td
                      style={{
                        whiteSpace: 'nowrap',
                        fontSize: 13,
                        color: 'var(--padler-ink)',
                        fontFamily: 'var(--padler-font-body)'
                      }}
                    >
                      {formatTripDeparture(row.departureTime)}
                    </td>
                    <td>
                      <span className={STATUS_CLASS[row.status]}>{row.status}</span>
                    </td>
                    <td style={{ fontFamily: 'var(--padler-font-heading)', fontWeight: 600 }}>
                      NGN {row.amount.toLocaleString()}
                    </td>
                    <td onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {(
                          [
                            ...(canShowCancelForRow(row.departureTime) ? (['cancel'] as const) : []),
                            ...(canShowCompleteForRow(row) ? (['complete'] as const) : []),
                            ...(canShowRefundForRow(row) ? (['refund'] as const) : [])
                          ] as const
                        ).map((action) => (
                          <button
                            key={action}
                            className="padler-action"
                            disabled={!canMutate}
                            onClick={() => {
                              if (action === 'complete' && canNavigate) {
                                goToDetailWithTripDrawer();
                                return;
                              }
                              void triggerAction(row.bookingReference, action);
                            }}
                          >
                            {action}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
                })
              )}
            </tbody>
          </table>
        </div>

        {!loadError && (rows.length > 0 || totalElements > 0) ? (
          <div
            className="padler-panel"
            style={{
              marginTop: 16,
              padding: '12px 20px',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12
            }}
          >
            <div style={{ fontSize: 13, color: 'var(--padler-ink-muted)' }}>
              {totalElements.toLocaleString()} booking group{totalElements === 1 ? '' : 's'}
              {totalPages > 0 ? ` · Page ${page + 1} of ${totalPages}` : ''}
              <span style={{ marginLeft: 8, opacity: 0.85 }}>({BOOKINGS_PAGE_SIZE} per page)</span>
              {rows.length > 0 && (searchQuery.trim() || statusFilter !== 'ALL') ? (
                <span style={{ display: 'block', marginTop: 4, fontSize: 12 }}>
                  Showing {displayRows.length} of {rows.length} on this page after filter
                </span>
              ) : null}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="padler-action"
                disabled={loading || page <= 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Previous
              </button>
              <button
                type="button"
                className="padler-action"
                disabled={loading || totalPages <= 0 || page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </div>

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
