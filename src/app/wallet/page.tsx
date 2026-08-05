import { redirect } from 'next/navigation';

/** Compat: legacy wallet under Tools (C5). */
export default function WalletRedirectPage() {
  redirect('/tools/wallet');
}
