'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { forgotPadlerPassword } from '@/lib/api';
import { MailCheck } from 'lucide-react';
import { AuthBrandPanel } from '@/app/auth/components/AuthBrandPanel';
import { AuthAnimations } from '@/app/auth/components/AuthAnimations';
import { Button } from '@/components/ui/button';
import { FieldLabel, Input } from '@/components/ui/field';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      await forgotPadlerPassword(email);
      setSuccess('Verification code sent to your email.');
      router.push(`/auth/reset-password?email=${encodeURIComponent(email)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send reset code.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen bg-slate-50">
      <div className="hidden flex-1 lg:flex">
        <AuthBrandPanel
          title="Reset access"
          subtitle="Care console"
          description="Enter the email on your Padler account. We’ll send a code so you can choose a new password."
          bullets={['Use the email tied to your Padler account', 'You’ll need the code on the next screen']}
          icon={<MailCheck size={34} />}
        />
      </div>

      <section className="grid flex-1 place-items-center p-6">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-[0_14px_30px_rgba(15,23,42,0.08)]"
        >
          <h2 className="m-0 text-3xl font-semibold tracking-tight text-slate-950">Forgot password</h2>
          <p className="mt-1.5 text-sm text-slate-500">We’ll send you a verification code.</p>

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

          <div className="mt-5">
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
          </div>

          <Button type="submit" variant="primary" className="mt-5 w-full" disabled={submitting}>
            {submitting ? 'Sending…' : 'Send verification code'}
          </Button>

          <p className="mt-4 text-center text-sm text-slate-500">
            Remembered your password?{' '}
            <Link href="/auth/login" className="font-semibold text-blue-700 hover:underline">
              Back to sign in
            </Link>
          </p>
        </form>
      </section>
      <AuthAnimations />
    </main>
  );
}
