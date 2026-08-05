'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { PadlerShell } from '@/app/components/PadlerShell';
import { CrmTabs } from '@/components/crm/CrmTabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { serialNumber } from '@/components/ui/data-table';
import { FieldLabel, Input, Select } from '@/components/ui/field';
import { FilterBar, PageHeader, StatePanel } from '@/components/ui/page';
import {
  getAuditEvent,
  isForbiddenError,
  listAuditConsumers,
  listDeadLetters,
  replayDeadLetter
} from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import { getAuthSession } from '@/lib/auth';
import type { AuditEventDetail, ConsumerLag, DeadLetter } from '@/lib/types';
import { canManageCases } from '@/lib/types';


function healthTone(health?: string | null): 'success' | 'warning' | 'danger' | 'neutral' {
  const h = (health ?? '').toUpperCase();
  if (h === 'UP' || h === 'OK') return 'success';
  if (h === 'DEGRADED' || h === 'WARN') return 'warning';
  if (h === 'DOWN' || h === 'ERROR') return 'danger';
  return 'neutral';
}

function lagHealth(lagSeconds?: number | null): string {
  if ((lagSeconds ?? 0) > 300) return 'DOWN';
  if ((lagSeconds ?? 0) > 60) return 'DEGRADED';
  return 'UP';
}

type TabId = 'consumers' | 'dead-letters' | 'event';

export default function OpsAuditPage() {
  const [tab, setTab] = useState<TabId>('consumers');
  const [canManage, setCanManage] = useState(false);

  const [consumers, setConsumers] = useState<ConsumerLag[]>([]);
  const [deadLetters, setDeadLetters] = useState<DeadLetter[]>([]);
  const [dlStatus, setDlStatus] = useState('OPEN');
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const [envelopeId, setEnvelopeId] = useState('');
  const [event, setEvent] = useState<AuditEventDetail | null>(null);
  const [eventError, setEventError] = useState<string | null>(null);
  const [eventLoading, setEventLoading] = useState(false);

  useEffect(() => {
    setCanManage(canManageCases(getAuthSession()?.designation));
  }, []);

  const loadOps = useCallback(async () => {
    setLoading(true);
    setError(null);
    setForbidden(false);
    try {
      const [c, d] = await Promise.all([
        listAuditConsumers(),
        listDeadLetters(dlStatus || undefined)
      ]);
      setConsumers(c);
      setDeadLetters(d);
    } catch (e) {
      setConsumers([]);
      setDeadLetters([]);
      if (isForbiddenError(e)) setForbidden(true);
      else setError(e instanceof Error ? e.message : 'Unable to load audit ops');
    } finally {
      setLoading(false);
    }
  }, [dlStatus]);

  useEffect(() => {
    void loadOps();
  }, [loadOps]);

  const onReplay = async (id: number) => {
    if (!window.confirm(`Replay dead letter #${id}?`)) return;
    setBusyId(id);
    setActionMsg(null);
    try {
      await replayDeadLetter(id);
      setActionMsg(`Replayed dead letter #${id}`);
      await loadOps();
    } catch (e) {
      setActionMsg(e instanceof Error ? e.message : 'Replay failed');
    } finally {
      setBusyId(null);
    }
  };

  const onLookupEvent = async (e: FormEvent) => {
    e.preventDefault();
    if (!envelopeId.trim()) return;
    setEventLoading(true);
    setEventError(null);
    setEvent(null);
    try {
      const detail = await getAuditEvent(envelopeId.trim());
      setEvent(detail);
    } catch (err) {
      setEventError(err instanceof Error ? err.message : 'Lookup failed');
    } finally {
      setEventLoading(false);
    }
  };

  return (
    <PadlerShell>
      <PageHeader
        eyebrow="Ops"
        title="Audit"
        subtitle="Consumer lag, dead-letter replay, and envelope lookup"
        actions={
          <Button type="button" onClick={() => void loadOps()}>
            Refresh
          </Button>
        }
      />

      <p className="mb-4 text-sm text-slate-500">
        Agent activity feed remains on{' '}
        <Link href="/activity" className="font-medium text-blue-700 hover:underline">
          Activity
        </Link>
        . This page is audit pipeline ops.
      </p>

      <CrmTabs
        ariaLabel="Audit ops"
        tabs={[
          { id: 'consumers', label: 'Consumers', count: consumers.length },
          { id: 'dead-letters', label: 'Dead letters', count: deadLetters.length },
          { id: 'event', label: 'Event lookup' }
        ]}
        active={tab}
        onChange={(id) => setTab(id as TabId)}
      />

      {actionMsg ? (
        <div
          className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
          role="status"
        >
          {actionMsg}
        </div>
      ) : null}

      {loading && tab !== 'event' ? <StatePanel kind="loading" /> : null}
      {forbidden ? <StatePanel kind="forbidden" /> : null}
      {error ? <StatePanel kind="error" message={error} /> : null}

      {tab === 'consumers' && !loading && !forbidden && !error ? (
        <Card className="overflow-hidden p-0">
          {consumers.length === 0 ? (
            <CardContent className="p-5">
              <StatePanel kind="empty" message="No consumer cursors registered." />
            </CardContent>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse whitespace-nowrap text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="whitespace-nowrap px-4 py-3 font-semibold">S/N</th>
                    <th className="whitespace-nowrap px-4 py-3 font-semibold">Consumer</th>
                    <th className="whitespace-nowrap px-4 py-3 font-semibold">Last seq</th>
                    <th className="whitespace-nowrap px-4 py-3 font-semibold">Last envelope</th>
                    <th className="whitespace-nowrap px-4 py-3 font-semibold">Last processed</th>
                    <th className="whitespace-nowrap px-4 py-3 font-semibold">Lag (s)</th>
                  </tr>
                </thead>
                <tbody>
                  {consumers.map((c, idx) => (
                    <tr
                      key={c.consumerName ?? c.lastEnvelopeId}
                      className="border-t border-slate-100 hover:bg-slate-50/80"
                    >
                      <td className="px-4 py-3 tabular-nums text-slate-500">{serialNumber(idx)}</td>
                      <td className="px-4 py-3 align-middle text-slate-800">{c.consumerName ?? '—'}</td>
                      <td className="px-4 py-3 align-middle text-slate-800">{c.lastSequenceNo ?? '—'}</td>
                      <td className="px-4 py-3 align-middle text-slate-800">
                        {c.lastEnvelopeId ? (
                          <Button
                            type="button"
                            variant="link"
                            className="h-auto min-h-0 p-0"
                            onClick={() => {
                              setEnvelopeId(c.lastEnvelopeId ?? '');
                              setTab('event');
                            }}
                          >
                            {c.lastEnvelopeId}
                          </Button>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3 align-middle text-slate-800">
                        {formatDateTime(c.lastProcessedAt)}
                      </td>
                      <td className="px-4 py-3 align-middle text-slate-800">
                        <Badge tone={healthTone(lagHealth(c.lagSeconds))}>{c.lagSeconds ?? '—'}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : null}

      {tab === 'dead-letters' && !loading && !forbidden && !error ? (
        <Card>
          <CardContent className="pt-5">
            <FilterBar
              onSubmit={(e) => {
                e.preventDefault();
                void loadOps();
              }}
            >
              <FieldLabel className="min-w-[160px]">
                Status
                <Select value={dlStatus} onChange={(e) => setDlStatus(e.target.value)}>
                  <option value="OPEN">OPEN</option>
                  <option value="REPLAYED">REPLAYED</option>
                  <option value="DISCARDED">DISCARDED</option>
                </Select>
              </FieldLabel>
              <Button type="submit">Apply</Button>
            </FilterBar>
            {deadLetters.length === 0 ? (
              <StatePanel kind="empty" message="No dead letters for this status." />
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="min-w-full border-collapse whitespace-nowrap text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="whitespace-nowrap px-4 py-3 font-semibold">S/N</th>
                      <th className="whitespace-nowrap px-4 py-3 font-semibold">Id</th>
                      <th className="whitespace-nowrap px-4 py-3 font-semibold">Envelope</th>
                      <th className="whitespace-nowrap px-4 py-3 font-semibold">Error</th>
                      <th className="whitespace-nowrap px-4 py-3 font-semibold">Attempts</th>
                      <th className="whitespace-nowrap px-4 py-3 font-semibold">Last failed</th>
                      <th className="whitespace-nowrap px-4 py-3 font-semibold">Status</th>
                      <th className="whitespace-nowrap px-4 py-3 font-semibold" />
                    </tr>
                  </thead>
                  <tbody>
                    {deadLetters.map((d, idx) => (
                      <tr key={d.id} className="border-t border-slate-100 hover:bg-slate-50/80">
                        <td className="px-4 py-3 tabular-nums text-slate-500">{serialNumber(idx)}</td>
                        <td className="px-4 py-3 align-middle text-slate-800">{d.id}</td>
                        <td className="px-4 py-3 align-middle text-slate-800">
                          {d.envelopeId ? (
                            <Button
                              type="button"
                              variant="link"
                              className="h-auto min-h-0 p-0"
                              onClick={() => {
                                setEnvelopeId(d.envelopeId ?? '');
                                setTab('event');
                              }}
                            >
                              {d.envelopeId}
                            </Button>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-4 py-3 align-middle text-slate-800">
                          {d.errorCode ?? '—'}
                          {d.errorDetail ? (
                            <div className="text-xs text-slate-500">{d.errorDetail}</div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 align-middle text-slate-800">{d.attempts ?? '—'}</td>
                        <td className="px-4 py-3 align-middle text-slate-800">
                          {formatDateTime(d.lastFailedAt)}
                        </td>
                        <td className="px-4 py-3 align-middle text-slate-800">
                          <Badge tone={healthTone(d.status === 'OPEN' ? 'DEGRADED' : 'UP')}>
                            {d.status ?? '—'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 align-middle text-slate-800">
                          {canManage && d.status === 'OPEN' ? (
                            <Button
                              type="button"
                              size="sm"
                              disabled={busyId === d.id}
                              onClick={() => void onReplay(d.id)}
                            >
                              {busyId === d.id ? 'Replaying…' : 'Replay'}
                            </Button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {tab === 'event' ? (
        <Card>
          <CardHeader>
            <CardTitle>Event lookup</CardTitle>
          </CardHeader>
          <CardContent>
            <FilterBar onSubmit={onLookupEvent}>
              <FieldLabel className="min-w-[280px] flex-1">
                Envelope id
                <Input
                  value={envelopeId}
                  onChange={(e) => setEnvelopeId(e.target.value)}
                  placeholder="Envelope UUID…"
                  required
                />
              </FieldLabel>
              <Button type="submit" variant="primary" disabled={eventLoading}>
                Lookup
              </Button>
            </FilterBar>
            {eventLoading ? <StatePanel kind="loading" /> : null}
            {eventError ? <StatePanel kind="error" message={eventError} /> : null}
            {event ? (
              <>
                <dl className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Event type</dt>
                    <dd className="mt-1 text-sm text-slate-900">{event.eventType ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Category</dt>
                    <dd className="mt-1 text-sm text-slate-900">{event.category ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Source</dt>
                    <dd className="mt-1 text-sm text-slate-900">{event.sourceSystem ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Case</dt>
                    <dd className="mt-1 text-sm text-slate-900">
                      {event.caseNumber ? (
                        <Link
                          href={`/cases/${encodeURIComponent(event.caseNumber)}`}
                          className="font-medium text-blue-700 hover:underline"
                        >
                          {event.caseNumber}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Incident</dt>
                    <dd className="mt-1 text-sm text-slate-900">
                      {event.incidentNumber ? (
                        <Link
                          href={`/incidents/${encodeURIComponent(event.incidentNumber)}`}
                          className="font-medium text-blue-700 hover:underline"
                        >
                          {event.incidentNumber}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Customer</dt>
                    <dd className="mt-1 text-sm text-slate-900">
                      {event.customerUserId ? (
                        <Link
                          href={`/customers/${encodeURIComponent(event.customerUserId)}`}
                          className="font-medium text-blue-700 hover:underline"
                        >
                          {event.customerUserId}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Occurred</dt>
                    <dd className="mt-1 text-sm text-slate-900">{formatDateTime(event.occurredAt)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Summary</dt>
                    <dd className="mt-1 text-sm text-slate-900">{event.summary ?? '—'}</dd>
                  </div>
                </dl>
                {event.payloadJson ? (
                  <pre className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-800">
                    {event.payloadJson}
                  </pre>
                ) : null}
              </>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </PadlerShell>
  );
}
