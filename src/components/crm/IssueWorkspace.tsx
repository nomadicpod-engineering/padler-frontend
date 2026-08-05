'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { CommandRequestDrawer } from '@/components/crm/CommandRequestDrawer';
import { CrmTabs } from '@/components/crm/CrmTabs';
import { PageHeader } from '@/components/ui/page';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type {
  CaseAttachment,
  CaseDetail,
  CasePriority,
  CaseTask,
  CommandExecution,
  KnowledgeRunbook,
  TaskStatus,
  TimelineItem
} from '@/lib/types';
import {
  CASE_LINK_TYPES,
  CASE_PRIORITIES,
  CASE_STATUSES,
  PADLER_QUEUES,
  TASK_STATUSES
} from '@/lib/types';
import { formatDateTime } from '@/lib/utils';


type IssueWorkspaceProps = {
  detail: CaseDetail;
  timeline: TimelineItem[];
  tasks: CaseTask[];
  attachments: CaseAttachment[];
  runbook: KnowledgeRunbook | null;
  executions?: CommandExecution[];
  canManage: boolean;
  canRequestCommands?: boolean;
  busy?: boolean;
  onUpdateFields: (body: Record<string, unknown>) => Promise<void>;
  onAddNote: (body: string, internal: boolean) => Promise<void>;
  onEscalate: (reason: string, targetQueueKey?: string) => Promise<void>;
  onCreateTask: (body: { title: string; description?: string }) => Promise<void>;
  onUpdateTask: (taskId: number, body: { status?: TaskStatus | string }) => Promise<void>;
  onRegisterAttachment: (body: { fileName: string; storageKey: string; contentType?: string }) => Promise<void>;
  onLinkCase: (body: { targetCaseNumber: string; linkType: string }) => Promise<void>;
  onMergeCase: (body: { survivorCaseNumber: string; reason?: string }) => Promise<void>;
  onCommandRequested?: () => void;
};

export function IssueWorkspace({
  detail,
  timeline,
  tasks,
  attachments,
  runbook,
  executions = [],
  canManage,
  canRequestCommands = false,
  busy,
  onUpdateFields,
  onAddNote,
  onEscalate,
  onCreateTask,
  onUpdateTask,
  onRegisterAttachment,
  onLinkCase,
  onMergeCase,
  onCommandRequested
}: IssueWorkspaceProps) {
  const [tab, setTab] = useState('summary');
  const [commandOpen, setCommandOpen] = useState(false);  const [note, setNote] = useState('');
  const [internal, setInternal] = useState(true);
  const [status, setStatus] = useState(String(detail.status ?? 'NEW'));
  const [priority, setPriority] = useState(String(detail.priority ?? 'P3'));
  const [queueKey, setQueueKey] = useState(detail.queueKey ?? '');
  const [assignee, setAssignee] = useState(detail.assigneePadlerId ?? '');
  const [escalateReason, setEscalateReason] = useState('');
  const [escalateQueue, setEscalateQueue] = useState(detail.queueKey ?? '');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [attachName, setAttachName] = useState('');
  const [attachKey, setAttachKey] = useState('');
  const [linkTarget, setLinkTarget] = useState('');
  const [linkType, setLinkType] = useState('RELATED');
  const [mergeSurvivor, setMergeSurvivor] = useState('');
  const [mergeReason, setMergeReason] = useState('');

  useEffect(() => {
    setStatus(String(detail.status ?? 'NEW'));
    setPriority(String(detail.priority ?? 'P3'));
    setQueueKey(detail.queueKey ?? '');
    setAssignee(detail.assigneePadlerId ?? '');
    setEscalateQueue(detail.queueKey ?? '');
  }, [detail]);

  const tabs = useMemo(
    () => [
      { id: 'summary', label: 'Summary' },
      { id: 'timeline', label: 'Timeline', count: timeline.length },
      { id: 'tasks', label: 'Tasks', count: tasks.length },
      { id: 'notes', label: 'Notes', count: detail.interactions?.length ?? 0 },
      { id: 'attachments', label: 'Attachments', count: attachments.length },
      { id: 'related', label: 'Related' },
      { id: 'runbook', label: 'Runbook' },
      { id: 'actions', label: 'Actions', count: executions.length }
    ],
    [timeline.length, tasks.length, detail.interactions?.length, attachments.length, executions.length]
  );

  const submitNote = async (e: FormEvent) => {
    e.preventDefault();
    if (!note.trim()) return;
    await onAddNote(note.trim(), internal);
    setNote('');
  };

  return (
    <div className="padler-issue-workspace">
      <PageHeader
        eyebrow={detail.caseNumber}
        title={detail.subject ?? 'Untitled case'}
        subtitle={`Priority ${detail.priority ?? '—'} · ${
          PADLER_QUEUES.find((q) => q.key === detail.queueKey)?.label ?? detail.queueKey ?? 'No queue'
        }`}
        actions={
          detail.customerUserId ? (
            <Button asChild>
              <Link href={`/customers/${encodeURIComponent(detail.customerUserId)}`}>
                Customer profile
              </Link>
            </Button>
          ) : null
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <StatusBadge status={detail.status} />
        <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">
          {detail.priority ?? '—'}
        </span>
        {detail.slaDueAt ? (
          <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900">
            Due {formatDateTime(detail.slaDueAt)}
          </span>
        ) : null}
        {detail.assigneePadlerId ? (
          <span className="text-sm text-slate-500">Assigned to {detail.assigneePadlerId}</span>
        ) : (
          <span className="text-sm text-slate-500">Unassigned</span>
        )}
      </div>

      <CrmTabs tabs={tabs} active={tab} onChange={setTab} ariaLabel="Case sections" />

      {tab === 'summary' ? (
        <div className="padler-issue-split">
          <section className="padler-panel">
            <h2 className="padler-panel-title">Details</h2>
            <dl className="padler-kv">
              <div>
                <dt>Customer</dt>
                <dd>{detail.customerName || detail.customerEmail || detail.customerUserId || '—'}</dd>
              </div>
              <div>
                <dt>Issue code</dt>
                <dd>{detail.issueCode ?? '—'}</dd>
              </div>
              <div>
                <dt>Booking</dt>
                <dd>
                  {detail.linkedBookingRef ? (
                    <Link className="padler-text-link" href="/tools">
                      {detail.linkedBookingRef}
                    </Link>
                  ) : (
                    '—'
                  )}
                </dd>
              </div>
              <div>
                <dt>Payment</dt>
                <dd>{detail.linkedPaymentRef ?? '—'}</dd>
              </div>
              <div>
                <dt>Description</dt>
                <dd className="padler-prewrap">{detail.description ?? '—'}</dd>
              </div>
            </dl>
          </section>
          {canManage ? (
            <section className="padler-panel">
              <h2 className="padler-panel-title">Edit fields</h2>
              <div className="padler-issue-stack">
                <label className="padler-field">
                  <span>Status</span>
                  <select value={status} onChange={(e) => setStatus(e.target.value)} disabled={busy}>
                    {CASE_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="padler-field">
                  <span>Priority</span>
                  <select value={priority} onChange={(e) => setPriority(e.target.value)} disabled={busy}>
                    {CASE_PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="padler-field">
                  <span>Queue</span>
                  <select value={queueKey} onChange={(e) => setQueueKey(e.target.value)} disabled={busy}>
                    {PADLER_QUEUES.map((q) => (
                      <option key={q.key} value={q.key}>
                        {q.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="padler-field">
                  <span>Assignee (Padler id / email)</span>
                  <input value={assignee} onChange={(e) => setAssignee(e.target.value)} disabled={busy} />
                </label>
                <button
                  type="button"
                  className="padler-btn padler-btn--primary"
                  disabled={busy}
                  onClick={() =>
                    void onUpdateFields({
                      status,
                      priority: priority as CasePriority,
                      queueKey: queueKey || undefined,
                      assigneePadlerId: assignee.trim() || undefined,
                      expectedVersion: detail.version
                    })
                  }
                >
                  Save changes
                </button>
              </div>
            </section>
          ) : null}
        </div>
      ) : null}

      {tab === 'timeline' ? (
        <section className="padler-panel">
          <h2 className="padler-panel-title">Timeline</h2>
          <ul className="padler-timeline-list">
            {timeline.length === 0 ? (
              <li className="padler-muted-copy">No timeline events for this case.</li>
            ) : (
              timeline.map((item) => (
                <li key={item.id ?? item.envelopeId ?? `${item.occurredAt}-${item.eventType}`}>
                  <div className="padler-timeline-list__meta">
                    {item.eventType ?? item.category ?? 'event'} · {formatDateTime(item.occurredAt)}
                  </div>
                  <strong>{item.title ?? 'Event'}</strong>
                  {item.summary ? <div>{item.summary}</div> : null}
                </li>
              ))
            )}
          </ul>
        </section>
      ) : null}

      {tab === 'tasks' ? (
        <section className="padler-panel">
          <h2 className="padler-panel-title">Tasks</h2>
          <ul className="padler-task-list">
            {tasks.length === 0 ? (
              <li className="padler-muted-copy">No tasks yet.</li>
            ) : (
              tasks.map((task) => (
                <li key={task.id ?? task.title} className="padler-task-item">
                  <div className="padler-task-item__body">
                    <strong>{task.title}</strong>
                    <div className="padler-timeline-list__meta">
                      {task.status ?? 'OPEN'}
                      {task.assigneePadlerId ? ` · ${task.assigneePadlerId}` : ''}
                      {task.dueAt ? ` · due ${formatDateTime(task.dueAt)}` : ''}
                    </div>
                    {task.description ? <div>{task.description}</div> : null}
                  </div>
                  {canManage && task.id != null ? (
                    <label className="padler-field">
                      <span>Status</span>
                      <select
                        value={String(task.status ?? 'OPEN')}
                        disabled={busy}
                        onChange={(e) => void onUpdateTask(task.id!, { status: e.target.value })}
                      >
                        {TASK_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                </li>
              ))
            )}
          </ul>
          {canManage ? (
            <form
              className="padler-note-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (!taskTitle.trim()) return;
                void onCreateTask({
                  title: taskTitle.trim(),
                  description: taskDescription.trim() || undefined
                }).then(() => {
                  setTaskTitle('');
                  setTaskDescription('');
                });
              }}
            >
              <label className="padler-field">
                <span>New task title</span>
                <input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} disabled={busy} required />
              </label>
              <label className="padler-field">
                <span>Description</span>
                <textarea rows={2} value={taskDescription} onChange={(e) => setTaskDescription(e.target.value)} disabled={busy} />
              </label>
              <button type="submit" className="padler-btn padler-btn--primary" disabled={busy}>
                Add task
              </button>
            </form>
          ) : null}
        </section>
      ) : null}

      {tab === 'notes' ? (
        <section className="padler-panel">
          <h2 className="padler-panel-title">Interactions</h2>
          <ul className="padler-timeline-list">
            {(detail.interactions ?? []).length === 0 ? (
              <li className="padler-muted-copy">No interactions yet.</li>
            ) : (
              (detail.interactions ?? []).map((item) => (
                <li key={item.id ?? `${item.createdAt}-${item.body?.slice(0, 12)}`}>
                  <div className="padler-timeline-list__meta">
                    {item.channel ?? 'NOTE'}
                    {item.internal ? ' · internal' : ''} · {formatDateTime(item.createdAt)}
                    {item.authorLabel ? ` · ${item.authorLabel}` : ''}
                  </div>
                  <div className="padler-prewrap">{item.body}</div>
                </li>
              ))
            )}
          </ul>
          {canManage ? (
            <form onSubmit={submitNote} className="padler-note-form">
              <label className="padler-field">
                <span>Add note</span>
                <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} disabled={busy} required />
              </label>
              <label className="padler-check">
                <input
                  type="checkbox"
                  checked={internal}
                  onChange={(e) => setInternal(e.target.checked)}
                  disabled={busy}
                />
                Internal note
              </label>
              <button type="submit" className="padler-btn padler-btn--primary" disabled={busy}>
                Add note
              </button>
            </form>
          ) : null}
        </section>
      ) : null}

      {tab === 'attachments' ? (
        <section className="padler-panel">
          <h2 className="padler-panel-title">Attachments</h2>
          <p className="padler-muted-copy">
            Registers metadata (storage key). Binary upload to object storage is out of band for now.
          </p>
          <ul className="padler-attachment-list">
            {attachments.length === 0 ? (
              <li className="padler-muted-copy">No attachments registered.</li>
            ) : (
              attachments.map((a) => (
                <li key={a.id ?? a.storageKey} className="padler-attachment-item">
                  <div className="padler-attachment-item__body">
                    <strong>{a.fileName}</strong>
                    <div className="padler-timeline-list__meta">
                      {a.contentType ?? 'file'}
                      {a.sizeBytes != null ? ` · ${a.sizeBytes} bytes` : ''}
                      {a.createdAt ? ` · ${formatDateTime(a.createdAt)}` : ''}
                    </div>
                    {a.storageKey ? <code>{a.storageKey}</code> : null}
                  </div>
                </li>
              ))
            )}
          </ul>
          {canManage ? (
            <form
              className="padler-note-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (!attachName.trim() || !attachKey.trim()) return;
                void onRegisterAttachment({
                  fileName: attachName.trim(),
                  storageKey: attachKey.trim(),
                  contentType: 'application/octet-stream'
                }).then(() => {
                  setAttachName('');
                  setAttachKey('');
                });
              }}
            >
              <label className="padler-field">
                <span>File name</span>
                <input value={attachName} onChange={(e) => setAttachName(e.target.value)} disabled={busy} required />
              </label>
              <label className="padler-field">
                <span>Storage key</span>
                <input value={attachKey} onChange={(e) => setAttachKey(e.target.value)} disabled={busy} required />
              </label>
              <button type="submit" className="padler-btn padler-btn--primary" disabled={busy}>
                Register attachment
              </button>
            </form>
          ) : null}
        </section>
      ) : null}

      {tab === 'related' ? (
        <section className="padler-panel">
          <h2 className="padler-panel-title">Link / merge</h2>
          {!canManage ? (
            <p className="padler-muted-copy">Read-only for your role.</p>
          ) : (
            <div className="padler-issue-split">
              <form
                className="padler-note-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!linkTarget.trim()) return;
                  void onLinkCase({ targetCaseNumber: linkTarget.trim(), linkType }).then(() =>
                    setLinkTarget('')
                  );
                }}
              >
                <h3 className="padler-panel-title">Link case</h3>
                <label className="padler-field">
                  <span>Target case number</span>
                  <input value={linkTarget} onChange={(e) => setLinkTarget(e.target.value)} disabled={busy} required />
                </label>
                <label className="padler-field">
                  <span>Link type</span>
                  <select value={linkType} onChange={(e) => setLinkType(e.target.value)} disabled={busy}>
                    {CASE_LINK_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="submit" className="padler-btn padler-btn--primary" disabled={busy}>
                  Link
                </button>
              </form>
              <form
                className="padler-note-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!mergeSurvivor.trim()) return;
                  void onMergeCase({
                    survivorCaseNumber: mergeSurvivor.trim(),
                    reason: mergeReason.trim() || undefined
                  }).then(() => {
                    setMergeSurvivor('');
                    setMergeReason('');
                  });
                }}
              >
                <h3 className="padler-panel-title">Merge into survivor</h3>
                <label className="padler-field">
                  <span>Survivor case number</span>
                  <input
                    value={mergeSurvivor}
                    onChange={(e) => setMergeSurvivor(e.target.value)}
                    disabled={busy}
                    required
                  />
                </label>
                <label className="padler-field">
                  <span>Reason</span>
                  <textarea rows={2} value={mergeReason} onChange={(e) => setMergeReason(e.target.value)} disabled={busy} />
                </label>
                <button type="submit" className="padler-btn" disabled={busy}>
                  Merge this case
                </button>
              </form>
            </div>
          )}
        </section>
      ) : null}

      {tab === 'runbook' ? (
        <section className="padler-panel">
          <h2 className="padler-panel-title">Runbook</h2>
          {!detail.issueCode ? (
            <p className="padler-muted-copy">No issue code on this case.</p>
          ) : !runbook ? (
            <p className="padler-muted-copy">No runbook for issue code {detail.issueCode}.</p>
          ) : (
            <div className="padler-runbook-block">
              <h3>{runbook.title ?? runbook.issueCode}</h3>
              {runbook.customerSafeSummary ? (
                <div>
                  <h3>Customer-safe summary</h3>
                  <p>{runbook.customerSafeSummary}</p>
                </div>
              ) : null}
              {runbook.whatThisMeans ? (
                <div>
                  <h3>What this means</h3>
                  <p>{runbook.whatThisMeans}</p>
                </div>
              ) : null}
              {runbook.checksToPerform ? (
                <div>
                  <h3>Checks</h3>
                  <p>{runbook.checksToPerform}</p>
                </div>
              ) : null}
              {runbook.safeResolution ? (
                <div>
                  <h3>Safe resolution</h3>
                  <p>{runbook.safeResolution}</p>
                </div>
              ) : null}
              {runbook.whenToEscalate ? (
                <div>
                  <h3>When to escalate</h3>
                  <p>{runbook.whenToEscalate}</p>
                </div>
              ) : null}
            </div>
          )}
        </section>
      ) : null}

      {tab === 'actions' ? (
        <section className="padler-panel">
          <div className="padler-compact-header">
            <h2 className="padler-panel-title" style={{ marginBottom: 0 }}>
              Actions
            </h2>
            {canRequestCommands ? (
              <button
                type="button"
                className="padler-btn padler-btn--primary"
                disabled={busy}
                onClick={() => setCommandOpen(true)}
              >
                Request action
              </button>
            ) : null}
          </div>

          <h3 className="padler-panel-title">Case executions</h3>
          {executions.length === 0 ? (
            <p className="padler-muted-copy">No command executions linked to this case yet.</p>
          ) : (
            <ul className="padler-timeline-list">
              {executions.map((ex) => (
                <li key={ex.executionNumber}>
                  <div className="padler-timeline-list__meta">
                    {ex.status ?? '—'} · {ex.commandKey ?? '—'} · {formatDateTime(ex.startedAt)}
                  </div>
                  <Link
                    className="padler-text-link"
                    href={`/actions/runs/${encodeURIComponent(ex.executionNumber)}`}
                  >
                    {ex.executionNumber}
                  </Link>
                  {ex.resultSummary ? <div>{ex.resultSummary}</div> : null}
                </li>
              ))}
            </ul>
          )}

          <h3 className="padler-panel-title" style={{ marginTop: 24 }}>
            Escalate
          </h3>
          {!canManage ? (
            <p className="padler-muted-copy">Your role cannot escalate.</p>
          ) : (
            <div className="padler-issue-controls">
              <label className="padler-field padler-field--grow">
                <span>Reason</span>
                <input
                  value={escalateReason}
                  onChange={(e) => setEscalateReason(e.target.value)}
                  placeholder="Why escalate?"
                  disabled={busy}
                />
              </label>
              <label className="padler-field">
                <span>Target queue</span>
                <select
                  value={escalateQueue}
                  onChange={(e) => setEscalateQueue(e.target.value)}
                  disabled={busy}
                >
                  {PADLER_QUEUES.map((q) => (
                    <option key={q.key} value={q.key}>
                      {q.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="padler-btn"
                disabled={busy || !escalateReason.trim()}
                onClick={() => void onEscalate(escalateReason.trim(), escalateQueue || undefined)}
              >
                Escalate
              </button>
            </div>
          )}
          <p className="padler-muted-copy" style={{ marginTop: 16 }}>
            Pending maker-checker items appear in{' '}
            <Link className="padler-text-link" href="/approvals">
              Approvals
            </Link>
            . Full catalog in{' '}
            <Link className="padler-text-link" href="/actions">
              Actions
            </Link>
            .
          </p>
        </section>
      ) : null}

      <CommandRequestDrawer
        open={commandOpen}
        caseNumber={detail.caseNumber}
        customerUserId={detail.customerUserId}
        busy={busy}
        onClose={() => setCommandOpen(false)}
        onSubmitted={() => {
          onCommandRequested?.();
        }}
      />
    </div>
  );
}
