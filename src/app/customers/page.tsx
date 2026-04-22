import { PadlerShell } from '@/app/components/PadlerShell';

export default function CustomersPage() {
  return (
    <PadlerShell>
      <div className="padler-page">
        <h1 className="padler-section-title">Customers</h1>
        <div className="padler-section-subtitle">
          Customer summaries sourced from user-service and user-detail-service.
        </div>
        <div className="padler-panel">
          <p style={{ margin: 0, color: 'var(--padler-ink-muted)' }}>
            A searchable roster with booking history and wallet balance will load here.
          </p>
        </div>
      </div>
    </PadlerShell>
  );
}
