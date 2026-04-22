'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getAuthSession } from '@/lib/auth';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const session = getAuthSession();
    if (session?.accessToken) {
      router.replace('/dashboard');
      return;
    }
    router.replace('/auth/login');
  }, [router]);

  return <div style={{ padding: 24 }}>Loading...</div>;
}
