'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { loginPadler } from '@/lib/api';
import { setAuthSession } from '@/lib/auth';
import { Eye, EyeOff, LayoutDashboard } from 'lucide-react';
import { AuthBrandPanel } from '@/app/auth/components/AuthBrandPanel';
import { AuthAnimations } from '@/app/auth/components/AuthAnimations';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const auth = await loginPadler(email, password);
      if (!auth.accessToken) {
        setError('Login response missing access token.');
        return;
      }
      setAuthSession({
        accessToken: auth.accessToken,
        email: auth.email,
        userId: auth.userId,
        designation: auth.designation
      });
      router.replace('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to login.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="padler-auth-main" style={{ minHeight: '100vh', display: 'flex', background: '#f8fafc' }}>
      <div className="padler-auth-brand" style={{ flex: 1, display: 'flex' }}>
        <AuthBrandPanel
          title="Welcome back"
          subtitle="Padler Admin Console"
          description="Sign in to manage bookings, customers, wallet activity, and audit actions across your services in one place."
          bullets={[
            'Role-based access for Super Admin and Admin users',
            'Secure authentication via your existing Nomadicpod stack'
          ]}
          icon={<LayoutDashboard size={34} />}
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
          <h2 style={{ marginTop: 0, marginBottom: 6, fontSize: 30 }}>Sign In</h2>
          <p style={{ marginTop: 0, marginBottom: 20, color: '#64748b' }}>Access your Padler workspace</p>

          {error ? (
            <div style={{ marginBottom: 12, border: '1px solid #fecaca', color: '#b91c1c', borderRadius: 10, background: '#fef2f2', padding: '10px 12px', fontSize: 13 }}>
              {error}
            </div>
          ) : null}

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
            <span style={{ fontSize: 14, color: '#334155' }}>Password</span>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                style={{ width: '100%', padding: '12px 40px 12px 13px', borderRadius: 10, border: '1px solid #cbd5e1', outline: 'none' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' }}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>
          <div style={{ textAlign: 'right', marginTop: 10 }}>
            <Link href="/auth/forgot-password" style={{ color: '#2563eb', fontSize: 13, fontWeight: 600 }}>
              Forgot password?
            </Link>
          </div>

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
            {submitting ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </section>

      <AuthAnimations />
    </main>
  );
}
