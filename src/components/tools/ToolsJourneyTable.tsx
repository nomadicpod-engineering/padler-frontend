'use client';

import Link from 'next/link';
import type { ToolsUsageStep } from '@/lib/api/tools-shared';
import { Button } from '@/components/ui/button';
import { serialNumber } from '@/components/ui/data-table';

type Props = {
  steps: ToolsUsageStep[];
  basePath?: string;
  onAction?: (step: ToolsUsageStep, action: string) => void;
  actionBusy?: string | null;
};

export function ToolsJourneyTable({ steps, basePath, onAction, actionBusy }: Props) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
      <table className="min-w-full border-collapse whitespace-nowrap text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="whitespace-nowrap px-4 py-3 font-semibold">S/N</th>
            <th className="whitespace-nowrap px-4 py-3 font-semibold">Step</th>
            <th className="whitespace-nowrap px-4 py-3 font-semibold">Status</th>
            <th className="whitespace-nowrap px-4 py-3 font-semibold">Count</th>
            <th className="whitespace-nowrap px-4 py-3 font-semibold">Note</th>
            <th className="whitespace-nowrap px-4 py-3 font-semibold" />
          </tr>
        </thead>
        <tbody>
          {steps.map((step, index) => (
            <tr key={step.key} className="border-t border-slate-100">
              <td className="px-4 py-3 tabular-nums text-slate-500">{serialNumber(index)}</td>
              <td className="px-4 py-3">
                <strong>{step.label}</strong>
              </td>
              <td className="px-4 py-3">{step.status ?? '—'}</td>
              <td className="px-4 py-3">
                <code>{step.count != null ? String(step.count) : '—'}</code>
              </td>
              <td className="px-4 py-3 text-slate-500">{step.errorMessage ?? '—'}</td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  {step.featurePath ? (
                    <Link
                      className="text-sm font-semibold text-blue-700 hover:underline"
                      href={
                        step.featurePath.startsWith('/')
                          ? step.featurePath
                          : `${basePath ?? ''}/${step.featurePath}`
                      }
                    >
                      Open
                    </Link>
                  ) : null}
                  {(step.actions ?? []).map((action) => (
                    <Button
                      key={action}
                      type="button"
                      size="sm"
                      disabled={actionBusy != null}
                      onClick={() => onAction?.(step, action)}
                    >
                      {actionBusy === action ? '…' : action.replace(/_/g, ' ')}
                    </Button>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
