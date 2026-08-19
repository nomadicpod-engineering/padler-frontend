import { toolsPost } from './tools-shared';

export type WalletRestrictionToggleResult = {
  status?: string;
  detail?: string;
  wallet?: Record<string, unknown>;
};

export async function toggleUserWithdrawals(
  userId: string,
  allowed: boolean
): Promise<WalletRestrictionToggleResult> {
  return toolsPost(
    `/api/v1/admin/wallet/user/${encodeURIComponent(userId.trim())}/withdrawals`,
    { allowed },
    'Unable to update withdrawal restriction'
  );
}

export async function toggleUserDeposits(
  userId: string,
  allowed: boolean
): Promise<WalletRestrictionToggleResult> {
  return toolsPost(
    `/api/v1/admin/wallet/user/${encodeURIComponent(userId.trim())}/deposits`,
    { allowed },
    'Unable to update payment restriction'
  );
}

/** Null/undefined/true = enabled; false = disabled. */
export function isWalletRestrictionEnabled(value: unknown): boolean {
  return value === undefined || value === null || value === true;
}

export function parseWalletRestrictionsFromSnapshot(snapshot?: Record<string, unknown> | null): {
  hasWallet: boolean;
  walletMissing: boolean;
  allowWithdrawals: boolean;
  allowDeposits: boolean;
} {
  if (!snapshot) {
    return {
      hasWallet: false,
      walletMissing: true,
      allowWithdrawals: true,
      allowDeposits: true
    };
  }
  const errorCode = snapshot.errorCode != null ? String(snapshot.errorCode) : '';
  if (errorCode === 'NOT_FOUND') {
    return {
      hasWallet: false,
      walletMissing: true,
      allowWithdrawals: true,
      allowDeposits: true
    };
  }
  const wallet = snapshot.wallet as Record<string, unknown> | undefined;
  if (!wallet || typeof wallet !== 'object') {
    return {
      hasWallet: false,
      walletMissing: Boolean(snapshot.errorMessage),
      allowWithdrawals: true,
      allowDeposits: true
    };
  }
  return {
    hasWallet: true,
    walletMissing: false,
    allowWithdrawals: isWalletRestrictionEnabled(wallet.allowWithdrawals),
    allowDeposits: isWalletRestrictionEnabled(wallet.allowDeposits)
  };
}
