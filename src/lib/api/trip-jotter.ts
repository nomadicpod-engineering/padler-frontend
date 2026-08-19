import axios from 'axios';
import { padlerApi } from '../axios-client';
import { PadlerApiError } from '../api';

type PadlerEnvelope<T> = {
  success?: boolean;
  message?: string;
  data?: T;
  statusCode?: number;
};

async function unwrap<T>(promise: Promise<{ data: PadlerEnvelope<T> }>, fallback: string): Promise<T> {
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
        (e.response?.data as { message?: string } | undefined)?.message ||
        e.message ||
        fallback;
      throw new PadlerApiError(msg, status);
    }
    throw e instanceof Error ? e : new PadlerApiError(fallback);
  }
}

export type TripJotterCompany = {
  id?: number;
  companyName?: string;
  companyLogo?: string;
  email?: string;
  userId?: string;
  tripJotterId?: string;
  isTransportCompanyVerified?: boolean;
  verificationStatus?: string;
  kybRejectionReason?: string;
};

export type TripJotterUsageStep = {
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

export type TripJotterCompanyUsage = {
  transportCompanyId?: number;
  userId?: string;
  email?: string;
  companyName?: string;
  verificationStatus?: string;
  verified?: boolean;
  kybRejectionReason?: string;
  steps?: TripJotterUsageStep[];
  stuckSamples?: Record<string, unknown>[];
  pendingPaymentCount?: number;
  gdsPendingCount?: number;
};

export async function fetchTripJotterCompanies(): Promise<TripJotterCompany[]> {
  const data = await unwrap(
    padlerApi.get<PadlerEnvelope<TripJotterCompany[]>>('/api/v1/admin/trip-jotter/companies'),
    'Unable to load Trip Jotter companies'
  );
  return Array.isArray(data) ? data : [];
}

export async function fetchTripJotterCompany(companyId: number | string): Promise<TripJotterCompany> {
  return unwrap(
    padlerApi.get<PadlerEnvelope<TripJotterCompany>>(
      `/api/v1/admin/trip-jotter/companies/${encodeURIComponent(String(companyId))}`
    ),
    'Unable to load Trip Jotter company'
  );
}

export async function fetchTripJotterCompanyUsage(companyId: number | string): Promise<TripJotterCompanyUsage> {
  return unwrap(
    padlerApi.get<PadlerEnvelope<TripJotterCompanyUsage>>(
      `/api/v1/admin/trip-jotter/companies/${encodeURIComponent(String(companyId))}/usage`
    ),
    'Unable to load company usage'
  );
}

export type TripJotterListPage = {
  content?: Record<string, unknown>[];
  totalElements?: number;
  totalPages?: number;
  page?: number;
  size?: number;
  first?: boolean;
  last?: boolean;
  sort?: string;
};

export const TRIP_JOTTER_PAGE_SIZE = 20;

async function fetchCompanyListPage(
  companyId: number | string,
  resource: string,
  page: number,
  size: number,
  fallback: string,
  search?: string
): Promise<TripJotterListPage> {
  const q = new URLSearchParams();
  q.set('page', String(Math.max(0, page)));
  q.set('size', String(size > 0 ? size : TRIP_JOTTER_PAGE_SIZE));
  const needle = search?.trim();
  if (needle) {
    q.set('q', needle);
  }
  const data = await unwrap(
    padlerApi.get<PadlerEnvelope<TripJotterListPage>>(
      `/api/v1/admin/trip-jotter/companies/${encodeURIComponent(String(companyId))}/${resource}?${q}`
    ),
    fallback
  );
  return {
    content: Array.isArray(data?.content) ? data.content : [],
    totalElements: Number(data?.totalElements ?? 0),
    totalPages: Number(data?.totalPages ?? 0),
    page: Number(data?.page ?? page),
    size: Number(data?.size ?? size),
    first: Boolean(data?.first),
    last: Boolean(data?.last),
    sort: data?.sort != null ? String(data.sort) : undefined
  };
}

export async function fetchTripJotterCompanyUsers(
  companyId: number | string,
  page = 0,
  size = TRIP_JOTTER_PAGE_SIZE,
  search?: string
): Promise<TripJotterListPage> {
  return fetchCompanyListPage(companyId, 'users', page, size, 'Unable to load company users', search);
}

export async function fetchTripJotterCompanyTerminals(
  companyId: number | string,
  page = 0,
  size = TRIP_JOTTER_PAGE_SIZE,
  search?: string
): Promise<TripJotterListPage> {
  return fetchCompanyListPage(companyId, 'terminals', page, size, 'Unable to load company terminals', search);
}

export async function fetchTripJotterCompanyRoutes(
  companyId: number | string,
  page = 0,
  size = TRIP_JOTTER_PAGE_SIZE,
  search?: string
): Promise<TripJotterListPage> {
  return fetchCompanyListPage(companyId, 'routes', page, size, 'Unable to load company routes', search);
}

export async function fetchTripJotterCompanyVehicles(
  companyId: number | string,
  page = 0,
  size = TRIP_JOTTER_PAGE_SIZE,
  search?: string
): Promise<TripJotterListPage> {
  return fetchCompanyListPage(companyId, 'vehicles', page, size, 'Unable to load company vehicles', search);
}

export async function fetchTripJotterCompanyTrips(
  companyId: number | string,
  page = 0,
  size = TRIP_JOTTER_PAGE_SIZE,
  search?: string
): Promise<TripJotterListPage> {
  return fetchCompanyListPage(companyId, 'trips', page, size, 'Unable to load company trips', search);
}

export async function fetchTripJotterCompanyBookings(
  companyId: number | string,
  page = 0,
  size = TRIP_JOTTER_PAGE_SIZE,
  search?: string
): Promise<{
  rows: Record<string, unknown>[];
  totalElements: number;
  totalPages: number;
  page: number;
  size: number;
}> {
  const q = new URLSearchParams();
  q.set('page', String(Math.max(0, page)));
  q.set('size', String(size > 0 ? size : TRIP_JOTTER_PAGE_SIZE));
  const needle = search?.trim();
  if (needle) {
    q.set('q', needle);
  }
  const data = await unwrap(
    padlerApi.get<
      PadlerEnvelope<{
        content?: Record<string, unknown>[];
        totalElements?: number;
        totalPages?: number;
        page?: number;
        size?: number;
      }>
    >(
      `/api/v1/admin/trip-jotter/companies/${encodeURIComponent(String(companyId))}/bookings?${q}`
    ),
    'Unable to load company bookings'
  );
  return {
    rows: Array.isArray(data?.content) ? data.content : [],
    totalElements: Number(data?.totalElements ?? 0),
    totalPages: Number(data?.totalPages ?? 0),
    page: Number(data?.page ?? page),
    size: Number(data?.size ?? size)
  };
}

export async function tripJotterKybAction(
  companyId: number | string,
  action: 'approve' | 'reject' | 'allow-resubmit',
  reason?: string
): Promise<Record<string, unknown>> {
  return unwrap(
    padlerApi.post<PadlerEnvelope<Record<string, unknown>>>(
      `/api/v1/admin/trip-jotter/companies/${encodeURIComponent(String(companyId))}/kyb/${action}`,
      reason ? { reason } : {}
    ),
    `Unable to ${action} Trip Jotter KYB`
  );
}

export async function fetchTripJotterStuckCheckouts(): Promise<Record<string, unknown>> {
  return unwrap(
    padlerApi.get<PadlerEnvelope<Record<string, unknown>>>('/api/v1/admin/trip-jotter/checkouts/stuck'),
    'Unable to load stuck checkouts'
  );
}

export type CheckoutSeatOutcome = {
  seatNumber?: string;
  seatStatus?: string;
  outcome?: string;
  passengerName?: string;
  tripId?: number;
  bookingId?: number;
  detail?: string;
};

export type CheckoutReconcileResult = {
  bookingReference?: string;
  beforeStatus?: string;
  afterStatus?: string;
  walletSettled?: boolean;
  confirmed?: boolean;
  needsSeatAction?: boolean;
  tripId?: number;
  tripSource?: string;
  detail?: string;
  seats?: CheckoutSeatOutcome[];
};

export async function reconcileTripJotterCheckout(
  bookingReference: string
): Promise<CheckoutReconcileResult> {
  return unwrap(
    padlerApi.post<PadlerEnvelope<CheckoutReconcileResult>>(
      `/api/v1/admin/trip-jotter/checkouts/${encodeURIComponent(bookingReference)}/reconcile`
    ),
    'Unable to reconcile checkout'
  );
}
