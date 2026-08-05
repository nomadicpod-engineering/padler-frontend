'use client';

import { useCallback, useEffect, useState } from 'react';
import { PadlerShell } from '@/app/components/PadlerShell';
import { CaseTable } from '@/components/crm/CaseTable';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader, StatePanel } from '@/components/ui/page';
import { isForbiddenError, searchCases } from '@/lib/api';
import { getAuthSession } from '@/lib/auth';
import type { CaseSummary } from '@/lib/types';

export default function MyCasesPage() {
  const [rows, setRows] = useState<CaseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const session = getAuthSession();
    if (!session?.userId && !session?.email) {
      setError('No signed-in user id or email available.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setForbidden(false);
    try {
      let page = await searchCases({
        assignee: session.userId,
        page: 0,
        size: 50
      });
      if (page.content.length === 0 && session.email) {
        page = await searchCases({ q: session.email, page: 0, size: 50 });
      }
      setRows(page.content);
    } catch (e) {
      setRows([]);
      if (isForbiddenError(e)) setForbidden(true);
      else setError(e instanceof Error ? e.message : 'Unable to load your cases');
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
        eyebrow="My day"
        title="My cases"
        subtitle="Cases assigned to you"
        actions={
          <Button type="button" onClick={() => void load()}>
            Refresh
          </Button>
        }
      />

      {loading ? <StatePanel kind="loading" /> : null}
      {forbidden ? <StatePanel kind="forbidden" /> : null}
      {error ? <StatePanel kind="error" message={error} /> : null}
      {!loading && !forbidden && !error && rows.length === 0 ? (
        <StatePanel
          kind="empty"
          title="No assigned cases"
          message="Nothing is assigned to you yet. Check Cases or ask a lead to assign work."
        />
      ) : null}
      {!loading && !forbidden && !error && rows.length > 0 ? (
        <Card className="overflow-hidden p-0">
          <CaseTable rows={rows} />
        </Card>
      ) : null}
    </PadlerShell>
  );
}
