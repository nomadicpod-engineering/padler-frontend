'use client';

import { FormEvent, Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { acceptPadlerInvite } from '@/lib/api';
import { UserPlus } from 'lucide-react';
import { AuthBrandPanel } from '@/app/auth/components/AuthBrandPanel';
import { AuthAnimations } from '@/app/auth/components/AuthAnimations';
import { Button } from '@/components/ui/button';
import { FieldLabel, Input } from '@/components/ui/field';
import { DetailSkeleton } from '@/components/ui/skeleton';

function AcceptInviteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenFromUrl = searchParams.get('token') ?? '';

  const [token, setToken] = useState(tokenFromUrl);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<{ designation?: string; detail?: string } | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setSubmitting(true);
    try {
      const result = await acceptPadlerInvite({
        token: token.trim(),
        password,
        phoneNumber: phoneNumber.trim()
      });
      setDone({ designation: result.designation, detail: result.detail });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to accept invite.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-[0_14px_30px_rgba(15,23,42,0.08)]"
    >
      <div className="mb-6 lg:hidden">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Padler</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Care console</h1>
      </div>
      <h2 className="m-0 text-3xl font-semibold tracking-tight text-slate-950">Accept invite</h2>
      <p className="mt-1.5 text-sm text-slate-500">Complete setup for your Padler workspace</p>

      {done ? (
        <>
          <div
            className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-900"
            role="status"
          >
            {done.detail || 'Invitation accepted.'}
            {done.designation ? ` Designation: ${done.designation}.` : ''}
          </div>
          <Button
            type="button"
            variant="primary"
            className="mt-5 w-full"
            onClick={() => router.replace('/auth/login')}
          >
            Continue to sign in
          </Button>
        </>
      ) : (
        <>
          {error ? (
            <div
              className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800"
              role="alert"
            >
              {error}
            </div>
          ) : null}

          <div className="mt-5 space-y-4">
            <FieldLabel>
              Invite token
              <Input
                value={token}
                onChange={(e) => setToken(e.target.value)}
                required
                disabled={submitting}
                autoComplete="off"
              />
            </FieldLabel>
            <FieldLabel>
              Phone number
              <Input
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                required
                disabled={submitting}
                autoComplete="tel"
              />
            </FieldLabel>
            <FieldLabel>
              Password
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={submitting}
                autoComplete="new-password"
              />
            </FieldLabel>
            <FieldLabel>
              Confirm password
              <Input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                disabled={submitting}
                autoComplete="new-password"
              />
            </FieldLabel>
          </div>

          <Button type="submit" variant="primary" className="mt-5 w-full" disabled={submitting}>
            {submitting ? 'Activating…' : 'Activate account'}
          </Button>
        </>
      )}

      <p className="mt-4 text-center text-sm text-slate-500">
        Already set up?{' '}
        <Link href="/auth/login" className="font-semibold text-blue-700 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}

export default function AcceptInvitePage() {
  return (
    <main className="flex min-h-screen bg-slate-50">
      <div className="hidden flex-1 lg:flex">
        <AuthBrandPanel
          title="Join Padler"
          subtitle="Accept your invitation"
          description="Set a password and phone number to activate your Padler admin account."
          bullets={['Role assigned by your inviter', 'Then sign in with your work email']}
          icon={<UserPlus size={34} />}
        />
      </div>

      <section className="grid flex-1 place-items-center p-6">
        <Suspense fallback={<div className="p-8"><DetailSkeleton /></div>}>
          <AcceptInviteForm />
        </Suspense>
      </section>

      <AuthAnimations />
    </main>
  );
}
