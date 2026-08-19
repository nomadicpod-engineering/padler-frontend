'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  parseWalletRestrictionsFromSnapshot,
  toggleUserDeposits,
  toggleUserWithdrawals
} from '@/lib/api/wallet-user';

type WalletRestrictionsPanelProps = {
  userId: string;
  walletSnapshot?: Record<string, unknown> | null;
  loading?: boolean;
  onUpdated?: () => void;
};

type RestrictionKey = 'withdrawals' | 'deposits';

function restrictionBadge(enabled: boolean) {
  return enabled ? (
    <Badge tone="success">Enabled</Badge>
  ) : (
    <Badge tone="danger">Disabled</Badge>
  );
}

export function WalletRestrictionsPanel({
  userId,
  walletSnapshot,
  loading = false,
  onUpdated
}: WalletRestrictionsPanelProps) {
  const parsed = parseWalletRestrictionsFromSnapshot(walletSnapshot);
  const [allowWithdrawals, setAllowWithdrawals] = useState(parsed.allowWithdrawals);
  const [allowDeposits, setAllowDeposits] = useState(parsed.allowDeposits);
  const [busy, setBusy] = useState<RestrictionKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setAllowWithdrawals(parsed.allowWithdrawals);
    setAllowDeposits(parsed.allowDeposits);
  }, [parsed.allowWithdrawals, parsed.allowDeposits, walletSnapshot]);

  const applyToggle = useCallback(
    async (key: RestrictionKey, nextAllowed: boolean) => {
      if (!userId.trim()) return;
      const label =
        key === 'withdrawals'
          ? nextAllowed
            ? 'enable withdrawals'
            : 'disable withdrawals'
          : nextAllowed
            ? 'enable payments'
            : 'disable payments';
      if (!nextAllowed && !window.confirm(`Are you sure you want to ${label} for this user?`)) {
        return;
      }
      setBusy(key);
      setError(null);
      setMessage(null);
      try {
        const result =
          key === 'withdrawals'
            ? await toggleUserWithdrawals(userId, nextAllowed)
            : await toggleUserDeposits(userId, nextAllowed);
        if (key === 'withdrawals') setAllowWithdrawals(nextAllowed);
        else setAllowDeposits(nextAllowed);
        setMessage(result.detail ?? (nextAllowed ? 'Restriction removed' : 'Restriction applied'));
        onUpdated?.();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unable to update restriction');
      } finally {
        setBusy(null);
      }
    },
    [userId, onUpdated]
  );

  const disabled = loading || busy != null || !parsed.hasWallet;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Wallet restrictions</CardTitle>
        <CardDescription>
          Control bank withdrawals and customer payments (top-up, booking, rental, parcel, etc.).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? <p className="text-sm text-slate-500">Loading wallet…</p> : null}
        {!loading && parsed.walletMissing ? (
          <p className="text-sm text-amber-800">No wallet found for this user.</p>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-slate-950">Withdrawals</span>
              {restrictionBadge(allowWithdrawals)}
            </div>
            <p className="mt-1 text-sm text-slate-500">Allow bank withdrawals from wallet</p>
          </div>
          <Button
            type="button"
            variant={allowWithdrawals ? 'secondary' : 'primary'}
            size="sm"
            disabled={disabled}
            onClick={() => void applyToggle('withdrawals', !allowWithdrawals)}
          >
            {busy === 'withdrawals' ? 'Saving…' : allowWithdrawals ? 'Disable' : 'Enable'}
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-slate-950">Deposits / payments</span>
              {restrictionBadge(allowDeposits)}
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Allow paying (wallet top-up, booking, rental, parcel, etc.)
            </p>
          </div>
          <Button
            type="button"
            variant={allowDeposits ? 'secondary' : 'primary'}
            size="sm"
            disabled={disabled}
            onClick={() => void applyToggle('deposits', !allowDeposits)}
          >
            {busy === 'deposits' ? 'Saving…' : allowDeposits ? 'Disable' : 'Enable'}
          </Button>
        </div>

        {error ? (
          <p className="text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}
        {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      </CardContent>
    </Card>
  );
}
