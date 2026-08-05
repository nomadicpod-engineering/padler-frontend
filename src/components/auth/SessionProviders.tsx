'use client';

import { IdleSessionGuard } from '@/components/auth/IdleSessionGuard';
import { TokenRefreshGuard } from '@/components/auth/TokenRefreshGuard';

export function SessionProviders({ children }: { children: React.ReactNode }) {
  return (
    <IdleSessionGuard>
      <TokenRefreshGuard>{children}</TokenRefreshGuard>
    </IdleSessionGuard>
  );
}
