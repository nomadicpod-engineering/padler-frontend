'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** C0: Services hub demoted — redirect to Tools. */
export default function ServicesRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/tools');
  }, [router]);
  return <div className="padler-page">Redirecting to Tools…</div>;
}
