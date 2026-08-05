'use client';

import { PadlerShell } from '@/app/components/PadlerShell';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page';

export default function WalletPage() {
  return (
    <PadlerShell>
      <PageHeader
        eyebrow="Fix problems"
        title="Wallet"
        subtitle="Track payment and refund transactions linked to booking references."
      />
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-slate-500">
            Wallet transactions will render here once the wallet-service feed is connected.
          </p>
        </CardContent>
      </Card>
    </PadlerShell>
  );
}
