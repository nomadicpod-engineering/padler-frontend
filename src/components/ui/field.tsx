import type {
  InputHTMLAttributes,
  LabelHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes
} from 'react';
import { cn } from '@/lib/utils';

export function FieldLabel({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn('grid gap-1.5 text-sm font-medium text-slate-700', className)}
      {...props}
    />
  );
}

const controlClass =
  'min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm outline-none transition duration-200 placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-600 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500';

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(controlClass, className)} {...props} />;
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(controlClass, className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(controlClass, 'min-h-24 resize-y', className)} {...props} />;
}

export function FieldHint({
  className,
  error,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement> & { error?: boolean }) {
  return (
    <p
      className={cn('text-xs text-slate-500', error && 'text-red-600', className)}
      aria-live={error ? 'polite' : undefined}
      {...props}
    />
  );
}
