import { redirect } from 'next/navigation';

/** Compat: legacy bookings list under Tools (C5). */
export default function BookingsRedirectPage() {
  redirect('/tools/bookings');
}
