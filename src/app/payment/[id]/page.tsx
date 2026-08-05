import { redirect } from 'next/navigation';

type Props = { params: Promise<{ id: string }> };

/** Compat: legacy payment detail under Tools (C5). */
export default async function PaymentDetailRedirectPage({ params }: Props) {
  const { id } = await params;
  redirect(`/tools/payment/${encodeURIComponent(id)}`);
}
