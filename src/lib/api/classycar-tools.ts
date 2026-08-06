import { toolsGet, toolsPost, type ToolsUsage } from './tools-shared';

export type { ToolsUsage, ToolsUsageStep } from './tools-shared';

export async function fetchClassycarHub(): Promise<Record<string, unknown>> {
  return toolsGet('/api/v1/admin/classycar/hub', 'Unable to load Npod-Auto hub');
}

export async function fetchClassycarDealers(q?: string): Promise<Record<string, unknown>[]> {
  const params = new URLSearchParams();
  if (q?.trim()) params.set('q', q.trim());
  const suffix = params.toString() ? `?${params}` : '';
  const data = await toolsGet<Record<string, unknown>[]>(
    `/api/v1/admin/classycar/dealers${suffix}`,
    'Unable to load dealers'
  );
  return Array.isArray(data) ? data : [];
}

export async function fetchClassycarUsage(id: number | string): Promise<ToolsUsage> {
  return toolsGet(
    `/api/v1/admin/classycar/dealers/${encodeURIComponent(String(id))}/usage`,
    'Unable to load dealer usage'
  );
}

export async function fetchClassycarStuckPayments(): Promise<Record<string, unknown>> {
  return toolsGet('/api/v1/admin/classycar/payments/stuck', 'Unable to load stuck payments');
}

export type ClassycarStuckReconcileResult = {
  kind?: string;
  id?: number;
  paymentReference?: string;
  beforeStatus?: string;
  afterStatus?: string;
  walletSettled?: boolean;
  confirmed?: boolean;
  detail?: string;
};

export async function reconcileClassycarStuckPayment(
  kind: string,
  id: number | string
): Promise<ClassycarStuckReconcileResult> {
  return toolsPost(
    `/api/v1/admin/classycar/payments/stuck/${encodeURIComponent(kind)}/${encodeURIComponent(String(id))}/reconcile`,
    {},
    'Reconcile stuck payment failed'
  );
}

export async function fetchClassycarBooking(id: number | string): Promise<Record<string, unknown>> {
  return toolsGet(
    `/api/v1/admin/classycar/bookings/${encodeURIComponent(String(id))}`,
    'Unable to load booking'
  );
}

export async function fetchClassycarBookings(q?: string): Promise<Record<string, unknown>[]> {
  const params = new URLSearchParams();
  if (q?.trim()) params.set('q', q.trim());
  const suffix = params.toString() ? `?${params}` : '';
  const data = await toolsGet<Record<string, unknown>[]>(
    `/api/v1/admin/classycar/bookings${suffix}`,
    'Unable to load bookings'
  );
  return Array.isArray(data) ? data : [];
}

export async function confirmClassycarBooking(id: number | string): Promise<Record<string, unknown>> {
  return toolsPost(
    `/api/v1/admin/classycar/bookings/${encodeURIComponent(String(id))}/confirm`,
    {},
    'Confirm booking failed'
  );
}

export async function classycarKybAction(
  id: number | string,
  action: string,
  reason?: string
): Promise<Record<string, unknown>> {
  return toolsPost(
    `/api/v1/admin/classycar/dealers/${encodeURIComponent(String(id))}/kyb/${encodeURIComponent(action)}`,
    reason ? { reason } : {},
    `Npod-Auto KYB ${action} failed`
  );
}
