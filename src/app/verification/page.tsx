'use client';

import Link from 'next/link';
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react';
import { PadlerShell } from '@/app/components/PadlerShell';
import { CrmTabs } from '@/components/crm/CrmTabs';
import { OnboardingJourneyDetail } from '@/components/crm/OnboardingJourneyDetail';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { FieldLabel, Input, Select } from '@/components/ui/field';
import { FilterBar, PageHeader, Pagination, StatePanel } from '@/components/ui/page';
import { SideDrawer } from '@/components/ui/side-drawer';
import { getOnboardingJourney, isForbiddenError, listOnboardingJourneys } from '@/lib/api';
import type { OnboardingJourney } from '@/lib/types';
import { ONBOARDING_LIFECYCLE_STATUSES } from '@/lib/types';
import { cn, formatDateTime } from '@/lib/utils';

type OnboardingView = 'all' | 'needs_review';

const PRODUCT_TABS: { id: string; label: string; productKey: string }[] = [
  { id: 'all', label: 'All products', productKey: '' },
  { id: 'trip-jotter', label: 'Trip Jotter', productKey: 'trip-jotter' },
  { id: 'classycar', label: 'Classycar', productKey: 'classycar' },
  { id: 'drift', label: 'Npod Rider', productKey: 'drift' },
  { id: 'npod', label: 'Npod', productKey: 'npod' }
];

function productLabel(productKey?: string | null): string {
  if (!productKey) return 'Product';
  return PRODUCT_TABS.find((t) => t.productKey === productKey)?.label ?? productKey;
}


function lifecycleTone(status?: string): 'success' | 'danger' | 'warning' | 'neutral' | 'info' {
  const s = (status ?? '').toUpperCase();
  if (s === 'COMPLETE') return 'success';
  if (s === 'REJECTED') return 'danger';
  if (s === 'NEEDS_DOCS' || s === 'PENDING_REVIEW' || s === 'IN_PROGRESS') return 'warning';
  return 'neutral';
}

export default function OnboardingOpsPage() {
  const [rows, setRows] = useState<OnboardingJourney[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [view, setView] = useState<OnboardingView>('all');
  const [productKey, setProductKey] = useState('');
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourceWarnings, setSourceWarnings] = useState<string[]>([]);
  const [productCountsAll, setProductCountsAll] = useState<Record<string, number>>({});

  const [selected, setSelected] = useState<OnboardingJourney | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [drawerFooter, setDrawerFooter] = useState<ReactNode>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setForbidden(false);
    try {
      const result = await listOnboardingJourneys({
        view,
        productKey: productKey || undefined,
        status: status || undefined,
        q: q || undefined,
        page,
        size: 20
      });
      setRows(result.content);
      setTotal(result.totalElements);
      setSourceWarnings(result.sourceWarnings ?? []);
      setProductCountsAll(result.productCounts ?? {});
    } catch (e) {
      setRows([]);
      setSourceWarnings([]);
      setProductCountsAll({});
      if (isForbiddenError(e)) setForbidden(true);
      else setError(e instanceof Error ? e.message : 'Unable to load verification journeys');
    } finally {
      setLoading(false);
    }
  }, [view, productKey, status, q, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const onFilter = (e: FormEvent) => {
    e.preventDefault();
    setPage(0);
    void load();
  };

  const countsByProduct = useMemo(() => {
    if (Object.keys(productCountsAll).length > 0) return productCountsAll;
    return rows.reduce<Record<string, number>>((acc, row) => {
      const key = row.productKey ?? 'unknown';
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});
  }, [productCountsAll, rows]);

  const productTabs = useMemo(
    () =>
      PRODUCT_TABS.map((tab) => ({
        id: tab.id,
        label: tab.label,
        count:
          tab.productKey === ''
            ? Object.values(countsByProduct).reduce((sum, n) => sum + n, 0) || total || undefined
            : countsByProduct[tab.productKey]
      })),
    [countsByProduct, total]
  );

  const activeProductTab = PRODUCT_TABS.find((t) => t.productKey === productKey)?.id ?? 'all';

  const openDetail = async (row: OnboardingJourney) => {
    const pk = row.productKey;
    const uid = row.customerUserId;
    setDrawerFooter(null);
    if (!pk || !uid) {
      setSelected(row);
      return;
    }
    setDetailLoading(true);
    setDetailError(null);
    setSelected(row);
    try {
      const fresh = await getOnboardingJourney(pk, uid);
      setSelected(fresh);
    } catch (e) {
      setDetailError(e instanceof Error ? e.message : 'Unable to load journey detail');
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setSelected(null);
    setDetailError(null);
    setDrawerFooter(null);
  };

  const columns = useMemo<DataTableColumn<OnboardingJourney>[]>(
    () => [
      {
        header: 'S/N',
        id: 'sn',
        cell: ({ row }) => (
          <span className="tabular-nums text-slate-500">{page * 20 + row.index + 1}</span>
        )
      },
      {
        header: 'Customer',
        accessorKey: 'customerUserId',
        cell: ({ row }) =>
          row.original.customerUserId ? (
            <Link
              href={`/customers/${encodeURIComponent(row.original.customerUserId)}`}
              className="font-medium text-blue-700 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {row.original.customerUserId}
            </Link>
          ) : (
            '—'
          )
      },
      {
        header: 'Label',
        accessorKey: 'partyLabel',
        cell: ({ row }) => row.original.partyLabel ?? '—'
      },
      {
        header: 'Traveller',
        accessorKey: 'travellerCode',
        cell: ({ row }) =>
          row.original.travellerCode ? (
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{row.original.travellerCode}</code>
          ) : (
            '—'
          )
      },
      {
        header: 'Status',
        accessorKey: 'lifecycleStatus',
        cell: ({ row }) => (
          <Badge tone={lifecycleTone(row.original.lifecycleStatus)}>
            {(row.original.lifecycleStatus ?? '—').replaceAll('_', ' ')}
          </Badge>
        )
      },
      {
        header: 'Step',
        accessorKey: 'currentStep',
        cell: ({ row }) => row.original.currentStep ?? '—'
      },
      {
        header: 'Health',
        accessorKey: 'dependencyHealth',
        cell: ({ row }) => <StatusBadge status={row.original.dependencyHealth} />
      },
      {
        header: 'Completed',
        accessorKey: 'completedAt',
        cell: ({ row }) => formatDateTime(row.original.completedAt)
      }
    ],
    [page]
  );

  const totalPages = Math.max(1, Math.ceil(total / 20));
  const drawerTitle =
    selected?.partyLabel ||
    selected?.businessName ||
    selected?.customerUserId ||
    'Verification journey';
  const drawerDescription = selected
    ? `${productLabel(selected.productKey)}${selected.lifecycleStatus ? ` · ${selected.lifecycleStatus.replaceAll('_', ' ')}` : ''}`
    : undefined;

  return (
    <PadlerShell>
      <PageHeader
        eyebrow="Trust"
        title="Business verification"
        subtitle="See who still needs review, or browse verification status by product."
        actions={
          <Button type="button" onClick={() => void load()} disabled={loading}>
            Refresh
          </Button>
        }
      />

      <div className="mb-4 inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm" role="group">
        {(
          [
            { id: 'all', label: 'All users' },
            { id: 'needs_review', label: 'Needs review' }
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            className={cn(
              'rounded-lg px-3 py-2 text-sm font-semibold transition',
              view === item.id
                ? 'bg-blue-50 text-blue-800'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            )}
            onClick={() => {
              setView(item.id);
              setPage(0);
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      <CrmTabs
        ariaLabel="Product"
        tabs={productTabs}
        active={activeProductTab}
        onChange={(id) => {
          const next = PRODUCT_TABS.find((t) => t.id === id);
          setProductKey(next?.productKey ?? '');
          setPage(0);
        }}
      />

      <FilterBar onSubmit={onFilter}>
        <FieldLabel className="min-w-[160px]">
          Status
          <Select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(0);
            }}
          >
            <option value="">All</option>
            {ONBOARDING_LIFECYCLE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replaceAll('_', ' ')}
              </option>
            ))}
          </Select>
        </FieldLabel>
        <FieldLabel className="min-w-[220px] flex-1">
          Search
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="User id, label, traveller code N-…"
          />
        </FieldLabel>
        <Button type="submit" variant="primary" disabled={loading}>
          Filter
        </Button>
      </FilterBar>

      {!loading && !forbidden && sourceWarnings.length > 0 ? (
        <div
          className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          role="status"
        >
          <strong className="font-semibold">Some products did not return parties</strong>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {sourceWarnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
          <p className="mt-2 text-amber-900/80">
            Trip Jotter, Classycar, and Npod Rider usually need platform access on that product. Npod
            loads with your Padler sign-in.
          </p>
        </div>
      ) : null}

      {loading && rows.length === 0 ? <StatePanel kind="loading" /> : null}
      {forbidden ? (
        <StatePanel
          kind="forbidden"
          message="Your role can’t open business verification. Ask a lead if you need access."
        />
      ) : null}
      {error ? <StatePanel kind="error" message={error} /> : null}
      {!loading && !forbidden && !error && rows.length === 0 ? (
        <StatePanel
          kind="empty"
          message={
            view === 'needs_review'
              ? 'No journeys currently need review. Switch to All users to browse every product party and status.'
              : 'No verification parties found for this product filter.'
          }
        />
      ) : null}

      {!loading && !forbidden && !error && rows.length > 0 ? (
        <Card className="overflow-hidden p-0">
          <DataTable
            columns={columns}
            data={rows}
            onRowClick={(row) => void openDetail(row)}
          />
          <div className="border-t border-slate-100 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm text-slate-500">{total} total</span>
              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
            </div>
          </div>
        </Card>
      ) : null}

      <SideDrawer
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) closeDetail();
        }}
        title={drawerTitle}
        description={drawerDescription}
        width="lg"
        footer={drawerFooter}
      >
        {detailLoading ? <StatePanel kind="loading" skeleton="detail" /> : null}
        {detailError ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
            {detailError}
          </div>
        ) : null}
        {!detailLoading && selected ? (
          <OnboardingJourneyDetail
            journey={selected}
            variant="drawer"
            onFooterActionsChange={setDrawerFooter}
            onUpdated={(next) => {
              setSelected(next);
              void load();
            }}
          />
        ) : null}
      </SideDrawer>
    </PadlerShell>
  );
}
