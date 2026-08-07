'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { PadlerShell } from '@/app/components/PadlerShell';
import { CreateCaseDrawer } from '@/components/crm/CreateCaseDrawer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { serialNumber } from '@/components/ui/data-table';
import { FieldLabel, Input, Select } from '@/components/ui/field';
import { FilterBar, PageHeader, Pagination, StatePanel } from '@/components/ui/page';
import { isForbiddenError, listLoginTray, resendPadlerInvite } from '@/lib/api';
import type { LoginTrayItem } from '@/lib/types';
import { formatDateTime } from '@/lib/utils';
import { canInviteTeam } from '@/lib/types';
import { getAuthSession } from '@/lib/auth';
import { toast } from 'sonner';


function statusTone(status?: string): 'success' | 'warning' | 'danger' | 'neutral' {
  const s = (status ?? '').toUpperCase();
  if (s === 'SUCCESS' || s === 'VERIFY') return 'success';
  if (s === 'FAILURE' || s === 'UNVERIFIED') return 'danger';
  if (s === 'INVITE') return 'warning';
  return 'neutral';
}

function canResendInviteRow(row: LoginTrayItem): boolean {
  if (!row.email) return false;
  const event = (row.eventType ?? '').toUpperCase();
  return (
    event === 'INVITE_CREATED' ||
    event === 'INVITE_EXPIRED' ||
    event === 'INVITE_RESENT' ||
    (row.status === 'INVITE' && event !== 'INVITE_ACCEPTED' && !row.summary?.toLowerCase().includes('accepted'))
  );
}

type LoginTrayViewProps = {
  partyType: 'STAFF' | 'CUSTOMER';
  title: string;
  subtitle: string;
  showServiceColumn: boolean;
};

const PAGE_SIZE = 20;

export function LoginTrayView({ partyType, title, subtitle, showServiceColumn }: LoginTrayViewProps) {
  const [rows, setRows] = useState<LoginTrayItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState('');
  const [productKey, setProductKey] = useState('');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [caseOpen, setCaseOpen] = useState(false);
  const [caseEmail, setCaseEmail] = useState('');
  const [caseUserId, setCaseUserId] = useState('');
  const [caseName, setCaseName] = useState('');
  const [canInvite, setCanInvite] = useState(false);
  const [resendingEmail, setResendingEmail] = useState<string | null>(null);

  useEffect(() => {
    setCanInvite(canInviteTeam(getAuthSession()?.designation));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setForbidden(false);
    try {
      const result = await listLoginTray({
        partyType,
        status: status || undefined,
        productKey: showServiceColumn ? productKey || undefined : undefined,
        q: q || undefined,
        page,
        size: PAGE_SIZE
      });
      setRows(result.content);
      setTotal(result.totalElements);
    } catch (e) {
      setRows([]);
      if (isForbiddenError(e)) setForbidden(true);
      else setError(e instanceof Error ? e.message : 'Unable to load login tray');
    } finally {
      setLoading(false);
    }
  }, [partyType, status, productKey, q, page, showServiceColumn]);

  useEffect(() => {
    void load();
  }, [load]);

  const onFilter = (e: FormEvent) => {
    e.preventDefault();
    setPage(0);
    void load();
  };

  const openCreateCase = (row: LoginTrayItem) => {
    setCaseEmail(row.email ?? '');
    setCaseUserId(row.customerUserId ?? row.partyKey ?? '');
    setCaseName(row.email ?? row.partyKey ?? '');
    setCaseOpen(true);
  };

  const onResendInvite = async (row: LoginTrayItem) => {
    const email = row.email?.trim();
    if (!email) return;
    setResendingEmail(email);
    try {
      const result = await resendPadlerInvite({ email });
      toast.success(result.detail || `Invite resent to ${email}`);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Unable to resend invite');
    } finally {
      setResendingEmail(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <PadlerShell>
      <PageHeader
        eyebrow="Trust"
        title={title}
        subtitle={subtitle}
        actions={
          <>
            <Button asChild>
              <Link href={partyType === 'STAFF' ? '/sign-ins/customers' : '/sign-ins/staff'}>
                {partyType === 'STAFF' ? 'Customer sign-ins' : 'Staff sign-ins'}
              </Link>
            </Button>
            <Button type="button" onClick={() => void load()}>
              Refresh
            </Button>
          </>
        }
      />

      <FilterBar onSubmit={onFilter}>
        <FieldLabel className="min-w-[160px]">
          Status
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All</option>
            <option value="SUCCESS">SUCCESS</option>
            <option value="FAILURE">FAILURE</option>
            <option value="UNVERIFIED">UNVERIFIED</option>
            {partyType === 'STAFF' ? <option value="INVITE">INVITE</option> : null}
            {partyType === 'STAFF' ? <option value="VERIFY">VERIFY</option> : null}
          </Select>
        </FieldLabel>
        {showServiceColumn ? (
          <FieldLabel className="min-w-[180px]">
            Service (productKey)
            <Input
              value={productKey}
              onChange={(e) => setProductKey(e.target.value)}
              placeholder="npod, trip-jotter…"
            />
          </FieldLabel>
        ) : null}
        <FieldLabel className="min-w-[220px] flex-1">
          Search
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Email, user id…"
          />
        </FieldLabel>
        <Button type="submit" variant="primary" disabled={loading}>
          Filter
        </Button>
      </FilterBar>

      {loading ? <StatePanel kind="loading" /> : null}
      {forbidden ? <StatePanel kind="forbidden" /> : null}
      {error ? <StatePanel kind="error" message={error} /> : null}
      {!loading && !forbidden && !error && rows.length === 0 ? (
        <StatePanel
          kind="empty"
          message={
            partyType === 'CUSTOMER'
              ? 'No customer login events yet. Product apps must pass productKey on login; user-service must have PADLER_LOGIN_EVENTS_URL configured.'
              : 'No staff login/invite rows yet. Try signing in or inviting a teammate.'
          }
        />
      ) : null}

      {!loading && !forbidden && !error && rows.length > 0 ? (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse whitespace-nowrap text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="whitespace-nowrap px-4 py-3 font-semibold">S/N</th>
                  <th className="whitespace-nowrap px-4 py-3 font-semibold">When</th>
                  <th className="whitespace-nowrap px-4 py-3 font-semibold">Status</th>
                  <th className="whitespace-nowrap px-4 py-3 font-semibold">Event</th>
                  <th className="whitespace-nowrap px-4 py-3 font-semibold">Email</th>
                  {showServiceColumn ? (
                    <th className="whitespace-nowrap px-4 py-3 font-semibold">Service</th>
                  ) : null}
                  {showServiceColumn ? (
                    <th className="whitespace-nowrap px-4 py-3 font-semibold">Source</th>
                  ) : null}
                  {partyType === 'CUSTOMER' ? (
                    <th className="whitespace-nowrap px-4 py-3 font-semibold">Role</th>
                  ) : null}
                  {partyType === 'STAFF' ? (
                    <th className="whitespace-nowrap px-4 py-3 font-semibold">Designation</th>
                  ) : null}
                  <th className="whitespace-nowrap px-4 py-3 font-semibold">Summary</th>
                  <th className="whitespace-nowrap px-4 py-3 font-semibold">Reach out</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr
                    key={`${row.envelopeId ?? row.email ?? 'row'}-${idx}`}
                    className="border-t border-slate-100 hover:bg-slate-50/80"
                  >
                    <td className="px-4 py-3 tabular-nums text-slate-500">
                      {serialNumber(idx, page, PAGE_SIZE)}
                    </td>
                    <td className="px-4 py-3 align-middle text-slate-800">{formatDateTime(row.occurredAt)}</td>
                    <td className="px-4 py-3 align-middle text-slate-800">
                      <Badge tone={statusTone(row.status)}>{row.status ?? '—'}</Badge>
                    </td>
                    <td className="px-4 py-3 align-middle text-slate-800">
                      <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{row.eventType ?? '—'}</code>
                    </td>
                    <td className="px-4 py-3 align-middle text-slate-800">
                      {row.customerUserId && partyType === 'CUSTOMER' ? (
                        <Link
                          href={`/customers/${encodeURIComponent(row.customerUserId)}`}
                          className="font-medium text-blue-700 hover:underline"
                        >
                          {row.email ?? row.customerUserId}
                        </Link>
                      ) : (
                        row.email ?? '—'
                      )}
                    </td>
                    {showServiceColumn ? (
                      <td className="px-4 py-3 align-middle text-slate-800">{row.productKey ?? '—'}</td>
                    ) : null}
                    {showServiceColumn ? (
                      <td className="px-4 py-3 align-middle text-slate-800">{row.sourceSystem ?? '—'}</td>
                    ) : null}
                    {partyType === 'CUSTOMER' ? (
                      <td className="px-4 py-3 align-middle text-slate-800">{row.role ?? '—'}</td>
                    ) : null}
                    {partyType === 'STAFF' ? (
                      <td className="px-4 py-3 align-middle text-slate-800">{row.designation ?? '—'}</td>
                    ) : null}
                    <td className="px-4 py-3 align-middle text-slate-800">{row.summary ?? '—'}</td>
                    <td className="px-4 py-3 align-middle text-slate-800">
                      <div className="flex flex-wrap items-center gap-2">
                        {row.reachOutHint ? (
                          <Button asChild variant="link" size="sm" className="h-auto min-h-0 p-0">
                            <a href={row.reachOutHint}>Email</a>
                          </Button>
                        ) : null}
                        {partyType === 'STAFF' && canInvite && canResendInviteRow(row) ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={resendingEmail === row.email}
                            onClick={() => void onResendInvite(row)}
                          >
                            {resendingEmail === row.email ? 'Resending…' : 'Resend invite'}
                          </Button>
                        ) : null}
                        {partyType === 'CUSTOMER' ? (
                          <Button type="button" size="sm" onClick={() => openCreateCase(row)}>
                            Create case
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-slate-100 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm text-slate-500">{total} total</span>
              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
            </div>
          </div>
        </Card>
      ) : null}

      <CreateCaseDrawer
        open={caseOpen}
        customerUserId={caseUserId || undefined}
        customerEmail={caseEmail || undefined}
        customerName={caseName || undefined}
        onClose={() => setCaseOpen(false)}
      />
    </PadlerShell>
  );
}
