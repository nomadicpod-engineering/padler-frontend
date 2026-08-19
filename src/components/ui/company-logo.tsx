'use client';

import { useState } from 'react';

type CompanyLogoProps = {
  logoUrl?: string;
  name?: string;
  size?: 'sm' | 'md';
  className?: string;
};

function companyInitials(name?: string): string {
  const raw = (name ?? '').trim();
  if (!raw) return '?';
  return (
    raw
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase() ?? '')
      .join('') || '?'
  );
}

const sizeClasses = {
  sm: {
    box: 'h-8 w-8 text-xs',
    img: 'max-h-8 max-w-[72px]'
  },
  md: {
    box: 'h-10 w-10 text-sm',
    img: 'max-h-10 max-w-[96px]'
  }
} as const;

export function CompanyLogo({ logoUrl, name, size = 'sm', className = '' }: CompanyLogoProps) {
  const [failed, setFailed] = useState(false);
  const trimmed = logoUrl?.trim();
  const classes = sizeClasses[size];

  if (trimmed && !failed) {
    return (
      <img
        src={trimmed}
        alt={name ? `${name} logo` : ''}
        className={`shrink-0 object-contain ${classes.img} ${className}`}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 font-semibold text-slate-600 ${classes.box} ${className}`}
      aria-hidden={!name}
      title={name}
    >
      {companyInitials(name)}
    </div>
  );
}
