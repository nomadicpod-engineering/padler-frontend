'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { handleProactiveRefreshFailure, tryRefreshTokens } from '@/lib/auth/refresh';
import {
  getAccessToken,
  getRefreshToken,
  isSessionIdleExpired,
  shouldRefreshAccessToken
} from '@/lib/auth';

const CHECK_INTERVAL_MS = 30_000;

/**
 * While the user is logged in and active (not idle), refresh the access token
 * shortly before it expires so API calls do not wait for a 401.
 */
export function TokenRefreshGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const refreshingRef = useRef(false);

  useEffect(() => {
    if (pathname?.startsWith('/auth/')) return;

    const maybeRefresh = async () => {
      if (refreshingRef.current) return;
      if (!getAccessToken() || !getRefreshToken()) return;
      if (isSessionIdleExpired()) return;
      if (!shouldRefreshAccessToken()) return;

      refreshingRef.current = true;
      try {
        const ok = await tryRefreshTokens();
        if (!ok) {
          handleProactiveRefreshFailure();
        }
      } finally {
        refreshingRef.current = false;
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void maybeRefresh();
      }
    };

    void maybeRefresh();
    document.addEventListener('visibilitychange', onVisibility);
    const intervalId = window.setInterval(() => {
      void maybeRefresh();
    }, CHECK_INTERVAL_MS);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearInterval(intervalId);
    };
  }, [pathname]);

  return <>{children}</>;
}
