import { toolsGet, toolsPost } from './tools-shared';

export type FailedWithdrawal = {
  transactionId: string;
  userId?: string | null;
  reference?: string | null;
  amount?: number | null;
  reason?: string | null;
  attemptCount?: number | null;
  lastAttemptAt?: string | null;
  createdAt?: string | null;
  transactionStatus?: string | null;
  retryable?: boolean | null;
  bankName?: string | null;
  accountNumber?: string | null;
};

export type FailedWithdrawalPage = {
  content: FailedWithdrawal[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

export async function fetchFailedWithdrawals(options: {
  userId?: string;
  page?: number;
  size?: number;
}): Promise<FailedWithdrawalPage> {
  const params = new URLSearchParams({
    page: String(options.page ?? 0),
    size: String(options.size ?? 20)
  });
  if (options.userId?.trim()) params.set('userId', options.userId.trim());
  return toolsGet(`/api/v1/admin/withdrawals/failed?${params}`, 'Unable to load failed withdrawals');
}

export async function retryFailedWithdrawal(transactionId: string): Promise<Record<string, unknown>> {
  return toolsPost(
    `/api/v1/admin/withdrawals/${encodeURIComponent(transactionId)}/retry`,
    {},
    'Retry failed'
  );
}

export async function cancelFailedWithdrawal(transactionId: string): Promise<Record<string, unknown>> {
  return toolsPost(
    `/api/v1/admin/withdrawals/${encodeURIComponent(transactionId)}/cancel`,
    {},
    'Cancel failed'
  );
}
