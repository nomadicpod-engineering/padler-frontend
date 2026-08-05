'use client';

import { useParams } from 'next/navigation';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Entity-tab alias → global NPod stuck page. */
export default function NpodTravellerStuckRedirect() {
  const params = useParams();
  const router = useRouter();
  const userId = String(params?.userId ?? '');

  useEffect(() => {
    router.replace(`/tools/npod/stuck${userId ? `?userId=${encodeURIComponent(userId)}` : ''}`);
  }, [router, userId]);

  return null;
}
