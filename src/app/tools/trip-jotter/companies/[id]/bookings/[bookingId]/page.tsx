'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PadlerShell } from '@/app/components/PadlerShell';
import { TripJotterCompanyShell } from '@/components/tripjotter/TripJotterCompanyShell';

/**
 * Detail reuses the legacy booking detail route, loading by booking id
 * (allCompanies) so company email is not required.
 */
export default function TripJotterCompanyBookingDetailPage() {
  const params = useParams();
  const search = useSearchParams();
  const router = useRouter();
  const companyId = String(params?.id ?? '');
  const bookingId = String(params?.bookingId ?? '');
  const email = search?.get('email') ?? search?.get('transportCompanyEmail') ?? '';

  useEffect(() => {
    if (!bookingId) return;
    const q = new URLSearchParams();
    q.set('allCompanies', 'true');
    if (email.trim()) {
      q.set('transportCompanyEmail', email.trim());
    }
    q.set(
      'returnTo',
      `/tools/trip-jotter/companies/${encodeURIComponent(companyId)}/bookings`
    );
    router.replace(`/tools/bookings/${encodeURIComponent(bookingId)}?${q.toString()}`);
  }, [bookingId, companyId, email, router]);

  return (
    <PadlerShell>
      <div className="padler-page">
        <TripJotterCompanyShell>
          <p className="padler-muted-copy">Opening booking detail…</p>
          <Link className="padler-link" href={`/tools/trip-jotter/companies/${companyId}/bookings`}>
            Back to bookings
          </Link>
        </TripJotterCompanyShell>
      </div>
    </PadlerShell>
  );
}
