'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { FieldLabel, Textarea } from '@/components/ui/field';
import { DrawerSection, SideDrawer } from '@/components/ui/side-drawer';
import { StatusBadge } from '@/components/ui/badge';
import type { ApprovalSummary } from '@/lib/types';

type ApprovalDrawerProps = {
  open: boolean;
  approval: ApprovalSummary | null;
  canDecide: boolean;
  busy?: boolean;
  onClose: () => void;
  onApprove: (note: string) => void;
  onReject: (note: string) => void;
};

function Kv({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-slate-100 py-2.5 last:border-b-0 sm:grid-cols-[130px_1fr]">
      <dt className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-400">{label}</dt>
      <dd className="text-sm text-slate-900">{value ?? '—'}</dd>
    </div>
  );
}

export function ApprovalDrawer({
  open,
  approval,
  canDecide,
  busy,
  onClose,
  onApprove,
  onReject
}: ApprovalDrawerProps) {
  const [note, setNote] = useState('');

  useEffect(() => {
    if (open) setNote('');
  }, [open, approval?.approvalNumber]);

  const canAct = Boolean(canDecide && approval?.status === 'PENDING');

  return (
    <SideDrawer
      open={open && Boolean(approval)}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={approval?.approvalNumber ?? 'Approval'}
      description="Review the request and approve or reject when you are the checker."
      width="md"
      footer={
        canAct ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="primary"
              disabled={busy}
              onClick={() => onApprove(note)}
            >
              {busy ? 'Working…' : 'Approve & execute'}
            </Button>
            <Button type="button" variant="danger" disabled={busy} onClick={() => onReject(note)}>
              Reject
            </Button>
            <Button type="button" variant="ghost" disabled={busy} onClick={onClose}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button type="button" variant="secondary" onClick={onClose}>
            Close
          </Button>
        )
      }
    >
      {approval ? (
        <div className="space-y-4">
          <DrawerSection title="Request">
            <dl>
              <Kv label="Command" value={approval.commandKey} />
              <Kv label="Risk" value={approval.riskClass} />
              <Kv label="Status" value={<StatusBadge status={approval.status} />} />
              <Kv label="Maker" value={approval.makerEmail ?? approval.makerPadlerId} />
              <Kv
                label="Case"
                value={
                  approval.caseNumber ? (
                    <Link
                      className="font-medium text-blue-700 underline-offset-2 hover:underline"
                      href={`/cases/${encodeURIComponent(approval.caseNumber)}`}
                    >
                      {approval.caseNumber}
                    </Link>
                  ) : undefined
                }
              />
              <Kv
                label="Customer"
                value={
                  approval.customerUserId ? (
                    <Link
                      className="font-medium text-blue-700 underline-offset-2 hover:underline"
                      href={`/customers/${encodeURIComponent(approval.customerUserId)}`}
                    >
                      {approval.customerUserId}
                    </Link>
                  ) : undefined
                }
              />
              <Kv label="Reason" value={approval.reason} />
              {approval.decisionNote ? <Kv label="Decision note" value={approval.decisionNote} /> : null}
            </dl>
          </DrawerSection>

          {canAct ? (
            <DrawerSection title="Decision" description="Optional note recorded with approve or reject.">
              <FieldLabel>
                Decision note
                <Textarea
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Optional note"
                  disabled={busy}
                />
              </FieldLabel>
            </DrawerSection>
          ) : null}
        </div>
      ) : null}
    </SideDrawer>
  );
}
