import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn(
        'animate-pulse rounded-lg bg-slate-200/80 motion-reduce:animate-none motion-reduce:bg-slate-200',
        className
      )}
      {...props}
    />
  );
}

export function PageSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-5', className)} role="status" aria-label="Loading">
      <div className="space-y-2 border-b border-slate-200/80 pb-5">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-64 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <CardGridSkeleton count={3} />
      <TableSkeleton rows={6} cols={5} />
    </div>
  );
}

export function TableSkeleton({
  rows = 6,
  cols = 5,
  className
}: {
  rows?: number;
  cols?: number;
  className?: string;
}) {
  return (
    <div
      className={cn('overflow-hidden rounded-2xl border border-slate-200 bg-white', className)}
      role="status"
      aria-label="Loading table"
    >
      <div
        className="hidden gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3 sm:grid"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={`h-${i}`} className="h-3 w-20" />
        ))}
      </div>
      <div className="divide-y divide-slate-100">
        {Array.from({ length: rows }).map((_, r) => (
          <div
            key={`r-${r}`}
            className="grid items-center gap-3 px-4 py-3.5"
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={`c-${r}-${c}`} className={cn('h-4', c === 0 ? 'w-10' : 'w-full max-w-[9rem]')} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function CardGridSkeleton({
  count = 4,
  className
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      className={cn('grid gap-3 sm:grid-cols-2 xl:grid-cols-4', className)}
      role="status"
      aria-label="Loading cards"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <Skeleton className="mb-4 size-10 rounded-2xl" />
          <Skeleton className="mb-2 h-4 w-32" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="mt-2 h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}

export function DetailSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-4', className)} role="status" aria-label="Loading details">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <Skeleton className="mb-3 h-4 w-40" />
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-full" />
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <Skeleton className="mb-3 h-4 w-32" />
        <Skeleton className="mb-2 h-3 w-full" />
        <Skeleton className="mb-2 h-3 w-5/6" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    </div>
  );
}
