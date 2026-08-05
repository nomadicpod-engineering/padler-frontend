'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { createCase } from '@/lib/api';
import type { CaseDetail } from '@/lib/types';
import { CASE_PRIORITIES, PADLER_QUEUES } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { FieldLabel, Input, Select, Textarea } from '@/components/ui/field';
import { DrawerSection, SideDrawer } from '@/components/ui/side-drawer';

type CreateCaseDrawerProps = {
  open: boolean;
  customerUserId?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerName?: string;
  onClose: () => void;
  onCreated?: (detail: CaseDetail) => void;
};

export function CreateCaseDrawer({
  open,
  customerUserId,
  customerEmail,
  customerPhone,
  customerName,
  onClose,
  onCreated
}: CreateCaseDrawerProps) {
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [queueKey, setQueueKey] = useState<string>(PADLER_QUEUES[0].key);
  const [priority, setPriority] = useState<string>('P3');
  const [email, setEmail] = useState(customerEmail ?? '');
  const [phone, setPhone] = useState(customerPhone ?? '');
  const [name, setName] = useState(customerName ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CaseDetail | null>(null);

  useEffect(() => {
    if (!open) return;
    setSubject('');
    setDescription('');
    setQueueKey(PADLER_QUEUES[0].key);
    setPriority('P3');
    setEmail(customerEmail ?? '');
    setPhone(customerPhone ?? '');
    setName(customerName ?? '');
    setError(null);
    setCreated(null);
  }, [open, customerEmail, customerPhone, customerName]);

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const detail = await createCase({
        subject: subject.trim(),
        description: description.trim(),
        queueKey,
        priority,
        customerUserId: customerUserId?.trim() || undefined,
        customerEmail: email.trim() || undefined,
        customerPhone: phone.trim() || undefined,
        customerName: name.trim() || undefined
      });
      setCreated(detail);
      onCreated?.(detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create case');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SideDrawer
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title="Create case"
      description={
        customerUserId
          ? `Prefills customer ${customerUserId}`
          : 'Open a new care case with queue and priority.'
      }
      width="md"
      footer={
        created?.caseNumber ? (
          <Button type="button" variant="secondary" onClick={onClose}>
            Done
          </Button>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="primary"
              disabled={submitting || !subject.trim() || !description.trim()}
              onClick={() => void submit()}
            >
              {submitting ? 'Creating…' : 'Create case'}
            </Button>
            <Button type="button" variant="ghost" disabled={submitting} onClick={onClose}>
              Cancel
            </Button>
          </div>
        )
      }
    >
      <div className="space-y-4">
        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
            {error}
          </div>
        ) : null}

        {created?.caseNumber ? (
          <DrawerSection title={`Created ${created.caseNumber}`}>
            <p className="text-sm text-slate-600">
              <Link
                className="font-medium text-blue-700 underline-offset-2 hover:underline"
                href={`/cases/${encodeURIComponent(created.caseNumber)}`}
              >
                Open issue workspace
              </Link>
            </p>
          </DrawerSection>
        ) : (
          <form
            id="create-case-form"
            onSubmit={(e) => void submit(e)}
            className="space-y-4"
          >
            <DrawerSection title="Case details">
              <div className="grid gap-3">
                <FieldLabel>
                  Subject
                  <Input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    required
                    maxLength={240}
                    disabled={submitting}
                  />
                </FieldLabel>
                <FieldLabel>
                  Description
                  <Textarea
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                    maxLength={4000}
                    disabled={submitting}
                  />
                </FieldLabel>
                <FieldLabel>
                  Queue
                  <Select value={queueKey} onChange={(e) => setQueueKey(e.target.value)} disabled={submitting}>
                    {PADLER_QUEUES.map((q) => (
                      <option key={q.key} value={q.key}>
                        {q.label}
                      </option>
                    ))}
                  </Select>
                </FieldLabel>
                <FieldLabel>
                  Priority
                  <Select value={priority} onChange={(e) => setPriority(e.target.value)} disabled={submitting}>
                    {CASE_PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </Select>
                </FieldLabel>
              </div>
            </DrawerSection>

            <DrawerSection title="Customer" description="Optional contact details for this case.">
              <div className="grid gap-3">
                <FieldLabel>
                  Customer name
                  <Input value={name} onChange={(e) => setName(e.target.value)} disabled={submitting} />
                </FieldLabel>
                <FieldLabel>
                  Email
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={submitting}
                  />
                </FieldLabel>
                <FieldLabel>
                  Phone
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} disabled={submitting} />
                </FieldLabel>
              </div>
            </DrawerSection>
          </form>
        )}
      </div>
    </SideDrawer>
  );
}
