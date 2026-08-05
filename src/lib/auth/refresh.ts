import axios from 'axios';
import { PADLER_API_BASE_URL } from '@/lib/api-config';
import {
  clearAuthSession,
  getAccessToken,
  getAccessTokenExpiresAtMs,
  getAuthSession,
  getRefreshToken,
  saveSessionFromLogin
} from '@/lib/auth';

type RefreshResponse = {
  success?: boolean;
  data?: {
    email?: string;
    userId?: string;
    designation?: string;
    authPayload?: Record<string, unknown>;
  };
};

const refreshApi = axios.create({
  baseURL: PADLER_API_BASE_URL,
  headers: { 'Content-Type': 'application/json' }
});

/** Deduplicates concurrent refresh attempts across parallel API calls. */
let refreshInFlight: Promise<boolean> | null = null;

export async function tryRefreshTokens(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = doRefresh().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

async function doRefresh(): Promise<boolean> {
  const refresh = getRefreshToken();
  const existing = getAuthSession();
  if (!refresh || !existing) return false;
  try {
    const { data: json } = await refreshApi.post<RefreshResponse>(
      '/api/v1/padler/auth/refresh-token',
      { refreshToken: refresh }
    );
    if (json?.success === false || !json?.data) return false;

    const authPayload = json.data.authPayload ?? {};
    const accessToken =
      (typeof authPayload.accessToken === 'string' && authPayload.accessToken) ||
      (typeof authPayload.access_token === 'string' && authPayload.access_token) ||
      '';
    if (!accessToken) return false;

    const refreshToken =
      (typeof authPayload.refreshToken === 'string' && authPayload.refreshToken) ||
      (typeof authPayload.refresh_token === 'string' && authPayload.refresh_token) ||
      refresh;

    const expiresRaw = authPayload.expiresIn ?? authPayload.expires_in;
    const expiresIn =
      typeof expiresRaw === 'number'
        ? expiresRaw
        : typeof expiresRaw === 'string' && Number.isFinite(Number(expiresRaw))
          ? Number(expiresRaw)
          : undefined;

    saveSessionFromLogin({
      accessToken,
      refreshToken,
      email: json.data.email ?? existing.email,
      userId: json.data.userId ?? existing.userId,
      designation:
        json.data.designation != null ? String(json.data.designation) : existing.designation,
      expiresIn
    });
    return true;
  } catch {
    return false;
  }
}

let redirecting = false;

/**
 * Signs the user out and sends them to the login page after the backend
 * rejects an authenticated request (expired/invalid token that could not be
 * refreshed). Full page navigation so all in-memory state is reset.
 */
export function handleSessionExpired(): void {
  if (typeof window === 'undefined' || redirecting) return;
  if (window.location.pathname.startsWith('/auth/')) return;
  if (!getAccessToken()) return;
  redirecting = true;

  clearAuthSession();

  const next = `${window.location.pathname}${window.location.search}`;
  window.location.replace(`/auth/login?session=expired&next=${encodeURIComponent(next)}`);
}

/** Used by TokenRefreshGuard when proactive refresh fails after expiry. */
export function handleProactiveRefreshFailure(): void {
  const expiresAt = getAccessTokenExpiresAtMs();
  if (expiresAt != null && Date.now() >= expiresAt) {
    handleSessionExpired();
  }
}
