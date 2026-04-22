'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PadlerShell } from '@/app/components/PadlerShell';
import { PaymentRow, type PaymentStatus } from '@/lib/types';
import { getAuthSession } from '@/lib/auth';
import { Bell, CalendarClock, Search, Settings } from 'lucide-react';
import { fetchPaymentsPage, PAYMENTS_PAGE_SIZE } from '@/lib/api';

const ALL_PAYMENT_STATUSES: (PaymentStatus | 'ALL')[] = [
  'ALL',
  'PENDING',
  'INITIATED',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
  'SUCCESSFUL'
];

function formatPaymentTime(raw: string | undefined): string {
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

function paymentStatusClass(status: string): string {
  const u = status.toUpperCase();
  if (u === 'COMPLETED' || u === 'SUCCESSFUL') {
    return 'padler-status padler-status--confirmed';
  }
  if (u === 'FAILED') {
    return 'padler-status padler-status--failed';
  }
  if (u === 'CANCELLED') {
    return 'padler-status padler-status--cancelled';
  }
  return 'padler-status padler-status--pending';
}

function paymentMatchesQuery(row: PaymentRow, q: string): boolean {
  const s = q.trim().toLowerCase();
  if (!s) {
    return true;
  }
  const hay = [
    row.reference,
    row.currency,
    row.service,
    row.paymentProcessor,
    row.purpose,
    row.message,
    row.email,
    row.payerUserId,
    row.status,
    String(row.amount),
    row.createdAt
  ]
    .join(' ')
    .toLowerCase();
  return hay.includes(s);
}

export default function PaymentPage() {
  const router = useRouter();
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [firstName, setFirstName] = useState('Padler');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | 'ALL'>('ALL');

  const displayRows = useMemo(() => {
    const filtered = rows.filter((row) => {
      if (statusFilter !== 'ALL' && String(row.status).toUpperCase() !== statusFilter) {
        return false;
      }
      return paymentMatchesQuery(row, searchQuery);
    });
    return [...filtered].sort((a, b) => {
      const ta = Date.parse(a.createdAt);
      const tb = Date.parse(b.createdAt);
      const aOk = !Number.isNaN(ta);
      const bOk = !Number.isNaN(tb);
      if (aOk && bOk) {
        return tb - ta;
      }
      return 0;
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

  const runLoad = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await fetchPaymentsPage({ page, size: PAYMENTS_PAGE_SIZE });
      setRows(result.rows);
      setTotalPages(result.totalPages);
      setTotalElements(result.totalElements);
    } catch (err) {
      setRows([]);
      setTotalPages(0);
      setTotalElements(0);
      setLoadError(err instanceof Error ? err.message : 'Failed to load payments');
    } finally {
      setLoading(false);
    }
  }, [page, reloadNonce]);

  useEffect(() => {
    const s = getAuthSession();
    if (s?.email) {
      setFirstName(s.email.split('@')[0]);
    }
  }, []);

  useEffect(() => {
    void runLoad();
  }, [runLoad]);

  return (
    <PadlerShell>
      <section className="padler-hero">
        <div className="padler-hero-topbar">
          <div className="padler-hero-title">
            Payments
            <small>
              Wallet payments (paginated) · Welcome back, {firstName} · {todayLabel}
            </small>
          </div>

          <div className="padler-hero-search" role="search">
            <Search size={16} color="rgba(15,23,42,0.55)" />
            <input
              placeholder="Search reference, service, status, amount, email…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={loading}
              aria-label="Filter payments on this page"
            />
            <button
              type="button"
              aria-label="Search options"
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'rgba(15,23,42,0.55)'
              }}
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
          className="padler-panel"
          style={{
            marginBottom: 16,
            padding: '16px 20px',
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) auto',
            gap: 16,
            alignItems: 'end'
          }}
        >
          <div className="padler-field-col">
            <div
              style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--padler-ink-muted)' }}
            >
              Status
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as PaymentStatus | 'ALL')}
              disabled={loading}
              style={{
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid var(--padler-border)',
                fontFamily: 'inherit',
                background: '#fff',
                maxWidth: 320,
                width: '100%',
                minWidth: 0,
                boxSizing: 'border-box'
              }}
            >
              {ALL_PAYMENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s === 'ALL' ? 'All statuses' : s}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className="padler-action padler-action--primary"
            onClick={() => setReloadNonce((n) => n + 1)}
            disabled={loading}
            style={{ whiteSpace: 'nowrap' }}
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>

        {searchQuery.trim() || statusFilter !== 'ALL' ? (
          <p style={{ fontSize: 12, color: 'var(--padler-ink-muted)', margin: '0 0 12px 0' }}>
            Search and status apply to the current page only ({PAYMENTS_PAGE_SIZE} rows from the server). Use
            pagination to see more.
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
                  'Amount',
                  'Currency',
                  'Status',
                  'Service',
                  'Processor',
                  'Payer',
                  'Created'
                ].map((col) => (
                  <th key={col}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: 48, color: 'var(--padler-ink-muted)' }}>
                    {loading ? 'Loading payments…' : 'No payments returned.'}
                  </td>
                </tr>
              ) : displayRows.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: 48, color: 'var(--padler-ink-muted)' }}>
                    No rows match your search or status on this page. Clear filters or go to another page.
                  </td>
                </tr>
              ) : (
                displayRows.map((row, displayIndex) => {
                  const serialNo = page * PAYMENTS_PAGE_SIZE + displayIndex + 1;
                  const canNavigate = row.id != null;
                  const goToDetail = () => {
                    if (canNavigate) {
                      router.push(`/payment/${row.id}`);
                    }
                  };
                  return (
                    <tr
                      key={
                        row.id != null
                          ? `pay-${row.id}`
                          : `${row.reference}-${row.createdAt}`
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
                      aria-label={canNavigate ? `View payment ${row.reference}` : undefined}
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
                      <td
                        style={{
                          fontFamily: 'var(--padler-font-heading)',
                          fontWeight: 600,
                          maxWidth: 160,
                          color: canNavigate ? 'var(--padler-primary)' : undefined
                        }}
                        title={row.reference}
                      >
                        {row.reference}
                      </td>
                      <td style={{ fontFamily: 'var(--padler-font-heading)', fontWeight: 600 }}>
                        {Number.isFinite(row.amount) ? row.amount.toLocaleString() : '—'}
                      </td>
                      <td style={{ color: 'var(--padler-ink-muted)' }}>{row.currency || '—'}</td>
                      <td>
                        <span className={paymentStatusClass(row.status)}>{row.status}</span>
                      </td>
                      <td style={{ maxWidth: 120 }} title={row.service}>
                        {row.service}
                      </td>
                      <td style={{ color: 'var(--padler-ink-muted)', fontSize: 13 }} title={row.paymentProcessor}>
                        {row.paymentProcessor}
                      </td>
                      <td style={{ maxWidth: 200, fontSize: 13 }}>
                        <div>{row.email && row.email !== '—' ? row.email : '—'}</div>
                        {row.payerUserId && row.payerUserId !== '—' ? (
                          <div style={{ color: 'var(--padler-ink-muted)', fontSize: 12 }} title={row.payerUserId}>
                            {row.payerUserId}
                          </div>
                        ) : null}
                      </td>
                      <td
                        style={{
                          whiteSpace: 'nowrap',
                          fontSize: 13,
                          color: 'var(--padler-ink)',
                          fontFamily: 'var(--padler-font-body)'
                        }}
                      >
                        {formatPaymentTime(row.createdAt)}
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
              {totalElements.toLocaleString()} payment{totalElements === 1 ? '' : 's'}
              {totalPages > 0 ? ` · Page ${page + 1} of ${totalPages}` : ''}
              <span style={{ marginLeft: 8, opacity: 0.85 }}>({PAYMENTS_PAGE_SIZE} per page)</span>
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
    </PadlerShell>
  );
}
