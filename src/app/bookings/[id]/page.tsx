import { redirect } from 'next/navigation';

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Compat: legacy booking detail under Tools (C5). */
export default async function BookingDetailRedirectPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (Array.isArray(value)) value.forEach((v) => q.append(key, v));
    else if (value != null) q.set(key, value);
  }
  const suffix = q.toString() ? `?${q.toString()}` : '';
  redirect(`/tools/bookings/${encodeURIComponent(id)}${suffix}`);
}
