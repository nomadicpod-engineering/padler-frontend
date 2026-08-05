import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[.98]',
  {
    variants: {
      variant: {
        primary: 'bg-blue-700 text-white shadow-sm hover:bg-blue-800 hover:shadow-md',
        secondary: 'border border-slate-200 bg-white text-slate-800 hover:bg-slate-50',
        ghost: 'text-slate-700 hover:bg-slate-100',
        danger: 'bg-red-600 text-white hover:bg-red-700',
        link: 'h-auto min-h-0 px-0 text-blue-700 underline-offset-4 hover:underline'
      },
      size: {
        sm: 'min-h-8 rounded-lg px-3 text-xs',
        md: 'min-h-10 px-4',
        lg: 'min-h-12 px-5 text-base',
        icon: 'size-10 px-0'
      }
    },
    defaultVariants: { variant: 'secondary', size: 'md' }
  }
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({ className, variant, size, asChild, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button';
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export { buttonVariants };
