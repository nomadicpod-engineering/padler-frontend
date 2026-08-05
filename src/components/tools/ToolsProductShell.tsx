'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode, useMemo } from 'react';
import { Button } from '@/components/ui/button';

export type ToolsNavItem = { slug: string; label: string };

type Props = {
  productLabel: string;
  productHref: string;
  listLabel: string;
  listHref: string;
  entityLabel?: string;
  basePath: string;
  features: readonly ToolsNavItem[];
  children: ReactNode;
};

export function ToolsProductShell({
  productLabel,
  productHref,
  listLabel,
  listHref,
  entityLabel,
  basePath,
  features,
  children
}: Props) {
  const pathname = usePathname();

  const activeSlug = useMemo(() => {
    const rest = pathname?.replace(basePath, '') ?? '';
    if (!rest || rest === '/') return '';
    return rest.replace(/^\//, '').split('/')[0] ?? '';
  }, [pathname, basePath]);

  return (
    <div>
      <nav className="mb-3 text-sm text-slate-500" aria-label="Breadcrumb">
        <Link href="/tools" className="font-semibold text-blue-700 hover:underline">
          Tools
        </Link>
        {' / '}
        <Link href={productHref} className="font-semibold text-blue-700 hover:underline">
          {productLabel}
        </Link>
        {' / '}
        <Link href={listHref} className="font-semibold text-blue-700 hover:underline">
          {listLabel}
        </Link>
        {entityLabel ? (
          <>
            {' / '}
            <span className="text-slate-700">{entityLabel}</span>
          </>
        ) : null}
      </nav>

      <div className="mb-4 flex flex-wrap gap-2">
        {features.map((f) => {
          const href = f.slug ? `${basePath}/${f.slug}` : basePath;
          const active = activeSlug === f.slug;
          return (
            <Button key={f.slug || 'journey'} variant={active ? 'primary' : 'secondary'} size="sm" asChild>
              <Link href={href}>{f.label}</Link>
            </Button>
          );
        })}
      </div>

      {children}
    </div>
  );
}
