'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { PadlerShell } from '@/app/components/PadlerShell';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader, StatePanel } from '@/components/ui/page';
import { fetchClassycarHub } from '@/lib/api/classycar-tools';
import { isForbiddenError } from '@/lib/api';
import { NPOD_AUTO_LABEL } from '@/lib/product-labels';

export default function ClassycarHubPage() {
  const [hub, setHub] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setForbidden(false);
    try {
      setHub(await fetchClassycarHub());
    } catch (e) {
      if (isForbiddenError(e)) setForbidden(true);
      else setError(e instanceof Error ? e.message : `Unable to load ${NPOD_AUTO_LABEL} hub`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <PadlerShell>
      <PageHeader
        eyebrow="Fix problems"
        title={NPOD_AUTO_LABEL}
        subtitle="Dealers — confirm booking, confirm payment, withdrawals."
        actions={
          <Button type="button" onClick={() => void load()} disabled={loading}>
            {loading ? 'Loading…' : 'Refresh'}
          </Button>
        }
      />

      <p className="mb-4 text-sm text-slate-500">
        <Link href="/tools" className="font-semibold text-blue-700 hover:underline">
          ← Tools
        </Link>
      </p>

      {forbidden ? <StatePanel kind="forbidden" /> : null}
      {loading ? <StatePanel kind="loading" skeleton="cards" /> : null}
      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {error}
        </div>
      ) : null}

      {!loading && !forbidden && hub ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Link href="/tools/classycar/dealers" className="group block">
            <Card className="h-full transition duration-200 group-hover:-translate-y-0.5 group-hover:border-blue-200 group-hover:shadow-md motion-reduce:transform-none">
              <CardHeader>
                <CardTitle>Dealers</CardTitle>
                <CardDescription>{String(hub.dealerCount ?? 0)} dealers</CardDescription>
              </CardHeader>
            </Card>
          </Link>
          <Link href="/tools/classycar/bookings" className="group block">
            <Card className="h-full transition duration-200 group-hover:-translate-y-0.5 group-hover:border-blue-200 group-hover:shadow-md motion-reduce:transform-none">
              <CardHeader>
                <CardTitle>Bookings</CardTitle>
                <CardDescription>
                  {String(hub.bookingCount ?? 0)} total · {String(hub.pendingBookings ?? 0)} pending
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
          <Link href="/tools/classycar/stuck" className="group block">
            <Card className="h-full transition duration-200 group-hover:-translate-y-0.5 group-hover:border-blue-200 group-hover:shadow-md motion-reduce:transform-none">
              <CardHeader>
                <CardTitle>Stuck payments</CardTitle>
                <CardDescription>
                  {(() => {
                    const stuck = (hub.stuckPayments ?? {}) as Record<string, unknown>;
                    const bookings = Number(stuck.pendingBookingCount ?? 0);
                    const sales = Number(stuck.initiatedSaleCount ?? 0);
                    if (stuck.error) return 'Queue unavailable';
                    return `${bookings} pending bookings · ${sales} initiated sales`;
                  })()}
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        </div>
      ) : null}
    </PadlerShell>
  );
}
