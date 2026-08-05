'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { PadlerShell } from '@/app/components/PadlerShell';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader, StatePanel } from '@/components/ui/page';
import { PaymentRow } from '@/lib/types';
import { fetchPaymentById } from '@/lib/api';
import { formatDateTime, formatMoney } from '@/lib/utils';


function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-slate-100 py-3 last:border-b-0 sm:grid-cols-[160px_1fr]">
      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</div>
      <div className="break-words text-sm text-slate-900">{value}</div>
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
        if (!cancelled) setRow(data);
      } catch (e) {
        if (!cancelled) {
          setRow(null);
          setLoadError(e instanceof Error ? e.message : 'Failed to load payment');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [paymentId]);

  return (
    <PadlerShell>
      <PageHeader
        eyebrow="Fix problems"
        title={row?.reference ?? 'Payment'}
        subtitle="Wallet payment record"
        actions={
          <Button asChild>
            <Link href="/tools/payment">Back to payments</Link>
          </Button>
        }
      />

      {loadError ? <StatePanel kind="error" message={loadError} /> : null}
      {loading ? <StatePanel kind="loading" skeleton="detail" /> : null}

      {!loading && !loadError && row ? (
        <Card>
          <CardHeader>
            <div>
              <CardTitle className="tabular-nums">{row.reference}</CardTitle>
              <CardDescription>
                {Number.isFinite(row.amount)
                  ? formatMoney(row.amount, row.currency ?? 'NGN')
                  : '—'}
              </CardDescription>
            </div>
            <StatusBadge status={row.status} />
          </CardHeader>
          <CardContent>
            <div>
              {row.id != null ? <DetailRow label="ID" value={String(row.id)} /> : null}
              <DetailRow label="Reference" value={row.reference} />
              <DetailRow label="Status" value={<StatusBadge status={row.status} />} />
              <DetailRow
                label="Amount"
                value={
                  Number.isFinite(row.amount)
                    ? formatMoney(row.amount, row.currency ?? 'NGN')
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
              <DetailRow label="Created" value={formatDateTime(row.createdAt)} />
              <DetailRow label="Updated" value={formatDateTime(row.updatedAt)} />
              {row.authorizationUrl ? (
                <DetailRow
                  label="Authorization URL"
                  value={
                    <a
                      href={row.authorizationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-blue-700 hover:underline"
                    >
                      Open link
                    </a>
                  }
                />
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </PadlerShell>
  );
}
