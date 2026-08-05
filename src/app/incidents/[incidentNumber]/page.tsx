'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { PadlerShell } from '@/app/components/PadlerShell';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldLabel, Input, Textarea } from '@/components/ui/field';
import { PageHeader, StatePanel } from '@/components/ui/page';
import {
  correlateIncident,
  getIncident,
  isForbiddenError,
  linkIncidentCase,
  resolveIncident
} from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import { getAuthSession } from '@/lib/auth';
import type { IncidentSummary } from '@/lib/types';
import { canManageCases } from '@/lib/types';


export default function IncidentDetailPage() {
  const params = useParams<{ incidentNumber: string }>();
  const incidentNumber = decodeURIComponent(params.incidentNumber ?? '');

  const [data, setData] = useState<IncidentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);

  const [caseNumber, setCaseNumber] = useState('');
  const [correlationKey, setCorrelationKey] = useState('');
  const [customerUserId, setCustomerUserId] = useState('');
  const [customerImpact, setCustomerImpact] = useState('');
  const [affectedPartyCount, setAffectedPartyCount] = useState('');

  useEffect(() => {
    setCanManage(canManageCases(getAuthSession()?.designation));
  }, []);

  const load = useCallback(async () => {
    if (!incidentNumber) return;
    setLoading(true);
    setError(null);
    setForbidden(false);
    try {
      const result = await getIncident(incidentNumber);
      setData(result);
      setCorrelationKey(result.correlationKey ?? '');
      setCustomerImpact(result.customerImpact ?? '');
      setAffectedPartyCount(
        result.affectedPartyCount != null ? String(result.affectedPartyCount) : ''
      );
    } catch (e) {
      setData(null);
      if (isForbiddenError(e)) setForbidden(true);
      else setError(e instanceof Error ? e.message : 'Unable to load incident');
    } finally {
      setLoading(false);
    }
  }, [incidentNumber]);

  useEffect(() => {
    void load();
  }, [load]);

  const onLink = async (e: FormEvent) => {
    e.preventDefault();
    if (!caseNumber.trim()) return;
    setBusy(true);
    setActionError(null);
    try {
      const updated = await linkIncidentCase(incidentNumber, caseNumber.trim());
      setData(updated);
      setCaseNumber('');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Link failed');
    } finally {
      setBusy(false);
    }
  };

  const onCorrelate = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setActionError(null);
    try {
      const updated = await correlateIncident(incidentNumber, {
        correlationKey: correlationKey.trim() || undefined,
        caseNumber: caseNumber.trim() || undefined,
        customerUserId: customerUserId.trim() || undefined,
        customerImpact: customerImpact.trim() || undefined,
        affectedPartyCount: affectedPartyCount.trim()
          ? Number(affectedPartyCount.trim())
          : undefined
      });
      setData(updated);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Correlate failed');
    } finally {
      setBusy(false);
    }
  };

  const onResolve = async () => {
    if (!window.confirm(`Resolve incident ${incidentNumber}?`)) return;
    setBusy(true);
    setActionError(null);
    try {
      const updated = await resolveIncident(incidentNumber);
      setData(updated);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Resolve failed');
    } finally {
      setBusy(false);
    }
  };

  const resolved = data?.status === 'RESOLVED' || data?.status === 'CLOSED';

  return (
    <PadlerShell>
      <PageHeader
        eyebrow="Incident"
        title={data?.title || incidentNumber}
        subtitle={incidentNumber}
        actions={
          <>
            <Button asChild>
              <Link href="/incidents">Back</Link>
            </Button>
            <Button type="button" onClick={() => void load()} disabled={busy}>
              Refresh
            </Button>
            {canManage && !resolved ? (
              <Button type="button" variant="primary" onClick={() => void onResolve()} disabled={busy}>
                Resolve
              </Button>
            ) : null}
          </>
        }
      />

      {loading ? <StatePanel kind="loading" skeleton="detail" /> : null}
      {forbidden ? <StatePanel kind="forbidden" /> : null}
      {error ? <StatePanel kind="error" message={error} /> : null}
      {actionError ? (
        <div
          className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          role="alert"
        >
          {actionError}
        </div>
      ) : null}

      {!loading && !forbidden && !error && data ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="mb-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Status</dt>
                  <dd className="mt-1">
                    <StatusBadge status={data.status} />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Severity</dt>
                  <dd className="mt-1 text-sm text-slate-900">{data.severity ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Product</dt>
                  <dd className="mt-1 text-sm text-slate-900">{data.productKey ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Dependency</dt>
                  <dd className="mt-1 text-sm text-slate-900">{data.dependencyKey ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Correlation key</dt>
                  <dd className="mt-1 text-sm text-slate-900">{data.correlationKey ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Affected parties</dt>
                  <dd className="mt-1 text-sm text-slate-900">{data.affectedPartyCount ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Started</dt>
                  <dd className="mt-1 text-sm text-slate-900">{formatDateTime(data.startedAt ?? data.createdAt)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Resolved</dt>
                  <dd className="mt-1 text-sm text-slate-900">{formatDateTime(data.resolvedAt)}</dd>
                </div>
              </dl>
              <p className="whitespace-pre-wrap text-sm text-slate-800">{data.summary}</p>
              {data.customerImpact ? (
                <p className="mt-2 text-sm text-slate-500">Impact: {data.customerImpact}</p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Linked cases</CardTitle>
            </CardHeader>
            <CardContent>
              {(data.linkedCaseNumbers ?? []).length === 0 ? (
                <p className="text-sm text-slate-500">No cases linked yet.</p>
              ) : (
                <ul className="space-y-2">
                  {(data.linkedCaseNumbers ?? []).map((c) => (
                    <li key={c}>
                      <Link
                        href={`/cases/${encodeURIComponent(c)}`}
                        className="font-medium text-blue-700 hover:underline"
                      >
                        {c}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {canManage && !resolved ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Link case</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={onLink} className="grid gap-4">
                    <FieldLabel>
                      Case number
                      <Input
                        value={caseNumber}
                        onChange={(e) => setCaseNumber(e.target.value)}
                        placeholder="PC-…"
                        required
                        disabled={busy}
                      />
                    </FieldLabel>
                    <Button type="submit" variant="primary" disabled={busy}>
                      Link case
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Correlate</CardTitle>
                  <CardDescription>
                    Attach correlation metadata and optional case / customer context.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={onCorrelate} className="grid gap-4">
                    <FieldLabel>
                      Correlation key
                      <Input
                        value={correlationKey}
                        onChange={(e) => setCorrelationKey(e.target.value)}
                        disabled={busy}
                      />
                    </FieldLabel>
                    <FieldLabel>
                      Case number (optional)
                      <Input
                        value={caseNumber}
                        onChange={(e) => setCaseNumber(e.target.value)}
                        disabled={busy}
                      />
                    </FieldLabel>
                    <FieldLabel>
                      Customer user id
                      <Input
                        value={customerUserId}
                        onChange={(e) => setCustomerUserId(e.target.value)}
                        disabled={busy}
                      />
                    </FieldLabel>
                    <FieldLabel>
                      Customer impact
                      <Textarea
                        rows={2}
                        value={customerImpact}
                        onChange={(e) => setCustomerImpact(e.target.value)}
                        disabled={busy}
                      />
                    </FieldLabel>
                    <FieldLabel>
                      Affected party count
                      <Input
                        type="number"
                        min={0}
                        value={affectedPartyCount}
                        onChange={(e) => setAffectedPartyCount(e.target.value)}
                        disabled={busy}
                      />
                    </FieldLabel>
                    <Button type="submit" variant="primary" disabled={busy}>
                      Save correlation
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </>
          ) : null}
        </div>
      ) : null}
    </PadlerShell>
  );
}
