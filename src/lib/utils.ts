import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDateTime(raw?: string | null): string {
  if (!raw?.trim()) return '—';
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  const date = parsed.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
  const time = parsed
    .toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
    .toLowerCase();
  return `${date} ${time}`;
}

export function formatDate(raw?: string | null): string {
  if (!raw?.trim()) return '—';
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
}

export function formatMoney(amount?: number | null, currency = 'NGN'): string {
  if (amount == null || !Number.isFinite(amount)) return '—';
  try {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: currency || 'NGN',
      maximumFractionDigits: 2
    }).format(amount);
  } catch {
    return `${currency || 'NGN'} ${amount.toLocaleString()}`;
  }
}

export type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export function formatStatusLabel(status?: string | null): string {
  const raw = (status ?? 'Unknown').trim();
  if (!raw) return 'Unknown';
  return raw.toUpperCase().replace(/_/g, ' ');
}

export function statusTone(status?: string | null): StatusTone {
  const normalized = (status ?? 'Unknown').toUpperCase();
  if (
    ['DONE', 'COMPLETED', 'SUCCESSFUL', 'RESOLVED', 'CLOSED', 'ACTIVE', 'SUCCEEDED', 'RECONCILED', 'VERIFIED'].includes(
      normalized
    )
  ) {
    return 'success';
  }
  if (['ERROR', 'FAILED', 'REOPENED', 'BLOCKED', 'CANCELLED', 'REJECTED'].includes(normalized)) {
    return 'danger';
  }
  if (
    [
      'PENDING',
      'CURRENT',
      'WAITING_CUSTOMER',
      'WAITING_SERVICE',
      'WAITING_APPROVAL',
      'IN_PROGRESS',
      'TRIAGED',
      'OPEN',
      'NEW',
      'UNKNOWN'
    ].includes(normalized)
  ) {
    return 'warning';
  }
  return 'info';
}
