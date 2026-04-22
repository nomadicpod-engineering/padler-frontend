export type AuthSession = {
  accessToken: string;
  email: string;
  designation: string;
  userId: string;
};

const AUTH_STORAGE_KEY = 'padler_auth_session';

export function getAuthSession(): AuthSession | null {
  if (typeof window === 'undefined') return null;
  let raw = window.sessionStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) {
    raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (raw) {
      window.sessionStorage.setItem(AUTH_STORAGE_KEY, raw);
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  }
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
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
  window.sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

export function clearAuthSession(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
  window.sessionStorage.removeItem(AUTH_STORAGE_KEY);
}
