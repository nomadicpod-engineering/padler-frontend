'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { PadlerShell } from '@/app/components/PadlerShell';
import { ApprovalDrawer } from '@/components/crm/ApprovalDrawer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { DataTable, serialColumn, type DataTableColumn } from '@/components/ui/data-table';
import { PageHeader, StatePanel } from '@/components/ui/page';
import {
  approveApproval,
  cancelApproval,
  isForbiddenError,
  listApprovals,
  rejectApproval
} from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import { getAuthSession } from '@/lib/auth';
import {
  canRequestCommands,
  canViewApprovals,
  type ApprovalSummary
} from '@/lib/types';


export default function ApprovalsPage() {
  const [rows, setRows] = useState<ApprovalSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canDecide, setCanDecide] = useState(false);
  const [canCancel, setCanCancel] = useState(false);
  const [selected, setSelected] = useState<ApprovalSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [roleBlocked, setRoleBlocked] = useState(false);

  useEffect(() => {
    const s = getAuthSession();
    const decide = canViewApprovals(s?.designation);
    const request = canRequestCommands(s?.designation);
    setCanDecide(decide);
    setCanCancel(request);
    if (!decide && !request) {
      setRoleBlocked(true);
      setLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    if (roleBlocked) return;
    setLoading(true);
    setError(null);
    setForbidden(false);
    try {
      const list = await listApprovals('PENDING');
      setRows(list);
    } catch (e) {
      setRows([]);
      if (isForbiddenError(e)) setForbidden(true);
      else setError(e instanceof Error ? e.message : 'Unable to load approvals');
    } finally {
      setLoading(false);
    }
  }, [roleBlocked]);

  useEffect(() => {
    if (!roleBlocked) void load();
  }, [load, roleBlocked]);

  const afterDecision = useCallback(async () => {
    setSelected(null);
    await load();
  }, [load]);

  const columns = useMemo<DataTableColumn<ApprovalSummary>[]>(
    () => [
      serialColumn<ApprovalSummary>(),
      {
        header: 'Request',
        accessorKey: 'approvalNumber',
        cell: ({ row }) => (
          <span className="font-medium tabular-nums text-slate-900">{row.original.approvalNumber}</span>
        )
      },
      {
        header: 'Action',
        accessorKey: 'commandKey',
        cell: ({ row }) => row.original.commandKey ?? '—'
      },
      {
        header: 'Risk',
        accessorKey: 'riskClass',
        cell: ({ row }) => <Badge tone="warning">{row.original.riskClass ?? '—'}</Badge>
      },
      {
        header: 'Requested by',
        id: 'maker',
        cell: ({ row }) => row.original.makerEmail ?? row.original.makerPadlerId ?? '—'
      },
      {
        header: 'Case',
        accessorKey: 'caseNumber',
        cell: ({ row }) =>
          row.original.caseNumber ? (
            <Link
              className="text-blue-700 hover:underline"
              href={`/cases/${encodeURIComponent(row.original.caseNumber)}`}
            >
              {row.original.caseNumber}
            </Link>
          ) : (
            '—'
          )
      },
      {
        header: 'Requested',
        accessorKey: 'requestedAt',
        cell: ({ row }) => formatDateTime(row.original.requestedAt)
      },
      {
        header: '',
        id: 'actions',
        cell: ({ row }) => (
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" onClick={() => setSelected(row.original)}>
              Open
            </Button>
            {canDecide ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="primary"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setActionError(null);
                    try {
                      await approveApproval(row.original.approvalNumber);
                      await afterDecision();
                    } catch (e) {
                      setActionError(e instanceof Error ? e.message : 'Approve failed');
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Approve
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setActionError(null);
                    try {
                      await rejectApproval(row.original.approvalNumber);
                      await afterDecision();
                    } catch (e) {
                      setActionError(e instanceof Error ? e.message : 'Reject failed');
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Reject
                </Button>
              </>
            ) : null}
            {canCancel && !canDecide ? (
              <Button
                type="button"
                size="sm"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setActionError(null);
                  try {
                    await cancelApproval(row.original.approvalNumber);
                    await afterDecision();
                  } catch (e) {
                    setActionError(e instanceof Error ? e.message : 'Cancel failed');
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Cancel
              </Button>
            ) : null}
          </div>
        )
      }
    ],
    [afterDecision, busy, canCancel, canDecide]
  );

  return (
    <PadlerShell>
      <PageHeader
        eyebrow="My day"
        title="Approvals"
        subtitle="Requests waiting for a second check before they run"
        actions={
          !roleBlocked ? (
            <Button type="button" onClick={() => void load()}>
              Refresh
            </Button>
          ) : null
        }
      />

      {roleBlocked ? (
        <StatePanel
          kind="forbidden"
          message="Your role can’t open approvals. Ask a lead if you need access."
        />
      ) : null}
      {loading && rows.length === 0 ? <StatePanel kind="loading" /> : null}
      {forbidden ? <StatePanel kind="forbidden" /> : null}
      {error ? <StatePanel kind="error" message={error} /> : null}
      {actionError ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {actionError}
        </div>
      ) : null}

      {!roleBlocked && !loading && !forbidden && !error && rows.length === 0 ? (
        <StatePanel kind="empty" title="No pending approvals" message="Nothing is waiting for review." />
      ) : null}

      {!roleBlocked && !loading && !forbidden && !error && rows.length > 0 ? (
        <Card className="overflow-hidden p-0">
          <DataTable columns={columns} data={rows} />
        </Card>
      ) : null}

      <ApprovalDrawer
        open={Boolean(selected)}
        approval={selected}
        canDecide={canDecide}
        busy={busy}
        onClose={() => setSelected(null)}
        onApprove={async (note) => {
          if (!selected) return;
          setBusy(true);
          setActionError(null);
          try {
            await approveApproval(selected.approvalNumber, note);
            await afterDecision();
          } catch (e) {
            setActionError(e instanceof Error ? e.message : 'Approve failed');
          } finally {
            setBusy(false);
          }
        }}
        onReject={async (note) => {
          if (!selected) return;
          setBusy(true);
          setActionError(null);
          try {
            await rejectApproval(selected.approvalNumber, note);
            await afterDecision();
          } catch (e) {
            setActionError(e instanceof Error ? e.message : 'Reject failed');
          } finally {
            setBusy(false);
          }
        }}
      />
    </PadlerShell>
  );
}
