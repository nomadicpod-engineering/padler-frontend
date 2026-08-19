'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useState } from 'react';
import { PadlerShell } from '@/app/components/PadlerShell';
import { WalletRestrictionsPanel } from '@/components/wallet/WalletRestrictionsPanel';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FieldLabel, Input } from '@/components/ui/field';
import { PageHeader, StatePanel } from '@/components/ui/page';
import { fetchAdapterWallet } from '@/lib/api';
import type { AdapterSnapshot } from '@/lib/types';

export default function WalletToolsPage() {
  const [lookupUserId, setLookupUserId] = useState('');
  const [activeUserId, setActiveUserId] = useState('');
  const [walletSnapshot, setWalletSnapshot] = useState<AdapterSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadWallet = useCallback(async (userId: string) => {
    const trimmed = userId.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    try {
      setWalletSnapshot(await fetchAdapterWallet(trimmed));
      setActiveUserId(trimmed);
    } catch (e) {
      setWalletSnapshot(null);
      setActiveUserId(trimmed);
      setError(e instanceof Error ? e.message : 'Unable to load wallet');
    } finally {
      setLoading(false);
    }
  }, []);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void loadWallet(lookupUserId);
  };

  return (
    <PadlerShell>
      <PageHeader
        eyebrow="Fix problems"
        title="Wallet"
        subtitle="Enable or disable withdrawals and customer payments per wallet."
      />

      <Card className="mb-4">
        <CardContent className="pt-6">
          <form className="flex flex-wrap items-end gap-3" onSubmit={onSubmit}>
            <FieldLabel className="min-w-[280px] flex-1">
              User id
              <Input
                value={lookupUserId}
                onChange={(e) => setLookupUserId(e.target.value)}
                placeholder="Keycloak / platform user id"
                disabled={loading}
              />
            </FieldLabel>
            <Button type="submit" variant="primary" disabled={loading || !lookupUserId.trim()}>
              {loading ? 'Loading…' : 'Load wallet'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {error ? <div className="mb-4"><StatePanel kind="error" message={error} /></div> : null}

      {activeUserId ? (
        <>
          <p className="mb-4 text-sm text-slate-600">
            User{' '}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{activeUserId}</code>
            {' · '}
            <Link
              href={`/customers/${encodeURIComponent(activeUserId)}`}
              className="font-medium text-blue-700 hover:underline"
            >
              Open Customer 360
            </Link>
          </p>
          <WalletRestrictionsPanel
            userId={activeUserId}
            walletSnapshot={walletSnapshot ?? undefined}
            loading={loading}
            onUpdated={() => void loadWallet(activeUserId)}
          />
        </>
      ) : (
        <StatePanel kind="empty" message="Enter a user id to manage wallet restrictions." />
      )}
    </PadlerShell>
  );
}
