import { toolsDelete, toolsGet, toolsPost, toolsPut } from './tools-shared';
import type { FailedWithdrawalPage } from './withdrawals';

const BASE = '/api/v1/admin/wallet-config';

// --- KYC ---

export function fetchKycConfig(): Promise<Record<string, unknown>> {
  return toolsGet(`${BASE}/kyc-config`, 'Unable to load KYC config');
}

export function updateKycConfig(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  return toolsPut(`${BASE}/kyc-config`, body, 'Unable to update KYC config');
}

// --- Reward+ ---

export function listActivationCodes(): Promise<Record<string, unknown>[]> {
  return toolsGet(`${BASE}/reward-plus/activation-codes`, 'Unable to list activation codes');
}

export function createActivationCode(body: {
  code: string;
  maxUses?: number;
  expiresAt?: string | null;
}): Promise<Record<string, unknown>> {
  return toolsPost(`${BASE}/reward-plus/activation-codes`, body, 'Unable to create activation code');
}

export function deactivateActivationCode(id: number | string): Promise<Record<string, unknown>> {
  return toolsPost(
    `${BASE}/reward-plus/activation-codes/${encodeURIComponent(String(id))}/deactivate`,
    {},
    'Unable to deactivate activation code'
  );
}

export function upsertRewardPlusMember(body: {
  userId: string;
  active?: boolean;
  adminNotes?: string;
}): Promise<Record<string, unknown>> {
  return toolsPut(`${BASE}/reward-plus/members`, body, 'Unable to upsert Reward+ member');
}

export function fetchRewardPlusMember(userId: string): Promise<Record<string, unknown>> {
  return toolsGet(
    `${BASE}/reward-plus/members/${encodeURIComponent(userId)}`,
    'Unable to load Reward+ member'
  );
}

export function fetchRewardPlusMemberBusinesses(
  userId: string,
  product?: string
): Promise<Record<string, unknown>> {
  const qs = product?.trim() ? `?product=${encodeURIComponent(product.trim())}` : '';
  return toolsGet(
    `${BASE}/reward-plus/members/${encodeURIComponent(userId)}/businesses${qs}`,
    'Unable to load member businesses'
  );
}

export function fetchRewardPlusMemberLedger(
  userId: string,
  page = 0,
  size = 20
): Promise<Record<string, unknown>> {
  return toolsGet(
    `${BASE}/reward-plus/members/${encodeURIComponent(userId)}/ledger?page=${page}&size=${size}`,
    'Unable to load Reward+ ledger'
  );
}

export function listRewardPlusProducts(): Promise<Record<string, unknown>[]> {
  return toolsGet(`${BASE}/reward-plus/products`, 'Unable to list Reward+ products');
}

export function upsertRewardPlusProduct(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  return toolsPut(`${BASE}/reward-plus/products`, body, 'Unable to upsert Reward+ product');
}

export function deactivateRewardPlusProduct(code: string): Promise<Record<string, unknown>> {
  return toolsPost(
    `${BASE}/reward-plus/products/${encodeURIComponent(code)}/deactivate`,
    {},
    'Unable to deactivate product'
  );
}

export function fetchRewardPlusMeta(): Promise<Record<string, unknown>> {
  return toolsGet(`${BASE}/reward-plus/meta`, 'Unable to load Reward+ meta');
}

export function fetchRewardPlusConfig(): Promise<Record<string, unknown>> {
  return toolsGet(`${BASE}/reward-plus/config`, 'Unable to load Reward+ config');
}

export function updateRewardPlusConfig(body: {
  minBankWithdrawalAmount: number | string;
}): Promise<Record<string, unknown>> {
  return toolsPut(`${BASE}/reward-plus/config`, body, 'Unable to update Reward+ config');
}

export function upsertRewardPlusRate(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  return toolsPut(`${BASE}/reward-plus/rates`, body, 'Unable to upsert Reward+ rate');
}

export function listRewardPlusGlobalRates(): Promise<Record<string, unknown>[]> {
  return toolsGet(`${BASE}/reward-plus/rates/global`, 'Unable to list global rates');
}

export function listRewardPlusUserRates(userId: string): Promise<Record<string, unknown>[]> {
  return toolsGet(
    `${BASE}/reward-plus/rates/user/${encodeURIComponent(userId)}`,
    'Unable to list user rates'
  );
}

export function listRewardPlusEffectiveRates(userId: string): Promise<Record<string, unknown>[]> {
  return toolsGet(
    `${BASE}/reward-plus/rates/effective/${encodeURIComponent(userId)}`,
    'Unable to list effective rates'
  );
}

// --- Rewards ---

export function listRewardsRules(): Promise<unknown> {
  return toolsGet(`${BASE}/rewards/rules`, 'Unable to list earn rules');
}

export function createRewardsRule(body: Record<string, unknown>): Promise<unknown> {
  return toolsPost(`${BASE}/rewards/rules`, body, 'Unable to create earn rule');
}

export function updateRewardsRule(id: number | string, body: Record<string, unknown>): Promise<unknown> {
  return toolsPut(`${BASE}/rewards/rules/${encodeURIComponent(String(id))}`, body, 'Unable to update earn rule');
}

export function deleteRewardsRule(id: number | string): Promise<Record<string, unknown>> {
  return toolsDelete(`${BASE}/rewards/rules/${encodeURIComponent(String(id))}`, 'Unable to delete earn rule');
}

export function listRewardsLedger(): Promise<unknown> {
  return toolsGet(`${BASE}/rewards/ledger`, 'Unable to list rewards ledger');
}

export function voidRewardsLedger(id: number | string, reason = 'admin-void'): Promise<unknown> {
  return toolsDelete(
    `${BASE}/rewards/ledger/${encodeURIComponent(String(id))}?reason=${encodeURIComponent(reason)}`,
    'Unable to void ledger entry'
  );
}

export function fetchConversionRate(): Promise<Record<string, unknown>> {
  return toolsGet(`${BASE}/rewards/conversion-rate`, 'Unable to load conversion rate');
}

export function updateConversionRate(body: Record<string, unknown>): Promise<unknown> {
  return toolsPut(`${BASE}/rewards/conversion-rate`, body, 'Unable to update conversion rate');
}

export function fetchReferralConfig(): Promise<unknown> {
  return toolsGet(`${BASE}/rewards/referral-config`, 'Unable to load referral config');
}

export function updateReferralConfig(body: Record<string, unknown>): Promise<unknown> {
  return toolsPut(`${BASE}/rewards/referral-config`, body, 'Unable to update referral config');
}

export function fetchRewardsAdminConfig(): Promise<unknown> {
  return toolsGet(`${BASE}/rewards/rewards-config`, 'Unable to load rewards config');
}

export function updateRewardsAdminConfig(body: Record<string, unknown>): Promise<unknown> {
  return toolsPut(`${BASE}/rewards/rewards-config`, body, 'Unable to update rewards config');
}

export function listReferralRules(): Promise<unknown> {
  return toolsGet(`${BASE}/rewards/referral-rules`, 'Unable to list referral rules');
}

export function createReferralRule(body: Record<string, unknown>): Promise<unknown> {
  return toolsPost(`${BASE}/rewards/referral-rules`, body, 'Unable to create referral rule');
}

export function updateReferralRule(id: number | string, body: Record<string, unknown>): Promise<unknown> {
  return toolsPut(
    `${BASE}/rewards/referral-rules/${encodeURIComponent(String(id))}`,
    body,
    'Unable to update referral rule'
  );
}

export function deleteReferralRule(id: number | string, hard = false): Promise<Record<string, unknown>> {
  return toolsDelete(
    `${BASE}/rewards/referral-rules/${encodeURIComponent(String(id))}?hard=${hard}`,
    'Unable to delete referral rule'
  );
}

export function fetchLiabilityReport(from: string, to: string): Promise<unknown> {
  const params = new URLSearchParams({ from, to });
  return toolsGet(`${BASE}/rewards/reports/liability?${params}`, 'Unable to load liability report');
}

export function fetchRewardsEventTrace(
  sourceRef: string,
  sourceService = 'np-rewards-service'
): Promise<unknown> {
  return toolsGet(
    `${BASE}/rewards/events/${encodeURIComponent(sourceRef)}/trace?sourceService=${encodeURIComponent(sourceService)}`,
    'Unable to trace reward event'
  );
}

export function fetchRewardsUserTimeline(userId: string, page = 0, size = 100): Promise<unknown> {
  return toolsGet(
    `${BASE}/rewards/users/${encodeURIComponent(userId)}/timeline?page=${page}&size=${size}`,
    'Unable to load user timeline'
  );
}

// --- Failed withdrawals (SUPER_ADMIN config path) ---

export function fetchConfigFailedWithdrawals(options: {
  userId?: string;
  page?: number;
  size?: number;
}): Promise<FailedWithdrawalPage> {
  const params = new URLSearchParams({
    page: String(options.page ?? 0),
    size: String(options.size ?? 20)
  });
  if (options.userId?.trim()) params.set('userId', options.userId.trim());
  return toolsGet(`${BASE}/withdrawals/failed?${params}`, 'Unable to load failed withdrawals');
}

export function retryConfigFailedWithdrawal(transactionId: string): Promise<Record<string, unknown>> {
  return toolsPost(
    `${BASE}/withdrawals/${encodeURIComponent(transactionId)}/retry`,
    {},
    'Retry failed'
  );
}

export function cancelConfigFailedWithdrawal(transactionId: string): Promise<Record<string, unknown>> {
  return toolsPost(
    `${BASE}/withdrawals/${encodeURIComponent(transactionId)}/cancel`,
    {},
    'Cancel failed'
  );
}
