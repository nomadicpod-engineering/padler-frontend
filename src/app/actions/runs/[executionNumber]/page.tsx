'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { PadlerShell } from '@/app/components/PadlerShell';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldLabel, Textarea } from '@/components/ui/field';
import { PageHeader, StatePanel } from '@/components/ui/page';
import {
  getCommandExecution,
  isForbiddenError,
  reconcileCommandExecution
} from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import { getAuthSession } from '@/lib/auth';
import { canReconcileCommands, type CommandExecution } from '@/lib/types';


function Kv({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-slate-100 py-3 last:border-b-0 sm:grid-cols-[140px_1fr]">
      <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</dt>
      <dd className="text-sm text-slate-900">{children}</dd>
    </div>
  );
}

export default function ActionResultPage() {
  const params = useParams<{ executionNumber: string }>();
  const executionNumber = decodeURIComponent(params.executionNumber ?? '');
  const [row, setRow] = useState<CommandExecution | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canReconcile, setCanReconcile] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    setCanReconcile(canReconcileCommands(getAuthSession()?.designation));
  }, []);

  const load = useCallback(async () => {
    if (!executionNumber) return;
    setLoading(true);
    setError(null);
    setForbidden(false);
    try {
      setRow(await getCommandExecution(executionNumber));
    } catch (e) {
      setRow(null);
      if (isForbiddenError(e)) setForbidden(true);
      else setError(e instanceof Error ? e.message : 'Unable to load action result');
    } finally {
      setLoading(false);
    }
  }, [executionNumber]);

  useEffect(() => {
    void load();
  }, [load]);

  const onReconcile = async (e: FormEvent) => {
    e.preventDefault();
    if (!note.trim()) return;
    setBusy(true);
    setActionError(null);
    try {
      const updated = await reconcileCommandExecution(executionNumber, note.trim());
      setRow(updated);
      setNote('');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not mark as reviewed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <PadlerShell>
      <PageHeader
        eyebrow="Actions"
        title={executionNumber || 'Action result'}
        subtitle={row ? `${row.commandKey ?? '—'} · ${row.status ?? '—'}` : 'What happened when this action ran'}
        actions={
          <Button asChild>
            <Link href="/actions">Back to actions</Link>
          </Button>
        }
      />
      {loading ? <StatePanel kind="loading" skeleton="detail" /> : null}
      {forbidden ? <StatePanel kind="forbidden" /> : null}
      {error ? <StatePanel kind="error" message={error} /> : null}
      {actionError ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {actionError}
        </div>
      ) : null}
      {!loading && !forbidden && !error && row ? (
        <div className="grid gap-5 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Details</CardTitle>
                <CardDescription>Outcome and linked records.</CardDescription>
              </div>
              <StatusBadge status={row.status} />
            </CardHeader>
            <CardContent>
              <dl>
                <Kv label="Action">{row.commandKey ?? '—'}</Kv>
                <Kv label="Case">
                  {row.caseNumber ? (
                    <Link
                      className="font-medium text-blue-700 hover:underline"
                      href={`/cases/${encodeURIComponent(row.caseNumber)}`}
                    >
                      {row.caseNumber}
                    </Link>
                  ) : (
                    '—'
                  )}
                </Kv>
                <Kv label="Customer">
                  {row.customerUserId ? (
                    <Link
                      className="font-medium text-blue-700 hover:underline"
                      href={`/customers/${encodeURIComponent(row.customerUserId)}`}
                    >
                      {row.customerUserId}
                    </Link>
                  ) : (
                    '—'
                  )}
                </Kv>
                <Kv label="Result">{row.resultSummary ?? '—'}</Kv>
                <Kv label="Error">
                  {row.errorCode || row.errorDetail
                    ? `${row.errorCode ?? ''} ${row.errorDetail ?? ''}`.trim()
                    : '—'}
                </Kv>
                <Kv label="Started">{formatDateTime(row.startedAt)}</Kv>
                <Kv label="Finished">{formatDateTime(row.finishedAt)}</Kv>
                <Kv label="Review due">{formatDateTime(row.reconcileDueAt)}</Kv>
                <Kv label="Reviewed">{formatDateTime(row.reconciledAt)}</Kv>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Review unclear result</CardTitle>
                <CardDescription>
                  Use this when the action finished in an unknown state and needs a written check.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {row.status === 'UNKNOWN' && canReconcile ? (
                <form onSubmit={onReconcile} className="space-y-4">
                  <FieldLabel>
                    Review note
                    <Textarea
                      rows={4}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      disabled={busy}
                      required
                      placeholder="What evidence shows the final outcome?"
                    />
                  </FieldLabel>
                  <Button type="submit" variant="primary" disabled={busy}>
                    Mark reviewed
                  </Button>
                </form>
              ) : row.status === 'UNKNOWN' ? (
                <p className="text-sm text-slate-500">Your role can’t review this. Ask a lead.</p>
              ) : row.status === 'RECONCILED' ? (
                <p className="text-sm text-slate-500">This result is already reviewed.</p>
              ) : (
                <p className="text-sm text-slate-500">Review is only needed when status is unknown.</p>
              )}
              {row.requestPayloadJson ? (
                <div className="mt-6">
                  <h3 className="mb-2 text-sm font-semibold text-slate-900">Request details</h3>
                  <pre className="overflow-x-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">
                    {row.requestPayloadJson}
                  </pre>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </PadlerShell>
  );
}
