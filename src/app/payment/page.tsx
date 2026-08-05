import { redirect } from 'next/navigation';

/** Compat: legacy payments under Tools (C5). */
export default function PaymentRedirectPage() {
  redirect('/tools/payment');
}
