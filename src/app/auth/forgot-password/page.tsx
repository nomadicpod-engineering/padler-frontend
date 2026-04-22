'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { forgotPadlerPassword } from '@/lib/api';
import { MailCheck } from 'lucide-react';
import { AuthBrandPanel } from '@/app/auth/components/AuthBrandPanel';
import { AuthAnimations } from '@/app/auth/components/AuthAnimations';

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
    <main className="padler-auth-main" style={{ minHeight: '100vh', display: 'flex', background: '#f8fafc' }}>
      <div className="padler-auth-brand" style={{ flex: 1, display: 'flex' }}>
        <AuthBrandPanel
          title="Reset access"
          subtitle="Padler Admin Console"
          description="Submit your account email to receive a verification code and reset your password securely."
          bullets={['Use the same email tied to your Padler account', 'Your code will be required on the next screen']}
          icon={<MailCheck size={34} />}
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
          <h2 style={{ marginTop: 0, marginBottom: 6, fontSize: 30 }}>Forgot Password</h2>
          <p style={{ marginTop: 0, marginBottom: 20, color: '#64748b' }}>We&apos;ll send you a reset verification code.</p>

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
            {submitting ? 'Sending...' : 'Send Verification Code'}
          </button>

          <p style={{ marginTop: 14, marginBottom: 0, fontSize: 13, color: '#64748b', textAlign: 'center' }}>
            Remembered your password?{' '}
            <Link href="/auth/login" style={{ color: '#2563eb', fontWeight: 600 }}>
              Back to Sign In
            </Link>
          </p>
        </form>
      </section>
      <AuthAnimations />
    </main>
  );
}
