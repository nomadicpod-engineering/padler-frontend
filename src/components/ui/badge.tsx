import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';
import { cn, formatStatusLabel, statusTone } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold',
  {
    variants: {
      tone: {
        neutral: 'border-slate-200 bg-slate-50 text-slate-700',
        info: 'border-blue-200 bg-blue-50 text-blue-800',
        success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
        warning: 'border-amber-200 bg-amber-50 text-amber-900',
        danger: 'border-red-200 bg-red-50 text-red-800'
      }
    },
    defaultVariants: { tone: 'neutral' }
  }
);

export function Badge({
  className,
  tone,
  ...props
}: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

export function StatusBadge({ status }: { status?: string | null }) {
  return <Badge tone={statusTone(status)}>{formatStatusLabel(status)}</Badge>;
}
