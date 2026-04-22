import { PadlerShell } from '@/app/components/PadlerShell';

export default function AuditLogPage() {
  return (
    <PadlerShell>
      <div className="padler-page">
        <h1 className="padler-section-title">Audit Log</h1>
        <div className="padler-section-subtitle">
          Immutable record of admin booking actions across sources.
        </div>
        <div className="padler-panel">
          <p style={{ margin: 0, color: 'var(--padler-ink-muted)' }}>
            Events streamed from the padler audit topic will appear here.
          </p>
        </div>
      </div>
    </PadlerShell>
  );
}
