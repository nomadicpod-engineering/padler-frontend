'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { PadlerShell } from '@/app/components/PadlerShell';
import { IssueWorkspace } from '@/components/crm/IssueWorkspace';
import { StatePanel } from '@/components/ui/page';
import {
  addCaseInteraction,
  createCaseTask,
  escalateCase,
  getCase,
  getCaseTimeline,
  getRunbook,
  isForbiddenError,
  linkCase,
  listCaseAttachments,
  listCaseTasks,
  listCommandExecutions,
  mergeCase,
  registerCaseAttachment,
  updateCase,
  updateCaseTask
} from '@/lib/api';
import { getAuthSession } from '@/lib/auth';
import {
  canManageCases,
  canRequestCommands,
  type CaseAttachment,
  type CaseDetail,
  type CaseTask,
  type CommandExecution,
  type KnowledgeRunbook,
  type TimelineItem
} from '@/lib/types';

export default function IssueDetailPage() {
  const params = useParams<{ caseNumber: string }>();
  const caseNumber = decodeURIComponent(params.caseNumber ?? '');
  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [tasks, setTasks] = useState<CaseTask[]>([]);
  const [attachments, setAttachments] = useState<CaseAttachment[]>([]);
  const [runbook, setRunbook] = useState<KnowledgeRunbook | null>(null);
  const [executions, setExecutions] = useState<CommandExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [canRequest, setCanRequest] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    const s = getAuthSession();
    setCanManage(canManageCases(s?.designation));
    setCanRequest(canRequestCommands(s?.designation));
  }, []);

  const load = useCallback(async () => {
    if (!caseNumber) return;
    setLoading(true);
    setError(null);
    setForbidden(false);
    try {
      const caseDetail = await getCase(caseNumber);
      const [tl, taskRows, attachmentRows, rb, execRows] = await Promise.all([
        getCaseTimeline(caseNumber).catch(() => ({ items: [] as TimelineItem[] })),
        listCaseTasks(caseNumber).catch(() => [] as CaseTask[]),
        listCaseAttachments(caseNumber).catch(() => [] as CaseAttachment[]),
        caseDetail.issueCode ? getRunbook(caseDetail.issueCode).catch(() => null) : Promise.resolve(null),
        listCommandExecutions().catch(() => [] as CommandExecution[])
      ]);
      setDetail(caseDetail);
      setTimeline(tl.items ?? []);
      setTasks(taskRows);
      setAttachments(attachmentRows);
      setRunbook(rb);
      setExecutions(execRows.filter((e) => e.caseNumber === caseNumber).slice(0, 25));
    } catch (e) {
      setDetail(null);
      setTimeline([]);
      setTasks([]);
      setAttachments([]);
      setRunbook(null);
      setExecutions([]);
      if (isForbiddenError(e)) setForbidden(true);
      else setError(e instanceof Error ? e.message : 'Unable to load case');
    } finally {
      setLoading(false);
    }
  }, [caseNumber]);

  useEffect(() => {
    void load();
  }, [load]);

  const runAction = async (fn: () => Promise<void>) => {
    setBusy(true);
    setActionError(null);
    try {
      await fn();
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <PadlerShell>
      {loading ? <StatePanel kind="loading" skeleton="detail" /> : null}
      {forbidden ? <StatePanel kind="forbidden" /> : null}
      {error ? <StatePanel kind="error" message={error} /> : null}
      {actionError ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {actionError}
        </div>
      ) : null}
      {!loading && !forbidden && !error && detail ? (
        <IssueWorkspace
            detail={detail}
            timeline={timeline}
            tasks={tasks}
            attachments={attachments}
            runbook={runbook}
            executions={executions}
            canManage={canManage}
            canRequestCommands={canRequest}
            busy={busy}
            onCommandRequested={() => {
              void load();
            }}
            onUpdateFields={async (body) => {
              await runAction(async () => {
                await updateCase(caseNumber, body);
              });
            }}
            onAddNote={async (body, internal) => {
              await runAction(async () => {
                await addCaseInteraction(caseNumber, {
                  channel: 'INTERNAL_NOTE',
                  body,
                  internal
                });
              });
            }}
            onEscalate={async (reason, targetQueueKey) => {
              await runAction(async () => {
                await escalateCase(caseNumber, { reason, targetQueueKey });
              });
            }}
            onCreateTask={async (body) => {
              await runAction(async () => {
                await createCaseTask(caseNumber, body);
              });
            }}
            onUpdateTask={async (taskId, body) => {
              await runAction(async () => {
                await updateCaseTask(caseNumber, taskId, body);
              });
            }}
            onRegisterAttachment={async (body) => {
              await runAction(async () => {
                await registerCaseAttachment(caseNumber, body);
              });
            }}
            onLinkCase={async (body) => {
              await runAction(async () => {
                await linkCase(caseNumber, body);
              });
            }}
            onMergeCase={async (body) => {
              await runAction(async () => {
                await mergeCase(caseNumber, body);
              });
            }}
          />
      ) : null}
    </PadlerShell>
  );
}
