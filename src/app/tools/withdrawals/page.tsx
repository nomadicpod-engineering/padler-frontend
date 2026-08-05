'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { PadlerShell } from '@/app/components/PadlerShell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/modal';
import { DataTable, serialColumn, type DataTableColumn } from '@/components/ui/data-table';
import { ListSearch, PageHeader, Pagination, StatePanel } from '@/components/ui/page';
import {
  cancelFailedWithdrawal,
  fetchFailedWithdrawals,
  retryFailedWithdrawal,
  type FailedWithdrawal
} from '@/lib/api/withdrawals';
import { isForbiddenError } from '@/lib/api';
import { formatDateTime, formatMoney } from '@/lib/utils';

const PAGE_SIZE = 20;



export default function FailedWithdrawalsPage() {
  const [rows, setRows] = useState<FailedWithdrawal[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(0);
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<FailedWithdrawal | null>(null);

  useEffect(() => {
    const initial = new URLSearchParams(window.location.search).get('userId');
    if (initial) setUserId(initial);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setForbidden(false);
    try {
      const result = await fetchFailedWithdrawals({ userId, page, size: PAGE_SIZE });
      setRows(result.content ?? []);
      setTotal(result.totalElements ?? 0);
      setTotalPages(result.totalPages ?? 0);
    } catch (e) {
      if (isForbiddenError(e)) setForbidden(true);
      else setError(e instanceof Error ? e.message : 'Unable to load failed bank payouts');
    } finally {
      setLoading(false);
    }
  }, [userId, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (transactionId: string, kind: 'retry' | 'cancel') => {
    setBusyId(transactionId);
    setError(null);
    setMessage(null);
    try {
      if (kind === 'retry') {
        await retryFailedWithdrawal(transactionId);
        setMessage(`Payout retried for ${transactionId}`);
      } else {
        await cancelFailedWithdrawal(transactionId);
        setMessage(`Withdrawal ${transactionId} cancelled — balance was never debited`);
      }
      setCancelTarget(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : `Unable to ${kind} payout`);
    } finally {
      setBusyId(null);
    }
  };

  const columns = useMemo<DataTableColumn<FailedWithdrawal>[]>(
    () => [
      serialColumn<FailedWithdrawal>({ page, pageSize: PAGE_SIZE }),
      {
        header: 'Transaction',
        accessorKey: 'transactionId',
        cell: ({ row }) => (
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs tabular-nums">
            {row.original.transactionId}
          </code>
        )
      },
      {
        header: 'Customer',
        accessorKey: 'userId',
        cell: ({ row }) =>
          row.original.userId ? (
            <Link
              className="font-medium text-blue-700 hover:underline"
              href={`/customers/${encodeURIComponent(row.original.userId)}`}
            >
              {row.original.userId}
            </Link>
          ) : (
            '—'
          )
      },
      {
        header: 'Amount',
        id: 'amount',
        cell: ({ row }) => <span className="tabular-nums">{formatMoney(row.original.amount)}</span>
      },
      {
        header: 'Bank account',
        id: 'destination',
        cell: ({ row }) =>
          [row.original.bankName, row.original.accountNumber].filter(Boolean).join(' · ') || '—'
      },
      {
        header: 'Reason',
        accessorKey: 'reason',
        cell: ({ row }) => row.original.reason ?? '—'
      },
      {
        header: 'Attempts',
        accessorKey: 'attemptCount',
        cell: ({ row }) => row.original.attemptCount ?? 1
      },
      {
        header: 'Last attempt',
        accessorKey: 'lastAttemptAt',
        cell: ({ row }) => formatDateTime(row.original.lastAttemptAt)
      },
      {
        header: 'Fix',
        id: 'fix',
        cell: ({ row }) =>
          row.original.retryable ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="primary"
                disabled={busyId === row.original.transactionId}
                onClick={() => void act(row.original.transactionId, 'retry')}
              >
                {busyId === row.original.transactionId ? 'Working…' : 'Retry payout'}
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={busyId === row.original.transactionId}
                onClick={() => setCancelTarget(row.original)}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <span className="text-sm text-slate-500">{row.original.transactionStatus ?? 'Not retryable'}</span>
          )
      }
    ],
    [busyId, page]
  );

  return (
    <PadlerShell>
      <PageHeader
        eyebrow="Fix problems"
        title="Failed bank payouts"
        subtitle="Bank transfers that failed at the provider. Customer balances were not debited."
        actions={
          <Button type="button" onClick={() => void load()}>
            Refresh
          </Button>
        }
      />
      <p className="mb-4 text-sm text-slate-500">
        <Link href="/tools" className="font-medium text-blue-700 hover:underline">
          ← All tools
        </Link>
      </p>
      <ListSearch
        value={userId}
        onChange={(value) => {
          setUserId(value);
          setPage(0);
        }}
        placeholder="Filter by customer user id"
        hint={`${total} unresolved`}
      />
      {forbidden ? <StatePanel kind="forbidden" /> : null}
      {loading && rows.length === 0 ? <StatePanel kind="loading" /> : null}
      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {message}
        </div>
      ) : null}
      {!loading && !forbidden && rows.length === 0 ? (
        <StatePanel kind="empty" message="No failed bank payouts." />
      ) : null}
      {!loading && !forbidden && rows.length > 0 ? (
        <Card className="overflow-hidden p-0">
          <DataTable columns={columns} data={rows} />
          <div className="border-t border-slate-100 px-4 py-3">
            <Pagination page={page} totalPages={Math.max(totalPages, 1)} onPageChange={setPage} />
          </div>
        </Card>
      ) : null}

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        onOpenChange={(open) => {
          if (!open) setCancelTarget(null);
        }}
        title="Cancel this payout request?"
        description="This closes the failed payout. The customer balance was never taken, so nothing is refunded."
        confirmLabel="Cancel payout"
        cancelLabel="Keep open"
        tone="danger"
        busy={busyId === cancelTarget?.transactionId}
        onConfirm={() => {
          if (cancelTarget) void act(cancelTarget.transactionId, 'cancel');
        }}
      />
    </PadlerShell>
  );
}
