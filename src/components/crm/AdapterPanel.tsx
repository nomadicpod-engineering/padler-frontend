'use client';

import Link from 'next/link';
import type { AdapterSnapshot } from '@/lib/types';
import { healthBadgeClass } from '@/lib/types';

type AdapterPanelProps = {
  title: string;
  snapshot?: AdapterSnapshot | null;
  toolsHref?: string;
  toolsLabel?: string;
  /** Extra summary lines shown above raw payload. */
  highlights?: Array<{ label: string; value: string }>;
  loading?: boolean;
};

function pickPreview(snapshot: AdapterSnapshot): Record<string, unknown> {
  const omit = new Set([
    'dependencyHealth',
    'errorCode',
    'errorMessage',
    'sourceSystem',
    'sourceFreshnessAt'
  ]);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(snapshot)) {
    if (omit.has(k)) continue;
    out[k] = v;
  }
  return out;
}

export function AdapterPanel({
  title,
  snapshot,
  toolsHref,
  toolsLabel = 'Open in Tools',
  highlights,
  loading
}: AdapterPanelProps) {
  const health = snapshot?.dependencyHealth ?? (loading ? '…' : 'UNCONFIGURED');
  const preview = snapshot ? pickPreview(snapshot) : {};
  const hasPreview = Object.keys(preview).length > 0;

  return (
    <section className="padler-panel">
      <div className="padler-compact-header" style={{ marginBottom: 12 }}>
        <h2 className="padler-panel-title" style={{ margin: 0 }}>
          {title}
        </h2>
        <span className={healthBadgeClass(typeof health === 'string' ? health : undefined)}>
          {String(health)}
        </span>
      </div>

      {loading ? <p className="padler-muted-copy">Loading…</p> : null}

      {!loading && snapshot?.errorMessage ? (
        <p className="padler-muted-copy" style={{ marginTop: 0 }}>
          {snapshot.errorCode ? `${snapshot.errorCode}: ` : ''}
          {snapshot.errorMessage}
        </p>
      ) : null}

      {!loading && snapshot?.sourceFreshnessAt ? (
        <p className="padler-muted-copy" style={{ marginTop: 0 }}>
          Freshness: {snapshot.sourceFreshnessAt}
          {snapshot.sourceSystem ? ` · ${snapshot.sourceSystem}` : ''}
        </p>
      ) : null}

      {highlights && highlights.length > 0 ? (
        <dl className="padler-kv">
          {highlights.map((h) => (
            <div key={h.label}>
              <dt>{h.label}</dt>
              <dd>{h.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {!loading && hasPreview ? (
        <pre className="padler-code-block">{JSON.stringify(preview, null, 2)}</pre>
      ) : null}

      {toolsHref ? (
        <p style={{ marginBottom: 0 }}>
          <Link href={toolsHref} className="padler-link">
            {toolsLabel}
          </Link>
        </p>
      ) : null}
    </section>
  );
}
