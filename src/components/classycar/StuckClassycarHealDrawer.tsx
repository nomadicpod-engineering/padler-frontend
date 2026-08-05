'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { DetailSkeleton } from '@/components/ui/skeleton';
import { DrawerSection, SideDrawer } from '@/components/ui/side-drawer';
import {
  fetchClassycarBooking,
  reconcileClassycarStuckPayment,
  type ClassycarStuckReconcileResult
} from '@/lib/api/classycar-tools';
import { formatDateTime, formatMoney } from '@/lib/utils';

export type ClassycarStuckRow = {
  kind: string;
  id: number;
  paymentReference?: string;
  status?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerUserId?: string;
  dealerId?: number;
  dealerUserId?: string;
  amount?: number | string;
  vehicleName?: string;
  transactionOrigin?: string;
  lastErrorHint?: string;
  updatedAt?: string;
};

type Props = {
  open: boolean;
  row: ClassycarStuckRow | null;
  onClose: () => void;
  onResolved?: () => void;
};

function textOrUndefined(value: unknown): string | undefined {
  if (value == null) return undefined;
  const s = String(value).trim();
  return s === '' ? undefined : s;
}

export function toClassycarStuckRow(row: Record<string, unknown>): ClassycarStuckRow | null {
  const id = Number(row.id);
  const kind = String(row.kind ?? '').trim().toUpperCase();
  if (!Number.isFinite(id) || id <= 0 || (kind !== 'BOOKING' && kind !== 'SALE')) {
    return null;
  }
  return {
    kind,
    id,
    paymentReference: textOrUndefined(row.paymentReference),
    status: textOrUndefined(row.status),
    customerName: textOrUndefined(row.customerName),
    customerEmail: textOrUndefined(row.customerEmail),
    customerPhone: textOrUndefined(row.customerPhone),
    customerUserId: textOrUndefined(row.customerUserId),
    dealerId: row.dealerId != null ? Number(row.dealerId) : undefined,
    dealerUserId: textOrUndefined(row.dealerUserId),
    amount: row.amount as number | string | undefined,
    vehicleName: textOrUndefined(row.vehicleName),
    transactionOrigin: textOrUndefined(row.transactionOrigin),
    lastErrorHint: textOrUndefined(row.lastErrorHint),
    updatedAt: textOrUndefined(row.updatedAt)
  };
}

function Row({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div className="grid gap-1 border-b border-slate-100 py-2.5 last:border-b-0 sm:grid-cols-[140px_1fr]">
      <dt className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-400">{label}</dt>
      <dd className="text-sm text-slate-900">{value?.trim() ? value : '—'}</dd>
    </div>
  );
}

function summarize(result: ClassycarStuckReconcileResult): string {
  return [
    `settled=${String(result.walletSettled)}`,
    `confirmed=${String(result.confirmed)}`,
    result.beforeStatus && result.afterStatus
      ? `${result.beforeStatus} → ${result.afterStatus}`
      : null,
    result.detail ? String(result.detail) : null
  ]
    .filter(Boolean)
    .join(' · ');
}

export function StuckClassycarHealDrawer({ open, row, onClose, onResolved }: Props) {
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [booking, setBooking] = useState<Record<string, unknown> | null>(null);
  const [result, setResult] = useState<ClassycarStuckReconcileResult | null>(null);

  const loadBooking = useCallback(async () => {
    if (!row || row.kind !== 'BOOKING') {
      setBooking(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setBooking(await fetchClassycarBooking(row.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load booking');
    } finally {
      setLoading(false);
    }
  }, [row]);

  useEffect(() => {
    if (!open || !row) return;
    setResult(null);
    setMessage(null);
    void loadBooking();
  }, [open, row, loadBooking]);

  const runMatch = useCallback(async () => {
    if (!row) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const next = await reconcileClassycarStuckPayment(row.kind, row.id);
      setResult(next);
      setMessage(summarize(next));
      if (row.kind === 'BOOKING') {
        await loadBooking();
      }
      if (next.confirmed) {
        onResolved?.();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Match payment failed');
    } finally {
      setBusy(false);
    }
  }, [row, loadBooking, onResolved]);

  if (!row) return null;

  const amountRaw = booking?.totalPrice ?? row.amount;
  const amount =
    amountRaw != null && amountRaw !== ''
      ? formatMoney(Number(amountRaw), 'NGN')
      : undefined;

  return (
    <SideDrawer
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={`${row.kind} #${row.id}`}
      description="Match wallet settlement and confirm the pending booking or sale."
      width="lg"
      footer={
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="primary" disabled={busy} onClick={() => void runMatch()}>
            {busy ? 'Matching…' : 'Match payment'}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {loading ? <DetailSkeleton /> : null}
        {message ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
            {error}
          </div>
        ) : null}

        <DrawerSection title="Payment">
          <dl>
            <Row label="Kind" value={row.kind} />
            <Row
              label="Payment ref"
              value={textOrUndefined(booking?.paymentReference) ?? row.paymentReference}
            />
            <Row label="Status" value={textOrUndefined(booking?.status) ?? row.status} />
            <Row
              label="Origin"
              value={textOrUndefined(booking?.transactionOrigin) ?? row.transactionOrigin}
            />
            <Row label="Amount" value={amount} />
            <Row label="Updated" value={formatDateTime(row.updatedAt)} />
            <Row label="Hint" value={row.lastErrorHint} />
          </dl>
        </DrawerSection>

        <DrawerSection title="Customer">
          <dl>
            <Row label="Name" value={textOrUndefined(booking?.customerName) ?? row.customerName} />
            <Row label="Email" value={textOrUndefined(booking?.customerEmail) ?? row.customerEmail} />
            <Row label="Phone" value={textOrUndefined(booking?.customerPhone) ?? row.customerPhone} />
            <Row
              label="Customer id"
              value={textOrUndefined(booking?.customerUserId) ?? row.customerUserId}
            />
          </dl>
        </DrawerSection>

        <DrawerSection title="Dealer / vehicle">
          <dl>
            <Row
              label="Dealer id"
              value={
                booking?.dealerId != null
                  ? String(booking.dealerId)
                  : row.dealerId != null
                    ? String(row.dealerId)
                    : undefined
              }
            />
            <Row label="Dealer user" value={row.dealerUserId} />
            <Row label="Vehicle" value={textOrUndefined(booking?.vehicleName) ?? row.vehicleName} />
          </dl>
        </DrawerSection>

        {result ? (
          <DrawerSection title="Last match result">
            <dl>
              <Row label="Wallet settled" value={String(result.walletSettled)} />
              <Row label="Confirmed" value={String(result.confirmed)} />
              <Row
                label="Status"
                value={
                  result.beforeStatus && result.afterStatus
                    ? `${result.beforeStatus} → ${result.afterStatus}`
                    : result.afterStatus
                }
              />
              <Row label="Detail" value={result.detail} />
            </dl>
          </DrawerSection>
        ) : null}
      </div>
    </SideDrawer>
  );
}
