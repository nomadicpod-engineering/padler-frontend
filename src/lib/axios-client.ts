import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { PADLER_API_BASE_URL } from './api-config';
import { getAuthSession } from './auth';
import { handleSessionExpired, tryRefreshTokens } from './auth/refresh';

type RetryConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
  skipAuthRefresh?: boolean;
};

function isAuthPublicPath(url?: string): boolean {
  if (!url) return false;
  return (
    url.includes('/api/v1/padler/auth/login') ||
    url.includes('/api/v1/padler/auth/refresh-token') ||
    url.includes('/api/v1/padler/auth/forgot-password') ||
    url.includes('/api/v1/padler/auth/reset-password') ||
    url.includes('/api/v1/padler/auth/accept-invite') ||
    url.includes('/api/v1/padler/auth/verify')
  );
}

export const padlerApi = axios.create({
  baseURL: PADLER_API_BASE_URL,
  headers: { 'Content-Type': 'application/json' }
});

padlerApi.interceptors.request.use((config) => {
  if (isAuthPublicPath(config.url)) {
    // Stale session tokens must not ride along — Spring OAuth2 returns 401 on
    // permitAll routes when an invalid Bearer JWT is present.
    if (config.headers) {
      delete config.headers.Authorization;
      delete config.headers.authorization;
    }
    (config as RetryConfig).skipAuthRefresh = true;
    return config;
  }
  const session = getAuthSession();
  if (session?.accessToken) {
    config.headers.Authorization = `Bearer ${session.accessToken}`;
  }
  return config;
});

padlerApi.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetryConfig | undefined;
    if (!config || error.response?.status !== 401) {
      return Promise.reject(error);
    }
    if (config.skipAuthRefresh || config._retry || isAuthPublicPath(config.url)) {
      return Promise.reject(error);
    }

    config._retry = true;
    const refreshed = await tryRefreshTokens();
    if (!refreshed) {
      handleSessionExpired();
      return Promise.reject(error);
    }

    const session = getAuthSession();
    if (session?.accessToken) {
      config.headers.Authorization = `Bearer ${session.accessToken}`;
    }
    return padlerApi.request(config);
  }
);
