'use client';

import Link from 'next/link';
import { Suspense } from 'react';
import { FormEvent, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { resetPadlerPassword } from '@/lib/api';
import { KeyRound } from 'lucide-react';
import { AuthBrandPanel } from '@/app/auth/components/AuthBrandPanel';
import { AuthAnimations } from '@/app/auth/components/AuthAnimations';
import { Button } from '@/components/ui/button';
import { FieldLabel, Input } from '@/components/ui/field';
import { PageSkeleton } from '@/components/ui/skeleton';

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get('email') ?? '');
  const [verificationCode, setVerificationCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      await resetPadlerPassword({
        email,
        verificationCode,
        newPassword,
        confirmPassword
      });
      setSuccess('Password reset successful. Redirecting to sign in…');
      setTimeout(() => router.replace('/auth/login'), 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reset password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen bg-slate-50">
      <div className="hidden flex-1 lg:flex">
        <AuthBrandPanel
          title="Set a new password"
          subtitle="Care console"
          description="Enter the verification code from your email and choose a new password."
          bullets={['Verification code is required', 'New password and confirm password must match']}
          icon={<KeyRound size={34} />}
        />
      </div>

      <section className="grid flex-1 place-items-center p-6">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-[0_14px_30px_rgba(15,23,42,0.08)]"
        >
          <h2 className="m-0 text-3xl font-semibold tracking-tight text-slate-950">Reset password</h2>
          <p className="mt-1.5 text-sm text-slate-500">Use the code sent to your email.</p>

          {error ? (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800" role="alert">
              {error}
            </div>
          ) : null}
          {success ? (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-900">
              {success}
            </div>
          ) : null}

          <div className="mt-5 space-y-4">
            <FieldLabel>
              Email
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
              />
            </FieldLabel>
            <FieldLabel>
              Verification code
              <Input
                type="text"
                required
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                placeholder="Enter code"
              />
            </FieldLabel>
            <FieldLabel>
              New password
              <Input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
              />
            </FieldLabel>
            <FieldLabel>
              Confirm password
              <Input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
              />
            </FieldLabel>
          </div>

          <Button type="submit" variant="primary" className="mt-5 w-full" disabled={submitting}>
            {submitting ? 'Resetting…' : 'Reset password'}
          </Button>

          <p className="mt-4 text-center text-sm text-slate-500">
            Back to{' '}
            <Link href="/auth/login" className="font-semibold text-blue-700 hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      </section>
      <AuthAnimations />
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-7xl px-4 py-8"><PageSkeleton /></main>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
