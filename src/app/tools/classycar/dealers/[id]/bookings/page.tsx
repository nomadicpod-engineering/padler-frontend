'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ClassycarDealerBookingsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/tools/classycar/bookings');
  }, [router]);
  return null;
}
