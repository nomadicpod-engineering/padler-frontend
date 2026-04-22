import { PadlerShell } from '@/app/components/PadlerShell';

export default function WalletPage() {
  return (
    <PadlerShell>
      <div className="padler-page">
        <h1 className="padler-section-title">Wallet</h1>
        <div className="padler-section-subtitle">
          Track payment and refund transactions linked to booking references.
        </div>
        <div className="padler-panel">
          <p style={{ margin: 0, color: 'var(--padler-ink-muted)' }}>
            Wallet transactions will render here once the wallet-service feed is connected.
          </p>
        </div>
      </div>
    </PadlerShell>
  );
}
