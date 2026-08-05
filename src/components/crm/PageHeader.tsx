'use client';

import type { ReactNode } from 'react';

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
};

export function PageHeader({ eyebrow, title, subtitle, actions }: PageHeaderProps) {
  return (
    <header className="padler-compact-header">
      <div>
        {eyebrow ? <p className="padler-eyebrow">{eyebrow}</p> : null}
        <h1 className="padler-section-title">{title}</h1>
        {subtitle ? <p className="padler-section-subtitle padler-section-subtitle--flush">{subtitle}</p> : null}
      </div>
      {actions ? <div className="padler-btn-row">{actions}</div> : null}
    </header>
  );
}
