'use client';

import Link from 'next/link';
import { Suspense } from 'react';
import { FormEvent, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { resetPadlerPassword } from '@/lib/api';
import { KeyRound } from 'lucide-react';
import { AuthBrandPanel } from '@/app/auth/components/AuthBrandPanel';
import { AuthAnimations } from '@/app/auth/components/AuthAnimations';

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
      setSuccess('Password reset successful. Redirecting to login...');
      setTimeout(() => router.replace('/auth/login'), 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reset password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="padler-auth-main" style={{ minHeight: '100vh', display: 'flex', background: '#f8fafc' }}>
      <div className="padler-auth-brand" style={{ flex: 1, display: 'flex' }}>
        <AuthBrandPanel
          title="Set a new password"
          subtitle="Padler Admin Console"
          description="Enter your verification code and choose a new secure password to restore access."
          bullets={['Verification code is required', 'Use matching new and confirm password values']}
          icon={<KeyRound size={34} />}
        />
      </div>

      <section style={{ flex: 1, display: 'grid', placeItems: 'center', padding: 24 }}>
        <form
          onSubmit={handleSubmit}
          style={{
            width: '100%',
            maxWidth: 420,
            background: '#ffffff',
            borderRadius: 16,
            border: '1px solid #e2e8f0',
            padding: 28,
            boxShadow: '0 14px 30px rgba(15,23,42,0.08)'
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: 6, fontSize: 30 }}>Reset Password</h2>
          <p style={{ marginTop: 0, marginBottom: 20, color: '#64748b' }}>Use the code sent to your email.</p>

          {error ? <div style={{ marginBottom: 12, border: '1px solid #fecaca', color: '#b91c1c', borderRadius: 10, background: '#fef2f2', padding: '10px 12px', fontSize: 13 }}>{error}</div> : null}
          {success ? <div style={{ marginBottom: 12, border: '1px solid #86efac', color: '#166534', borderRadius: 10, background: '#f0fdf4', padding: '10px 12px', fontSize: 13 }}>{success}</div> : null}

          <label style={{ display: 'grid', gap: 7, marginTop: 6 }}>
            <span style={{ fontSize: 14, color: '#334155' }}>Email Address</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              style={{ padding: '12px 13px', borderRadius: 10, border: '1px solid #cbd5e1', outline: 'none' }}
            />
          </label>

          <label style={{ display: 'grid', gap: 7, marginTop: 14 }}>
            <span style={{ fontSize: 14, color: '#334155' }}>Verification Code</span>
            <input
              type="text"
              required
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              placeholder="Enter code"
              style={{ padding: '12px 13px', borderRadius: 10, border: '1px solid #cbd5e1', outline: 'none' }}
            />
          </label>

          <label style={{ display: 'grid', gap: 7, marginTop: 14 }}>
            <span style={{ fontSize: 14, color: '#334155' }}>New Password</span>
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
              style={{ padding: '12px 13px', borderRadius: 10, border: '1px solid #cbd5e1', outline: 'none' }}
            />
          </label>

          <label style={{ display: 'grid', gap: 7, marginTop: 14 }}>
            <span style={{ fontSize: 14, color: '#334155' }}>Confirm Password</span>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              style={{ padding: '12px 13px', borderRadius: 10, border: '1px solid #cbd5e1', outline: 'none' }}
            />
          </label>

          <button
            type="submit"
            disabled={submitting}
            style={{
              marginTop: 18,
              width: '100%',
              border: 'none',
              borderRadius: 10,
              background: '#2563eb',
              color: 'white',
              padding: '12px 12px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            {submitting ? 'Resetting...' : 'Reset Password'}
          </button>

          <p style={{ marginTop: 14, marginBottom: 0, fontSize: 13, color: '#64748b', textAlign: 'center' }}>
            Back to{' '}
            <Link href="/auth/login" style={{ color: '#2563eb', fontWeight: 600 }}>
              Sign In
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
    <Suspense fallback={<main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>Loading...</main>}>
      <ResetPasswordContent />
    </Suspense>
  );
}
