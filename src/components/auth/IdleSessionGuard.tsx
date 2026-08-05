'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  AUTH_SESSION_STORAGE_KEY,
  clearAuthSession,
  getAccessToken,
  isSessionIdleExpired,
  touchSessionActivity
} from '@/lib/auth';

const CHECK_INTERVAL_MS = 60_000;
const ACTIVITY_THROTTLE_MS = 30_000;

const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll', 'click'] as const;

/**
 * Signs the user out after idle timeout without interaction while the app is open.
 * Active use (mouse, keyboard, touch, scroll) resets the timer.
 */
export function IdleSessionGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const lastTouchRef = useRef(0);
  const loggingOutRef = useRef(false);

  useEffect(() => {
    const logoutForIdle = (reason: 'idle' | 'sync') => {
      if (loggingOutRef.current) return;
      if (!getAccessToken()) return;
      if (!isSessionIdleExpired()) return;

      loggingOutRef.current = true;
      clearAuthSession();
      const query = reason === 'idle' ? '?session=idle' : '';
      router.replace(`/auth/login${query}`);
    };

    const onActivity = () => {
      if (!getAccessToken()) return;
      const now = Date.now();
      if (now - lastTouchRef.current < ACTIVITY_THROTTLE_MS) return;
      lastTouchRef.current = now;
      touchSessionActivity();
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        logoutForIdle('idle');
      }
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key === AUTH_SESSION_STORAGE_KEY && event.newValue === null) {
        loggingOutRef.current = true;
        router.replace('/auth/login');
      }
    };

    if (getAccessToken()) {
      if (isSessionIdleExpired()) {
        logoutForIdle('idle');
        return;
      }
      touchSessionActivity();
    }

    for (const name of ACTIVITY_EVENTS) {
      window.addEventListener(name, onActivity, { passive: true });
    }
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('storage', onStorage);

    const intervalId = window.setInterval(() => logoutForIdle('idle'), CHECK_INTERVAL_MS);

    return () => {
      for (const name of ACTIVITY_EVENTS) {
        window.removeEventListener(name, onActivity);
      }
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('storage', onStorage);
      window.clearInterval(intervalId);
    };
  }, [pathname, router]);

  return <>{children}</>;
}
