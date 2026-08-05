export type AuthSession = {
  accessToken: string;
  email: string;
  designation: string;
  userId: string;
  refreshToken?: string;
  lastActivityAt?: number;
  accessExpiresAt?: number;
};

const AUTH_STORAGE_KEY = 'padler_auth_session';

/** Idle timeout before automatic sign-out (45 minutes). */
export const IDLE_SESSION_MS = 45 * 60 * 1000;

/** Refresh the access token this many ms before JWT expiry. */
export const ACCESS_TOKEN_REFRESH_SKEW_MS = 60_000;

function readRawSession(): string | null {
  if (typeof window === 'undefined') return null;
  let raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) {
    raw = window.sessionStorage.getItem(AUTH_STORAGE_KEY);
    if (raw) {
      window.localStorage.setItem(AUTH_STORAGE_KEY, raw);
      window.sessionStorage.removeItem(AUTH_STORAGE_KEY);
    }
  }
  return raw;
}

export function getAuthSession(): AuthSession | null {
  const raw = readRawSession();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AuthSession;
    if (!parsed?.accessToken) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setAuthSession(session: AuthSession): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(AUTH_STORAGE_KEY);
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

export function clearAuthSession(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
  window.sessionStorage.removeItem(AUTH_STORAGE_KEY);
}

export function getAccessToken(): string | null {
  return getAuthSession()?.accessToken ?? null;
}

export function getRefreshToken(): string | null {
  const token = getAuthSession()?.refreshToken;
  return token && token.trim() ? token.trim() : null;
}

/** Decode JWT `exp` (seconds) to epoch ms without verifying the signature. */
export function readJwtExpMs(token: string): number | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4);
    const json = JSON.parse(atob(padded)) as { exp?: unknown };
    if (typeof json.exp !== 'number' || !Number.isFinite(json.exp)) return null;
    return json.exp * 1000;
  } catch {
    return null;
  }
}

function resolveAccessExpiresAt(accessToken?: string, expiresIn?: number): number | undefined {
  if (accessToken) {
    const fromJwt = readJwtExpMs(accessToken);
    if (fromJwt != null) return fromJwt;
  }
  if (typeof expiresIn === 'number' && Number.isFinite(expiresIn) && expiresIn > 0) {
    return Date.now() + expiresIn * 1000;
  }
  return undefined;
}

/**
 * Persist a full login/refresh payload. Sets expiry from JWT `exp` or `expiresIn`,
 * and touches idle activity.
 */
export function saveSessionFromLogin(body: {
  accessToken: string;
  email: string;
  userId: string;
  designation: string;
  refreshToken?: string;
  expiresIn?: number;
}): void {
  const existing = getAuthSession();
  const accessExpiresAt =
    resolveAccessExpiresAt(body.accessToken, body.expiresIn) ?? existing?.accessExpiresAt;
  setAuthSession({
    accessToken: body.accessToken,
    email: body.email,
    userId: body.userId,
    designation: body.designation,
    refreshToken: body.refreshToken ?? existing?.refreshToken,
    accessExpiresAt,
    lastActivityAt: Date.now()
  });
}

export function touchSessionActivity(): void {
  const session = getAuthSession();
  if (!session) return;
  setAuthSession({ ...session, lastActivityAt: Date.now() });
}

export function getLastActivityAt(): number | null {
  const n = getAuthSession()?.lastActivityAt;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

export function isSessionIdleExpired(idleMs: number = IDLE_SESSION_MS): boolean {
  if (!getAccessToken()) return false;
  const last = getLastActivityAt();
  if (last == null) return false;
  return Date.now() - last >= idleMs;
}

export function getAccessTokenExpiresAtMs(): number | null {
  const session = getAuthSession();
  if (!session) return null;
  if (session.accessToken) {
    const fromJwt = readJwtExpMs(session.accessToken);
    if (fromJwt != null) return fromJwt;
  }
  const stored = session.accessExpiresAt;
  return typeof stored === 'number' && Number.isFinite(stored) ? stored : null;
}

/** True when the access token is missing expiry info or within the refresh skew window. */
export function shouldRefreshAccessToken(skewMs: number = ACCESS_TOKEN_REFRESH_SKEW_MS): boolean {
  const expiresAt = getAccessTokenExpiresAtMs();
  if (expiresAt == null) return false;
  return Date.now() >= expiresAt - skewMs;
}

/** Storage key used for cross-tab logout detection. */
export const AUTH_SESSION_STORAGE_KEY = AUTH_STORAGE_KEY;
