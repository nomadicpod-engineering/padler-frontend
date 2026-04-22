'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { PadlerShell } from '@/app/components/PadlerShell';
import { PaymentRow } from '@/lib/types';
import { fetchPaymentById } from '@/lib/api';
import { getAuthSession } from '@/lib/auth';
import { ArrowLeft, Bell, CalendarClock } from 'lucide-react';

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

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(120px, 200px) 1fr',
        gap: 12,
        padding: '10px 0',
        borderBottom: '1px solid var(--padler-border)'
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--padler-ink-muted)' }}>{label}</div>
      <div style={{ fontSize: 14, color: 'var(--padler-ink)', wordBreak: 'break-word' }}>{value}</div>
    </div>
  );
}

export default function PaymentDetailPage() {
  const params = useParams();
  const idParam = params?.id;
  const paymentId = typeof idParam === 'string' ? parseInt(idParam, 10) : Number.NaN;

  const [row, setRow] = useState<PaymentRow | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [firstName, setFirstName] = useState('Padler');

  const todayLabel = useMemo(() => {
    const d = new Date();
    return d.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }, []);

  useEffect(() => {
    const s = getAuthSession();
    if (s?.email) {
      setFirstName(s.email.split('@')[0]);
    }
  }, []);

  useEffect(() => {
    if (Number.isNaN(paymentId) || paymentId <= 0) {
      setLoading(false);
      setLoadError('Invalid payment link.');
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    void (async () => {
      try {
        const data = await fetchPaymentById(paymentId);
        if (!cancelled) {
          setRow(data);
        }
      } catch (e) {
        if (!cancelled) {
          setRow(null);
          setLoadError(e instanceof Error ? e.message : 'Failed to load payment');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [paymentId]);

  return (
    <PadlerShell>
      <section className="padler-hero">
        <div className="padler-hero-topbar">
          <div className="padler-hero-title">
            Payment details
            <small>
              {row?.reference ? `${row.reference} · ` : ''}
              Welcome back, {firstName} · {todayLabel}
            </small>
          </div>

          <div className="padler-hero-search" style={{ opacity: 0.5, pointerEvents: 'none' }} aria-hidden>
            <span style={{ fontSize: 13, color: 'rgba(15,23,42,0.45)' }}>Read-only</span>
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
        <div style={{ marginBottom: 16 }}>
          <Link
            href="/payment"
            className="padler-action"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}
          >
            <ArrowLeft size={16} />
            Back to payments
          </Link>
        </div>

        {loadError ? (
          <div
            role="alert"
            className="padler-panel"
            style={{
              padding: '16px 20px',
              background: '#fef2f2',
              color: '#991b1b',
              border: '1px solid #fecaca',
              fontSize: 14
            }}
          >
            {loadError}
          </div>
        ) : null}

        {loading ? (
          <div className="padler-panel" style={{ padding: 24 }}>
            <p style={{ margin: 0, color: 'var(--padler-ink-muted)' }}>Loading payment…</p>
          </div>
        ) : row ? (
          <div className="padler-panel" style={{ padding: '20px 24px' }}>
            <h2
              className="padler-section-title"
              style={{ marginTop: 0, marginBottom: 8, fontSize: 20 }}
            >
              {row.reference}
            </h2>
            <p className="padler-section-subtitle" style={{ marginBottom: 20 }}>
              Wallet payment record
            </p>

            <div>
              {row.id != null ? <DetailRow label="ID" value={String(row.id)} /> : null}
              <DetailRow label="Reference" value={row.reference} />
              <DetailRow label="Status" value={<span className={paymentStatusClass(row.status)}>{row.status}</span>} />
              <DetailRow
                label="Amount"
                value={
                  Number.isFinite(row.amount)
                    ? `${row.currency ? `${row.currency} ` : ''}${row.amount.toLocaleString()}`
                    : '—'
                }
              />
              <DetailRow label="Discount" value={String(row.discountAmount)} />
              {row.discountCode ? <DetailRow label="Discount code" value={row.discountCode} /> : null}
              <DetailRow label="Service" value={row.service} />
              <DetailRow label="Processor" value={row.paymentProcessor} />
              <DetailRow label="Purpose" value={row.purpose} />
              {row.message ? <DetailRow label="Message" value={row.message} /> : null}
              <DetailRow label="Email" value={row.email} />
              <DetailRow label="Payer user id" value={row.payerUserId} />
              <DetailRow label="Created" value={formatPaymentTime(row.createdAt)} />
              <DetailRow label="Updated" value={formatPaymentTime(row.updatedAt)} />
              {row.authorizationUrl ? (
                <DetailRow
                  label="Authorization URL"
                  value={
                    <a href={row.authorizationUrl} target="_blank" rel="noopener noreferrer">
                      Open link
                    </a>
                  }
                />
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </PadlerShell>
  );
}
