'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PadlerShell } from '@/app/components/PadlerShell';

/** Legacy hub — Trip Jotter bookings now live under Tools → Trip Jotter → Company. */
export default function LegacyBookingsRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/tools/trip-jotter');
  }, [router]);

  return (
    <PadlerShell>
      <div className="padler-page">
        <p className="padler-muted-copy">Redirecting to Trip Jotter…</p>
      </div>
    </PadlerShell>
  );
}
