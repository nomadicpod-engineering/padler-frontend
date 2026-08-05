'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { PadlerShell } from '@/app/components/PadlerShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/modal';
import { DataTable, serialColumn, type DataTableColumn } from '@/components/ui/data-table';
import { FieldLabel, Input, Textarea } from '@/components/ui/field';
import { ListSearch, PageHeader, Pagination, StatePanel } from '@/components/ui/page';
import { isForbiddenError } from '@/lib/api';
import {
  cancelConfigFailedWithdrawal,
  createActivationCode,
  createRewardsRule,
  deactivateActivationCode,
  deleteRewardsRule,
  fetchConfigFailedWithdrawals,
  fetchConversionRate,
  fetchKycConfig,
  fetchLiabilityReport,
  fetchReferralConfig,
  fetchRewardPlusConfig,
  fetchRewardPlusMember,
  fetchRewardPlusMemberBusinesses,
  fetchRewardPlusMemberLedger,
  fetchRewardsAdminConfig,
  fetchRewardsEventTrace,
  fetchRewardsUserTimeline,
  listActivationCodes,
  listReferralRules,
  listRewardPlusGlobalRates,
  listRewardPlusProducts,
  listRewardsLedger,
  listRewardsRules,
  retryConfigFailedWithdrawal,
  updateConversionRate,
  updateKycConfig,
  updateReferralConfig,
  updateRewardPlusConfig,
  updateRewardsAdminConfig,
  upsertRewardPlusMember,
  upsertRewardPlusProduct,
  upsertRewardPlusRate,
  voidRewardsLedger
} from '@/lib/api/wallet-config';
import type { FailedWithdrawal } from '@/lib/api/withdrawals';
import { getAuthSession } from '@/lib/auth';
import { canAccessWalletConfig } from '@/lib/types';
import { cn, formatDateTime, formatMoney } from '@/lib/utils';

type TabId = 'reward-plus' | 'rewards' | 'kyc' | 'withdrawals';

const TABS: { id: TabId; label: string }[] = [
  { id: 'reward-plus', label: 'Reward+' },
  { id: 'rewards', label: 'Rewards' },
  { id: 'kyc', label: 'KYC' },
  { id: 'withdrawals', label: 'Failed payouts' }
];

function asRows(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value as Record<string, unknown>[];
  return [];
}

function cell(value: unknown): string {
  if (value == null || value === '') return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export default function WalletConfigPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [tab, setTab] = useState<TabId>('reward-plus');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAllowed(canAccessWalletConfig(getAuthSession()?.designation));
  }, []);

  if (allowed === null) {
    return (
      <PadlerShell>
        <StatePanel kind="loading" skeleton="detail" />
      </PadlerShell>
    );
  }

  if (!allowed) {
    return (
      <PadlerShell>
        <PageHeader
          eyebrow="Platform"
          title="Wallet config"
          subtitle="Reward+, Rewards, KYC, and failed payouts"
        />
        <StatePanel
          kind="forbidden"
          message="Only BACK_OFFICE_SUPER_ADMIN can open wallet config (CAP_ADMIN_ALL)."
        />
      </PadlerShell>
    );
  }

  return (
    <PadlerShell>
      <PageHeader
        eyebrow="Platform"
        title="Wallet config"
        subtitle="SUPER_ADMIN control plane for wallet-service admin APIs"
      />

      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map((item) => (
          <Button
            key={item.id}
            type="button"
            variant={tab === item.id ? 'primary' : 'secondary'}
            onClick={() => {
              setTab(item.id);
              setError(null);
              setMessage(null);
            }}
          >
            {item.label}
          </Button>
        ))}
      </div>

      {error ? (
        <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {message}
        </p>
      ) : null}

      {tab === 'reward-plus' ? (
        <RewardPlusTab
          onError={setError}
          onMessage={setMessage}
        />
      ) : null}
      {tab === 'rewards' ? <RewardsTab onError={setError} onMessage={setMessage} /> : null}
      {tab === 'kyc' ? <KycTab onError={setError} onMessage={setMessage} /> : null}
      {tab === 'withdrawals' ? (
        <WithdrawalsTab onError={setError} onMessage={setMessage} />
      ) : null}
    </PadlerShell>
  );
}

function RewardPlusTab({
  onError,
  onMessage
}: {
  onError: (v: string | null) => void;
  onMessage: (v: string | null) => void;
}) {
  const [codes, setCodes] = useState<Record<string, unknown>[]>([]);
  const [products, setProducts] = useState<Record<string, unknown>[]>([]);
  const [rates, setRates] = useState<Record<string, unknown>[]>([]);
  const [minWithdraw, setMinWithdraw] = useState('');
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState('');
  const [maxUses, setMaxUses] = useState('1');
  const [expiresAt, setExpiresAt] = useState('');
  const [memberId, setMemberId] = useState('');
  const [memberNotes, setMemberNotes] = useState('');
  const [memberActive, setMemberActive] = useState(true);
  const [memberDetail, setMemberDetail] = useState<Record<string, unknown> | null>(null);
  const [memberBiz, setMemberBiz] = useState<Record<string, unknown> | null>(null);
  const [memberLedger, setMemberLedger] = useState<Record<string, unknown> | null>(null);
  const [productCode, setProductCode] = useState('');
  const [productName, setProductName] = useState('');
  const [platformTake, setPlatformTake] = useState('10');
  const [businessNet, setBusinessNet] = useState('90');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    onError(null);
    try {
      const [codeRows, productRows, rateRows, cfg] = await Promise.all([
        listActivationCodes(),
        listRewardPlusProducts(),
        listRewardPlusGlobalRates(),
        fetchRewardPlusConfig()
      ]);
      setCodes(codeRows ?? []);
      setProducts(productRows ?? []);
      setRates(rateRows ?? []);
      const program = (cfg?.program ?? cfg) as Record<string, unknown> | undefined;
      setMinWithdraw(String(program?.minBankWithdrawalAmount ?? ''));
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Unable to load Reward+ config');
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    void load();
  }, [load]);

  const codeColumns = useMemo<DataTableColumn<Record<string, unknown>>[]>(
    () => [
      serialColumn(),
      { header: 'Code', accessorKey: 'code' },
      { header: 'Uses', cell: ({ row }) => `${row.original.usedCount ?? 0}/${row.original.maxUses ?? '—'}` },
      {
        header: 'Expires',
        cell: ({ row }) =>
          formatDateTime(row.original.expiresAt != null ? String(row.original.expiresAt) : undefined)
      },
      {
        header: 'Active',
        cell: ({ row }) => (row.original.active === false ? 'No' : 'Yes')
      },
      {
        header: 'Actions',
        cell: ({ row }) => (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={row.original.active === false || busy}
            onClick={async () => {
              setBusy(true);
              onError(null);
              try {
                await deactivateActivationCode(Number(row.original.id));
                onMessage(`Deactivated ${String(row.original.code)}`);
                await load();
              } catch (e) {
                onError(e instanceof Error ? e.message : 'Deactivate failed');
              } finally {
                setBusy(false);
              }
            }}
          >
            Deactivate
          </Button>
        )
      }
    ],
    [busy, load, onError, onMessage]
  );

  const productColumns = useMemo<DataTableColumn<Record<string, unknown>>[]>(
    () => [
      serialColumn(),
      { header: 'Code', accessorKey: 'code' },
      { header: 'Name', accessorKey: 'displayName' },
      { header: 'Platform %', accessorKey: 'defaultPlatformTakePercent' },
      { header: 'Business %', accessorKey: 'defaultBusinessNetPercent' },
      {
        header: 'Active',
        cell: ({ row }) => (row.original.active === false ? 'No' : 'Yes')
      }
    ],
    []
  );

  const onCreateCode = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    onError(null);
    try {
      await createActivationCode({
        code: code.trim(),
        maxUses: Number(maxUses) || 1,
        expiresAt: expiresAt.trim() ? expiresAt.trim() : null
      });
      onMessage(`Created activation code ${code.trim().toUpperCase()}`);
      setCode('');
      setMaxUses('1');
      setExpiresAt('');
      await load();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <StatePanel kind="loading" skeleton="table" />;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Activation codes</CardTitle>
          <CardDescription>Create codes Reward+ users redeem to activate membership.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="grid gap-3 sm:grid-cols-4" onSubmit={onCreateCode}>
            <FieldLabel>
              Code
              <Input value={code} onChange={(e) => setCode(e.target.value)} required placeholder="LAUNCH2026" />
            </FieldLabel>
            <FieldLabel>
              Max uses
              <Input
                type="number"
                min={1}
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
                required
              />
            </FieldLabel>
            <FieldLabel>
              Expires (ISO, optional)
              <Input
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                placeholder="2026-12-31T23:59:59"
              />
            </FieldLabel>
            <div className="flex items-end">
              <Button type="submit" disabled={busy || !code.trim()}>
                Create code
              </Button>
            </div>
          </form>
          <DataTable columns={codeColumns} data={codes} emptyMessage="No activation codes yet." />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <CardDescription>Look up or upsert a Reward+ membership by user id.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <FieldLabel className="sm:col-span-2">
              User id
              <Input value={memberId} onChange={(e) => setMemberId(e.target.value)} placeholder="Keycloak user id" />
            </FieldLabel>
            <FieldLabel>
              Active
              <select
                className="min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                value={memberActive ? 'true' : 'false'}
                onChange={(e) => setMemberActive(e.target.value === 'true')}
              >
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </FieldLabel>
            <div className="flex items-end gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={busy || !memberId.trim()}
                onClick={async () => {
                  setBusy(true);
                  onError(null);
                  try {
                    const [m, b, l] = await Promise.all([
                      fetchRewardPlusMember(memberId.trim()),
                      fetchRewardPlusMemberBusinesses(memberId.trim()),
                      fetchRewardPlusMemberLedger(memberId.trim())
                    ]);
                    setMemberDetail(m);
                    setMemberBiz(b);
                    setMemberLedger(l);
                    onMessage(`Loaded member ${memberId.trim()}`);
                  } catch (err) {
                    onError(err instanceof Error ? err.message : 'Lookup failed');
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Load
              </Button>
              <Button
                type="button"
                disabled={busy || !memberId.trim()}
                onClick={async () => {
                  setBusy(true);
                  onError(null);
                  try {
                    const m = await upsertRewardPlusMember({
                      userId: memberId.trim(),
                      active: memberActive,
                      adminNotes: memberNotes.trim() || undefined
                    });
                    setMemberDetail(m);
                    onMessage(`Upserted member ${memberId.trim()}`);
                  } catch (err) {
                    onError(err instanceof Error ? err.message : 'Upsert failed');
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Upsert
              </Button>
            </div>
          </div>
          <FieldLabel>
            Admin notes
            <Textarea value={memberNotes} onChange={(e) => setMemberNotes(e.target.value)} />
          </FieldLabel>
          {memberDetail ? (
            <pre className="overflow-x-auto rounded-xl bg-slate-50 p-3 text-xs text-slate-700">
              {JSON.stringify({ member: memberDetail, businesses: memberBiz, ledger: memberLedger }, null, 2)}
            </pre>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Products &amp; rates</CardTitle>
          <CardDescription>Upsert products and GLOBAL rates; set min bank withdrawal.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            className="grid gap-3 sm:grid-cols-5"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              onError(null);
              try {
                await upsertRewardPlusProduct({
                  code: productCode.trim(),
                  displayName: productName.trim(),
                  defaultPlatformTakePercent: Number(platformTake),
                  defaultBusinessNetPercent: Number(businessNet),
                  seedGlobalRate: true
                });
                await upsertRewardPlusRate({
                  scope: 'GLOBAL',
                  productCode: productCode.trim(),
                  platformTakePercent: Number(platformTake),
                  businessNetPercent: Number(businessNet)
                });
                onMessage(`Saved product ${productCode.trim()}`);
                setProductCode('');
                setProductName('');
                await load();
              } catch (err) {
                onError(err instanceof Error ? err.message : 'Product save failed');
              } finally {
                setBusy(false);
              }
            }}
          >
            <FieldLabel>
              Code
              <Input value={productCode} onChange={(e) => setProductCode(e.target.value)} required />
            </FieldLabel>
            <FieldLabel>
              Display name
              <Input value={productName} onChange={(e) => setProductName(e.target.value)} required />
            </FieldLabel>
            <FieldLabel>
              Platform %
              <Input value={platformTake} onChange={(e) => setPlatformTake(e.target.value)} required />
            </FieldLabel>
            <FieldLabel>
              Business %
              <Input value={businessNet} onChange={(e) => setBusinessNet(e.target.value)} required />
            </FieldLabel>
            <div className="flex items-end">
              <Button type="submit" disabled={busy}>
                Save product
              </Button>
            </div>
          </form>
          <DataTable columns={productColumns} data={products} emptyMessage="No products." />
          <div className="grid gap-3 sm:grid-cols-3">
            <FieldLabel>
              Min bank withdrawal
              <Input value={minWithdraw} onChange={(e) => setMinWithdraw(e.target.value)} />
            </FieldLabel>
            <div className="flex items-end">
              <Button
                type="button"
                disabled={busy || !minWithdraw.trim()}
                onClick={async () => {
                  setBusy(true);
                  onError(null);
                  try {
                    await updateRewardPlusConfig({ minBankWithdrawalAmount: minWithdraw.trim() });
                    onMessage('Updated Reward+ program config');
                    await load();
                  } catch (err) {
                    onError(err instanceof Error ? err.message : 'Config update failed');
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Save config
              </Button>
            </div>
          </div>
          <pre className="overflow-x-auto rounded-xl bg-slate-50 p-3 text-xs text-slate-700">
            {JSON.stringify(rates, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}

function RewardsTab({
  onError,
  onMessage
}: {
  onError: (v: string | null) => void;
  onMessage: (v: string | null) => void;
}) {
  const [rules, setRules] = useState<Record<string, unknown>[]>([]);
  const [ledger, setLedger] = useState<Record<string, unknown>[]>([]);
  const [referralRules, setReferralRules] = useState<Record<string, unknown>[]>([]);
  const [conversion, setConversion] = useState<Record<string, unknown> | null>(null);
  const [referralConfig, setReferralConfig] = useState<Record<string, unknown> | null>(null);
  const [rewardsConfig, setRewardsConfig] = useState<Record<string, unknown> | null>(null);
  const [liability, setLiability] = useState<Record<string, unknown> | null>(null);
  const [trace, setTrace] = useState<unknown>(null);
  const [timeline, setTimeline] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pointsPerNaira, setPointsPerNaira] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sourceRef, setSourceRef] = useState('');
  const [timelineUser, setTimelineUser] = useState('');
  const [ruleProduct, setRuleProduct] = useState('TRIP_JOTTER');
  const [ruleEvent, setRuleEvent] = useState('BOOKING_COMPLETED');
  const [ruleRole, setRuleRole] = useState('CUSTOMER');
  const [rulePoints, setRulePoints] = useState('100');

  const load = useCallback(async () => {
    setLoading(true);
    onError(null);
    try {
      const [r, l, rr, c, rc, rac] = await Promise.all([
        listRewardsRules(),
        listRewardsLedger(),
        listReferralRules(),
        fetchConversionRate(),
        fetchReferralConfig(),
        fetchRewardsAdminConfig()
      ]);
      setRules(asRows(r));
      setLedger(asRows(l));
      setReferralRules(asRows(rr));
      setConversion(c);
      setReferralConfig((rc as Record<string, unknown>) ?? null);
      setRewardsConfig((rac as Record<string, unknown>) ?? null);
      const current = (c?.current ?? {}) as Record<string, unknown>;
      setPointsPerNaira(String(current.pointsPerNaira ?? ''));
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Unable to load rewards admin');
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    void load();
  }, [load]);

  const ruleColumns = useMemo<DataTableColumn<Record<string, unknown>>[]>(
    () => [
      serialColumn(),
      { header: 'Id', accessorKey: 'id' },
      { header: 'Product', accessorKey: 'product' },
      { header: 'Event', cell: ({ row }) => cell(row.original.eventType) },
      { header: 'Role', cell: ({ row }) => cell(row.original.partyRole) },
      { header: 'Fixed', accessorKey: 'fixedPoints' },
      {
        header: 'Active',
        cell: ({ row }) => (row.original.active === false ? 'No' : 'Yes')
      },
      {
        header: 'Actions',
        cell: ({ row }) => (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              onError(null);
              try {
                await deleteRewardsRule(Number(row.original.id));
                onMessage(`Deleted rule ${String(row.original.id)}`);
                await load();
              } catch (e) {
                onError(e instanceof Error ? e.message : 'Delete failed');
              } finally {
                setBusy(false);
              }
            }}
          >
            Soft-delete
          </Button>
        )
      }
    ],
    [busy, load, onError, onMessage]
  );

  if (loading) return <StatePanel kind="loading" skeleton="table" />;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Earn rules</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            className="grid gap-3 sm:grid-cols-5"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              onError(null);
              try {
                await createRewardsRule({
                  product: ruleProduct.trim(),
                  eventType: ruleEvent.trim(),
                  partyRole: ruleRole.trim(),
                  fixedPoints: Number(rulePoints) || 0,
                  pointsPer1000: 0,
                  priorityOrder: 0,
                  active: true
                });
                onMessage('Created earn rule');
                await load();
              } catch (err) {
                onError(err instanceof Error ? err.message : 'Create rule failed');
              } finally {
                setBusy(false);
              }
            }}
          >
            <FieldLabel>
              Product
              <Input value={ruleProduct} onChange={(e) => setRuleProduct(e.target.value)} />
            </FieldLabel>
            <FieldLabel>
              Event type
              <Input value={ruleEvent} onChange={(e) => setRuleEvent(e.target.value)} />
            </FieldLabel>
            <FieldLabel>
              Party role
              <Input value={ruleRole} onChange={(e) => setRuleRole(e.target.value)} />
            </FieldLabel>
            <FieldLabel>
              Fixed points
              <Input value={rulePoints} onChange={(e) => setRulePoints(e.target.value)} />
            </FieldLabel>
            <div className="flex items-end">
              <Button type="submit" disabled={busy}>
                Create rule
              </Button>
            </div>
          </form>
          <DataTable columns={ruleColumns} data={rules} emptyMessage="No earn rules." />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Conversion rate</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <FieldLabel>
              Points per naira
              <Input value={pointsPerNaira} onChange={(e) => setPointsPerNaira(e.target.value)} />
            </FieldLabel>
            <Button
              type="button"
              disabled={busy || !pointsPerNaira.trim()}
              onClick={async () => {
                setBusy(true);
                onError(null);
                try {
                  await updateConversionRate({ pointsPerNaira: Number(pointsPerNaira) });
                  onMessage('Updated conversion rate');
                  await load();
                } catch (e) {
                  onError(e instanceof Error ? e.message : 'Rate update failed');
                } finally {
                  setBusy(false);
                }
              }}
            >
              Save rate
            </Button>
            <pre className="overflow-x-auto rounded-xl bg-slate-50 p-3 text-xs">
              {JSON.stringify(conversion, null, 2)}
            </pre>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Liability report</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <FieldLabel>
              From (ISO)
              <Input value={from} onChange={(e) => setFrom(e.target.value)} placeholder="2026-01-01T00:00:00" />
            </FieldLabel>
            <FieldLabel>
              To (ISO)
              <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="2026-12-31T23:59:59" />
            </FieldLabel>
            <Button
              type="button"
              disabled={busy || !from.trim() || !to.trim()}
              onClick={async () => {
                setBusy(true);
                onError(null);
                try {
                  const report = await fetchLiabilityReport(from.trim(), to.trim());
                  setLiability(report as Record<string, unknown>);
                  onMessage('Loaded liability report');
                } catch (e) {
                  onError(e instanceof Error ? e.message : 'Report failed');
                } finally {
                  setBusy(false);
                }
              }}
            >
              Run report
            </Button>
            <pre className="overflow-x-auto rounded-xl bg-slate-50 p-3 text-xs">
              {JSON.stringify(liability, null, 2)}
            </pre>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configs</CardTitle>
          <CardDescription>Referral + rewards ops config (edit JSON carefully, then save).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FieldLabel>
            Referral config JSON
            <Textarea
              className="font-mono text-xs"
              value={JSON.stringify(referralConfig ?? {}, null, 2)}
              onChange={(e) => {
                try {
                  setReferralConfig(JSON.parse(e.target.value) as Record<string, unknown>);
                } catch {
                  /* keep typing */
                }
              }}
            />
          </FieldLabel>
          <Button
            type="button"
            disabled={busy || !referralConfig}
            onClick={async () => {
              setBusy(true);
              onError(null);
              try {
                await updateReferralConfig(referralConfig ?? {});
                onMessage('Saved referral config');
                await load();
              } catch (e) {
                onError(e instanceof Error ? e.message : 'Referral config save failed');
              } finally {
                setBusy(false);
              }
            }}
          >
            Save referral config
          </Button>
          <FieldLabel>
            Rewards admin config JSON
            <Textarea
              className="font-mono text-xs"
              value={JSON.stringify(rewardsConfig ?? {}, null, 2)}
              onChange={(e) => {
                try {
                  setRewardsConfig(JSON.parse(e.target.value) as Record<string, unknown>);
                } catch {
                  /* keep typing */
                }
              }}
            />
          </FieldLabel>
          <Button
            type="button"
            disabled={busy || !rewardsConfig}
            onClick={async () => {
              setBusy(true);
              onError(null);
              try {
                await updateRewardsAdminConfig(rewardsConfig ?? {});
                onMessage('Saved rewards config');
                await load();
              } catch (e) {
                onError(e instanceof Error ? e.message : 'Rewards config save failed');
              } finally {
                setBusy(false);
              }
            }}
          >
            Save rewards config
          </Button>
          <pre className="overflow-x-auto rounded-xl bg-slate-50 p-3 text-xs">
            Referral rules: {JSON.stringify(referralRules, null, 2)}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Support</CardTitle>
          <CardDescription>Event trace and user timeline.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <FieldLabel className="sm:col-span-2">
              Source ref
              <Input value={sourceRef} onChange={(e) => setSourceRef(e.target.value)} />
            </FieldLabel>
            <div className="flex items-end">
              <Button
                type="button"
                disabled={busy || !sourceRef.trim()}
                onClick={async () => {
                  setBusy(true);
                  onError(null);
                  try {
                    setTrace(await fetchRewardsEventTrace(sourceRef.trim()));
                    onMessage('Loaded event trace');
                  } catch (e) {
                    onError(e instanceof Error ? e.message : 'Trace failed');
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Trace event
              </Button>
            </div>
          </div>
          <pre className="overflow-x-auto rounded-xl bg-slate-50 p-3 text-xs">{JSON.stringify(trace, null, 2)}</pre>
          <div className="grid gap-3 sm:grid-cols-3">
            <FieldLabel className="sm:col-span-2">
              User id
              <Input value={timelineUser} onChange={(e) => setTimelineUser(e.target.value)} />
            </FieldLabel>
            <div className="flex items-end">
              <Button
                type="button"
                disabled={busy || !timelineUser.trim()}
                onClick={async () => {
                  setBusy(true);
                  onError(null);
                  try {
                    setTimeline(await fetchRewardsUserTimeline(timelineUser.trim()));
                    onMessage('Loaded user timeline');
                  } catch (e) {
                    onError(e instanceof Error ? e.message : 'Timeline failed');
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Load timeline
              </Button>
            </div>
          </div>
          <pre className="overflow-x-auto rounded-xl bg-slate-50 p-3 text-xs">
            {JSON.stringify(timeline, null, 2)}
          </pre>
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-slate-900">Ledger (void)</h4>
            <DataTable
              columns={
                [
                  serialColumn(),
                  { header: 'Id', accessorKey: 'id' },
                  { header: 'User', accessorKey: 'userId' },
                  { header: 'Points', accessorKey: 'points' },
                  {
                    header: 'Actions',
                    cell: ({ row }) => (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          onError(null);
                          try {
                            await voidRewardsLedger(Number(row.original.id));
                            onMessage(`Voided ledger ${String(row.original.id)}`);
                            await load();
                          } catch (e) {
                            onError(e instanceof Error ? e.message : 'Void failed');
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        Void
                      </Button>
                    )
                  }
                ] as DataTableColumn<Record<string, unknown>>[]
              }
              data={ledger.slice(0, 50)}
              emptyMessage="No ledger rows."
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function KycTab({
  onError,
  onMessage
}: {
  onError: (v: string | null) => void;
  onMessage: (v: string | null) => void;
}) {
  const [bvn, setBvn] = useState(true);
  const [nin, setNin] = useState(true);
  const [nameMatch, setNameMatch] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    onError(null);
    try {
      const cfg = await fetchKycConfig();
      setBvn(cfg.bvnVerifyEnabled !== false);
      setNin(cfg.ninVerifyEnabled !== false);
      setNameMatch(cfg.nameMatcherEnabled !== false);
      setUpdatedAt(cfg.updatedAt != null ? String(cfg.updatedAt) : null);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Unable to load KYC config');
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <StatePanel kind="loading" skeleton="detail" />;

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>Ercas KYC toggles</CardTitle>
        <CardDescription>
          Partial update without redeploy. Last updated:{' '}
          {formatDateTime(updatedAt ?? undefined)}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {(
          [
            ['BVN verify', bvn, setBvn],
            ['NIN verify', nin, setNin],
            ['Name matcher', nameMatch, setNameMatch]
          ] as const
        ).map(([label, value, setter]) => (
          <label key={label} className="flex items-center gap-3 text-sm text-slate-800">
            <input
              type="checkbox"
              checked={value}
              onChange={(e) => setter(e.target.checked)}
              className="size-4 rounded border-slate-300"
            />
            {label}
          </label>
        ))}
        <Button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            onError(null);
            try {
              const cfg = await updateKycConfig({
                bvnVerifyEnabled: bvn,
                ninVerifyEnabled: nin,
                nameMatcherEnabled: nameMatch
              });
              setUpdatedAt(cfg.updatedAt != null ? String(cfg.updatedAt) : null);
              onMessage('Saved KYC config');
            } catch (e) {
              onError(e instanceof Error ? e.message : 'KYC save failed');
            } finally {
              setBusy(false);
            }
          }}
        >
          Save KYC config
        </Button>
      </CardContent>
    </Card>
  );
}

function WithdrawalsTab({
  onError,
  onMessage
}: {
  onError: (v: string | null) => void;
  onMessage: (v: string | null) => void;
}) {
  const PAGE_SIZE = 20;
  const [rows, setRows] = useState<FailedWithdrawal[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(0);
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<FailedWithdrawal | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    onError(null);
    setForbidden(false);
    try {
      const result = await fetchConfigFailedWithdrawals({ userId, page, size: PAGE_SIZE });
      setRows(result.content ?? []);
      setTotal(result.totalElements ?? 0);
      setTotalPages(result.totalPages ?? 0);
    } catch (e) {
      if (isForbiddenError(e)) setForbidden(true);
      else onError(e instanceof Error ? e.message : 'Unable to load failed payouts');
    } finally {
      setLoading(false);
    }
  }, [userId, page, onError]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns = useMemo<DataTableColumn<FailedWithdrawal>[]>(
    () => [
      serialColumn({ page, pageSize: PAGE_SIZE }),
      { header: 'Transaction', accessorKey: 'transactionId' },
      { header: 'User', accessorKey: 'userId' },
      {
        header: 'Amount',
        cell: ({ row }) => formatMoney(row.original.amount)
      },
      { header: 'Reason', accessorKey: 'reason' },
      {
        header: 'Updated',
        cell: ({ row }) => formatDateTime(row.original.lastAttemptAt ?? row.original.createdAt)
      },
      {
        header: 'Actions',
        cell: ({ row }) => (
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              disabled={busyId === row.original.transactionId || row.original.retryable === false}
              onClick={async () => {
                setBusyId(row.original.transactionId);
                onError(null);
                try {
                  await retryConfigFailedWithdrawal(row.original.transactionId);
                  onMessage(`Retried ${row.original.transactionId}`);
                  await load();
                } catch (e) {
                  onError(e instanceof Error ? e.message : 'Retry failed');
                } finally {
                  setBusyId(null);
                }
              }}
            >
              Retry
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={busyId === row.original.transactionId}
              onClick={() => setCancelTarget(row.original)}
            >
              Cancel
            </Button>
          </div>
        )
      }
    ],
    [busyId, load, onError, onMessage, page]
  );

  if (forbidden) {
    return <StatePanel kind="forbidden" message="CAP_ADMIN_ALL required." />;
  }

  return (
    <div className="space-y-4">
      <ListSearch
        value={userId}
        onChange={(v) => {
          setUserId(v);
          setPage(0);
        }}
        placeholder="Filter by user id"
      />
      <p className={cn('text-sm text-slate-500')}>{total} unresolved</p>
      {loading ? (
        <StatePanel kind="loading" skeleton="table" />
      ) : (
        <DataTable columns={columns} data={rows} emptyMessage="No failed payouts." />
      )}
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      <ConfirmDialog
        open={cancelTarget != null}
        onOpenChange={(open) => {
          if (!open) setCancelTarget(null);
        }}
        title="Cancel withdrawal?"
        description={
          cancelTarget
            ? `Cancel ${cancelTarget.transactionId}. Balance was never debited for a failed payout.`
            : 'Cancel this failed payout request.'
        }
        confirmLabel="Cancel payout"
        tone="danger"
        busy={busyId === cancelTarget?.transactionId}
        onConfirm={() => {
          if (!cancelTarget) return;
          void (async () => {
            setBusyId(cancelTarget.transactionId);
            onError(null);
            try {
              await cancelConfigFailedWithdrawal(cancelTarget.transactionId);
              onMessage(`Cancelled ${cancelTarget.transactionId}`);
              setCancelTarget(null);
              await load();
            } catch (e) {
              onError(e instanceof Error ? e.message : 'Cancel failed');
            } finally {
              setBusyId(null);
            }
          })();
        }}
      />
    </div>
  );
}
