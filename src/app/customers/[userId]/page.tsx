'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PadlerShell } from '@/app/components/PadlerShell';
import { AdapterPanel } from '@/components/crm/AdapterPanel';
import { CaseTable } from '@/components/crm/CaseTable';
import { CommandRequestDrawer } from '@/components/crm/CommandRequestDrawer';
import { CreateCaseDrawer } from '@/components/crm/CreateCaseDrawer';
import { CrmTabs } from '@/components/crm/CrmTabs';
import { OnboardingJourneyDetail } from '@/components/crm/OnboardingJourneyDetail';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldLabel, Input } from '@/components/ui/field';
import { PageHeader, StatePanel } from '@/components/ui/page';
import {
  fetchAdapterCapslocker,
  fetchAdapterClassycarOps,
  fetchAdapterDriftSafety,
  fetchAdapterIdentity,
  fetchAdapterNpodOps,
  fetchAdapterTripJotterOps,
  fetchAdapterWallet,
  fetchAdapterWealth,
  getCustomer360,
  getOnboardingJourney,
  isForbiddenError,
  upsertIdentity
} from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import { getAuthSession } from '@/lib/auth';
import type { AdapterSnapshot, Customer360, IdentityCrosswalk, OnboardingJourney } from '@/lib/types';
import { ONBOARDING_PRODUCT_KEYS } from '@/lib/types';


function healthTone(health?: string | null): 'success' | 'warning' | 'danger' | 'neutral' {
  const h = (health ?? '').toUpperCase();
  if (h === 'UP' || h === 'OK') return 'success';
  if (h === 'DEGRADED' || h === 'WARN') return 'warning';
  if (h === 'DOWN' || h === 'ERROR') return 'danger';
  return 'neutral';
}

function asSnapshot(partial?: Record<string, unknown> | null): AdapterSnapshot | null {
  if (!partial) return null;
  return {
    ...partial,
    dependencyHealth:
      partial.dependencyHealth != null ? String(partial.dependencyHealth) : undefined,
    errorCode: partial.errorCode != null ? String(partial.errorCode) : undefined,
    errorMessage: partial.errorMessage != null ? String(partial.errorMessage) : undefined,
    sourceSystem: partial.sourceSystem != null ? String(partial.sourceSystem) : undefined,
    sourceFreshnessAt:
      partial.sourceFreshnessAt != null ? String(partial.sourceFreshnessAt) : undefined
  };
}

type TabId = 'overview' | 'adapters' | 'cases' | 'timeline' | 'identity' | 'onboarding';

type AdapterBundle = {
  identity: AdapterSnapshot | null;
  wallet: AdapterSnapshot | null;
  wealth: AdapterSnapshot | null;
  capslocker: AdapterSnapshot | null;
  tripJotter: AdapterSnapshot | null;
  drift: AdapterSnapshot | null;
  classycar: AdapterSnapshot | null;
  npod: AdapterSnapshot | null;
};

export default function Customer360Page() {
  const params = useParams<{ userId: string }>();
  const router = useRouter();
  const userId = decodeURIComponent(params.userId ?? '');

  const [tab, setTab] = useState<TabId>('overview');
  const [data, setData] = useState<Customer360 | null>(null);
  const [adapters, setAdapters] = useState<AdapterBundle | null>(null);
  const [adaptersLoading, setAdaptersLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);

  const [idEmail, setIdEmail] = useState('');
  const [idPhone, setIdPhone] = useState('');
  const [idName, setIdName] = useState('');
  const [idBusy, setIdBusy] = useState(false);
  const [idMsg, setIdMsg] = useState<string | null>(null);
  const [idError, setIdError] = useState<string | null>(null);

  const [onboardingRows, setOnboardingRows] = useState<OnboardingJourney[]>([]);
  const [onboardingLoading, setOnboardingLoading] = useState(false);
  const [onboardingLoaded, setOnboardingLoaded] = useState(false);
  const [onboardingError, setOnboardingError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    setForbidden(false);
    try {
      const result = await getCustomer360(userId);
      setData(result);
      setIdEmail(result.identity?.email ?? '');
      setIdPhone(result.identity?.phone ?? '');
      setIdName(result.identity?.displayName ?? '');
    } catch (e) {
      setData(null);
      if (isForbiddenError(e)) setForbidden(true);
      else setError(e instanceof Error ? e.message : 'Unable to load customer 360');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const loadAdapters = useCallback(async () => {
    if (!userId) return;
    setAdaptersLoading(true);
    const adminEmail = getAuthSession()?.email ?? '';
    const settled = await Promise.allSettled([
      fetchAdapterIdentity(userId),
      fetchAdapterWallet(userId),
      fetchAdapterWealth(userId),
      fetchAdapterCapslocker(userId),
      fetchAdapterTripJotterOps(adminEmail),
      fetchAdapterDriftSafety(),
      fetchAdapterClassycarOps(),
      fetchAdapterNpodOps()
    ]);
    const pick = (i: number): AdapterSnapshot | null => {
      const r = settled[i];
      if (r.status === 'fulfilled') return r.value;
      return {
        dependencyHealth: 'DOWN',
        errorMessage: r.reason instanceof Error ? r.reason.message : 'Adapter failed'
      };
    };
    setAdapters({
      identity: pick(0),
      wallet: pick(1),
      wealth: pick(2),
      capslocker: pick(3),
      tripJotter: pick(4),
      drift: pick(5),
      classycar: pick(6),
      npod: pick(7)
    });
    setAdaptersLoading(false);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadOnboarding = useCallback(async () => {
    if (!userId) return;
    setOnboardingLoading(true);
    setOnboardingError(null);
    try {
      const settled = await Promise.allSettled(
        ONBOARDING_PRODUCT_KEYS.map((productKey) => getOnboardingJourney(productKey, userId))
      );
      const found: OnboardingJourney[] = [];
      for (const result of settled) {
        if (result.status !== 'fulfilled') continue;
        const journey = result.value;
        if (journey?.productKey || journey?.lifecycleStatus || journey?.customerUserId) {
          found.push(journey);
        }
      }
      setOnboardingRows(found);
      setOnboardingLoaded(true);
    } catch (e) {
      setOnboardingRows([]);
      setOnboardingError(e instanceof Error ? e.message : 'Unable to load onboarding');
      setOnboardingLoaded(true);
    } finally {
      setOnboardingLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (tab === 'adapters' && !adapters && !adaptersLoading) {
      void loadAdapters();
    }
  }, [tab, adapters, adaptersLoading, loadAdapters]);

  useEffect(() => {
    if (tab === 'onboarding' && !onboardingLoaded && !onboardingLoading) {
      void loadOnboarding();
    }
  }, [tab, onboardingLoaded, onboardingLoading, loadOnboarding]);

  const identity = data?.identity;
  const healthEntries = Object.entries(data?.dependencyHealthBySystem ?? {});
  const openCases = data?.openCases ?? [];
  const commandCaseNumber = openCases[0]?.caseNumber;

  const walletSnap = useMemo(
    () => adapters?.wallet ?? asSnapshot(data?.wallet as Record<string, unknown> | undefined),
    [adapters, data]
  );
  const wealthSnap = useMemo(
    () => adapters?.wealth ?? asSnapshot(data?.wealth as Record<string, unknown> | undefined),
    [adapters, data]
  );
  const capSnap = useMemo(
    () =>
      adapters?.capslocker ?? asSnapshot(data?.capslocker as Record<string, unknown> | undefined),
    [adapters, data]
  );
  const identitySnap = useMemo(
    () =>
      adapters?.identity ?? asSnapshot(data?.identity as Record<string, unknown> | undefined),
    [adapters, data]
  );
  const npodSnap = useMemo(
    () => adapters?.npod ?? asSnapshot(data?.npod as Record<string, unknown> | undefined),
    [adapters, data]
  );

  const saveIdentity = async (e: FormEvent) => {
    e.preventDefault();
    setIdBusy(true);
    setIdError(null);
    setIdMsg(null);
    try {
      const row: IdentityCrosswalk = await upsertIdentity({
        partyType: 'CUSTOMER',
        partyKey: userId,
        email: idEmail.trim() || undefined,
        phone: idPhone.trim() || undefined,
        displayName: idName.trim() || undefined,
        keycloakSub:
          identity?.keycloakSub != null ? String(identity.keycloakSub) : undefined
      });
      setIdMsg(`Identity saved (${row.partyKey ?? userId})`);
      await load();
    } catch (err) {
      setIdError(err instanceof Error ? err.message : 'Unable to upsert identity');
    } finally {
      setIdBusy(false);
    }
  };

  return (
    <PadlerShell>
      <PageHeader
        eyebrow="Customer profile"
        title={identity?.displayName || userId}
        subtitle={identity?.email || identity?.phone || userId}
        actions={
          <>
            <Button type="button" onClick={() => void load()}>
              Refresh
            </Button>
            <Button type="button" onClick={() => setCreateOpen(true)}>
              Create case
            </Button>
            <Button type="button" variant="primary" onClick={() => setCommandOpen(true)}>
              Request action
            </Button>
          </>
        }
      />

      {loading ? <StatePanel kind="loading" skeleton="detail" /> : null}
      {forbidden ? (
        <StatePanel
          kind="forbidden"
          message="Your role can’t open this customer profile. Ask a lead if you need access."
        />
      ) : null}
      {error ? <StatePanel kind="error" message={error} /> : null}

      {!loading && !forbidden && !error && data ? (
        <>
          {data.errorMessage ? (
            <div
              className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
              role="status"
            >
              {data.errorCode ? `${data.errorCode}: ` : ''}
              {data.errorMessage}
            </div>
          ) : null}

          <div className="mb-4 flex flex-wrap gap-2">
            <Badge tone={healthTone(data.dependencyHealth)}>
              Overall {data.dependencyHealth ?? '—'}
            </Badge>
            {healthEntries.map(([system, health]) => (
              <Badge key={system} tone={healthTone(health)} title={system}>
                {system}: {health}
              </Badge>
            ))}
          </div>

          <CrmTabs
            ariaLabel="Customer profile sections"
            tabs={[
              { id: 'overview', label: 'Overview' },
              { id: 'adapters', label: 'Product accounts' },
              { id: 'cases', label: 'Cases', count: openCases.length },
              { id: 'timeline', label: 'Timeline', count: (data.timeline ?? []).length },
              { id: 'identity', label: 'Identity' },
              {
                id: 'onboarding',
                label: 'Onboarding',
                count: onboardingLoaded ? onboardingRows.length : undefined
              }
            ]}
            active={tab}
            onChange={(id) => setTab(id as TabId)}
          />

          {tab === 'overview' ? (
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Identity</CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">User id</dt>
                      <dd className="mt-1 text-sm text-slate-900">
                        <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{userId}</code>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Display name</dt>
                      <dd className="mt-1 text-sm text-slate-900">{identity?.displayName ?? '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Email</dt>
                      <dd className="mt-1 text-sm text-slate-900">{identity?.email ?? '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Phone</dt>
                      <dd className="mt-1 text-sm text-slate-900">{identity?.phone ?? '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Health</dt>
                      <dd className="mt-1">
                        <Badge tone={healthTone(identity?.dependencyHealth ?? data.dependencyHealth)}>
                          {identity?.dependencyHealth ?? data.dependencyHealth ?? '—'}
                        </Badge>
                      </dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Product tools</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    <li>
                      <Link href="/tools" className="font-medium text-blue-700 hover:underline">
                        Tools hub
                      </Link>{' '}
                      — bookings, payments, wallet
                    </li>
                    <li>
                      <Link href="/tools/bookings" className="font-medium text-blue-700 hover:underline">
                        Bookings
                      </Link>
                    </li>
                    <li>
                      <Link href="/tools/payment" className="font-medium text-blue-700 hover:underline">
                        Payments
                      </Link>
                    </li>
                    <li>
                      <Link href="/cases" className="font-medium text-blue-700 hover:underline">
                        All issues
                      </Link>
                    </li>
                  </ul>
                  <p className="mt-3 text-sm text-slate-500">
                    Mutating product actions stay behind governed commands — adapters here are
                    read-only.
                  </p>
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <CardTitle>Open cases</CardTitle>
                    <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
                      Create case
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {openCases.length === 0 ? (
                    <p className="text-sm text-slate-500">No open cases linked to this customer.</p>
                  ) : (
                    <CaseTable rows={openCases} />
                  )}
                </CardContent>
              </Card>
            </div>
          ) : null}

          {tab === 'adapters' ? (
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <AdapterPanel
                title="Identity"
                snapshot={identitySnap}
                loading={adaptersLoading && !identitySnap}
              />
              <AdapterPanel
                title="Wallet"
                snapshot={walletSnap}
                loading={adaptersLoading && !walletSnap}
                toolsHref="/tools"
                toolsLabel="Wallet / Tools"
              />
              <AdapterPanel
                title="Wealth"
                snapshot={wealthSnap}
                loading={adaptersLoading && !wealthSnap}
              />
              <AdapterPanel
                title="Capslocker"
                snapshot={capSnap}
                loading={adaptersLoading && !capSnap}
              />
              <AdapterPanel
                title="TripJotter ops"
                snapshot={adapters?.tripJotter}
                loading={adaptersLoading}
                toolsHref="/tools/trip-jotter"
                toolsLabel="Open Trip Jotter tools"
              />
              <AdapterPanel
                title="Drift safety"
                snapshot={adapters?.drift}
                loading={adaptersLoading}
                toolsHref="/tools/drift"
                toolsLabel="Open Drift tools"
              />
              <AdapterPanel
                title="Npod-Auto ops"
                snapshot={adapters?.classycar}
                loading={adaptersLoading}
                toolsHref="/tools/classycar"
                toolsLabel="Open Npod-Auto tools"
              />
              <AdapterPanel
                title="Npod ops"
                snapshot={npodSnap}
                loading={adaptersLoading && !npodSnap}
                toolsHref={`/tools/npod/travellers/${encodeURIComponent(userId)}`}
                toolsLabel="Open NPod journey"
              />
              <div className="lg:col-span-2">
                <Button type="button" disabled={adaptersLoading} onClick={() => void loadAdapters()}>
                  {adaptersLoading ? 'Refreshing adapters…' : 'Refresh adapters'}
                </Button>
              </div>
            </div>
          ) : null}

          {tab === 'cases' ? (
            <Card className="mt-4">
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <CardTitle>Open cases</CardTitle>
                  <Button type="button" variant="primary" onClick={() => setCreateOpen(true)}>
                    Create case
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {openCases.length === 0 ? (
                  <StatePanel
                    kind="empty"
                    title="No open cases"
                    message="Create a case to continue into the issue workspace and commands."
                  />
                ) : (
                  <CaseTable rows={openCases} />
                )}
              </CardContent>
            </Card>
          ) : null}

          {tab === 'timeline' ? (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle>Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                {(data.timeline ?? []).length === 0 ? (
                  <p className="text-sm text-slate-500">No timeline events available.</p>
                ) : (
                  <ul className="space-y-3">
                    {(data.timeline ?? []).map((item) => (
                      <li
                        key={item.id ?? item.envelopeId ?? `${item.occurredAt}-${item.eventType}`}
                        className="rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3 text-sm"
                      >
                        <div className="text-xs text-slate-500">
                          {item.eventType ?? item.category ?? 'event'} · {formatDateTime(item.occurredAt)}
                        </div>
                        <strong className="text-slate-900">{item.title ?? 'Event'}</strong>
                        {item.summary ? <div className="mt-1 text-slate-700">{item.summary}</div> : null}
                        {item.caseNumber ? (
                          <div className="mt-1">
                            <Link
                              href={`/cases/${encodeURIComponent(item.caseNumber)}`}
                              className="font-medium text-blue-700 hover:underline"
                            >
                              {item.caseNumber}
                            </Link>
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          ) : null}

          {tab === 'identity' ? (
            <Card className="mt-4 max-w-xl">
              <CardHeader>
                <CardTitle>Identity crosswalk</CardTitle>
                <CardDescription>
                  Upsert CRM identity for party type CUSTOMER / party key = this user id.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {idError ? (
                  <div
                    className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
                    role="alert"
                  >
                    {idError}
                  </div>
                ) : null}
                {idMsg ? (
                  <div
                    className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
                    role="status"
                  >
                    {idMsg}
                  </div>
                ) : null}
                <form onSubmit={saveIdentity} className="grid gap-4">
                  <FieldLabel>
                    Display name
                    <Input
                      value={idName}
                      onChange={(e) => setIdName(e.target.value)}
                      disabled={idBusy}
                    />
                  </FieldLabel>
                  <FieldLabel>
                    Email
                    <Input
                      type="email"
                      value={idEmail}
                      onChange={(e) => setIdEmail(e.target.value)}
                      disabled={idBusy}
                    />
                  </FieldLabel>
                  <FieldLabel>
                    Phone
                    <Input
                      value={idPhone}
                      onChange={(e) => setIdPhone(e.target.value)}
                      disabled={idBusy}
                    />
                  </FieldLabel>
                  <Button type="submit" variant="primary" disabled={idBusy}>
                    {idBusy ? 'Saving…' : 'Save identity'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : null}

          {tab === 'onboarding' ? (
            <div className="mt-4 space-y-4">
              <Button
                type="button"
                disabled={onboardingLoading}
                onClick={() => void loadOnboarding()}
              >
                {onboardingLoading ? 'Refreshing…' : 'Refresh onboarding'}
              </Button>
              {onboardingLoading && onboardingRows.length === 0 ? (
                <StatePanel kind="loading" />
              ) : null}
              {onboardingError ? <StatePanel kind="error" message={onboardingError} /> : null}
              {!onboardingLoading && !onboardingError && onboardingRows.length === 0 ? (
                <StatePanel
                  kind="empty"
                  title="No onboarding journeys"
                  message="No journeys found for classycar, trip-jotter, capslocker, npod, or drift."
                />
              ) : null}
              {onboardingRows.map((journey) => (
                <Card key={`${journey.productKey}-${journey.customerUserId}`}>
                  <CardContent className="pt-5">
                    <OnboardingJourneyDetail
                      journey={journey}
                      compact
                      onUpdated={(next) => {
                        setOnboardingRows((prev) =>
                          prev.map((row) =>
                            row.productKey === next.productKey &&
                            row.customerUserId === next.customerUserId
                              ? next
                              : row
                          )
                        );
                      }}
                    />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : null}
        </>
      ) : null}

      <CreateCaseDrawer
        open={createOpen}
        customerUserId={userId}
        customerEmail={identity?.email}
        customerPhone={identity?.phone}
        customerName={identity?.displayName}
        onClose={() => setCreateOpen(false)}
        onCreated={(detail) => {
          void load();
          if (detail.caseNumber) {
            router.push(`/cases/${encodeURIComponent(detail.caseNumber)}`);
          }
        }}
      />

      <CommandRequestDrawer
        open={commandOpen}
        caseNumber={commandCaseNumber}
        customerUserId={userId}
        onClose={() => setCommandOpen(false)}
      />
    </PadlerShell>
  );
}
