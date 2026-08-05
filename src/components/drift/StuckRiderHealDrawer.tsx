'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { DetailSkeleton } from '@/components/ui/skeleton';
import { DrawerSection, SideDrawer } from '@/components/ui/side-drawer';
import {
  fetchDriftStuckPaymentDetail,
  reconcileDriftStuckPayment,
  type DriftStuckReconcileResult
} from '@/lib/api/drift-tools';
import { formatDateTime, formatMoney } from '@/lib/utils';

export type DriftStuckRow = {
  orderId: string;
  kind?: string;
  status?: string;
  paymentStatus?: string;
  paymentMethod?: string;
  paymentReference?: string;
  customerEmail?: string;
  customerUserId?: string;
  driftDispatchReference?: string;
  driftBookingId?: number | string;
  quotedFinalPrice?: string | number;
  currency?: string;
  lastErrorHint?: string;
  updatedAt?: string;
};

type Props = {
  open: boolean;
  row: DriftStuckRow | null;
  onClose: () => void;
  onResolved?: () => void;
};

function textOrUndefined(value: unknown): string | undefined {
  if (value == null) return undefined;
  const s = String(value).trim();
  return s === '' ? undefined : s;
}

export function toDriftStuckRow(row: Record<string, unknown>): DriftStuckRow {
  return {
    orderId: String(row.orderId ?? row.id ?? ''),
    kind: textOrUndefined(row.kind),
    status: textOrUndefined(row.status),
    paymentStatus: textOrUndefined(row.paymentStatus),
    paymentMethod: textOrUndefined(row.paymentMethod),
    paymentReference: textOrUndefined(row.paymentReference),
    customerEmail: textOrUndefined(row.customerEmail),
    customerUserId: textOrUndefined(row.customerUserId),
    driftDispatchReference: textOrUndefined(row.driftDispatchReference),
    driftBookingId: row.driftBookingId != null ? (row.driftBookingId as number | string) : undefined,
    quotedFinalPrice: row.quotedFinalPrice as string | number | undefined,
    currency: textOrUndefined(row.currency) ?? 'NGN',
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

function summarize(result: DriftStuckReconcileResult): string {
  return [
    `settled=${String(result.paymentSettled)}`,
    `advanced=${String(result.workflowAdvanced)}`,
    `dispatcherPaid=${String(result.dispatcherPaid)}`,
    result.detail ? String(result.detail) : null
  ]
    .filter(Boolean)
    .join(' · ');
}

export function StuckRiderHealDrawer({ open, row, onClose, onResolved }: Props) {
  const orderId = (row?.orderId ?? '').trim();
  const isDeliveredUnpaid = row?.kind === 'DELIVERED_DISPATCH_UNPAID';

  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [result, setResult] = useState<DriftStuckReconcileResult | null>(null);

  const loadDetail = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    setError(null);
    try {
      setDetail(await fetchDriftStuckPaymentDetail(orderId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load detail');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    if (!open || !orderId) return;
    setResult(null);
    setMessage(null);
    void loadDetail();
  }, [open, orderId, loadDetail]);

  const runHeal = useCallback(async () => {
    if (!orderId) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const next = await reconcileDriftStuckPayment(orderId);
      setResult(next);
      setMessage(summarize(next));
      await loadDetail();
      if (next.workflowAdvanced || next.dispatcherPaid) {
        onResolved?.();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Heal failed');
    } finally {
      setBusy(false);
    }
  }, [orderId, loadDetail, onResolved]);

  if (!row) return null;

  const view = detail ?? (row as unknown as Record<string, unknown>);
  const amountRaw = view.quotedFinalPrice ?? row.quotedFinalPrice;
  const amount =
    amountRaw != null && amountRaw !== ''
      ? formatMoney(Number(amountRaw), String(view.currency ?? row.currency ?? 'NGN'))
      : undefined;

  return (
    <SideDrawer
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={orderId || 'Stuck payment'}
      description={
        isDeliveredUnpaid
          ? 'Pay the dispatcher after a successful delivery when settlement failed.'
          : 'Continue a paid order when dispatch/pins failed to advance.'
      }
      width="lg"
      footer={
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="primary" disabled={!orderId || busy} onClick={() => void runHeal()}>
            {busy
              ? 'Working…'
              : isDeliveredUnpaid
                ? 'Pay dispatcher'
                : 'Continue paid order'}
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

        <DrawerSection title="Order">
          <dl>
            <Row label="Kind" value={textOrUndefined(view.kind) ?? row.kind} />
            <Row label="Status" value={textOrUndefined(view.status) ?? row.status} />
            <Row label="Payment status" value={textOrUndefined(view.paymentStatus) ?? row.paymentStatus} />
            <Row label="Payment method" value={textOrUndefined(view.paymentMethod) ?? row.paymentMethod} />
            <Row label="Payment ref" value={textOrUndefined(view.paymentReference) ?? row.paymentReference} />
            <Row label="Amount" value={amount} />
            <Row
              label="Updated"
              value={formatDateTime(
                textOrUndefined(view.updatedAt) ?? row.updatedAt
              )}
            />
            <Row label="Hint" value={textOrUndefined(view.lastErrorHint) ?? row.lastErrorHint} />
          </dl>
        </DrawerSection>

        <DrawerSection title="Customer & dispatch">
          <dl>
            <Row label="Customer email" value={textOrUndefined(view.customerEmail) ?? row.customerEmail} />
            <Row label="Customer id" value={textOrUndefined(view.customerUserId) ?? row.customerUserId} />
            <Row
              label="Dispatch ref"
              value={textOrUndefined(view.driftDispatchReference) ?? row.driftDispatchReference}
            />
            <Row
              label="Booking id"
              value={
                view.driftBookingId != null
                  ? String(view.driftBookingId)
                  : row.driftBookingId != null
                    ? String(row.driftBookingId)
                    : undefined
              }
            />
            <Row
              label="Settlement recipient"
              value={textOrUndefined(view.settlementRecipientUserId)}
            />
          </dl>
        </DrawerSection>

        {result ? (
          <DrawerSection title="Last heal result">
            <dl>
              <Row label="Payment settled" value={String(result.paymentSettled)} />
              <Row label="Workflow advanced" value={String(result.workflowAdvanced)} />
              <Row label="Dispatcher paid" value={String(result.dispatcherPaid)} />
              <Row label="Detail" value={result.detail} />
            </dl>
          </DrawerSection>
        ) : null}
      </div>
    </SideDrawer>
  );
}
