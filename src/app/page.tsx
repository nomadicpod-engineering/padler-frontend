'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getAuthSession } from '@/lib/auth';

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    const session = getAuthSession();
    if (session?.accessToken) {
      router.replace('/today');
      return;
    }
    router.replace('/auth/login');
  }, [router]);

  return <div className="grid min-h-screen place-items-center text-sm text-slate-500">Loading…</div>;
}
