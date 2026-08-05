'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { PadlerShell } from '@/app/components/PadlerShell';
import { CaseTable } from '@/components/crm/CaseTable';
import { Button } from '@/components/ui/button';
import { FieldLabel, Input, Select } from '@/components/ui/field';
import { Card } from '@/components/ui/card';
import { FilterBar, PageHeader, Pagination, StatePanel } from '@/components/ui/page';
import { isForbiddenError, searchCases } from '@/lib/api';
import { CASE_STATUSES, PADLER_QUEUES, type CaseSummary } from '@/lib/types';

const PAGE_SIZE = 20;

function CasesContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState('');
  const [queueKey, setQueueKey] = useState(searchParams.get('queueKey') ?? '');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<CaseSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fromUrl = searchParams.get('queueKey');
    if (fromUrl) setQueueKey(fromUrl);
  }, [searchParams]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setForbidden(false);
    try {
      const result = await searchCases({
        status: status || undefined,
        queueKey: queueKey || undefined,
        q: q || undefined,
        page,
        size: PAGE_SIZE
      });
      setRows(result.content);
      setTotal(result.totalElements);
    } catch (e) {
      setRows([]);
      setTotal(0);
      if (isForbiddenError(e)) setForbidden(true);
      else setError(e instanceof Error ? e.message : 'Unable to load cases');
    } finally {
      setLoading(false);
    }
  }, [status, queueKey, q, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeader
        eyebrow="Care"
        title="Cases"
        subtitle={`${total} case${total === 1 ? '' : 's'} match this view`}
      />

      <FilterBar
        onSubmit={() => {
          setPage(0);
          void load();
        }}
      >
        <FieldLabel className="min-w-[140px]">
          Status
          <Select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(0);
            }}
          >
            <option value="">All</option>
            {CASE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replaceAll('_', ' ')}
              </option>
            ))}
          </Select>
        </FieldLabel>
        <FieldLabel className="min-w-[180px]">
          Queue
          <Select
            value={queueKey}
            onChange={(e) => {
              setQueueKey(e.target.value);
              setPage(0);
            }}
          >
            <option value="">All</option>
            {PADLER_QUEUES.map((qItem) => (
              <option key={qItem.key} value={qItem.key}>
                {qItem.label}
              </option>
            ))}
          </Select>
        </FieldLabel>
        <FieldLabel className="min-w-[220px] flex-1">
          Search
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Subject, email, case number…"
          />
        </FieldLabel>
        <Button type="submit" variant="primary">
          Apply
        </Button>
      </FilterBar>

      {loading && rows.length === 0 ? <StatePanel kind="loading" /> : null}
      {forbidden ? <StatePanel kind="forbidden" /> : null}
      {error ? <StatePanel kind="error" message={error} /> : null}
      {!loading && !forbidden && !error && rows.length === 0 ? (
        <StatePanel kind="empty" message="No cases match these filters." />
      ) : null}
      {!loading && !forbidden && !error && rows.length > 0 ? (
        <Card className="p-0 overflow-hidden">
          <CaseTable rows={rows} page={page} pageSize={PAGE_SIZE} />
          <div className="border-t border-slate-100 px-4 py-3">
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        </Card>
      ) : null}
    </>
  );
}

export default function CasesPage() {
  return (
    <PadlerShell>
      <Suspense fallback={<StatePanel kind="loading" />}>
        <CasesContent />
      </Suspense>
    </PadlerShell>
  );
}
