import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button } from './button';
import { CardGridSkeleton, DetailSkeleton, TableSkeleton } from './skeleton';

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
};

export function PageHeader({ eyebrow, title, subtitle, actions, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        'mb-6 flex flex-col gap-4 border-b border-slate-200/80 pb-5 sm:flex-row sm:items-end sm:justify-between',
        className
      )}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">{title}</h1>
        {subtitle ? <p className="mt-1 max-w-3xl text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

type EmptyStateProps = {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ title, message, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">{message}</p>
      {actionLabel && onAction ? (
        <Button className="mt-4" variant="primary" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}

type StatePanelProps = {
  kind: 'loading' | 'empty' | 'error' | 'forbidden';
  title?: string;
  message?: string;
  action?: ReactNode;
  /** Shape of the loading skeleton when kind is loading. */
  skeleton?: 'table' | 'detail' | 'cards';
};

const STATE_COPY: Record<Exclude<StatePanelProps['kind'], 'loading'>, { title: string; message: string }> = {
  empty: { title: 'Nothing here yet', message: 'No records match this view.' },
  error: { title: 'Something went wrong', message: 'Unable to load data. Try again.' },
  forbidden: {
    title: 'You do not have access',
    message: 'Your role cannot open this screen. Ask a lead if you need help.'
  }
};

export function StatePanel({ kind, title, message, action, skeleton = 'table' }: StatePanelProps) {
  if (kind === 'loading') {
    if (skeleton === 'detail') return <DetailSkeleton />;
    if (skeleton === 'cards') return <CardGridSkeleton />;
    return <TableSkeleton />;
  }
  const defaults = STATE_COPY[kind];
  return (
    <div
      className={cn(
        'rounded-2xl border px-5 py-6',
        kind === 'error' || kind === 'forbidden'
          ? 'border-red-200 bg-red-50 text-red-900'
          : 'border-slate-200 bg-white text-slate-800'
      )}
      role="status"
    >
      <div className="text-sm font-semibold">{title ?? defaults.title}</div>
      <p className="mt-1 text-sm opacity-80">{message ?? defaults.message}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

type FilterBarProps = {
  children: ReactNode;
  className?: string;
  onSubmit?: React.FormEventHandler<HTMLFormElement>;
};

export function FilterBar({ children, className, onSubmit }: FilterBarProps) {
  return (
    <form
      className={cn(
        'mb-5 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm',
        className
      )}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.(event);
      }}
    >
      {children}
    </form>
  );
}

type ListSearchProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  hint?: string;
};

export function ListSearch({ value, onChange, placeholder, hint }: ListSearchProps) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <input
        className="min-h-10 min-w-[220px] flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm shadow-sm outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
      {hint ? <span className="text-sm text-slate-500">{hint}</span> : null}
    </div>
  );
}

type PaginationProps = {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};

export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;
  return (
    <div className="mt-4 flex items-center gap-3">
      <Button variant="secondary" disabled={page <= 0} onClick={() => onPageChange(page - 1)}>
        Previous
      </Button>
      <span className="text-sm text-slate-500">
        Page {page + 1} of {totalPages}
      </span>
      <Button
        variant="secondary"
        disabled={page + 1 >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        Next
      </Button>
    </div>
  );
}
