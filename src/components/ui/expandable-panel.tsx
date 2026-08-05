'use client';

import * as Collapsible from '@radix-ui/react-collapsible';
import { ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type ExpandablePanelProps = {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
};

export function ExpandablePanel({
  title,
  description,
  defaultOpen = false,
  children,
  className
}: ExpandablePanelProps) {
  return (
    <Collapsible.Root
      defaultOpen={defaultOpen}
      className={cn('overflow-hidden rounded-2xl border border-slate-200 bg-white', className)}
    >
      <Collapsible.Trigger className="group flex w-full items-start justify-between gap-3 px-5 py-4 text-left transition hover:bg-slate-50">
        <div>
          <div className="text-sm font-semibold text-slate-950">{title}</div>
          {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
        </div>
        <ChevronDown
          size={18}
          className="mt-0.5 shrink-0 text-slate-400 transition-transform duration-200 group-data-[state=open]:rotate-180"
        />
      </Collapsible.Trigger>
      <Collapsible.Content className="overflow-hidden data-[state=closed]:animate-collapse-up data-[state=open]:animate-collapse-down">
        <div className="border-t border-slate-200 px-5 py-4">{children}</div>
      </Collapsible.Content>
    </Collapsible.Root>
  );
}
