import { redirect } from 'next/navigation';

/** Compat: legacy dashboard now lives under Tools (C5). */
export default function DashboardRedirectPage() {
  redirect('/tools/dashboard');
}
