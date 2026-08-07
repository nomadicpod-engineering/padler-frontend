'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { PadlerShell } from '@/app/components/PadlerShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldLabel, Input, Select } from '@/components/ui/field';
import { PageHeader, StatePanel } from '@/components/ui/page';
import { invitePadlerAdmin, resendPadlerInvite } from '@/lib/api';
import { getAuthSession } from '@/lib/auth';
import type { InviteResult } from '@/lib/types';
import { canInviteTeam, INVITE_DESIGNATIONS } from '@/lib/types';

export default function AddPadlerPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [designation, setDesignation] = useState<string>('JUNIOR');
  const [orgId, setOrgId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InviteResult | null>(null);

  const [resendEmail, setResendEmail] = useState('');
  const [resendBusy, setResendBusy] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);
  const [resendResult, setResendResult] = useState<InviteResult | null>(null);

  useEffect(() => {
    const session = getAuthSession();
    setAllowed(canInviteTeam(session?.designation));
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const next = await invitePadlerAdmin({
        email: email.trim(),
        fullName: fullName.trim(),
        designation,
        organizationId: orgId.trim() || undefined
      });
      setResult(next);
      setEmail('');
      setFullName('');
      setOrgId('');
      setDesignation('JUNIOR');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invite failed');
    } finally {
      setBusy(false);
    }
  };

  const onResend = async (e: FormEvent) => {
    e.preventDefault();
    setResendBusy(true);
    setResendError(null);
    setResendResult(null);
    try {
      const next = await resendPadlerInvite({ email: resendEmail.trim() });
      setResendResult(next);
    } catch (err) {
      setResendError(err instanceof Error ? err.message : 'Resend failed');
    } finally {
      setResendBusy(false);
    }
  };

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
          eyebrow="Admin"
          title="Add Padler"
          subtitle="Invite a teammate to the Padler console"
        />
        <StatePanel
          kind="forbidden"
          message="Only BACK_OFFICE_SUPER_ADMIN and ADMIN can invite Padler users."
        />
      </PadlerShell>
    );
  }

  return (
    <PadlerShell>
      <PageHeader
        eyebrow="Admin"
        title="Add Padler"
        subtitle="Invite a teammate. They open the accept-invite link to set a password and join."
        actions={
          <Button asChild variant="secondary">
            <Link href="/settings">Back to settings</Link>
          </Button>
        }
      />

      <div className="grid max-w-xl gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Invite details</CardTitle>
            <CardDescription>
              Requires CAP_TEAM_INVITE (BACK_OFFICE_SUPER_ADMIN or ADMIN). Invitees open{' '}
              <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">/auth/accept-invite?token=…</code>
              . Re-inviting an email that already has a pending invite refreshes the link and resends the email.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error ? (
              <div
                className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
                role="alert"
              >
                {error}
              </div>
            ) : null}
            {result ? (
              <div
                className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
                role="status"
              >
                {result.detail || result.status || 'Invite sent.'}
                {result.resent ? ' (resent)' : ''}
                {result.invitationToken ? (
                  <>
                    {' '}
                    Token (dev):{' '}
                    <code className="rounded bg-white/80 px-1.5 py-0.5 text-xs">{result.invitationToken}</code>
                  </>
                ) : null}
                {result.expiresAt ? ` · expires ${result.expiresAt}` : ''}
              </div>
            ) : null}
            <form onSubmit={onSubmit} className="grid gap-4">
              <FieldLabel>
                Full name
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required disabled={busy} />
              </FieldLabel>
              <FieldLabel>
                Email
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={busy}
                />
              </FieldLabel>
              <FieldLabel>
                Designation
                <Select value={designation} onChange={(e) => setDesignation(e.target.value)} disabled={busy}>
                  {INVITE_DESIGNATIONS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </Select>
              </FieldLabel>
              <FieldLabel>
                Organization id (optional)
                <Input value={orgId} onChange={(e) => setOrgId(e.target.value)} disabled={busy} />
              </FieldLabel>
              <Button type="submit" variant="primary" disabled={busy}>
                {busy ? 'Sending…' : 'Send invite'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resend invite</CardTitle>
            <CardDescription>
              For expired or pending invites only. Issues a new token (7 days) and emails the link again.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {resendError ? (
              <div
                className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
                role="alert"
              >
                {resendError}
              </div>
            ) : null}
            {resendResult ? (
              <div
                className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
                role="status"
              >
                {resendResult.detail || 'Invitation resent.'}
                {resendResult.expiresAt ? ` · expires ${resendResult.expiresAt}` : ''}
              </div>
            ) : null}
            <form onSubmit={onResend} className="grid gap-4">
              <FieldLabel>
                Invitee email
                <Input
                  type="email"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  required
                  disabled={resendBusy}
                  placeholder="teammate@company.com"
                />
              </FieldLabel>
              <Button type="submit" variant="secondary" disabled={resendBusy}>
                {resendBusy ? 'Resending…' : 'Resend invite email'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </PadlerShell>
  );
}
