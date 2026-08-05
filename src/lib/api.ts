import axios from 'axios';
import { padlerApi } from './axios-client';
import {
  AcceptanceCriteriaMatrix,
  AdapterSnapshot,
  AdminBookingLine,
  ApprovalSummary,
  AuditEventDetail,
  BookingDetail,
  BookingItem,
  BookingStatus,
  CaseAttachment,
  CaseAuditEvent,
  CaseDetail,
  CaseStatus,
  CaseSummary,
  CaseTask,
  CommandDefinition,
  CommandExecution,
  CommandRequestResult,
  ConsumerLag,
  CrmSearchResult,
  Customer360,
  DeadLetter,
  GovernanceCadence,
  IdentityCrosswalk,
  IncidentSummary,
  InviteResult,
  AcceptInviteResult,
  KnowledgeRunbook,
  LoginTrayItem,
  LoginTraySettings,
  OnboardingDocument,
  OnboardingJourney,
  OnboardingStep,
  OpsReport,
  PaymentRow,
  RolloutStatus,
  TaskStatus,
  TimelineResponse,
  TripDetail
} from './types';

/** Preserves HTTP status for permission / empty UI states. */
export class PadlerApiError extends Error {
  readonly status?: number;
  readonly forbidden: boolean;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'PadlerApiError';
    this.status = status;
    this.forbidden = status === 403;
  }
}

export function isForbiddenError(err: unknown): boolean {
  if (err instanceof PadlerApiError) return err.forbidden;
  if (axios.isAxiosError(err)) return err.response?.status === 403;
  return false;
}

export const defaultTransportCompanyEmail = process.env.NEXT_PUBLIC_PADLER_TRANSPORT_COMPANY_EMAIL ?? '';

export type TransportCompanyOption = {
  /** Trip Jotter transport company id; optional for older clients. */
  id?: number;
  email: string;
  displayName: string;
};

function normalizeBookingStatus(raw: string | undefined): BookingStatus {
  const u = (raw ?? 'PENDING').toUpperCase();
  const allowed: BookingStatus[] = [
    'PENDING',
    'CONFIRMED',
    'CANCELLED',
    'COMPLETED',
    'REFUNDED',
    'FAILED'
  ];
  return allowed.includes(u as BookingStatus) ? (u as BookingStatus) : 'PENDING';
}

function readApiError(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { message?: string; detail?: string } | undefined;
    return data?.message ?? data?.detail ?? err.message ?? fallback;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}

function toPadlerApiError(err: unknown, fallback: string): PadlerApiError {
  if (err instanceof PadlerApiError) return err;
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { message?: string; detail?: string } | undefined;
    return new PadlerApiError(
      data?.message ?? data?.detail ?? err.message ?? fallback,
      err.response?.status
    );
  }
  if (err instanceof Error) return new PadlerApiError(err.message);
  return new PadlerApiError(fallback);
}

export type SpringPageResult<T> = {
  content: T[];
  totalElements: number;
  totalPages: number;
  page: number;
  size: number;
  first: boolean;
  last: boolean;
};

function normalizeSpringPage<T>(
  data: unknown,
  mapRow: (row: Record<string, unknown>) => T,
  fallbackSize: number
): SpringPageResult<T> {
  if (Array.isArray(data)) {
    const content = data.map((row) => mapRow(row as Record<string, unknown>));
    return {
      content,
      totalElements: content.length,
      totalPages: 1,
      page: 0,
      size: content.length || fallbackSize,
      first: true,
      last: true
    };
  }
  const page = (data ?? {}) as {
    content?: unknown[];
    totalElements?: number;
    totalPages?: number;
    page?: number;
    number?: number;
    size?: number;
    first?: boolean;
    last?: boolean;
  };
  const content = Array.isArray(page.content)
    ? page.content.map((row) => mapRow(row as Record<string, unknown>))
    : [];
  const pageNum = Number(page.page ?? page.number ?? 0);
  const size = Number(page.size ?? fallbackSize);
  const totalElements = Number(page.totalElements ?? content.length);
  const totalPages = Number(page.totalPages ?? (size > 0 ? Math.ceil(totalElements / size) : 0));
  return {
    content,
    totalElements,
    totalPages,
    page: pageNum,
    size,
    first: Boolean(page.first ?? pageNum <= 0),
    last: Boolean(page.last ?? pageNum >= Math.max(totalPages - 1, 0))
  };
}

function mapCaseSummary(row: Record<string, unknown>): CaseSummary {
  return {
    id: row.id != null ? Number(row.id) : undefined,
    caseNumber: String(row.caseNumber ?? ''),
    subject: row.subject != null ? String(row.subject) : undefined,
    status: row.status != null ? String(row.status) : undefined,
    priority: row.priority != null ? String(row.priority) : undefined,
    severity: row.severity != null ? String(row.severity) : undefined,
    queueKey: row.queueKey != null ? String(row.queueKey) : undefined,
    productKey: row.productKey != null ? String(row.productKey) : undefined,
    issueCode: row.issueCode != null ? String(row.issueCode) : undefined,
    customerUserId: row.customerUserId != null ? String(row.customerUserId) : undefined,
    customerEmail: row.customerEmail != null ? String(row.customerEmail) : undefined,
    customerName: row.customerName != null ? String(row.customerName) : undefined,
    assigneePadlerId: row.assigneePadlerId != null ? String(row.assigneePadlerId) : undefined,
    linkedBookingRef: row.linkedBookingRef != null ? String(row.linkedBookingRef) : undefined,
    linkedPaymentRef: row.linkedPaymentRef != null ? String(row.linkedPaymentRef) : undefined,
    slaDueAt: row.slaDueAt != null ? String(row.slaDueAt) : undefined,
    updatedAt: row.updatedAt != null ? String(row.updatedAt) : undefined,
    createdAt: row.createdAt != null ? String(row.createdAt) : undefined
  };
}

function mapCaseDetail(row: Record<string, unknown>): CaseDetail {
  const interactions = Array.isArray(row.interactions)
    ? (row.interactions as Record<string, unknown>[]).map((i) => ({
        id: i.id != null ? Number(i.id) : undefined,
        channel: i.channel != null ? String(i.channel) : undefined,
        body: i.body != null ? String(i.body) : undefined,
        internal: Boolean(i.internal),
        authorPadlerId: i.authorPadlerId != null ? String(i.authorPadlerId) : undefined,
        authorLabel: i.authorLabel != null ? String(i.authorLabel) : undefined,
        createdAt: i.createdAt != null ? String(i.createdAt) : undefined
      }))
    : [];
  return {
    ...mapCaseSummary(row),
    description: row.description != null ? String(row.description) : undefined,
    customerPhone: row.customerPhone != null ? String(row.customerPhone) : undefined,
    organizationId: row.organizationId != null ? String(row.organizationId) : undefined,
    createdByPadlerId: row.createdByPadlerId != null ? String(row.createdByPadlerId) : undefined,
    linkedDispatchId: row.linkedDispatchId != null ? String(row.linkedDispatchId) : undefined,
    firstResponseAt: row.firstResponseAt != null ? String(row.firstResponseAt) : undefined,
    resolvedAt: row.resolvedAt != null ? String(row.resolvedAt) : undefined,
    closedAt: row.closedAt != null ? String(row.closedAt) : undefined,
    waitingReason: row.waitingReason != null ? String(row.waitingReason) : undefined,
    nextFollowUpAt: row.nextFollowUpAt != null ? String(row.nextFollowUpAt) : undefined,
    resolutionCode: row.resolutionCode != null ? String(row.resolutionCode) : undefined,
    resolutionSummary: row.resolutionSummary != null ? String(row.resolutionSummary) : undefined,
    customerImpact: row.customerImpact != null ? String(row.customerImpact) : undefined,
    reopenCount: row.reopenCount != null ? Number(row.reopenCount) : undefined,
    version: row.version != null ? Number(row.version) : undefined,
    interactions
  };
}

type PadlerEnvelope<T> = {
  success?: boolean;
  message?: string;
  detail?: string;
  data?: T;
};

export async function loginPadler(email: string, password: string): Promise<{
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  email: string;
  userId: string;
  designation: string;
}> {
  try {
    const { data: json } = await padlerApi.post<
      PadlerEnvelope<{
        email: string;
        userId: string;
        designation: string;
        authPayload?: {
          accessToken?: string;
          access_token?: string;
          refreshToken?: string;
          refresh_token?: string;
          expiresIn?: number | string;
          expires_in?: number | string;
        };
      }>
    >('/api/v1/padler/auth/login', { email, password });

    if (!json?.success || !json?.data) {
      throw new Error(json?.message ?? json?.detail ?? 'Login failed');
    }

    const authPayload = json.data.authPayload ?? {};
    const expiresRaw = authPayload.expiresIn ?? authPayload.expires_in;
    const expiresIn =
      typeof expiresRaw === 'number'
        ? expiresRaw
        : typeof expiresRaw === 'string' && Number.isFinite(Number(expiresRaw))
          ? Number(expiresRaw)
          : undefined;

    return {
      accessToken: authPayload.accessToken ?? authPayload.access_token ?? '',
      refreshToken: authPayload.refreshToken ?? authPayload.refresh_token,
      expiresIn,
      email: json.data.email,
      userId: json.data.userId,
      designation: json.data.designation
    };
  } catch (e) {
    if (e instanceof Error && !axios.isAxiosError(e)) throw e;
    throw new Error(readApiError(e, 'Login failed'));
  }
}

export async function forgotPadlerPassword(email: string): Promise<void> {
  try {
    const { data: json } = await padlerApi.post<PadlerEnvelope<unknown>>('/api/v1/padler/auth/forgot-password', {
      email
    });
    if (json?.success === false) {
      throw new Error(json?.message ?? json?.detail ?? 'Unable to send reset code');
    }
  } catch (e) {
    if (e instanceof Error && !axios.isAxiosError(e)) throw e;
    throw new Error(readApiError(e, 'Unable to send reset code'));
  }
}

export async function resetPadlerPassword(payload: {
  email: string;
  verificationCode: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<void> {
  try {
    const { data: json } = await padlerApi.post<PadlerEnvelope<unknown>>('/api/v1/padler/auth/reset-password', payload);
    if (json?.success === false) {
      throw new Error(json?.message ?? json?.detail ?? 'Unable to reset password');
    }
  } catch (e) {
    if (e instanceof Error && !axios.isAxiosError(e)) throw e;
    throw new Error(readApiError(e, 'Unable to reset password'));
  }
}

export async function fetchTransportCompanyOptions(): Promise<TransportCompanyOption[]> {
  try {
    const { data: json } = await padlerApi.get<PadlerEnvelope<unknown[]>>('/api/v1/admin/transport-companies');
    return (Array.isArray(json?.data) ? json.data : [])
      .map((r) => r as { id?: unknown; email?: string; displayName?: string })
      .filter((r) => Boolean(r.email?.trim()))
      .map((r) => ({
        id: r.id != null && r.id !== '' && !Number.isNaN(Number(r.id)) ? Number(r.id) : undefined,
        email: String(r.email),
        displayName: String(r.displayName ?? r.email)
      }));
  } catch {
    return [];
  }
}

export type BookingsPageResult = {
  rows: BookingItem[];
  totalElements: number;
  totalPages: number;
  page: number;
  size: number;
  first: boolean;
  last: boolean;
};

export const BOOKINGS_PAGE_SIZE = 10;
export const PAYMENTS_PAGE_SIZE = 10;

function mapBookingApiRow(row: Record<string, unknown>): BookingItem {
  const dep = row.departureTime;
  return {
    id: row.id != null ? Number(row.id) : undefined,
    bookingReference: String(row.bookingReference ?? ''),
    customerName: String(row.passengerName ?? ''),
    sourceChannel: 'TRIPJOTTER' as const,
    routeLabel: String(row.route ?? 'N/A'),
    companyName:
      row.companyName != null && String(row.companyName).trim() !== '' ? String(row.companyName).trim() : undefined,
    departureTime: dep != null && String(dep).trim() !== '' ? String(dep) : undefined,
    status: normalizeBookingStatus(row.status as string | undefined),
    amount: Number(row.price ?? 0),
    createdAt: String(row.createdAt ?? new Date().toISOString())
  };
}

/**
 * Paginated bookings. Use {@param allCompanies} for a super-admin view across all transport companies.
 */
export async function fetchBookingsPage(params: {
  transportCompanyEmail: string;
  allCompanies: boolean;
  page: number;
  size?: number;
}): Promise<BookingsPageResult> {
  const size = params.size ?? BOOKINGS_PAGE_SIZE;

  if (!params.allCompanies) {
    const resolved = (params.transportCompanyEmail || defaultTransportCompanyEmail).trim();
    if (!resolved) {
      throw new Error('Choose a transport company or enter its email to load bookings.');
    }
  }

  const search = new URLSearchParams();
  if (!params.allCompanies) {
    search.set('transportCompanyEmail', (params.transportCompanyEmail || defaultTransportCompanyEmail).trim());
  }
  search.set('allCompanies', String(params.allCompanies));
  search.set('page', String(Math.max(0, params.page)));
  search.set('size', String(size));

  try {
    const { data: json } = await padlerApi.get<
      PadlerEnvelope<{
        content?: unknown[];
        totalElements?: number;
        totalPages?: number;
        page?: number;
        size?: number;
        first?: boolean;
        last?: boolean;
      }>
    >(`/api/v1/admin/bookings?${search.toString()}`);

    if (json?.success === false) {
      throw new Error(json?.message ?? 'Unable to load bookings');
    }

    const data = json?.data;
    const content = Array.isArray(data?.content) ? data.content : [];

    return {
      rows: content.map((row: unknown) => mapBookingApiRow(row as Record<string, unknown>)),
      totalElements: Number(data?.totalElements ?? 0),
      totalPages: Number(data?.totalPages ?? 0),
      page: Number(data?.page ?? 0),
      size: Number(data?.size ?? size),
      first: Boolean(data?.first ?? true),
      last: Boolean(data?.last ?? true)
    };
  } catch (e) {
    if (e instanceof Error && !axios.isAxiosError(e)) throw e;
    throw new Error(readApiError(e, 'Unable to load bookings'));
  }
}

function mapBookingDetail(row: Record<string, unknown>): BookingDetail {
  const dep = row.departureTime;
  const arr = row.arrivalTime;
  return {
    id: row.id != null ? Number(row.id) : 0,
    tripId: row.tripId != null ? Number(row.tripId) : undefined,
    bookingReference: String(row.bookingReference ?? ''),
    customerName: String(row.passengerName ?? ''),
    sourceChannel: 'TRIPJOTTER' as const,
    routeLabel: String(row.route ?? 'N/A'),
    companyName:
      row.companyName != null && String(row.companyName).trim() !== '' ? String(row.companyName).trim() : undefined,
    companyLogoUrl:
      row.companyLogoUrl != null && String(row.companyLogoUrl).trim() !== ''
        ? String(row.companyLogoUrl).trim()
        : undefined,
    departureTime: dep != null && String(dep).trim() !== '' ? String(dep) : undefined,
    arrivalTime: arr != null && String(arr).trim() !== '' ? String(arr) : undefined,
    status: normalizeBookingStatus(row.status as string | undefined),
    amount: Number(row.price ?? 0),
    seatNumber: row.seatNumber != null && String(row.seatNumber) !== '' ? String(row.seatNumber) : undefined,
    passengerEmail: row.passengerEmail != null ? String(row.passengerEmail) : undefined,
    passengerPhone: row.passengerPhone != null ? String(row.passengerPhone) : undefined,
    identificationType:
      row.identificationType != null && String(row.identificationType) !== ''
        ? String(row.identificationType)
        : undefined,
    paymentMethod: row.paymentMethod != null && String(row.paymentMethod) !== '' ? String(row.paymentMethod) : undefined,
    createdAt: String(row.createdAt ?? new Date().toISOString()),
    updatedAt: String(row.updatedAt ?? row.createdAt ?? new Date().toISOString())
  };
}

/**
 * Single booking by id (Trip Jotter via BFF). Prefer allCompanies for Padler Tools id lookup.
 */
export async function fetchBookingById(params: {
  id: number;
  allCompanies: boolean;
  transportCompanyEmail: string;
}): Promise<BookingDetail> {
  if (!Number.isFinite(params.id) || params.id <= 0) {
    throw new Error('Invalid booking id');
  }
  const email = (params.transportCompanyEmail || defaultTransportCompanyEmail).trim();
  // Padler Tools loads by booking id; do not require company email.
  const allCompanies = params.allCompanies || !email;

  const search = new URLSearchParams();
  search.set('allCompanies', String(allCompanies));
  if (!allCompanies) {
    search.set('transportCompanyEmail', email);
  }

  try {
    const { data: json } = await padlerApi.get<PadlerEnvelope<Record<string, unknown>>>(
      `/api/v1/admin/bookings/${params.id}?${search.toString()}`
    );
    if (json?.success === false || !json?.data) {
      throw new Error(json?.message ?? 'Booking not found');
    }
    return mapBookingDetail(json.data);
  } catch (e) {
    if (e instanceof Error && !axios.isAxiosError(e)) throw e;
    throw new Error(readApiError(e, 'Unable to load booking'));
  }
}

export type PaymentsPageResult = {
  rows: PaymentRow[];
  totalElements: number;
  totalPages: number;
  page: number;
  size: number;
  first: boolean;
  last: boolean;
};

function mapPaymentApiRow(row: Record<string, unknown>): PaymentRow {
  return {
    id: row.id != null ? Number(row.id) : undefined,
    reference: String(row.reference ?? ''),
    amount: Number(row.amount ?? 0),
    discountAmount: Number(row.discountAmount ?? 0),
    discountCode: row.discountCode != null ? String(row.discountCode) : undefined,
    currency: String(row.currency ?? ''),
    service: String(row.service ?? '—'),
    paymentProcessor: String(row.paymentProcessor ?? '—'),
    purpose: String(row.purpose ?? '—'),
    message: row.message != null ? String(row.message) : undefined,
    email: String(row.email ?? '—'),
    payerUserId: String(row.payerUserId ?? '—'),
    status: String(row.status ?? '—'),
    createdAt: String(row.createdAt ?? ''),
    updatedAt: row.updatedAt != null ? String(row.updatedAt) : undefined,
    authorizationUrl:
      row.authorizationUrl != null && String(row.authorizationUrl).trim() !== ''
        ? String(row.authorizationUrl).trim()
        : undefined
  };
}

/**
 * Paginated payments from wallet-service (via padler BFF).
 */
export async function fetchPaymentsPage(params: { page: number; size?: number }): Promise<PaymentsPageResult> {
  const size = params.size ?? PAYMENTS_PAGE_SIZE;
  const search = new URLSearchParams();
  search.set('page', String(Math.max(0, params.page)));
  search.set('size', String(size));

  try {
    const { data: json } = await padlerApi.get<
      PadlerEnvelope<{
        content?: unknown[];
        totalElements?: number;
        totalPages?: number;
        page?: number;
        size?: number;
        first?: boolean;
        last?: boolean;
      }>
    >(`/api/v1/admin/payments?${search.toString()}`);

    if (json?.success === false) {
      throw new Error(json?.message ?? 'Unable to load payments');
    }

    const data = json?.data;
    const content = Array.isArray(data?.content) ? data.content : [];

    return {
      rows: content.map((row: unknown) => mapPaymentApiRow(row as Record<string, unknown>)),
      totalElements: Number(data?.totalElements ?? 0),
      totalPages: Number(data?.totalPages ?? 0),
      page: Number(data?.page ?? 0),
      size: Number(data?.size ?? size),
      first: Boolean(data?.first ?? true),
      last: Boolean(data?.last ?? true)
    };
  } catch (e) {
    if (e instanceof Error && !axios.isAxiosError(e)) throw e;
    throw toPadlerApiError(e, 'Unable to load payments');
  }
}

/**
 * Single payment for detail view (Padler BFF → wallet).
 */
export async function fetchPaymentById(id: number): Promise<PaymentRow> {
  if (!Number.isFinite(id) || id <= 0) {
    throw new Error('Invalid payment id');
  }
  try {
    const { data: json } = await padlerApi.get<PadlerEnvelope<Record<string, unknown>>>(
      `/api/v1/admin/payments/${id}`
    );
    if (json?.success === false || !json?.data) {
      throw new Error(json?.message ?? 'Payment not found');
    }
    return mapPaymentApiRow(json.data);
  } catch (e) {
    if (e instanceof Error && !axios.isAxiosError(e)) throw e;
    throw new Error(readApiError(e, 'Unable to load payment'));
  }
}

/**
 * Payment by reference (read-only, wallet via BFF). Use booking reference for trip bookings.
 */
export async function fetchPaymentByReference(reference: string): Promise<PaymentRow> {
  const ref = reference.trim();
  if (!ref) {
    throw new Error('Payment reference is required');
  }
  try {
    const { data: json } = await padlerApi.get<PadlerEnvelope<Record<string, unknown>>>(
      `/api/v1/admin/payments/by-reference/${encodeURIComponent(ref)}`
    );
    if (json?.success === false || !json?.data) {
      throw new Error(json?.message ?? 'Payment not found');
    }
    return mapPaymentApiRow(json.data);
  } catch (e) {
    if (e instanceof Error && !axios.isAxiosError(e)) throw e;
    throw new Error(readApiError(e, 'Unable to load payment'));
  }
}

function mapTripDetail(data: Record<string, unknown>): TripDetail {
  const seats = data.vehicleSeats;
  return {
    id: data.id != null ? Number(data.id) : 0,
    transportCompanyId: data.transportCompanyId != null ? Number(data.transportCompanyId) : undefined,
    originTerminalId: data.originTerminalId != null ? Number(data.originTerminalId) : undefined,
    destinationTerminalId:
      data.destinationTerminalId != null ? Number(data.destinationTerminalId) : undefined,
    routeOrigin: data.routeOrigin != null ? String(data.routeOrigin) : undefined,
    routeDestination: data.routeDestination != null ? String(data.routeDestination) : undefined,
    transportCompanyName:
      data.transportCompanyName != null ? String(data.transportCompanyName) : undefined,
    vehicleCapacity: data.vehicleCapacity != null ? Number(data.vehicleCapacity) : undefined,
    vehicleType: data.vehicleType != null ? String(data.vehicleType) : undefined,
    vehicleSeatLayout: data.vehicleSeatLayout != null ? String(data.vehicleSeatLayout) : undefined,
    vehicleLicensePlate: data.vehicleLicensePlate != null ? String(data.vehicleLicensePlate) : undefined,
    vehicleStatus: data.vehicleStatus != null ? String(data.vehicleStatus) : undefined,
    driverName: data.driverName != null ? String(data.driverName) : undefined,
    driverPhone: data.driverPhone != null ? String(data.driverPhone) : undefined,
    departureTime: data.departureTime != null ? String(data.departureTime) : undefined,
    arrivalTime: data.arrivalTime != null ? String(data.arrivalTime) : undefined,
    basePrice: data.basePrice != null ? Number(data.basePrice) : undefined,
    status: data.status != null ? String(data.status) : undefined,
    tripType: data.tripType != null ? String(data.tripType) : undefined,
    bookedSeats: data.bookedSeats != null ? Number(data.bookedSeats) : undefined,
    vehicleSeats: Array.isArray(seats)
      ? (seats as Record<string, unknown>[]).map((s) => ({
          number: String(s.number ?? ''),
          status: String(s.status ?? 'AVAILABLE')
        }))
      : undefined
  };
}

/**
 * Trip Jotter trip with seats (Padler BFF). Scope must match the booking list/detail context.
 */
/**
 * Padler admin: list later trips (same company, O/D) for reassigning after payment.
 */
export async function fetchTripAlternativesForBooking(params: {
  transportCompanyId: number;
  originTerminalId: number;
  destinationTerminalId: number;
  departureAfter?: string;
  excludeTripId?: number;
}): Promise<TripDetail[]> {
  const q = new URLSearchParams();
  q.set('transportCompanyId', String(params.transportCompanyId));
  q.set('originTerminalId', String(params.originTerminalId));
  q.set('destinationTerminalId', String(params.destinationTerminalId));
  if (params.departureAfter?.trim()) {
    q.set('departureAfter', params.departureAfter.trim());
  }
  if (params.excludeTripId != null && params.excludeTripId > 0) {
    q.set('excludeTripId', String(params.excludeTripId));
  }
  try {
    const { data: json } = await padlerApi.get<PadlerEnvelope<unknown[]>>(
      `/api/v1/admin/trips/alternatives?${q.toString()}`
    );
    if (json?.success === false || !Array.isArray(json?.data)) {
      return [];
    }
    return (json.data as Record<string, unknown>[]).map((row) => mapTripDetail(row));
  } catch {
    return [];
  }
}

/**
 * One row per seat line (order matches reassign `newSeatNumbers`).
 */
export async function fetchAdminBookingLines(bookingReference: string): Promise<AdminBookingLine[]> {
  const ref = bookingReference.trim();
  if (!ref) {
    throw new Error('Booking reference is required');
  }
  try {
    const { data: json } = await padlerApi.get<PadlerEnvelope<unknown[]>>(
      `/api/v1/admin/bookings/${encodeURIComponent(ref)}/lines`
    );
    if (json?.success === false || !Array.isArray(json?.data)) {
      throw new Error(json?.message ?? 'Unable to load booking lines');
    }
    return (json.data as Record<string, unknown>[]).map((row) => ({
      id: row.id != null ? Number(row.id) : undefined,
      seatNumber: row.seatNumber != null ? String(row.seatNumber) : undefined,
      passengerName: row.passengerName != null ? String(row.passengerName) : undefined,
      status: row.status != null ? String(row.status) : undefined
    }));
  } catch (e) {
    if (e instanceof Error && !axios.isAxiosError(e)) throw e;
    throw new Error(readApiError(e, 'Unable to load booking lines'));
  }
}

export async function reassignSeatsAfterPayment(
  bookingReference: string,
  body: {
    newTripId?: number;
    newSeatNumbers: string[];
    reason?: string;
    sourceAction?: string;
    actionBy?: string;
  }
): Promise<void> {
  const ref = bookingReference.trim();
  if (!ref) {
    throw new Error('Booking reference is required');
  }
  if (!Array.isArray(body.newSeatNumbers) || body.newSeatNumbers.length === 0) {
    throw new Error('newSeatNumbers is required');
  }
  try {
    const { data: json } = await padlerApi.post<PadlerEnvelope<unknown>>(
      `/api/v1/admin/bookings/${encodeURIComponent(ref)}/reassign-after-payment`,
      {
        newTripId: body.newTripId,
        newSeatNumbers: body.newSeatNumbers,
        reason: body.reason ?? 'Reassign from Padler admin (after payment)',
        sourceAction: body.sourceAction ?? 'PADLER_ADMIN_REASSIGN',
        actionBy: body.actionBy
      }
    );
    if (json?.success === false) {
      throw new Error(json?.message ?? json?.detail ?? 'Reassign failed');
    }
  } catch (e) {
    if (e instanceof Error && !axios.isAxiosError(e)) throw e;
    throw new Error(readApiError(e, 'Reassign failed'));
  }
}

export type TerminalListItem = {
  id: number;
  name: string;
  city?: string;
  state?: string;
};

/**
 * All active terminals (Trip Jotter public list) via Padler BFF, for new-booking origin/destination.
 */
export async function fetchAdminTerminals(website?: string): Promise<TerminalListItem[]> {
  const q = new URLSearchParams();
  if (website?.trim()) {
    q.set('website', website.trim());
  }
  const suffix = q.toString() ? `?${q.toString()}` : '';
  try {
    const { data: json } = await padlerApi.get<PadlerEnvelope<unknown[]>>(
      `/api/v1/admin/terminals${suffix}`
    );
    if (json?.success === false || !Array.isArray(json?.data)) {
      return [];
    }
    return (json.data as Record<string, unknown>[])
      .map((r) => ({
        id: r.id != null ? Number(r.id) : 0,
        name: String(r.name ?? ''),
        city: r.city != null && String(r.city).trim() !== '' ? String(r.city) : undefined,
        state: r.state != null && String(r.state).trim() !== '' ? String(r.state) : undefined
      }))
      .filter((t) => t.id > 0 && t.name.trim() !== '');
  } catch (e) {
    if (e instanceof Error && !axios.isAxiosError(e)) throw e;
    throw new Error(readApiError(e, 'Unable to load terminals'));
  }
}

/**
 * String passed to public trip search (matches terminal address city or location LIKE in Trip Jotter).
 */
export function searchTextFromTerminal(t: TerminalListItem | undefined): string {
  if (!t) {
    return '';
  }
  const c = t.city?.trim();
  if (c) {
    return c;
  }
  return t.name.trim() ?? '';
}

/**
 * Public-style trip search (area/city and date) via Padler BFF → Trip Jotter.
 */
export async function searchTripsForAdmin(params: {
  origin: string;
  destination: string;
  date: string;
  website?: string;
}): Promise<TripDetail[]> {
  const o = params.origin.trim();
  const d = params.destination.trim();
  const day = params.date.trim();
  if (!o || !d || !day) {
    throw new Error('Origin, destination, and date are required.');
  }
  const q = new URLSearchParams();
  q.set('origin', o);
  q.set('destination', d);
  q.set('date', day);
  if (params.website?.trim()) {
    q.set('website', params.website.trim());
  }
  try {
    const { data: json } = await padlerApi.get<PadlerEnvelope<unknown[]>>(
      `/api/v1/admin/trip-search?${q.toString()}`
    );
    if (json?.success === false || !Array.isArray(json?.data)) {
      return [];
    }
    return (json.data as Record<string, unknown>[]).map((row) => mapTripDetail(row));
  } catch (e) {
    if (e instanceof Error && !axios.isAxiosError(e)) throw e;
    throw new Error(readApiError(e, 'Unable to search trips'));
  }
}

export type AdminTravellerDetailPayload = {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  seatNumber: string;
  email: string;
  nextOfKinName: string;
  nextOfKinPhone: string;
  identificationType?: string;
};

export type AdminCreateBookingPayload = {
  sourceChannel: string;
  sourceAction: string;
  sourceName?: string;
  /** If omitted, Trip Jotter resolves the operator from the trip. */
  transportCompanyEmail?: string;
  tripId: number;
  departureTerminalId: number;
  destinationTerminalId: number;
  travellerDetails: AdminTravellerDetailPayload[];
  additionalLuggageAmount?: number;
  paymentMethod?: string;
  seatHoldSessionId?: string;
};

export type AdminCreateBookingResult = {
  message?: string;
  primaryBookingReference?: string;
  bookingReferences?: string[];
  authorizationUrl?: string;
};

/**
 * Create booking via Trip Jotter admin (back-office) API.
 */
export async function createAdminBooking(
  payload: AdminCreateBookingPayload
): Promise<AdminCreateBookingResult> {
  try {
    const { data: json } = await padlerApi.post<PadlerEnvelope<AdminCreateBookingResult>>(
      '/api/v1/admin/bookings',
      payload
    );
    if (json?.success === false || !json?.data) {
      throw new Error(json?.message ?? json?.detail ?? 'Booking failed');
    }
    return json.data;
  } catch (e) {
    if (e instanceof Error && !axios.isAxiosError(e)) throw e;
    throw new Error(readApiError(e, 'Unable to create booking'));
  }
}

export async function fetchTripForBookingDetail(params: {
  tripId: number;
  allCompanies: boolean;
  transportCompanyEmail: string;
}): Promise<TripDetail> {
  if (!Number.isFinite(params.tripId) || params.tripId <= 0) {
    throw new Error('Invalid trip id');
  }
  if (!params.allCompanies) {
    const resolved = (params.transportCompanyEmail || defaultTransportCompanyEmail).trim();
    if (!resolved) {
      throw new Error('Transport company email is required to load the trip in this scope.');
    }
  }
  const search = new URLSearchParams();
  search.set('allCompanies', String(params.allCompanies));
  if (!params.allCompanies) {
    search.set('transportCompanyEmail', (params.transportCompanyEmail || defaultTransportCompanyEmail).trim());
  }
  try {
    const { data: json } = await padlerApi.get<PadlerEnvelope<Record<string, unknown>>>(
      `/api/v1/admin/trips/${params.tripId}?${search.toString()}`
    );
    if (json?.success === false || !json?.data) {
      throw new Error(json?.message ?? 'Trip not found');
    }
    return mapTripDetail(json.data);
  } catch (e) {
    if (e instanceof Error && !axios.isAxiosError(e)) throw e;
    throw new Error(readApiError(e, 'Unable to load trip'));
  }
}

export function isWalletPaymentSuccessful(status: string | undefined): boolean {
  if (!status?.trim()) return false;
  const u = status.trim().toUpperCase();
  return u === 'COMPLETED' || u === 'SUCCESSFUL';
}

export async function mutateBookingAction(
  bookingReference: string,
  action: 'approve' | 'cancel' | 'complete' | 'refund',
  payload: Record<string, unknown>
): Promise<boolean> {
  try {
    const res = await padlerApi.post(`/api/v1/admin/bookings/${bookingReference}/${action}`, payload);
    return res.status >= 200 && res.status < 300;
  } catch {
    return false;
  }
}

export type DashboardSummary = {
  totalBookings: number;
  pendingApprovals: number;
  cancelledBookings: number;
  completedBookings: number;
  totalRevenue: number;
};

export type DashboardOverview = {
  counts: Record<string, unknown>;
  monthlyBookings: { month: number; count: number }[];
  upcomingTrips: { id: string; title: string; meta: string; when: string }[];
  topCustomers: { name: string; tripCount: number; roleLabel: string }[];
  kpi: { last7Days: number; previous7Days: number };
};

function pickCount(raw: Record<string, unknown> | undefined, ...keys: string[]): number {
  if (!raw) return 0;
  for (const k of keys) {
    const v = raw[k];
    if (v != null && typeof v === 'number' && !Number.isNaN(v)) {
      return v;
    }
    if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) {
      return Number(v);
    }
  }
  return 0;
}

/** Maps Trip Jotter / Feign count field names (total, pending, …) to dashboard summary. */
export function mapDashboardSummaryFromCounts(
  raw: Record<string, unknown> | undefined
): DashboardSummary {
  return {
    totalBookings: pickCount(raw, 'totalBookings', 'total'),
    pendingApprovals: pickCount(raw, 'pendingApprovals', 'totalPendingBookings', 'pending'),
    cancelledBookings: pickCount(raw, 'cancelledBookings', 'totalCancelledBookings', 'cancelled'),
    completedBookings: pickCount(raw, 'completedBookings', 'totalCompletedBookings', 'completed'),
    totalRevenue: pickCount(raw, 'totalRevenue', 'revenue')
  };
}

/**
 * One round-trip: counts, monthly trend, upcoming trips, top customers, and KPI windows.
 * Returns null when a transport company is required but missing.
 */
export async function fetchDashboardOverview(params: {
  transportCompanyEmail: string;
  allCompanies: boolean;
  year?: number;
  upcomingLimit?: number;
  topLimit?: number;
  topScope?: 'year' | 'all';
}): Promise<DashboardOverview | null> {
  if (!params.allCompanies) {
    const resolved = (params.transportCompanyEmail || defaultTransportCompanyEmail).trim();
    if (!resolved) {
      return null;
    }
  }
  const search = new URLSearchParams();
  if (!params.allCompanies) {
    search.set('transportCompanyEmail', (params.transportCompanyEmail || defaultTransportCompanyEmail).trim());
  }
  search.set('allCompanies', String(params.allCompanies));
  if (params.year != null) {
    search.set('year', String(params.year));
  }
  search.set('upcomingLimit', String(params.upcomingLimit ?? 4));
  search.set('topLimit', String(params.topLimit ?? 3));
  search.set('topScope', params.topScope ?? 'year');

  const empty: DashboardOverview = {
    counts: {},
    monthlyBookings: [],
    upcomingTrips: [],
    topCustomers: [],
    kpi: { last7Days: 0, previous7Days: 0 }
  };
  try {
    const { data: json } = await padlerApi.get<PadlerEnvelope<DashboardOverview>>(
      `/api/v1/admin/dashboard/overview?${search.toString()}`
    );
    if (json?.success === false || !json?.data) {
      return empty;
    }
    return {
      ...empty,
      ...json.data,
      monthlyBookings: Array.isArray(json.data.monthlyBookings) ? json.data.monthlyBookings : [],
      upcomingTrips: Array.isArray(json.data.upcomingTrips) ? json.data.upcomingTrips : [],
      topCustomers: Array.isArray(json.data.topCustomers) ? json.data.topCustomers : [],
      kpi: json.data.kpi ?? { last7Days: 0, previous7Days: 0 }
    };
  } catch {
    return empty;
  }
}

/**
 * @deprecated Prefer {@link fetchDashboardOverview} for the full dashboard. Wrapper around summary only.
 */
export async function fetchDashboardSummary(params: {
  transportCompanyEmail: string;
  allCompanies: boolean;
}): Promise<DashboardSummary> {
  const empty: DashboardSummary = {
    totalBookings: 0,
    pendingApprovals: 0,
    cancelledBookings: 0,
    completedBookings: 0,
    totalRevenue: 0
  };
  if (!params.allCompanies) {
    const resolved = (params.transportCompanyEmail || defaultTransportCompanyEmail).trim();
    if (!resolved) {
      return empty;
    }
  }
  try {
    const search = new URLSearchParams();
    if (!params.allCompanies) {
      search.set('transportCompanyEmail', (params.transportCompanyEmail || defaultTransportCompanyEmail).trim());
    }
    search.set('allCompanies', String(params.allCompanies));
    const { data: json } = await padlerApi.get<PadlerEnvelope<Record<string, unknown>>>(
      `/api/v1/admin/dashboard/summary?${search.toString()}`
    );
    if (!json?.data || typeof json.data !== 'object') {
      return empty;
    }
    return mapDashboardSummaryFromCounts(json.data as Record<string, unknown>);
  } catch {
    return empty;
  }
}

/* ===================== CRM / Cases / Approvals / Commands ===================== */

export const CASES_PAGE_SIZE = 20;

export async function searchCases(params: {
  status?: CaseStatus | string;
  queueKey?: string;
  assignee?: string;
  q?: string;
  page?: number;
  size?: number;
}): Promise<SpringPageResult<CaseSummary>> {
  const size = params.size ?? CASES_PAGE_SIZE;
  const search = new URLSearchParams();
  if (params.status) search.set('status', String(params.status));
  if (params.queueKey?.trim()) search.set('queueKey', params.queueKey.trim());
  if (params.assignee?.trim()) search.set('assignee', params.assignee.trim());
  if (params.q?.trim()) search.set('q', params.q.trim());
  search.set('page', String(Math.max(0, params.page ?? 0)));
  search.set('size', String(size));
  try {
    const { data: json } = await padlerApi.get<PadlerEnvelope<unknown>>(
      `/api/v1/admin/cases?${search.toString()}`
    );
    if (json?.success === false) {
      throw new PadlerApiError(json?.message ?? json?.detail ?? 'Unable to search cases');
    }
    return normalizeSpringPage(json?.data, mapCaseSummary, size);
  } catch (e) {
    throw toPadlerApiError(e, 'Unable to search cases');
  }
}

export async function getCase(caseNumber: string): Promise<CaseDetail> {
  const num = caseNumber.trim();
  if (!num) throw new PadlerApiError('Case number is required');
  try {
    const { data: json } = await padlerApi.get<PadlerEnvelope<Record<string, unknown>>>(
      `/api/v1/admin/cases/${encodeURIComponent(num)}`
    );
    if (json?.success === false || !json?.data) {
      throw new PadlerApiError(json?.message ?? json?.detail ?? 'Case not found', 404);
    }
    return mapCaseDetail(json.data);
  } catch (e) {
    throw toPadlerApiError(e, 'Unable to load case');
  }
}

export async function createCase(body: Record<string, unknown>): Promise<CaseDetail> {
  try {
    const { data: json } = await padlerApi.post<PadlerEnvelope<Record<string, unknown>>>(
      '/api/v1/admin/cases',
      body
    );
    if (json?.success === false || !json?.data) {
      throw new PadlerApiError(json?.message ?? json?.detail ?? 'Unable to create case');
    }
    return mapCaseDetail(json.data);
  } catch (e) {
    throw toPadlerApiError(e, 'Unable to create case');
  }
}

export async function updateCase(
  caseNumber: string,
  body: Record<string, unknown>
): Promise<CaseDetail> {
  const num = caseNumber.trim();
  if (!num) throw new PadlerApiError('Case number is required');
  try {
    const { data: json } = await padlerApi.patch<PadlerEnvelope<Record<string, unknown>>>(
      `/api/v1/admin/cases/${encodeURIComponent(num)}`,
      body
    );
    if (json?.success === false || !json?.data) {
      throw new PadlerApiError(json?.message ?? json?.detail ?? 'Unable to update case');
    }
    return mapCaseDetail(json.data);
  } catch (e) {
    throw toPadlerApiError(e, 'Unable to update case');
  }
}

export async function addCaseInteraction(
  caseNumber: string,
  body: { channel: string; body: string; internal?: boolean }
): Promise<CaseDetail> {
  const num = caseNumber.trim();
  if (!num) throw new PadlerApiError('Case number is required');
  try {
    const { data: json } = await padlerApi.post<PadlerEnvelope<Record<string, unknown>>>(
      `/api/v1/admin/cases/${encodeURIComponent(num)}/interactions`,
      body
    );
    if (json?.success === false || !json?.data) {
      throw new PadlerApiError(json?.message ?? json?.detail ?? 'Unable to add interaction');
    }
    return mapCaseDetail(json.data);
  } catch (e) {
    throw toPadlerApiError(e, 'Unable to add interaction');
  }
}

export async function escalateCase(
  caseNumber: string,
  body: { reason: string; targetQueueKey?: string; priority?: string; severity?: string }
): Promise<CaseDetail> {
  const num = caseNumber.trim();
  if (!num) throw new PadlerApiError('Case number is required');
  try {
    const { data: json } = await padlerApi.post<PadlerEnvelope<Record<string, unknown>>>(
      `/api/v1/admin/cases/${encodeURIComponent(num)}/escalate`,
      body
    );
    if (json?.success === false || !json?.data) {
      throw new PadlerApiError(json?.message ?? json?.detail ?? 'Unable to escalate case');
    }
    return mapCaseDetail(json.data);
  } catch (e) {
    throw toPadlerApiError(e, 'Unable to escalate case');
  }
}

export async function listCaseAudit(caseNumber: string): Promise<CaseAuditEvent[]> {
  const num = caseNumber.trim();
  if (!num) throw new PadlerApiError('Case number is required');
  try {
    const { data: json } = await padlerApi.get<PadlerEnvelope<unknown[]>>(
      `/api/v1/admin/cases/${encodeURIComponent(num)}/audit`
    );
    if (json?.success === false) {
      throw new PadlerApiError(json?.message ?? json?.detail ?? 'Unable to load case audit');
    }
    const rows = Array.isArray(json?.data) ? json.data : [];
    return rows.map((r) => {
      const row = r as Record<string, unknown>;
      return {
        id: row.id != null ? Number(row.id) : undefined,
        action: row.action != null ? String(row.action) : undefined,
        detail: row.detail != null ? String(row.detail) : undefined,
        actorPadlerId: row.actorPadlerId != null ? String(row.actorPadlerId) : undefined,
        actorEmail: row.actorEmail != null ? String(row.actorEmail) : undefined,
        requestId: row.requestId != null ? String(row.requestId) : undefined,
        createdAt: row.createdAt != null ? String(row.createdAt) : undefined
      };
    });
  } catch (e) {
    throw toPadlerApiError(e, 'Unable to load case audit');
  }
}

export async function getCaseTimeline(caseNumber: string): Promise<TimelineResponse> {
  const num = caseNumber.trim();
  if (!num) throw new PadlerApiError('Case number is required');
  try {
    const { data: json } = await padlerApi.get<PadlerEnvelope<Record<string, unknown>>>(
      `/api/v1/admin/cases/${encodeURIComponent(num)}/timeline`
    );
    if (json?.success === false) {
      throw new PadlerApiError(json?.message ?? json?.detail ?? 'Unable to load timeline');
    }
    const data = (json?.data ?? {}) as Record<string, unknown>;
    const items = Array.isArray(data.items)
      ? (data.items as Record<string, unknown>[]).map(mapTimelineItem)
      : [];
    return {
      partyType: data.partyType != null ? String(data.partyType) : undefined,
      partyKey: data.partyKey != null ? String(data.partyKey) : undefined,
      caseNumber: data.caseNumber != null ? String(data.caseNumber) : undefined,
      items
    };
  } catch (e) {
    throw toPadlerApiError(e, 'Unable to load timeline');
  }
}

function mapTimelineItem(row: Record<string, unknown>) {
  return {
    id: row.id != null ? Number(row.id) : undefined,
    auditEventId: row.auditEventId != null ? Number(row.auditEventId) : undefined,
    envelopeId: row.envelopeId != null ? String(row.envelopeId) : undefined,
    partyType: row.partyType != null ? String(row.partyType) : undefined,
    partyKey: row.partyKey != null ? String(row.partyKey) : undefined,
    caseNumber: row.caseNumber != null ? String(row.caseNumber) : undefined,
    category: row.category != null ? String(row.category) : undefined,
    eventType: row.eventType != null ? String(row.eventType) : undefined,
    title: row.title != null ? String(row.title) : undefined,
    summary: row.summary != null ? String(row.summary) : undefined,
    sourceSystem: row.sourceSystem != null ? String(row.sourceSystem) : undefined,
    occurredAt: row.occurredAt != null ? String(row.occurredAt) : undefined,
    ingestedAt: row.ingestedAt != null ? String(row.ingestedAt) : undefined,
    sourceFreshnessAt: row.sourceFreshnessAt != null ? String(row.sourceFreshnessAt) : undefined,
    sequenceNo: row.sequenceNo != null ? Number(row.sequenceNo) : undefined
  };
}

export async function crmSearch(q: string): Promise<CrmSearchResult> {
  const query = q.trim();
  if (!query) throw new PadlerApiError('Search query is required');
  try {
    const { data: json } = await padlerApi.get<PadlerEnvelope<Record<string, unknown>>>(
      `/api/v1/admin/crm/search?q=${encodeURIComponent(query)}`
    );
    if (json?.success === false) {
      throw new PadlerApiError(json?.message ?? json?.detail ?? 'CRM search failed');
    }
    const data = (json?.data ?? {}) as Record<string, unknown>;
    return {
      query: data.query != null ? String(data.query) : query,
      cases: Array.isArray(data.cases)
        ? (data.cases as Record<string, unknown>[]).map(mapCaseSummary)
        : [],
      identities: Array.isArray(data.identities)
        ? (data.identities as Record<string, unknown>[]).map((row) => ({
            id: row.id != null ? Number(row.id) : undefined,
            partyType: row.partyType != null ? String(row.partyType) : undefined,
            partyKey: row.partyKey != null ? String(row.partyKey) : undefined,
            customerUserId: row.customerUserId != null ? String(row.customerUserId) : undefined,
            keycloakSub: row.keycloakSub != null ? String(row.keycloakSub) : undefined,
            email: row.email != null ? String(row.email) : undefined,
            phone: row.phone != null ? String(row.phone) : undefined,
            displayName: row.displayName != null ? String(row.displayName) : undefined,
            organizationId: row.organizationId != null ? String(row.organizationId) : undefined,
            productIdsJson: row.productIdsJson != null ? String(row.productIdsJson) : undefined,
            sourceFreshnessAt: row.sourceFreshnessAt != null ? String(row.sourceFreshnessAt) : undefined
          }))
        : []
    };
  } catch (e) {
    throw toPadlerApiError(e, 'CRM search failed');
  }
}

export async function crmLookup(params: {
  email?: string;
  phone?: string;
  customerUserId?: string;
  bookingRef?: string;
  paymentRef?: string;
  dispatchId?: string;
}): Promise<CaseSummary[]> {
  const search = new URLSearchParams();
  if (params.email?.trim()) search.set('email', params.email.trim());
  if (params.phone?.trim()) search.set('phone', params.phone.trim());
  if (params.customerUserId?.trim()) search.set('customerUserId', params.customerUserId.trim());
  if (params.bookingRef?.trim()) search.set('bookingRef', params.bookingRef.trim());
  if (params.paymentRef?.trim()) search.set('paymentRef', params.paymentRef.trim());
  if (params.dispatchId?.trim()) search.set('dispatchId', params.dispatchId.trim());
  if (![...search.keys()].length) {
    throw new PadlerApiError('At least one lookup parameter is required');
  }
  try {
    const { data: json } = await padlerApi.get<PadlerEnvelope<unknown>>(
      `/api/v1/admin/crm/lookup?${search.toString()}`
    );
    if (json?.success === false) {
      throw new PadlerApiError(json?.message ?? json?.detail ?? 'CRM lookup failed');
    }
    const data = json?.data;
    if (Array.isArray(data)) {
      return data.map((row) => mapCaseSummary(row as Record<string, unknown>));
    }
    return [];
  } catch (e) {
    throw toPadlerApiError(e, 'CRM lookup failed');
  }
}

export async function getCustomer360(customerUserId: string): Promise<Customer360> {
  const id = customerUserId.trim();
  if (!id) throw new PadlerApiError('Customer user id is required');
  try {
    const { data: json } = await padlerApi.get<PadlerEnvelope<Record<string, unknown>>>(
      `/api/v1/admin/crm/customer-360?customerUserId=${encodeURIComponent(id)}`
    );
    if (json?.success === false || !json?.data) {
      throw new PadlerApiError(json?.message ?? json?.detail ?? 'Customer 360 not found');
    }
    const data = json.data;
    return {
      ...data,
      customerUserId: data.customerUserId != null ? String(data.customerUserId) : id,
      openCases: Array.isArray(data.openCases)
        ? (data.openCases as Record<string, unknown>[]).map(mapCaseSummary)
        : [],
      timeline: Array.isArray(data.timeline)
        ? (data.timeline as Record<string, unknown>[]).map(mapTimelineItem)
        : [],
      dependencyHealthBySystem:
        data.dependencyHealthBySystem && typeof data.dependencyHealthBySystem === 'object'
          ? (data.dependencyHealthBySystem as Record<string, string>)
          : undefined,
      dependencyHealth: data.dependencyHealth != null ? String(data.dependencyHealth) : undefined,
      errorCode: data.errorCode != null ? String(data.errorCode) : undefined,
      errorMessage: data.errorMessage != null ? String(data.errorMessage) : undefined
    } as Customer360;
  } catch (e) {
    throw toPadlerApiError(e, 'Unable to load customer 360');
  }
}

function mapApproval(row: Record<string, unknown>): ApprovalSummary {
  return {
    id: row.id != null ? Number(row.id) : undefined,
    approvalNumber: String(row.approvalNumber ?? ''),
    commandKey: row.commandKey != null ? String(row.commandKey) : undefined,
    riskClass: row.riskClass != null ? String(row.riskClass) : undefined,
    status: row.status != null ? String(row.status) : undefined,
    makerPadlerId: row.makerPadlerId != null ? String(row.makerPadlerId) : undefined,
    makerEmail: row.makerEmail != null ? String(row.makerEmail) : undefined,
    checkerPadlerId: row.checkerPadlerId != null ? String(row.checkerPadlerId) : undefined,
    checkerEmail: row.checkerEmail != null ? String(row.checkerEmail) : undefined,
    caseNumber: row.caseNumber != null ? String(row.caseNumber) : undefined,
    customerUserId: row.customerUserId != null ? String(row.customerUserId) : undefined,
    idempotencyKey: row.idempotencyKey != null ? String(row.idempotencyKey) : undefined,
    payloadJson: row.payloadJson != null ? String(row.payloadJson) : undefined,
    reason: row.reason != null ? String(row.reason) : undefined,
    decisionNote: row.decisionNote != null ? String(row.decisionNote) : undefined,
    requestedAt: row.requestedAt != null ? String(row.requestedAt) : undefined,
    decidedAt: row.decidedAt != null ? String(row.decidedAt) : undefined,
    expiresAt: row.expiresAt != null ? String(row.expiresAt) : undefined,
    version: row.version != null ? Number(row.version) : undefined
  };
}

export async function listApprovals(status?: string): Promise<ApprovalSummary[]> {
  const search = new URLSearchParams();
  if (status?.trim()) search.set('status', status.trim());
  const suffix = search.toString() ? `?${search.toString()}` : '';
  try {
    const { data: json } = await padlerApi.get<PadlerEnvelope<unknown>>(
      `/api/v1/admin/approvals${suffix}`
    );
    if (json?.success === false) {
      throw new PadlerApiError(json?.message ?? json?.detail ?? 'Unable to load approvals');
    }
    const data = json?.data;
    if (!Array.isArray(data)) return [];
    return data.map((row) => mapApproval(row as Record<string, unknown>));
  } catch (e) {
    throw toPadlerApiError(e, 'Unable to load approvals');
  }
}

export async function approveApproval(
  approvalNumber: string,
  decisionNote?: string
): Promise<unknown> {
  const num = approvalNumber.trim();
  if (!num) throw new PadlerApiError('Approval number is required');
  try {
    const { data: json } = await padlerApi.post<PadlerEnvelope<unknown>>(
      `/api/v1/admin/approvals/${encodeURIComponent(num)}/approve`,
      decisionNote?.trim() ? { decisionNote: decisionNote.trim() } : {}
    );
    if (json?.success === false) {
      throw new PadlerApiError(json?.message ?? json?.detail ?? 'Unable to approve');
    }
    return json?.data;
  } catch (e) {
    throw toPadlerApiError(e, 'Unable to approve');
  }
}

export async function rejectApproval(
  approvalNumber: string,
  decisionNote?: string
): Promise<ApprovalSummary> {
  const num = approvalNumber.trim();
  if (!num) throw new PadlerApiError('Approval number is required');
  try {
    const { data: json } = await padlerApi.post<PadlerEnvelope<Record<string, unknown>>>(
      `/api/v1/admin/approvals/${encodeURIComponent(num)}/reject`,
      decisionNote?.trim() ? { decisionNote: decisionNote.trim() } : {}
    );
    if (json?.success === false || !json?.data) {
      throw new PadlerApiError(json?.message ?? json?.detail ?? 'Unable to reject');
    }
    return mapApproval(json.data);
  } catch (e) {
    throw toPadlerApiError(e, 'Unable to reject');
  }
}

export async function cancelApproval(approvalNumber: string): Promise<ApprovalSummary> {
  const num = approvalNumber.trim();
  if (!num) throw new PadlerApiError('Approval number is required');
  try {
    const { data: json } = await padlerApi.post<PadlerEnvelope<Record<string, unknown>>>(
      `/api/v1/admin/approvals/${encodeURIComponent(num)}/cancel`
    );
    if (json?.success === false || !json?.data) {
      throw new PadlerApiError(json?.message ?? json?.detail ?? 'Unable to cancel');
    }
    return mapApproval(json.data);
  } catch (e) {
    throw toPadlerApiError(e, 'Unable to cancel');
  }
}

const UI_SAFE_RISKS = new Set(['R0', 'R1', 'R2']);

/** Lists command definitions; UI actions should only use enabled R0–R2. */
export async function listCommands(opts?: {
  uiSafeOnly?: boolean;
}): Promise<CommandDefinition[]> {
  try {
    const { data: json } = await padlerApi.get<PadlerEnvelope<unknown>>('/api/v1/admin/commands');
    if (json?.success === false) {
      throw new PadlerApiError(json?.message ?? json?.detail ?? 'Unable to load commands');
    }
    const rows = Array.isArray(json?.data) ? json.data : [];
    const mapped = rows.map((r) => {
      const row = r as Record<string, unknown>;
      return {
        id: row.id != null ? Number(row.id) : undefined,
        commandKey: String(row.commandKey ?? ''),
        displayName: row.displayName != null ? String(row.displayName) : undefined,
        productKey: row.productKey != null ? String(row.productKey) : undefined,
        riskClass: row.riskClass != null ? String(row.riskClass) : undefined,
        requiredCapability: row.requiredCapability != null ? String(row.requiredCapability) : undefined,
        requiresApproval: Boolean(row.requiresApproval),
        approvalExpiryMinutes:
          row.approvalExpiryMinutes != null ? Number(row.approvalExpiryMinutes) : undefined,
        enabled: Boolean(row.enabled),
        description: row.description != null ? String(row.description) : undefined
      } satisfies CommandDefinition;
    });
    if (opts?.uiSafeOnly === false) return mapped;
    return mapped.filter(
      (c) => c.enabled && c.riskClass != null && UI_SAFE_RISKS.has(String(c.riskClass).toUpperCase())
    );
  } catch (e) {
    throw toPadlerApiError(e, 'Unable to load commands');
  }
}

export async function listCommandExecutions(params?: {
  status?: string;
  commandKey?: string;
}): Promise<CommandExecution[]> {
  const search = new URLSearchParams();
  if (params?.status?.trim()) search.set('status', params.status.trim());
  if (params?.commandKey?.trim()) search.set('commandKey', params.commandKey.trim());
  const suffix = search.toString() ? `?${search.toString()}` : '';
  try {
    const { data: json } = await padlerApi.get<PadlerEnvelope<unknown>>(
      `/api/v1/admin/commands/executions${suffix}`
    );
    if (json?.success === false) {
      throw new PadlerApiError(json?.message ?? json?.detail ?? 'Unable to load executions');
    }
    const rows = Array.isArray(json?.data) ? json.data : [];
    return rows.map((r) => {
      const row = r as Record<string, unknown>;
      return mapCommandExecution(row);
    });
  } catch (e) {
    throw toPadlerApiError(e, 'Unable to load executions');
  }
}

function mapCommandExecution(row: Record<string, unknown>): CommandExecution {
  return {
    id: row.id != null ? Number(row.id) : undefined,
    executionNumber: String(row.executionNumber ?? ''),
    approvalRequestId: row.approvalRequestId != null ? Number(row.approvalRequestId) : undefined,
    commandKey: row.commandKey != null ? String(row.commandKey) : undefined,
    idempotencyKey: row.idempotencyKey != null ? String(row.idempotencyKey) : undefined,
    status: row.status != null ? String(row.status) : undefined,
    makerPadlerId: row.makerPadlerId != null ? String(row.makerPadlerId) : undefined,
    actorPadlerId: row.actorPadlerId != null ? String(row.actorPadlerId) : undefined,
    caseNumber: row.caseNumber != null ? String(row.caseNumber) : undefined,
    customerUserId: row.customerUserId != null ? String(row.customerUserId) : undefined,
    requestPayloadJson: row.requestPayloadJson != null ? String(row.requestPayloadJson) : undefined,
    beforeSnapshotJson: row.beforeSnapshotJson != null ? String(row.beforeSnapshotJson) : undefined,
    afterSnapshotJson: row.afterSnapshotJson != null ? String(row.afterSnapshotJson) : undefined,
    resultSummary: row.resultSummary != null ? String(row.resultSummary) : undefined,
    errorCode: row.errorCode != null ? String(row.errorCode) : undefined,
    errorDetail: row.errorDetail != null ? String(row.errorDetail) : undefined,
    productReference: row.productReference != null ? String(row.productReference) : undefined,
    correlationRequestId: row.correlationRequestId != null ? String(row.correlationRequestId) : undefined,
    startedAt: row.startedAt != null ? String(row.startedAt) : undefined,
    finishedAt: row.finishedAt != null ? String(row.finishedAt) : undefined,
    reconcileDueAt: row.reconcileDueAt != null ? String(row.reconcileDueAt) : undefined,
    reconciledAt: row.reconciledAt != null ? String(row.reconciledAt) : undefined,
    version: row.version != null ? Number(row.version) : undefined
  };
}

export async function getCommand(commandKey: string): Promise<CommandDefinition> {
  const key = commandKey.trim();
  if (!key) throw new PadlerApiError('Command key is required');
  try {
    const { data: json } = await padlerApi.get<PadlerEnvelope<Record<string, unknown>>>(
      `/api/v1/admin/commands/${encodeURIComponent(key)}`
    );
    if (json?.success === false || !json?.data) {
      throw new PadlerApiError(json?.message ?? json?.detail ?? 'Command not found', 404);
    }
    const row = json.data;
    return {
      id: row.id != null ? Number(row.id) : undefined,
      commandKey: String(row.commandKey ?? key),
      displayName: row.displayName != null ? String(row.displayName) : undefined,
      productKey: row.productKey != null ? String(row.productKey) : undefined,
      riskClass: row.riskClass != null ? String(row.riskClass) : undefined,
      requiredCapability: row.requiredCapability != null ? String(row.requiredCapability) : undefined,
      requiresApproval: Boolean(row.requiresApproval),
      approvalExpiryMinutes:
        row.approvalExpiryMinutes != null ? Number(row.approvalExpiryMinutes) : undefined,
      enabled: Boolean(row.enabled),
      description: row.description != null ? String(row.description) : undefined
    };
  } catch (e) {
    throw toPadlerApiError(e, 'Unable to load command');
  }
}

export async function requestCommandExecution(body: {
  commandKey: string;
  idempotencyKey: string;
  caseNumber?: string;
  customerUserId?: string;
  payload?: Record<string, unknown>;
  reason?: string;
}): Promise<CommandRequestResult> {
  try {
    const { data: json } = await padlerApi.post<PadlerEnvelope<Record<string, unknown>>>(
      '/api/v1/admin/commands/executions',
      body
    );
    if (json?.success === false || !json?.data) {
      throw new PadlerApiError(json?.message ?? json?.detail ?? 'Unable to request command');
    }
    const data = json.data;
    const approvalRaw = data.approval as Record<string, unknown> | null | undefined;
    const executionRaw = data.execution as Record<string, unknown> | null | undefined;
    return {
      outcome: String(data.outcome ?? 'UNKNOWN'),
      approval: approvalRaw ? mapApproval(approvalRaw) : null,
      execution: executionRaw ? mapCommandExecution(executionRaw) : null
    };
  } catch (e) {
    throw toPadlerApiError(e, 'Unable to request command');
  }
}

export async function getCommandExecution(executionNumber: string): Promise<CommandExecution> {
  const num = executionNumber.trim();
  if (!num) throw new PadlerApiError('Execution number is required');
  try {
    const { data: json } = await padlerApi.get<PadlerEnvelope<Record<string, unknown>>>(
      `/api/v1/admin/commands/executions/${encodeURIComponent(num)}`
    );
    if (json?.success === false || !json?.data) {
      throw new PadlerApiError(json?.message ?? json?.detail ?? 'Execution not found', 404);
    }
    return mapCommandExecution(json.data);
  } catch (e) {
    throw toPadlerApiError(e, 'Unable to load execution');
  }
}

export async function reconcileCommandExecution(
  executionNumber: string,
  note: string
): Promise<CommandExecution> {
  const num = executionNumber.trim();
  if (!num) throw new PadlerApiError('Execution number is required');
  if (!note.trim()) throw new PadlerApiError('Reconcile note is required');
  try {
    const { data: json } = await padlerApi.post<PadlerEnvelope<Record<string, unknown>>>(
      `/api/v1/admin/commands/executions/${encodeURIComponent(num)}/reconcile`,
      { note: note.trim() }
    );
    if (json?.success === false || !json?.data) {
      throw new PadlerApiError(json?.message ?? json?.detail ?? 'Unable to reconcile execution');
    }
    return mapCommandExecution(json.data);
  } catch (e) {
    throw toPadlerApiError(e, 'Unable to reconcile execution');
  }
}

export async function getApproval(approvalNumber: string): Promise<ApprovalSummary> {
  const num = approvalNumber.trim();
  if (!num) throw new PadlerApiError('Approval number is required');
  try {
    const { data: json } = await padlerApi.get<PadlerEnvelope<Record<string, unknown>>>(
      `/api/v1/admin/approvals/${encodeURIComponent(num)}`
    );
    if (json?.success === false || !json?.data) {
      throw new PadlerApiError(json?.message ?? json?.detail ?? 'Approval not found', 404);
    }
    return mapApproval(json.data);
  } catch (e) {
    throw toPadlerApiError(e, 'Unable to load approval');
  }
}

function mapNamedCounts(raw: unknown): { name: string; count: number }[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      name: String(r.name ?? 'UNKNOWN'),
      count: Number(r.count ?? 0)
    };
  });
}

export async function fetchOpsReport(): Promise<OpsReport> {
  try {
    const { data: json } = await padlerApi.get<PadlerEnvelope<Record<string, unknown>>>(
      '/api/v1/admin/reports/ops'
    );
    if (json?.success === false || !json?.data) {
      throw new PadlerApiError(json?.message ?? json?.detail ?? 'Unable to load ops report');
    }
    const d = json.data;
    return {
      generatedAt: d.generatedAt != null ? String(d.generatedAt) : undefined,
      openBacklog: Number(d.openBacklog ?? 0),
      slaBreached: Number(d.slaBreached ?? 0),
      slaAtRisk: Number(d.slaAtRisk ?? 0),
      casesWithReopen: Number(d.casesWithReopen ?? 0),
      totalReopenEvents: Number(d.totalReopenEvents ?? 0),
      escalationEvents: Number(d.escalationEvents ?? 0),
      pendingApprovals: Number(d.pendingApprovals ?? 0),
      agingApprovalsOver24h: Number(d.agingApprovalsOver24h ?? 0),
      failedExecutions: Number(d.failedExecutions ?? 0),
      unknownExecutions: Number(d.unknownExecutions ?? 0),
      backlogByStatus: mapNamedCounts(d.backlogByStatus),
      backlogByQueue: mapNamedCounts(d.backlogByQueue),
      workloadByAssignee: mapNamedCounts(d.workloadByAssignee),
      contactsByChannel: mapNamedCounts(d.contactsByChannel),
      failedActionsByErrorCode: mapNamedCounts(d.failedActionsByErrorCode),
      executionsByStatus: mapNamedCounts(d.executionsByStatus),
      qualitySampleCaseNumbers: Array.isArray(d.qualitySampleCaseNumbers)
        ? d.qualitySampleCaseNumbers.map((n) => String(n))
        : []
    };
  } catch (e) {
    throw toPadlerApiError(e, 'Unable to load ops report');
  }
}

export async function fetchGovernanceCadence(): Promise<GovernanceCadence> {
  try {
    const { data: json } = await padlerApi.get<PadlerEnvelope<Record<string, unknown>>>(
      '/api/v1/admin/governance/cadence'
    );
    if (json?.success === false || !json?.data) {
      throw new PadlerApiError(json?.message ?? json?.detail ?? 'Unable to load governance cadence');
    }
    const d = json.data;
    const signals = Array.isArray(d.liveSignals) ? d.liveSignals : [];
    const reviews = Array.isArray(d.reviews) ? d.reviews : [];
    return {
      phase: String(d.phase ?? '11'),
      generatedAt: d.generatedAt != null ? String(d.generatedAt) : undefined,
      rolloutMode: d.rolloutMode != null ? String(d.rolloutMode) : undefined,
      highRiskCommandsAllowed: Boolean(d.highRiskCommandsAllowed),
      liveSignals: signals.map((row) => {
        const r = row as Record<string, unknown>;
        return {
          code: String(r.code ?? ''),
          label: String(r.label ?? ''),
          value: Number(r.value ?? 0),
          severity: String(r.severity ?? 'OK')
        };
      }),
      reviews: reviews.map((row) => {
        const r = row as Record<string, unknown>;
        const checklist = Array.isArray(r.checklist) ? r.checklist : [];
        return {
          id: String(r.id ?? ''),
          cadence: String(r.cadence ?? ''),
          title: String(r.title ?? ''),
          owner: r.owner != null ? String(r.owner) : undefined,
          periodStart: r.periodStart != null ? String(r.periodStart) : null,
          nextDueDate: r.nextDueDate != null ? String(r.nextDueDate) : null,
          dueStatus: String(r.dueStatus ?? 'TEMPLATE'),
          checklist: checklist.map((item) => {
            const c = item as Record<string, unknown>;
            return {
              code: String(c.code ?? ''),
              label: String(c.label ?? ''),
              evidenceHint: c.evidenceHint != null ? String(c.evidenceHint) : undefined
            };
          }),
          relatedApis: Array.isArray(r.relatedApis) ? r.relatedApis.map((a) => String(a)) : []
        };
      }),
      note: d.note != null ? String(d.note) : undefined
    };
  } catch (e) {
    throw toPadlerApiError(e, 'Unable to load governance cadence');
  }
}

export async function fetchAcceptanceCriteria(): Promise<AcceptanceCriteriaMatrix> {
  try {
    const { data: json } = await padlerApi.get<PadlerEnvelope<Record<string, unknown>>>(
      '/api/v1/admin/acceptance/criteria'
    );
    if (json?.success === false || !json?.data) {
      throw new PadlerApiError(json?.message ?? json?.detail ?? 'Unable to load acceptance criteria');
    }
    const d = json.data;
    const rawCriteria = Array.isArray(d.criteria) ? d.criteria : [];
    const statusCounts: Record<string, number> = {};
    if (d.statusCounts && typeof d.statusCounts === 'object') {
      for (const [k, v] of Object.entries(d.statusCounts as Record<string, unknown>)) {
        statusCounts[k] = Number(v ?? 0);
      }
    }
    const snap = d.rolloutSnapshot as Record<string, unknown> | undefined;
    return {
      phase: String(d.phase ?? '10'),
      generatedAt: d.generatedAt != null ? String(d.generatedAt) : undefined,
      statusCounts,
      criteria: rawCriteria.map((row) => {
        const r = row as Record<string, unknown>;
        return {
          id: String(r.id ?? ''),
          category: String(r.category ?? ''),
          criterion: String(r.criterion ?? ''),
          status: String(r.status ?? 'UNKNOWN'),
          evidence: r.evidence != null ? String(r.evidence) : undefined,
          owner: r.owner != null ? String(r.owner) : undefined
        };
      }),
      note: d.note != null ? String(d.note) : undefined,
      rolloutSnapshot: snap
        ? {
            rolloutMode: snap.rolloutMode != null ? String(snap.rolloutMode) : undefined,
            commandsEnabled: Boolean(snap.commandsEnabled),
            highRiskCommandsAllowed: Boolean(snap.highRiskCommandsAllowed),
            adaptersConfigured:
              snap.adaptersConfigured && typeof snap.adaptersConfigured === 'object'
                ? (snap.adaptersConfigured as Record<string, boolean>)
                : undefined
          }
        : undefined
    };
  } catch (e) {
    throw toPadlerApiError(e, 'Unable to load acceptance criteria');
  }
}

export async function fetchRolloutStatus(): Promise<RolloutStatus> {
  try {
    const { data: json } = await padlerApi.get<PadlerEnvelope<Record<string, unknown>>>(
      '/api/v1/admin/rollout'
    );
    if (json?.success === false || !json?.data) {
      throw new PadlerApiError(json?.message ?? json?.detail ?? 'Unable to load rollout status');
    }
    const d = json.data;
    return {
      mode: String(d.mode ?? 'UNKNOWN'),
      commandsEnabled: Boolean(d.commandsEnabled),
      canaryCohort: d.canaryCohort != null ? String(d.canaryCohort) : null,
      allowsR0: Boolean(d.allowsR0),
      allowsR1: Boolean(d.allowsR1),
      allowsR2: Boolean(d.allowsR2),
      allowsR3: Boolean(d.allowsR3),
      allowsR4: Boolean(d.allowsR4),
      nextModeHint: d.nextModeHint != null ? String(d.nextModeHint) : undefined,
      rollbackHint: d.rollbackHint != null ? String(d.rollbackHint) : undefined
    };
  } catch (e) {
    throw toPadlerApiError(e, 'Unable to load rollout status');
  }
}

/* ===================== Case support (tasks / attachments / link / merge / runbooks) ===================== */

function mapCaseTask(row: Record<string, unknown>): CaseTask {
  return {
    id: row.id != null ? Number(row.id) : undefined,
    caseNumber: row.caseNumber != null ? String(row.caseNumber) : undefined,
    title: String(row.title ?? ''),
    description: row.description != null ? String(row.description) : undefined,
    status: row.status != null ? (String(row.status) as TaskStatus) : undefined,
    assigneePadlerId: row.assigneePadlerId != null ? String(row.assigneePadlerId) : undefined,
    dueAt: row.dueAt != null ? String(row.dueAt) : undefined,
    completedAt: row.completedAt != null ? String(row.completedAt) : undefined,
    createdByPadlerId: row.createdByPadlerId != null ? String(row.createdByPadlerId) : undefined,
    createdAt: row.createdAt != null ? String(row.createdAt) : undefined
  };
}

function mapCaseAttachment(row: Record<string, unknown>): CaseAttachment {
  return {
    id: row.id != null ? Number(row.id) : undefined,
    fileName: String(row.fileName ?? ''),
    contentType: row.contentType != null ? String(row.contentType) : undefined,
    storageKey: row.storageKey != null ? String(row.storageKey) : undefined,
    sizeBytes: row.sizeBytes != null ? Number(row.sizeBytes) : undefined,
    uploadedByPadlerId: row.uploadedByPadlerId != null ? String(row.uploadedByPadlerId) : undefined,
    checksumSha256: row.checksumSha256 != null ? String(row.checksumSha256) : undefined,
    createdAt: row.createdAt != null ? String(row.createdAt) : undefined
  };
}

function mapRunbook(row: Record<string, unknown>): KnowledgeRunbook {
  return {
    id: row.id != null ? Number(row.id) : undefined,
    issueCode: String(row.issueCode ?? ''),
    title: row.title != null ? String(row.title) : undefined,
    productKey: row.productKey != null ? String(row.productKey) : undefined,
    customerSafeSummary: row.customerSafeSummary != null ? String(row.customerSafeSummary) : undefined,
    whatThisMeans: row.whatThisMeans != null ? String(row.whatThisMeans) : undefined,
    checksToPerform: row.checksToPerform != null ? String(row.checksToPerform) : undefined,
    safeResolution: row.safeResolution != null ? String(row.safeResolution) : undefined,
    whenToEscalate: row.whenToEscalate != null ? String(row.whenToEscalate) : undefined,
    ownerQueueKey: row.ownerQueueKey != null ? String(row.ownerQueueKey) : undefined,
    active: row.active != null ? Boolean(row.active) : undefined,
    updatedAt: row.updatedAt != null ? String(row.updatedAt) : undefined
  };
}

export async function listCaseTasks(caseNumber: string): Promise<CaseTask[]> {
  const num = caseNumber.trim();
  if (!num) throw new PadlerApiError('Case number is required');
  try {
    const { data: json } = await padlerApi.get<PadlerEnvelope<unknown[]>>(
      `/api/v1/admin/cases/${encodeURIComponent(num)}/tasks`
    );
    if (json?.success === false) {
      throw new PadlerApiError(json?.message ?? json?.detail ?? 'Unable to load tasks');
    }
    const rows = Array.isArray(json?.data) ? json.data : [];
    return rows.map((r) => mapCaseTask(r as Record<string, unknown>));
  } catch (e) {
    throw toPadlerApiError(e, 'Unable to load tasks');
  }
}

export async function createCaseTask(
  caseNumber: string,
  body: { title: string; description?: string; assigneePadlerId?: string; dueAt?: string }
): Promise<CaseTask> {
  const num = caseNumber.trim();
  if (!num) throw new PadlerApiError('Case number is required');
  try {
    const { data: json } = await padlerApi.post<PadlerEnvelope<Record<string, unknown>>>(
      `/api/v1/admin/cases/${encodeURIComponent(num)}/tasks`,
      body
    );
    if (json?.success === false || !json?.data) {
      throw new PadlerApiError(json?.message ?? json?.detail ?? 'Unable to create task');
    }
    return mapCaseTask(json.data);
  } catch (e) {
    throw toPadlerApiError(e, 'Unable to create task');
  }
}

export async function updateCaseTask(
  caseNumber: string,
  taskId: number,
  body: { status?: TaskStatus | string; assigneePadlerId?: string }
): Promise<CaseTask> {
  const num = caseNumber.trim();
  if (!num) throw new PadlerApiError('Case number is required');
  try {
    const { data: json } = await padlerApi.patch<PadlerEnvelope<Record<string, unknown>>>(
      `/api/v1/admin/cases/${encodeURIComponent(num)}/tasks/${taskId}`,
      body
    );
    if (json?.success === false || !json?.data) {
      throw new PadlerApiError(json?.message ?? json?.detail ?? 'Unable to update task');
    }
    return mapCaseTask(json.data);
  } catch (e) {
    throw toPadlerApiError(e, 'Unable to update task');
  }
}

export async function listCaseAttachments(caseNumber: string): Promise<CaseAttachment[]> {
  const num = caseNumber.trim();
  if (!num) throw new PadlerApiError('Case number is required');
  try {
    const { data: json } = await padlerApi.get<PadlerEnvelope<unknown[]>>(
      `/api/v1/admin/cases/${encodeURIComponent(num)}/attachments`
    );
    if (json?.success === false) {
      throw new PadlerApiError(json?.message ?? json?.detail ?? 'Unable to load attachments');
    }
    const rows = Array.isArray(json?.data) ? json.data : [];
    return rows.map((r) => mapCaseAttachment(r as Record<string, unknown>));
  } catch (e) {
    throw toPadlerApiError(e, 'Unable to load attachments');
  }
}

export async function registerCaseAttachment(
  caseNumber: string,
  body: {
    fileName: string;
    storageKey: string;
    contentType?: string;
    sizeBytes?: number;
    checksumSha256?: string;
  }
): Promise<CaseAttachment> {
  const num = caseNumber.trim();
  if (!num) throw new PadlerApiError('Case number is required');
  try {
    const { data: json } = await padlerApi.post<PadlerEnvelope<Record<string, unknown>>>(
      `/api/v1/admin/cases/${encodeURIComponent(num)}/attachments`,
      body
    );
    if (json?.success === false || !json?.data) {
      throw new PadlerApiError(json?.message ?? json?.detail ?? 'Unable to register attachment');
    }
    return mapCaseAttachment(json.data);
  } catch (e) {
    throw toPadlerApiError(e, 'Unable to register attachment');
  }
}

export async function linkCase(
  caseNumber: string,
  body: { targetCaseNumber: string; linkType: string }
): Promise<CaseDetail> {
  const num = caseNumber.trim();
  if (!num) throw new PadlerApiError('Case number is required');
  try {
    const { data: json } = await padlerApi.post<PadlerEnvelope<Record<string, unknown>>>(
      `/api/v1/admin/cases/${encodeURIComponent(num)}/links`,
      body
    );
    if (json?.success === false || !json?.data) {
      throw new PadlerApiError(json?.message ?? json?.detail ?? 'Unable to link case');
    }
    return mapCaseDetail(json.data);
  } catch (e) {
    throw toPadlerApiError(e, 'Unable to link case');
  }
}

export async function mergeCase(
  caseNumber: string,
  body: { survivorCaseNumber: string; reason?: string }
): Promise<CaseDetail> {
  const num = caseNumber.trim();
  if (!num) throw new PadlerApiError('Case number is required');
  try {
    const { data: json } = await padlerApi.post<PadlerEnvelope<Record<string, unknown>>>(
      `/api/v1/admin/cases/${encodeURIComponent(num)}/merge`,
      body
    );
    if (json?.success === false || !json?.data) {
      throw new PadlerApiError(json?.message ?? json?.detail ?? 'Unable to merge case');
    }
    return mapCaseDetail(json.data);
  } catch (e) {
    throw toPadlerApiError(e, 'Unable to merge case');
  }
}

export async function getRunbook(issueCode: string): Promise<KnowledgeRunbook | null> {
  const code = issueCode.trim();
  if (!code) return null;
  try {
    const { data: json } = await padlerApi.get<PadlerEnvelope<Record<string, unknown>>>(
      `/api/v1/admin/crm/runbooks/${encodeURIComponent(code)}`
    );
    if (json?.success === false || !json?.data) return null;
    return mapRunbook(json.data);
  } catch (e) {
    if (axios.isAxiosError(e) && e.response?.status === 404) return null;
    throw toPadlerApiError(e, 'Unable to load runbook');
  }
}

export async function listRunbooks(productKey?: string): Promise<KnowledgeRunbook[]> {
  const search = new URLSearchParams();
  if (productKey?.trim()) search.set('productKey', productKey.trim());
  const suffix = search.toString() ? `?${search.toString()}` : '';
  try {
    const { data: json } = await padlerApi.get<PadlerEnvelope<unknown[]>>(
      `/api/v1/admin/crm/runbooks${suffix}`
    );
    if (json?.success === false) {
      throw new PadlerApiError(json?.message ?? json?.detail ?? 'Unable to load runbooks');
    }
    const rows = Array.isArray(json?.data) ? json.data : [];
    return rows.map((r) => mapRunbook(r as Record<string, unknown>));
  } catch (e) {
    throw toPadlerApiError(e, 'Unable to load runbooks');
  }
}

/* ===================== Adapters / identities (C3) ===================== */

function asAdapterSnapshot(data: Record<string, unknown> | null | undefined): AdapterSnapshot {
  if (!data) return { dependencyHealth: 'UNCONFIGURED' };
  return {
    ...data,
    dependencyHealth: data.dependencyHealth != null ? String(data.dependencyHealth) : undefined,
    errorCode: data.errorCode != null ? String(data.errorCode) : undefined,
    errorMessage: data.errorMessage != null ? String(data.errorMessage) : undefined,
    sourceSystem: data.sourceSystem != null ? String(data.sourceSystem) : undefined,
    sourceFreshnessAt: data.sourceFreshnessAt != null ? String(data.sourceFreshnessAt) : undefined
  };
}

async function getAdapter(
  path: string,
  fallback: string
): Promise<AdapterSnapshot> {
  try {
    const { data: json } = await padlerApi.get<PadlerEnvelope<Record<string, unknown>>>(path);
    if (json?.success === false) {
      throw new PadlerApiError(json?.message ?? json?.detail ?? fallback);
    }
    return asAdapterSnapshot(json?.data ?? undefined);
  } catch (e) {
    if (axios.isAxiosError(e) && e.response?.status === 403) {
      throw toPadlerApiError(e, fallback);
    }
    // Soft-fail individual adapters so 360 page can still render.
    if (axios.isAxiosError(e)) {
      const data = e.response?.data as { message?: string; detail?: string } | undefined;
      return {
        dependencyHealth: e.response?.status === 404 ? 'UNCONFIGURED' : 'DOWN',
        errorCode: String(e.response?.status ?? 'ERROR'),
        errorMessage: data?.message ?? data?.detail ?? e.message ?? fallback
      };
    }
    throw toPadlerApiError(e, fallback);
  }
}

export async function fetchAdapterIdentity(userId: string): Promise<AdapterSnapshot> {
  return getAdapter(`/api/v1/admin/adapters/identity/${encodeURIComponent(userId.trim())}`, 'Identity adapter failed');
}

export async function fetchAdapterWallet(userId: string): Promise<AdapterSnapshot> {
  return getAdapter(`/api/v1/admin/adapters/wallet/${encodeURIComponent(userId.trim())}`, 'Wallet adapter failed');
}

export async function fetchAdapterWealth(userId: string): Promise<AdapterSnapshot> {
  return getAdapter(`/api/v1/admin/adapters/wealth/${encodeURIComponent(userId.trim())}`, 'Wealth adapter failed');
}

export async function fetchAdapterCapslocker(userId: string): Promise<AdapterSnapshot> {
  return getAdapter(
    `/api/v1/admin/adapters/capslocker/${encodeURIComponent(userId.trim())}`,
    'Capslocker adapter failed'
  );
}

export async function fetchAdapterTripJotterOps(adminEmail: string): Promise<AdapterSnapshot> {
  const email = adminEmail.trim();
  if (!email) {
    return { dependencyHealth: 'UNCONFIGURED', errorMessage: 'Admin email required for TripJotter ops' };
  }
  return getAdapter(
    `/api/v1/admin/adapters/trip-jotter/ops?adminEmail=${encodeURIComponent(email)}`,
    'TripJotter ops failed'
  );
}

export async function fetchAdapterDriftSafety(): Promise<AdapterSnapshot> {
  return getAdapter('/api/v1/admin/adapters/drift/safety', 'Drift safety failed');
}

export async function fetchAdapterClassycarOps(): Promise<AdapterSnapshot> {
  return getAdapter('/api/v1/admin/adapters/classycar/ops', 'Classycar ops failed');
}

export async function fetchAdapterNpodOps(): Promise<AdapterSnapshot> {
  return getAdapter('/api/v1/admin/adapters/npod/ops', 'Npod ops failed');
}

function mapIdentity(row: Record<string, unknown>): IdentityCrosswalk {
  return {
    id: row.id != null ? Number(row.id) : undefined,
    partyType: row.partyType != null ? String(row.partyType) : undefined,
    partyKey: row.partyKey != null ? String(row.partyKey) : undefined,
    customerUserId: row.customerUserId != null ? String(row.customerUserId) : undefined,
    keycloakSub: row.keycloakSub != null ? String(row.keycloakSub) : undefined,
    email: row.email != null ? String(row.email) : undefined,
    phone: row.phone != null ? String(row.phone) : undefined,
    displayName: row.displayName != null ? String(row.displayName) : undefined,
    organizationId: row.organizationId != null ? String(row.organizationId) : undefined,
    productIdsJson: row.productIdsJson != null ? String(row.productIdsJson) : undefined,
    sourceFreshnessAt: row.sourceFreshnessAt != null ? String(row.sourceFreshnessAt) : undefined
  };
}

export async function listIdentities(q?: string): Promise<IdentityCrosswalk[]> {
  const search = new URLSearchParams();
  if (q?.trim()) search.set('q', q.trim());
  const suffix = search.toString() ? `?${search.toString()}` : '';
  try {
    const { data: json } = await padlerApi.get<PadlerEnvelope<unknown[]>>(
      `/api/v1/admin/crm/identities${suffix}`
    );
    if (json?.success === false) {
      throw new PadlerApiError(json?.message ?? json?.detail ?? 'Unable to list identities');
    }
    const rows = Array.isArray(json?.data) ? json.data : [];
    return rows.map((r) => mapIdentity(r as Record<string, unknown>));
  } catch (e) {
    throw toPadlerApiError(e, 'Unable to list identities');
  }
}

export async function upsertIdentity(body: {
  partyType: string;
  partyKey: string;
  keycloakSub?: string;
  email?: string;
  phone?: string;
  displayName?: string;
  organizationId?: string;
  productIdsJson?: string;
}): Promise<IdentityCrosswalk> {
  try {
    const { data: json } = await padlerApi.put<PadlerEnvelope<Record<string, unknown>>>(
      '/api/v1/admin/crm/identities',
      body
    );
    if (json?.success === false || !json?.data) {
      throw new PadlerApiError(json?.message ?? json?.detail ?? 'Unable to upsert identity');
    }
    return mapIdentity(json.data);
  } catch (e) {
    throw toPadlerApiError(e, 'Unable to upsert identity');
  }
}

/* ===================== Incidents / audit / invite (C4) ===================== */

function mapIncident(row: Record<string, unknown>): IncidentSummary {
  const linked = Array.isArray(row.linkedCaseNumbers)
    ? (row.linkedCaseNumbers as unknown[]).map((c) => String(c))
    : undefined;
  return {
    id: row.id != null ? Number(row.id) : undefined,
    incidentNumber: String(row.incidentNumber ?? ''),
    title: row.title != null ? String(row.title) : undefined,
    summary: row.summary != null ? String(row.summary) : undefined,
    status: row.status != null ? String(row.status) : undefined,
    severity: row.severity != null ? String(row.severity) : undefined,
    productKey: row.productKey != null ? String(row.productKey) : undefined,
    dependencyKey: row.dependencyKey != null ? String(row.dependencyKey) : undefined,
    customerImpact: row.customerImpact != null ? String(row.customerImpact) : undefined,
    correlationKey: row.correlationKey != null ? String(row.correlationKey) : undefined,
    affectedPartyCount: row.affectedPartyCount != null ? Number(row.affectedPartyCount) : undefined,
    startedAt: row.startedAt != null ? String(row.startedAt) : undefined,
    resolvedAt: row.resolvedAt != null ? String(row.resolvedAt) : undefined,
    createdByPadlerId: row.createdByPadlerId != null ? String(row.createdByPadlerId) : undefined,
    createdAt: row.createdAt != null ? String(row.createdAt) : undefined,
    linkedCaseNumbers: linked
  };
}

export async function listIncidents(params?: {
  status?: string;
  page?: number;
  size?: number;
}): Promise<SpringPageResult<IncidentSummary>> {
  const search = new URLSearchParams();
  if (params?.status?.trim()) search.set('status', params.status.trim());
  search.set('page', String(params?.page ?? 0));
  search.set('size', String(params?.size ?? 20));
  try {
    const { data: json } = await padlerApi.get<PadlerEnvelope<unknown>>(
      `/api/v1/admin/incidents?${search.toString()}`
    );
    if (json?.success === false) {
      throw new PadlerApiError(json?.message ?? json?.detail ?? 'Unable to list incidents');
    }
    return normalizeSpringPage(json?.data, (row) => mapIncident(row as Record<string, unknown>), params?.size ?? 20);
  } catch (e) {
    throw toPadlerApiError(e, 'Unable to list incidents');
  }
}

export async function getIncident(incidentNumber: string): Promise<IncidentSummary> {
  const num = incidentNumber.trim();
  if (!num) throw new PadlerApiError('Incident number is required');
  try {
    const { data: json } = await padlerApi.get<PadlerEnvelope<Record<string, unknown>>>(
      `/api/v1/admin/incidents/${encodeURIComponent(num)}`
    );
    if (json?.success === false || !json?.data) {
      throw new PadlerApiError(json?.message ?? json?.detail ?? 'Incident not found', 404);
    }
    return mapIncident(json.data);
  } catch (e) {
    throw toPadlerApiError(e, 'Unable to load incident');
  }
}

export async function createIncident(body: {
  title: string;
  summary: string;
  severity?: string;
  productKey?: string;
  dependencyKey?: string;
  customerImpact?: string;
}): Promise<IncidentSummary> {
  try {
    const { data: json } = await padlerApi.post<PadlerEnvelope<Record<string, unknown>>>(
      '/api/v1/admin/incidents',
      body
    );
    if (json?.success === false || !json?.data) {
      throw new PadlerApiError(json?.message ?? json?.detail ?? 'Unable to create incident');
    }
    return mapIncident(json.data);
  } catch (e) {
    throw toPadlerApiError(e, 'Unable to create incident');
  }
}

export async function linkIncidentCase(
  incidentNumber: string,
  caseNumber: string
): Promise<IncidentSummary> {
  const inc = incidentNumber.trim();
  const cse = caseNumber.trim();
  if (!inc || !cse) throw new PadlerApiError('Incident and case numbers are required');
  try {
    const { data: json } = await padlerApi.post<PadlerEnvelope<Record<string, unknown>>>(
      `/api/v1/admin/incidents/${encodeURIComponent(inc)}/cases/${encodeURIComponent(cse)}`
    );
    if (json?.success === false || !json?.data) {
      throw new PadlerApiError(json?.message ?? json?.detail ?? 'Unable to link case');
    }
    return mapIncident(json.data);
  } catch (e) {
    throw toPadlerApiError(e, 'Unable to link case');
  }
}

export async function correlateIncident(
  incidentNumber: string,
  body: {
    correlationKey?: string;
    caseNumber?: string;
    customerUserId?: string;
    customerImpact?: string;
    affectedPartyCount?: number;
  }
): Promise<IncidentSummary> {
  const num = incidentNumber.trim();
  if (!num) throw new PadlerApiError('Incident number is required');
  try {
    const { data: json } = await padlerApi.post<PadlerEnvelope<Record<string, unknown>>>(
      `/api/v1/admin/incidents/${encodeURIComponent(num)}/correlate`,
      body
    );
    if (json?.success === false || !json?.data) {
      throw new PadlerApiError(json?.message ?? json?.detail ?? 'Unable to correlate incident');
    }
    return mapIncident(json.data);
  } catch (e) {
    throw toPadlerApiError(e, 'Unable to correlate incident');
  }
}

export async function resolveIncident(incidentNumber: string): Promise<IncidentSummary> {
  const num = incidentNumber.trim();
  if (!num) throw new PadlerApiError('Incident number is required');
  try {
    const { data: json } = await padlerApi.post<PadlerEnvelope<Record<string, unknown>>>(
      `/api/v1/admin/incidents/${encodeURIComponent(num)}/resolve`
    );
    if (json?.success === false || !json?.data) {
      throw new PadlerApiError(json?.message ?? json?.detail ?? 'Unable to resolve incident');
    }
    return mapIncident(json.data);
  } catch (e) {
    throw toPadlerApiError(e, 'Unable to resolve incident');
  }
}

function mapConsumerLag(row: Record<string, unknown>): ConsumerLag {
  return {
    consumerName: row.consumerName != null ? String(row.consumerName) : undefined,
    lastSequenceNo: row.lastSequenceNo != null ? Number(row.lastSequenceNo) : undefined,
    lastEnvelopeId: row.lastEnvelopeId != null ? String(row.lastEnvelopeId) : undefined,
    lastProcessedAt: row.lastProcessedAt != null ? String(row.lastProcessedAt) : undefined,
    lagSeconds: row.lagSeconds != null ? Number(row.lagSeconds) : undefined
  };
}

function mapDeadLetter(row: Record<string, unknown>): DeadLetter {
  return {
    id: Number(row.id),
    envelopeId: row.envelopeId != null ? String(row.envelopeId) : undefined,
    outboxId: row.outboxId != null ? Number(row.outboxId) : undefined,
    errorCode: row.errorCode != null ? String(row.errorCode) : undefined,
    errorDetail: row.errorDetail != null ? String(row.errorDetail) : undefined,
    attempts: row.attempts != null ? Number(row.attempts) : undefined,
    firstFailedAt: row.firstFailedAt != null ? String(row.firstFailedAt) : undefined,
    lastFailedAt: row.lastFailedAt != null ? String(row.lastFailedAt) : undefined,
    replayedAt: row.replayedAt != null ? String(row.replayedAt) : undefined,
    status: row.status != null ? String(row.status) : undefined
  };
}

function mapAuditEvent(row: Record<string, unknown>): AuditEventDetail {
  return {
    envelopeId: row.envelopeId != null ? String(row.envelopeId) : undefined,
    envelopeVersion: row.envelopeVersion != null ? String(row.envelopeVersion) : undefined,
    eventType: row.eventType != null ? String(row.eventType) : undefined,
    category: row.category != null ? String(row.category) : undefined,
    sourceSystem: row.sourceSystem != null ? String(row.sourceSystem) : undefined,
    sourceEventId: row.sourceEventId != null ? String(row.sourceEventId) : undefined,
    idempotencyKey: row.idempotencyKey != null ? String(row.idempotencyKey) : undefined,
    partyType: row.partyType != null ? String(row.partyType) : undefined,
    partyKey: row.partyKey != null ? String(row.partyKey) : undefined,
    customerUserId: row.customerUserId != null ? String(row.customerUserId) : undefined,
    caseNumber: row.caseNumber != null ? String(row.caseNumber) : undefined,
    incidentNumber: row.incidentNumber != null ? String(row.incidentNumber) : undefined,
    productKey: row.productKey != null ? String(row.productKey) : undefined,
    bookingRef: row.bookingRef != null ? String(row.bookingRef) : undefined,
    paymentRef: row.paymentRef != null ? String(row.paymentRef) : undefined,
    dispatchId: row.dispatchId != null ? String(row.dispatchId) : undefined,
    requestId: row.requestId != null ? String(row.requestId) : undefined,
    traceparent: row.traceparent != null ? String(row.traceparent) : undefined,
    occurredAt: row.occurredAt != null ? String(row.occurredAt) : undefined,
    ingestedAt: row.ingestedAt != null ? String(row.ingestedAt) : undefined,
    sourceFreshnessAt: row.sourceFreshnessAt != null ? String(row.sourceFreshnessAt) : undefined,
    summary: row.summary != null ? String(row.summary) : undefined,
    payloadJson: row.payloadJson != null ? String(row.payloadJson) : undefined,
    actorType: row.actorType != null ? String(row.actorType) : undefined,
    actorId: row.actorId != null ? String(row.actorId) : undefined,
    prevHash: row.prevHash != null ? String(row.prevHash) : undefined,
    eventHash: row.eventHash != null ? String(row.eventHash) : undefined,
    sequenceNo: row.sequenceNo != null ? Number(row.sequenceNo) : undefined
  };
}

export async function listAuditConsumers(): Promise<ConsumerLag[]> {
  try {
    const { data: json } = await padlerApi.get<PadlerEnvelope<unknown[]>>(
      '/api/v1/admin/audit/consumers'
    );
    if (json?.success === false) {
      throw new PadlerApiError(json?.message ?? json?.detail ?? 'Unable to list consumers');
    }
    const rows = Array.isArray(json?.data) ? json.data : [];
    return rows.map((r) => mapConsumerLag(r as Record<string, unknown>));
  } catch (e) {
    throw toPadlerApiError(e, 'Unable to list consumers');
  }
}

export async function listDeadLetters(status?: string): Promise<DeadLetter[]> {
  const search = new URLSearchParams();
  if (status?.trim()) search.set('status', status.trim());
  const suffix = search.toString() ? `?${search.toString()}` : '';
  try {
    const { data: json } = await padlerApi.get<PadlerEnvelope<unknown[]>>(
      `/api/v1/admin/audit/dead-letters${suffix}`
    );
    if (json?.success === false) {
      throw new PadlerApiError(json?.message ?? json?.detail ?? 'Unable to list dead letters');
    }
    const rows = Array.isArray(json?.data) ? json.data : [];
    return rows.map((r) => mapDeadLetter(r as Record<string, unknown>));
  } catch (e) {
    throw toPadlerApiError(e, 'Unable to list dead letters');
  }
}

export async function getAuditEvent(envelopeId: string): Promise<AuditEventDetail> {
  const id = envelopeId.trim();
  if (!id) throw new PadlerApiError('Envelope id is required');
  try {
    const { data: json } = await padlerApi.get<PadlerEnvelope<Record<string, unknown>>>(
      `/api/v1/admin/audit/events/${encodeURIComponent(id)}`
    );
    if (json?.success === false || !json?.data) {
      throw new PadlerApiError(json?.message ?? json?.detail ?? 'Audit event not found', 404);
    }
    return mapAuditEvent(json.data);
  } catch (e) {
    throw toPadlerApiError(e, 'Unable to load audit event');
  }
}

export async function replayDeadLetter(id: number): Promise<DeadLetter> {
  try {
    const { data: json } = await padlerApi.post<PadlerEnvelope<Record<string, unknown>>>(
      `/api/v1/admin/audit/dead-letters/${id}/replay`
    );
    if (json?.success === false || !json?.data) {
      throw new PadlerApiError(json?.message ?? json?.detail ?? 'Unable to replay dead letter');
    }
    return mapDeadLetter(json.data);
  } catch (e) {
    throw toPadlerApiError(e, 'Unable to replay dead letter');
  }
}

export async function getCrmTimeline(params: {
  partyType?: string;
  partyKey?: string;
  customerUserId?: string;
  caseNumber?: string;
}): Promise<TimelineResponse> {
  const search = new URLSearchParams();
  if (params.partyType?.trim()) search.set('partyType', params.partyType.trim());
  if (params.partyKey?.trim()) search.set('partyKey', params.partyKey.trim());
  if (params.customerUserId?.trim()) search.set('customerUserId', params.customerUserId.trim());
  if (params.caseNumber?.trim()) search.set('caseNumber', params.caseNumber.trim());
  try {
    const { data: json } = await padlerApi.get<PadlerEnvelope<Record<string, unknown>>>(
      `/api/v1/admin/crm/timeline?${search.toString()}`
    );
    if (json?.success === false) {
      throw new PadlerApiError(json?.message ?? json?.detail ?? 'Unable to load CRM timeline');
    }
    const data = (json?.data ?? {}) as Record<string, unknown>;
    const items = Array.isArray(data.items)
      ? (data.items as Record<string, unknown>[]).map(mapTimelineItem)
      : [];
    return {
      partyType: data.partyType != null ? String(data.partyType) : undefined,
      partyKey: data.partyKey != null ? String(data.partyKey) : undefined,
      caseNumber: data.caseNumber != null ? String(data.caseNumber) : undefined,
      items
    };
  } catch (e) {
    throw toPadlerApiError(e, 'Unable to load CRM timeline');
  }
}

export async function invitePadlerAdmin(body: {
  email: string;
  fullName: string;
  designation: string;
  organizationId?: string;
}): Promise<InviteResult> {
  try {
    const { data: json } = await padlerApi.post<PadlerEnvelope<Record<string, unknown>>>(
      '/api/v1/padler/auth/invite',
      body
    );
    if (json?.success === false || !json?.data) {
      throw new PadlerApiError(json?.message ?? json?.detail ?? 'Unable to send invite');
    }
    const data = json.data;
    return {
      status: data.status != null ? String(data.status) : undefined,
      detail: data.detail != null ? String(data.detail) : undefined,
      invitationToken: data.invitationToken != null ? String(data.invitationToken) : undefined,
      expiresAt: data.expiresAt != null ? String(data.expiresAt) : undefined
    };
  } catch (e) {
    throw toPadlerApiError(e, 'Unable to send invite');
  }
}

export async function acceptPadlerInvite(body: {
  token: string;
  password: string;
  phoneNumber: string;
}): Promise<AcceptInviteResult> {
  try {
    const { data: json } = await padlerApi.post<PadlerEnvelope<Record<string, unknown>>>(
      '/api/v1/padler/auth/accept-invite',
      body
    );
    if (json?.success === false || !json?.data) {
      throw new PadlerApiError(json?.message ?? json?.detail ?? 'Unable to accept invite');
    }
    const data = json.data;
    return {
      status: data.status != null ? String(data.status) : undefined,
      detail: data.detail != null ? String(data.detail) : undefined,
      userId: data.userId != null ? String(data.userId) : undefined,
      designation: data.designation != null ? String(data.designation) : undefined
    };
  } catch (e) {
    throw toPadlerApiError(e, 'Unable to accept invite');
  }
}

function mapLoginTrayItem(row: Record<string, unknown>): LoginTrayItem {
  return {
    occurredAt: row.occurredAt != null ? String(row.occurredAt) : undefined,
    eventType: row.eventType != null ? String(row.eventType) : undefined,
    status: row.status != null ? String(row.status) : undefined,
    email: row.email != null ? String(row.email) : undefined,
    partyType: row.partyType != null ? String(row.partyType) : undefined,
    partyKey: row.partyKey != null ? String(row.partyKey) : undefined,
    productKey: row.productKey != null ? String(row.productKey) : undefined,
    sourceSystem: row.sourceSystem != null ? String(row.sourceSystem) : undefined,
    summary: row.summary != null ? String(row.summary) : undefined,
    envelopeId: row.envelopeId != null ? String(row.envelopeId) : undefined,
    padlerId: row.padlerId != null ? String(row.padlerId) : undefined,
    designation: row.designation != null ? String(row.designation) : undefined,
    role: row.role != null ? String(row.role) : undefined,
    customerUserId: row.customerUserId != null ? String(row.customerUserId) : undefined,
    reachOutHint: row.reachOutHint != null ? String(row.reachOutHint) : undefined
  };
}

export async function listLoginTray(params: {
  partyType: 'STAFF' | 'CUSTOMER' | string;
  eventType?: string;
  status?: string;
  productKey?: string;
  q?: string;
  page?: number;
  size?: number;
}): Promise<SpringPageResult<LoginTrayItem>> {
  const search = new URLSearchParams();
  search.set('partyType', params.partyType);
  if (params.eventType?.trim()) search.set('eventType', params.eventType.trim());
  if (params.status?.trim()) search.set('status', params.status.trim());
  if (params.productKey?.trim()) search.set('productKey', params.productKey.trim());
  if (params.q?.trim()) search.set('q', params.q.trim());
  search.set('page', String(params.page ?? 0));
  search.set('size', String(params.size ?? 20));
  try {
    const { data: json } = await padlerApi.get<PadlerEnvelope<unknown>>(
      `/api/v1/admin/logins?${search.toString()}`
    );
    if (json?.success === false) {
      throw new PadlerApiError(json?.message ?? json?.detail ?? 'Unable to load login tray');
    }
    return normalizeSpringPage(json?.data, (row) => mapLoginTrayItem(row as Record<string, unknown>), params.size ?? 20);
  } catch (e) {
    throw toPadlerApiError(e, 'Unable to load login tray');
  }
}

export async function getLoginTraySettings(): Promise<LoginTraySettings> {
  try {
    const { data: json } = await padlerApi.get<PadlerEnvelope<LoginTraySettings>>(
      '/api/v1/admin/logins/settings'
    );
    if (json?.success === false) {
      throw new PadlerApiError(json?.message ?? json?.detail ?? 'Unable to load login tray settings');
    }
    const data = json?.data;
    return { ttlDays: Number(data?.ttlDays ?? 30) };
  } catch (e) {
    throw toPadlerApiError(e, 'Unable to load login tray settings');
  }
}

export async function updateLoginTraySettings(ttlDays: number): Promise<LoginTraySettings> {
  try {
    const { data: json } = await padlerApi.put<PadlerEnvelope<LoginTraySettings>>(
      '/api/v1/admin/logins/settings',
      { ttlDays }
    );
    if (json?.success === false) {
      throw new PadlerApiError(json?.message ?? json?.detail ?? 'Unable to update login tray settings');
    }
    const data = json?.data;
    return { ttlDays: Number(data?.ttlDays ?? ttlDays) };
  } catch (e) {
    throw toPadlerApiError(e, 'Unable to update login tray settings');
  }
}

function mapOnboardingStep(row: Record<string, unknown>): OnboardingStep {
  return {
    key: row.key != null ? String(row.key) : undefined,
    label: row.label != null ? String(row.label) : undefined,
    status: row.status != null ? String(row.status) : undefined
  };
}

function mapOnboardingDocument(row: Record<string, unknown>): OnboardingDocument {
  return {
    type: row.type != null ? String(row.type) : undefined,
    label: row.label != null ? String(row.label) : undefined,
    url: row.url != null ? String(row.url) : undefined,
    present: row.present === true || row.present === 'true'
  };
}

function mapOnboardingJourney(row: Record<string, unknown>): OnboardingJourney {
  const steps = Array.isArray(row.steps)
    ? row.steps.map((s) => mapOnboardingStep(s as Record<string, unknown>))
    : undefined;
  const documents = Array.isArray(row.documents)
    ? row.documents.map((d) => mapOnboardingDocument(d as Record<string, unknown>))
    : undefined;
  const actionsAllowed = Array.isArray(row.actionsAllowed)
    ? row.actionsAllowed.map((a) => String(a))
    : undefined;
  const requestedDocumentTypes = Array.isArray(row.requestedDocumentTypes)
    ? row.requestedDocumentTypes.map((t) => String(t))
    : undefined;
  const requestedProfileFields = Array.isArray(row.requestedProfileFields)
    ? row.requestedProfileFields.map((t) => String(t))
    : undefined;
  return {
    productKey: row.productKey != null ? String(row.productKey) : undefined,
    sourceSystem: row.sourceSystem != null ? String(row.sourceSystem) : undefined,
    customerUserId: row.customerUserId != null ? String(row.customerUserId) : undefined,
    partyLabel: row.partyLabel != null ? String(row.partyLabel) : undefined,
    lifecycleStatus: row.lifecycleStatus != null ? String(row.lifecycleStatus) : undefined,
    currentStep: row.currentStep != null ? String(row.currentStep) : undefined,
    steps,
    documents,
    actionsAllowed,
    rejectionReason: row.rejectionReason != null ? String(row.rejectionReason) : undefined,
    completedAt: row.completedAt != null ? String(row.completedAt) : undefined,
    dealerId: row.dealerId != null && row.dealerId !== '' ? Number(row.dealerId) : undefined,
    companyId: row.companyId != null ? String(row.companyId) : undefined,
    travellerCode: row.travellerCode != null ? String(row.travellerCode) : undefined,
    requestedDocumentTypes,
    requestedProfileFields,
    customerUploadUrl: row.customerUploadUrl != null ? String(row.customerUploadUrl) : undefined,
    uploadLinkExpiresAt: row.uploadLinkExpiresAt != null ? String(row.uploadLinkExpiresAt) : undefined,
    productDeepLink: row.productDeepLink != null ? String(row.productDeepLink) : undefined,
    dependencyHealth: row.dependencyHealth != null ? String(row.dependencyHealth) : undefined,
    errorMessage: row.errorMessage != null ? String(row.errorMessage) : undefined,
    email: row.email != null ? String(row.email) : undefined,
    phoneNumber: row.phoneNumber != null ? String(row.phoneNumber) : undefined,
    firstName: row.firstName != null ? String(row.firstName) : undefined,
    lastName: row.lastName != null ? String(row.lastName) : undefined,
    businessName: row.businessName != null ? String(row.businessName) : undefined,
    directorEmail: row.directorEmail != null ? String(row.directorEmail) : undefined,
    directorNin: row.directorNin != null ? String(row.directorNin) : undefined,
    directorBvn: row.directorBvn != null ? String(row.directorBvn) : undefined,
    walletCreated:
      row.walletCreated === true || row.walletCreated === 'true'
        ? true
        : row.walletCreated === false || row.walletCreated === 'false'
          ? false
          : row.walletCreated == null
            ? null
            : undefined,
    ninVerified:
      row.ninVerified === true || row.ninVerified === 'true'
        ? true
        : row.ninVerified === false || row.ninVerified === 'false'
          ? false
          : row.ninVerified == null
            ? null
            : undefined,
    bvnVerified:
      row.bvnVerified === true || row.bvnVerified === 'true'
        ? true
        : row.bvnVerified === false || row.bvnVerified === 'false'
          ? false
          : row.bvnVerified == null
            ? null
            : undefined,
    identityProfileKind:
      row.identityProfileKind != null ? String(row.identityProfileKind) : undefined
  };
}

export type OnboardingActionBody = {
  reason?: string;
  requestedDocumentTypes?: string[];
  requestedProfileFields?: string[];
};

export async function listOnboardingJourneys(params: {
  productKey?: string;
  status?: string;
  q?: string;
  view?: 'all' | 'needs_review';
  page?: number;
  size?: number;
}): Promise<SpringPageResult<OnboardingJourney> & {
  sourceWarnings?: string[];
  productCounts?: Record<string, number>;
}> {
  const search = new URLSearchParams();
  if (params.productKey?.trim()) search.set('productKey', params.productKey.trim());
  if (params.status?.trim()) search.set('status', params.status.trim());
  if (params.q?.trim()) search.set('q', params.q.trim());
  if (params.view?.trim()) search.set('view', params.view.trim());
  search.set('page', String(params.page ?? 0));
  search.set('size', String(params.size ?? 20));
  try {
    const { data: json } = await padlerApi.get<PadlerEnvelope<Record<string, unknown>>>(
      `/api/v1/admin/onboarding?${search.toString()}`
    );
    if (json?.success === false) {
      throw new PadlerApiError(json?.message ?? json?.detail ?? 'Unable to load onboarding journeys');
    }
    const payload = (json?.data ?? {}) as Record<string, unknown>;
    const page = normalizeSpringPage(
      payload,
      (row) => mapOnboardingJourney(row as Record<string, unknown>),
      params.size ?? 20
    );
    const sourceWarnings = Array.isArray(payload.sourceWarnings)
      ? payload.sourceWarnings.map((w) => String(w))
      : undefined;
    const productCountsRaw = payload.productCounts;
    let productCounts: Record<string, number> | undefined;
    if (productCountsRaw && typeof productCountsRaw === 'object' && !Array.isArray(productCountsRaw)) {
      productCounts = {};
      for (const [k, v] of Object.entries(productCountsRaw as Record<string, unknown>)) {
        const n = Number(v);
        if (!Number.isNaN(n)) productCounts[k] = n;
      }
    }
    return { ...page, sourceWarnings, productCounts };
  } catch (e) {
    throw toPadlerApiError(e, 'Unable to load onboarding journeys');
  }
}

export async function getOnboardingJourney(
  productKey: string,
  customerUserId: string
): Promise<OnboardingJourney> {
  try {
    const { data: json } = await padlerApi.get<PadlerEnvelope<Record<string, unknown>>>(
      `/api/v1/admin/onboarding/${encodeURIComponent(productKey)}/${encodeURIComponent(customerUserId)}`
    );
    if (json?.success === false || !json?.data) {
      throw new PadlerApiError(json?.message ?? json?.detail ?? 'Unable to load onboarding journey');
    }
    return mapOnboardingJourney(json.data);
  } catch (e) {
    throw toPadlerApiError(e, 'Unable to load onboarding journey');
  }
}

export async function performOnboardingAction(
  productKey: string,
  customerUserId: string,
  action: string,
  body?: OnboardingActionBody
): Promise<OnboardingJourney> {
  try {
    const { data: json } = await padlerApi.post<PadlerEnvelope<Record<string, unknown>>>(
      `/api/v1/admin/onboarding/${encodeURIComponent(productKey)}/${encodeURIComponent(customerUserId)}/actions/${encodeURIComponent(action)}`,
      body ?? {}
    );
    if (json?.success === false || !json?.data) {
      throw new PadlerApiError(json?.message ?? json?.detail ?? 'Unable to perform onboarding action');
    }
    return mapOnboardingJourney(json.data);
  } catch (e) {
    throw toPadlerApiError(e, 'Unable to perform onboarding action');
  }
}

export async function createOnboardingUploadLink(
  productKey: string,
  customerUserId: string,
  body?: OnboardingActionBody
): Promise<OnboardingJourney> {
  try {
    const { data: json } = await padlerApi.post<PadlerEnvelope<Record<string, unknown>>>(
      `/api/v1/admin/onboarding/${encodeURIComponent(productKey)}/${encodeURIComponent(customerUserId)}/upload-links`,
      body ?? {}
    );
    if (json?.success === false || !json?.data) {
      throw new PadlerApiError(json?.message ?? json?.detail ?? 'Unable to create upload link');
    }
    return mapOnboardingJourney(json.data);
  } catch (e) {
    throw toPadlerApiError(e, 'Unable to create upload link');
  }
}
