import { toolsGet, toolsPost, type ToolsUsage } from './tools-shared';

export type { ToolsUsage, ToolsUsageStep } from './tools-shared';

export async function fetchDriftHub(): Promise<Record<string, unknown>> {
  return toolsGet('/api/v1/admin/drift/hub', 'Unable to load Drift hub');
}

export async function fetchDriftDispatch(params?: {
  partyType?: string;
  q?: string;
}): Promise<Record<string, unknown>[]> {
  const q = new URLSearchParams();
  if (params?.partyType) q.set('partyType', params.partyType);
  if (params?.q?.trim()) q.set('q', params.q.trim());
  const suffix = q.toString() ? `?${q}` : '';
  const data = await toolsGet<Record<string, unknown>[]>(
    `/api/v1/admin/drift/dispatch${suffix}`,
    'Unable to load Drift dispatch parties'
  );
  return Array.isArray(data) ? data : [];
}

export async function fetchDriftUsage(
  partyType: string,
  id: number | string
): Promise<ToolsUsage> {
  return toolsGet(
    `/api/v1/admin/drift/dispatch/${encodeURIComponent(partyType)}/${encodeURIComponent(String(id))}/usage`,
    'Unable to load Drift usage'
  );
}

export async function fetchDriftQueues(): Promise<Record<string, unknown>> {
  return toolsGet('/api/v1/admin/drift/queues', 'Unable to load Drift queues');
}

export async function fetchDriftStuckPayments(): Promise<Record<string, unknown>> {
  return toolsGet('/api/v1/admin/drift/payments/stuck', 'Unable to load stuck payments');
}

export async function fetchDriftStuckPaymentDetail(
  orderId: string
): Promise<Record<string, unknown>> {
  return toolsGet(
    `/api/v1/admin/drift/payments/stuck/${encodeURIComponent(orderId)}`,
    'Unable to load stuck payment detail'
  );
}

export type DriftStuckReconcileResult = {
  orderId?: string;
  kind?: string | null;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
  paymentSettled?: boolean;
  workflowAdvanced?: boolean;
  dispatcherPaid?: boolean;
  detail?: string;
  found?: boolean;
};

export async function reconcileDriftStuckPayment(
  orderId: string
): Promise<DriftStuckReconcileResult> {
  return toolsPost(
    `/api/v1/admin/drift/payments/stuck/${encodeURIComponent(orderId)}/reconcile`,
    {},
    'Reconcile stuck payment failed'
  );
}

export async function driftKybAction(
  partyType: string,
  id: number | string,
  action: string,
  reason?: string
): Promise<Record<string, unknown>> {
  return toolsPost(
    `/api/v1/admin/drift/dispatch/${encodeURIComponent(partyType)}/${encodeURIComponent(String(id))}/kyb/${encodeURIComponent(action)}`,
    reason ? { reason } : {},
    `Drift KYB ${action} failed`
  );
}
