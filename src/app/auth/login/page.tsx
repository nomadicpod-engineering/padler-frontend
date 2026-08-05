'use client';

import { FormEvent, Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { loginPadler } from '@/lib/api';
import { saveSessionFromLogin } from '@/lib/auth';
import { Eye, EyeOff, LayoutDashboard } from 'lucide-react';
import { AuthBrandPanel } from '@/app/auth/components/AuthBrandPanel';
import { AuthAnimations } from '@/app/auth/components/AuthAnimations';
import { Button } from '@/components/ui/button';
import { FieldLabel, Input } from '@/components/ui/field';
import { DetailSkeleton } from '@/components/ui/skeleton';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  useEffect(() => {
    if (searchParams.get('session') === 'idle') {
      setInfo('You were signed out after 45 minutes of inactivity. Please sign in again.');
    } else if (searchParams.get('session') === 'expired') {
      setInfo('Your session has expired. Please sign in again.');
    } else {
      setInfo('');
    }
  }, [searchParams]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const auth = await loginPadler(email, password);
      if (!auth.accessToken) {
        setError('Sign-in response missing access token.');
        return;
      }
      saveSessionFromLogin({
        accessToken: auth.accessToken,
        refreshToken: auth.refreshToken,
        expiresIn: auth.expiresIn,
        email: auth.email,
        userId: auth.userId,
        designation: auth.designation
      });
      const next = searchParams.get('next');
      router.replace(next && next.startsWith('/') ? next : '/today');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in.');
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
      <h2 className="m-0 text-3xl font-semibold tracking-tight text-slate-950">Sign in</h2>
      <p className="mt-1.5 text-sm text-slate-500">Access your Padler workspace</p>

      {info ? (
        <div
          className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900"
          role="status"
        >
          {info}
        </div>
      ) : null}

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
          Email
          <Input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            autoComplete="username"
          />
        </FieldLabel>

        <FieldLabel>
          Password
          <div className="relative">
            <Input
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              className="pr-11"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </FieldLabel>
      </div>

      <div className="mt-3 text-right">
        <Link href="/auth/forgot-password" className="text-sm font-semibold text-blue-700 hover:underline">
          Forgot password?
        </Link>
      </div>

      <Button type="submit" variant="primary" className="mt-5 w-full" disabled={submitting}>
        {submitting ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen bg-slate-50">
      <div className="hidden flex-1 lg:flex">
        <AuthBrandPanel
          title="Welcome back"
          subtitle="Care console"
          description="Sign in to help customers with cases, payments, bookings, and product accounts — without needing technical support."
          bullets={[
            'Start from Today and My cases',
            'Request actions from a case when needed',
            'Use Fix problems tools only when a runbook says so'
          ]}
          icon={<LayoutDashboard size={34} />}
        />
      </div>

      <section className="grid flex-1 place-items-center p-6">
        <Suspense fallback={<div className="p-8"><DetailSkeleton /></div>}>
          <LoginForm />
        </Suspense>
      </section>

      <AuthAnimations />
    </main>
  );
}
