'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PadlerShell } from '@/app/components/PadlerShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader, StatePanel } from '@/components/ui/page';
import { fetchRolloutStatus, isForbiddenError } from '@/lib/api';
import { clearAuthSession, getAuthSession, type AuthSession } from '@/lib/auth';
import type { RolloutStatus } from '@/lib/types';
import { canInviteTeam } from '@/lib/types';

export default function SettingsPage() {
  const router = useRouter();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [rollout, setRollout] = useState<RolloutStatus | null>(null);
  const [rolloutError, setRolloutError] = useState<string | null>(null);
  const [rolloutForbidden, setRolloutForbidden] = useState(false);

  const showInvite = canInviteTeam(session?.designation);

  useEffect(() => {
    setSession(getAuthSession());
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const status = await fetchRolloutStatus();
        if (!cancelled) {
          setRollout(status);
          setRolloutError(null);
          setRolloutForbidden(false);
        }
      } catch (e) {
        if (cancelled) return;
        if (isForbiddenError(e)) setRolloutForbidden(true);
        else setRolloutError(e instanceof Error ? e.message : 'Unable to load rollout');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const logout = () => {
    clearAuthSession();
    router.replace('/auth/login');
  };

  return (
    <PadlerShell>
      <PageHeader
        eyebrow="Admin"
        title="Settings"
        subtitle="Session and progressive rollout"
      />

      <div className="space-y-4">
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle>Session</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="mb-4 grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Email</dt>
                <dd className="mt-1 text-sm text-slate-900">{session?.email ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">User id</dt>
                <dd className="mt-1 text-sm text-slate-900">{session?.userId ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Designation</dt>
                <dd className="mt-1 text-sm text-slate-900">{session?.designation ?? '—'}</dd>
              </div>
            </dl>
            <Button type="button" variant="primary" onClick={logout}>
              Log out
            </Button>
          </CardContent>
        </Card>

        {showInvite ? (
          <Card className="max-w-xl">
            <CardHeader>
              <CardTitle>Team</CardTitle>
              <CardDescription>
                Invite Padler console users (BACK_OFFICE_SUPER_ADMIN and ADMIN only).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="primary">
                <Link href="/settings/add-padler">Add Padler</Link>
              </Button>
            </CardContent>
          </Card>
        ) : null}

        <p className="text-sm text-slate-500">
          Program evidence:{' '}
          <Link href="/acceptance" className="font-medium text-blue-700 hover:underline">
            Acceptance
          </Link>
          {' · '}
          <Link href="/governance" className="font-medium text-blue-700 hover:underline">
            Governance
          </Link>
          {' · '}
          <Link href="/ops/audit" className="font-medium text-blue-700 hover:underline">
            Audit ops
          </Link>
        </p>

        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle>Rollout</CardTitle>
          </CardHeader>
          <CardContent>
            {rolloutForbidden ? <StatePanel kind="forbidden" /> : null}
            {rolloutError ? <StatePanel kind="error" message={rolloutError} /> : null}
            {rollout ? (
              <dl className="grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Mode</dt>
                  <dd className="mt-1 text-sm text-slate-900">{rollout.mode}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Commands kill switch</dt>
                  <dd className="mt-1 text-sm text-slate-900">{rollout.commandsEnabled ? 'enabled' : 'disabled'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Canary cohort</dt>
                  <dd className="mt-1 text-sm text-slate-900">{rollout.canaryCohort || '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Allowed risk</dt>
                  <dd className="mt-1 text-sm text-slate-900">
                    {[
                      rollout.allowsR0 && 'R0',
                      rollout.allowsR1 && 'R1',
                      rollout.allowsR2 && 'R2',
                      rollout.allowsR3 && 'R3',
                      rollout.allowsR4 && 'R4'
                    ]
                      .filter(Boolean)
                      .join(', ') || 'none'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Next</dt>
                  <dd className="mt-1 text-sm text-slate-900">{rollout.nextModeHint ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Rollback</dt>
                  <dd className="mt-1 text-sm text-slate-900">{rollout.rollbackHint ?? '—'}</dd>
                </div>
              </dl>
            ) : !rolloutForbidden && !rolloutError ? (
              <StatePanel kind="loading" />
            ) : null}
          </CardContent>
        </Card>
      </div>
    </PadlerShell>
  );
}
