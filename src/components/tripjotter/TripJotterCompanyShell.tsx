'use client';

import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { ReactNode, useMemo } from 'react';
import { Button } from '@/components/ui/button';

const FEATURES = [
  { slug: '', label: 'Journey' },
  { slug: 'users', label: 'Users' },
  { slug: 'terminals', label: 'Terminals' },
  { slug: 'routes', label: 'Routes' },
  { slug: 'vehicles', label: 'Vehicles' },
  { slug: 'trips', label: 'Trips' },
  { slug: 'bookings', label: 'Bookings' }
] as const;

type TripJotterCompanyShellProps = {
  companyLabel?: string;
  children: ReactNode;
};

export function TripJotterCompanyShell({ companyLabel, children }: TripJotterCompanyShellProps) {
  const params = useParams();
  const pathname = usePathname();
  const companyId = String(params?.id ?? '');

  const base = `/tools/trip-jotter/companies/${encodeURIComponent(companyId)}`;

  const activeSlug = useMemo(() => {
    const rest = pathname?.replace(base, '') ?? '';
    if (!rest || rest === '/') return '';
    return rest.replace(/^\//, '').split('/')[0] ?? '';
  }, [pathname, base]);

  return (
    <div>
      <nav className="mb-3 text-sm text-slate-500" aria-label="Breadcrumb">
        <Link href="/tools" className="font-semibold text-blue-700 hover:underline">
          Tools
        </Link>
        {' / '}
        <Link href="/tools/trip-jotter" className="font-semibold text-blue-700 hover:underline">
          Trip Jotter
        </Link>
        {' / '}
        <Link href="/tools/trip-jotter/companies" className="font-semibold text-blue-700 hover:underline">
          Companies
        </Link>
        {' / '}
        <span className="text-slate-700">{companyLabel?.trim() || companyId}</span>
      </nav>

      <div className="mb-4 flex flex-wrap gap-2">
        {FEATURES.map((f) => {
          const href = f.slug ? `${base}/${f.slug}` : base;
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
