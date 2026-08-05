import axios from 'axios';
import { padlerApi } from '../axios-client';
import { PadlerApiError } from '../api';

export type PadlerEnvelope<T> = {
  success?: boolean;
  message?: string;
  data?: T;
  statusCode?: number;
};

export type ToolsUsageStep = {
  key?: string;
  label?: string;
  status?: string;
  errorMessage?: string;
  count?: number | null;
  customerResolvable?: boolean;
  padlerResolvable?: boolean;
  featurePath?: string;
  actions?: string[];
};

export type ToolsUsage = {
  productKey?: string;
  entityType?: string;
  entityId?: string;
  userId?: string;
  email?: string;
  displayName?: string;
  verificationStatus?: string;
  verified?: boolean;
  kybRejectionReason?: string;
  note?: string;
  steps?: ToolsUsageStep[];
  queueSamples?: Record<string, unknown>[];
  counters?: Record<string, unknown>;
};

export async function unwrapTools<T>(
  promise: Promise<{ data: PadlerEnvelope<T> }>,
  fallback: string
): Promise<T> {
  try {
    const { data: json } = await promise;
    if (json?.success === false) {
      throw new PadlerApiError(json.message || fallback, json.statusCode);
    }
    return json.data as T;
  } catch (e) {
    if (e instanceof PadlerApiError) throw e;
    if (axios.isAxiosError(e)) {
      const status = e.response?.status;
      const msg =
        (e.response?.data as { message?: string } | undefined)?.message || e.message || fallback;
      throw new PadlerApiError(msg, status);
    }
    throw e instanceof Error ? e : new PadlerApiError(fallback);
  }
}

export function toolsGet<T>(path: string, fallback: string): Promise<T> {
  return unwrapTools(padlerApi.get<PadlerEnvelope<T>>(path), fallback);
}

export function toolsPost<T>(path: string, body: unknown, fallback: string): Promise<T> {
  return unwrapTools(padlerApi.post<PadlerEnvelope<T>>(path, body), fallback);
}

export function toolsPut<T>(path: string, body: unknown, fallback: string): Promise<T> {
  return unwrapTools(padlerApi.put<PadlerEnvelope<T>>(path, body), fallback);
}

export function toolsDelete<T>(path: string, fallback: string): Promise<T> {
  return unwrapTools(padlerApi.delete<PadlerEnvelope<T>>(path), fallback);
}
