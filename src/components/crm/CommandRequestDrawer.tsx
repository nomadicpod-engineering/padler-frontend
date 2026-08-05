'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { CommandDefinition, CommandRequestResult } from '@/lib/types';
import { listCommands, requestCommandExecution } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { FieldHint, FieldLabel, Select, Textarea } from '@/components/ui/field';
import { DetailSkeleton } from '@/components/ui/skeleton';
import { DrawerSection, SideDrawer } from '@/components/ui/side-drawer';
import { StatusBadge } from '@/components/ui/badge';

function newIdempotencyKey(commandKey: string): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${commandKey}:${rand}`;
}

type CommandRequestDrawerProps = {
  open: boolean;
  /** Optional — customer-only requests omit case linkage. */
  caseNumber?: string;
  customerUserId?: string;
  busy?: boolean;
  onClose: () => void;
  onSubmitted?: (result: CommandRequestResult) => void;
};

export function CommandRequestDrawer({
  open,
  caseNumber,
  customerUserId,
  busy,
  onClose,
  onSubmitted
}: CommandRequestDrawerProps) {
  const [commands, setCommands] = useState<CommandDefinition[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [commandKey, setCommandKey] = useState('');
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<CommandRequestResult | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      setLastResult(null);
      setSubmitError(null);
      setReason('');
      setNote('');
      try {
        const defs = await listCommands({ uiSafeOnly: true });
        if (cancelled) return;
        setCommands(defs);
        if (defs.length > 0) setCommandKey(defs[0].commandKey);
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Unable to load commands');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const selected = useMemo(
    () => commands.find((c) => c.commandKey === commandKey) ?? null,
    [commands, commandKey]
  );

  const needsNote = commandKey === 'CASE_ADD_INTERNAL_NOTE';

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!commandKey) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload: Record<string, unknown> | undefined = needsNote
        ? { note: note.trim() }
        : undefined;
      if (needsNote && !note.trim()) {
        throw new Error('Note is required for CASE_ADD_INTERNAL_NOTE');
      }
      const result = await requestCommandExecution({
        commandKey,
        idempotencyKey: newIdempotencyKey(commandKey),
        caseNumber: caseNumber?.trim() || undefined,
        customerUserId: customerUserId || undefined,
        payload,
        reason: reason.trim() || undefined
      });
      setLastResult(result);
      onSubmitted?.(result);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setSubmitting(false);
    }
  };

  const description = [
    caseNumber ? `Case ${caseNumber}` : 'No case linked',
    customerUserId ? `customer ${customerUserId}` : null
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <SideDrawer
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title="Request action"
      description={`${description}. Only enabled R0–R2 commands are listed.`}
      width="md"
      footer={
        lastResult ? (
          <Button type="button" variant="secondary" onClick={onClose}>
            Done
          </Button>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="primary"
              disabled={busy || submitting || loading || !commandKey}
              onClick={() => void submit()}
            >
              {submitting
                ? 'Submitting…'
                : selected?.requiresApproval
                  ? 'Submit for approval'
                  : 'Execute'}
            </Button>
            <Button type="button" variant="ghost" disabled={submitting} onClick={onClose}>
              Cancel
            </Button>
          </div>
        )
      }
    >
      <div className="space-y-4">
        {loadError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
            {loadError}
          </div>
        ) : null}
        {submitError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
            {submitError}
          </div>
        ) : null}

        {loading ? <DetailSkeleton /> : null}

        {lastResult ? (
          <DrawerSection title={`Outcome: ${lastResult.outcome}`}>
            <div className="space-y-2 text-sm text-slate-700">
              {lastResult.approval?.approvalNumber ? (
                <p>
                  Approval{' '}
                  <Link className="font-medium text-blue-700 underline-offset-2 hover:underline" href="/approvals">
                    {lastResult.approval.approvalNumber}
                  </Link>{' '}
                  <StatusBadge status={lastResult.approval.status ?? 'PENDING'} />
                </p>
              ) : null}
              {lastResult.execution?.executionNumber ? (
                <p>
                  Execution{' '}
                  <Link
                    className="font-medium text-blue-700 underline-offset-2 hover:underline"
                    href={`/actions/runs/${encodeURIComponent(lastResult.execution.executionNumber)}`}
                  >
                    {lastResult.execution.executionNumber}
                  </Link>{' '}
                  · {lastResult.execution.status ?? '—'}
                </p>
              ) : null}
            </div>
          </DrawerSection>
        ) : !loading ? (
          <form onSubmit={(e) => void submit(e)} className="space-y-4">
            <DrawerSection title="Command">
              <div className="grid gap-3">
                <FieldLabel>
                  Command
                  <Select
                    value={commandKey}
                    onChange={(e) => setCommandKey(e.target.value)}
                    disabled={busy || submitting || commands.length === 0}
                    required
                  >
                    {commands.map((c) => (
                      <option key={c.commandKey} value={c.commandKey}>
                        {c.displayName ?? c.commandKey} ({c.riskClass}
                        {c.requiresApproval ? ' · approval' : ''})
                      </option>
                    ))}
                  </Select>
                </FieldLabel>
                {selected?.description ? <FieldHint>{selected.description}</FieldHint> : null}
                {needsNote ? (
                  <FieldLabel>
                    Internal note
                    <Textarea
                      rows={3}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      disabled={busy || submitting}
                      required
                    />
                  </FieldLabel>
                ) : null}
                <FieldLabel>
                  Reason (optional)
                  <Textarea
                    rows={2}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    disabled={busy || submitting}
                    placeholder="Why this action?"
                  />
                </FieldLabel>
              </div>
            </DrawerSection>
          </form>
        ) : null}
      </div>
    </SideDrawer>
  );
}
