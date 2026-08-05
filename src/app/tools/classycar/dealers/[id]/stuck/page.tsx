'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ClassycarDealerStuckRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/tools/classycar/stuck');
  }, [router]);
  return null;
}
