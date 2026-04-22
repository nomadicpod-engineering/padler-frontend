import axios from 'axios';
import { padlerApi } from './axios-client';
import {
  AdminBookingLine,
  BookingDetail,
  BookingItem,
  BookingStatus,
  PaymentRow,
  TripDetail
} from './types';

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

type PadlerEnvelope<T> = {
  success?: boolean;
  message?: string;
  detail?: string;
  data?: T;
};

export async function loginPadler(email: string, password: string): Promise<{
  accessToken: string;
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
        authPayload?: { accessToken?: string; access_token?: string };
      }>
    >('/api/v1/padler/auth/login', { email, password });

    if (!json?.success || !json?.data) {
      throw new Error(json?.message ?? json?.detail ?? 'Login failed');
    }

    const authPayload = json.data.authPayload ?? {};
    return {
      accessToken: authPayload.accessToken ?? authPayload.access_token ?? '',
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
 * Single booking (Trip Jotter via BFF). Pass query scope matching the list: {@param allCompanies} and optional company email.
 */
export async function fetchBookingById(params: {
  id: number;
  allCompanies: boolean;
  transportCompanyEmail: string;
}): Promise<BookingDetail> {
  if (!Number.isFinite(params.id) || params.id <= 0) {
    throw new Error('Invalid booking id');
  }
  if (!params.allCompanies) {
    const resolved = (params.transportCompanyEmail || defaultTransportCompanyEmail).trim();
    if (!resolved) {
      throw new Error('Open this booking from the list with a company selected, or set transport company email.');
    }
  }

  const search = new URLSearchParams();
  search.set('allCompanies', String(params.allCompanies));
  if (!params.allCompanies) {
    search.set('transportCompanyEmail', (params.transportCompanyEmail || defaultTransportCompanyEmail).trim());
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
    throw new Error(readApiError(e, 'Unable to load payments'));
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
