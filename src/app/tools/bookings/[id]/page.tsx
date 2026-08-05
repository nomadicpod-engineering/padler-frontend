'use client';

import Link from 'next/link';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { PadlerShell } from '@/app/components/PadlerShell';
import { TripSeatGrid } from '@/components/booking/TripSeatGrid';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldLabel, Select } from '@/components/ui/field';
import { PageHeader, StatePanel } from '@/components/ui/page';
import { DetailSkeleton, PageSkeleton } from '@/components/ui/skeleton';
import { DrawerSection, SideDrawer } from '@/components/ui/side-drawer';
import { AdminBookingLine, BookingDetail, BookingItem, Role, canMutateBookings, type TripDetail } from '@/lib/types';
import {
  fetchAdminBookingLines,
  fetchBookingById,
  fetchPaymentByReference,
  fetchTripAlternativesForBooking,
  fetchTripForBookingDetail,
  isWalletPaymentSuccessful,
  mutateBookingAction,
  reassignSeatsAfterPayment
} from '@/lib/api';
import { formatDateTime, formatMoney } from '@/lib/utils';
import {
  buildSeatsFromVehicleSeats,
  getRowLayoutForCapacity,
  type SeatData
} from '@/lib/booking/seatLayout';
import { getAuthSession } from '@/lib/auth';
import { ArrowLeft, Bus, CalendarClock, Clock, MapPin, User } from 'lucide-react';


function isNotYetDeparted(departureTime: string | undefined): boolean {
  if (!departureTime?.trim()) {
    return true;
  }
  const d = new Date(departureTime.trim());
  if (Number.isNaN(d.getTime())) {
    return true;
  }
  return Date.now() < d.getTime();
}

const MS_24H = 24 * 60 * 60 * 1000;

function canShowCancelForRow(departureTime: string | undefined): boolean {
  return isNotYetDeparted(departureTime);
}

function canShowCompleteForRow(row: Pick<BookingItem, 'status' | 'departureTime'>): boolean {
  if (row.status !== 'PENDING' && row.status !== 'FAILED') {
    return false;
  }
  return isNotYetDeparted(row.departureTime);
}

function canShowRefundForRow(row: Pick<BookingItem, 'status' | 'departureTime'>): boolean {
  if (row.status !== 'COMPLETED') {
    return false;
  }
  if (!row.departureTime?.trim()) {
    return false;
  }
  const d = new Date(row.departureTime.trim());
  if (Number.isNaN(d.getTime())) {
    return false;
  }
  return Date.now() < d.getTime() - MS_24H;
}

function canShowTripDrawerGate(d: BookingDetail): boolean {
  if (!isNotYetDeparted(d.departureTime)) {
    return false;
  }
  if (d.status !== 'PENDING' && d.status !== 'CONFIRMED') {
    return false;
  }
  if (d.tripId == null || d.tripId <= 0) {
    return false;
  }
  return true;
}

function asItemForActions(d: BookingDetail): BookingItem {
  return {
    id: d.id,
    bookingReference: d.bookingReference,
    customerName: d.customerName,
    sourceChannel: d.sourceChannel,
    routeLabel: d.routeLabel,
    departureTime: d.departureTime,
    companyName: d.companyName,
    status: d.status,
    amount: d.amount,
    createdAt: d.createdAt
  };
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(120px, 200px) 1fr',
        gap: 12,
        padding: '10px 0',
        borderBottom: '1px solid var(--padler-border)'
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--padler-ink-muted)' }}>{label}</div>
      <div style={{ fontSize: 14, color: 'var(--padler-ink)', wordBreak: 'break-word' }}>{value}</div>
    </div>
  );
}

function BookingDetailContent() {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const idParam = params?.id;
  const bookingId = typeof idParam === 'string' ? parseInt(idParam, 10) : Number.NaN;

  const allCompanies = searchParams.get('allCompanies') === 'true';
  const transportCompanyEmail =
    searchParams.get('transportCompanyEmail') ?? searchParams.get('email') ?? '';
  const returnTo = searchParams.get('returnTo') ?? '';
  const openTripDrawerFromList = searchParams.get('openTripDrawer') === '1';

  const [detail, setDetail] = useState<BookingDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [firstName, setFirstName] = useState('Padler');
  const [role, setRole] = useState<Role>('ADMIN');

  const [tripDrawerOpen, setTripDrawerOpen] = useState(false);
  const autoOpenTripDrawerDoneRef = useRef(false);
  const [tripDrawerLoading, setTripDrawerLoading] = useState(false);
  const [tripForDrawer, setTripForDrawer] = useState<TripDetail | null>(null);
  const [tripDrawerError, setTripDrawerError] = useState<string | null>(null);
  const [completeFromDrawerBusy, setCompleteFromDrawerBusy] = useState(false);

  const [bookingLines, setBookingLines] = useState<AdminBookingLine[]>([]);
  const [tripAlternatives, setTripAlternatives] = useState<TripDetail[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null);
  const [draftSeatNumbers, setDraftSeatNumbers] = useState<string[]>([]);
  const [activeLineIdx, setActiveLineIdx] = useState(0);
  const activeLineIdxRef = useRef(0);
  useEffect(() => {
    activeLineIdxRef.current = activeLineIdx;
  }, [activeLineIdx]);
  const [reassignBusy, setReassignBusy] = useState(false);
  const [reassignError, setReassignError] = useState<string | null>(null);

  const canMutate = canMutateBookings(role);

  const todayLabel = useMemo(() => {
    const d = new Date();
    return d.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }, []);

  useEffect(() => {
    const s = getAuthSession();
    if (s?.email) {
      setFirstName(s.email.split('@')[0]);
    }
    if (s?.designation === 'BACK_OFFICE_SUPER_ADMIN' || s?.designation === 'ADMIN' || s?.designation === 'SENIOR' || s?.designation === 'JUNIOR') {
      setRole(s.designation);
    }
  }, []);

  useEffect(() => {
    if (Number.isNaN(bookingId) || bookingId <= 0) {
      setLoading(false);
      setLoadError('Invalid booking link.');
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    void (async () => {
      try {
        const data = await fetchBookingById({
          id: bookingId,
          allCompanies,
          transportCompanyEmail
        });
        if (!cancelled) {
          setDetail(data);
        }
      } catch (e) {
        if (!cancelled) {
          setDetail(null);
          setLoadError(e instanceof Error ? e.message : 'Failed to load booking');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bookingId, allCompanies, transportCompanyEmail, reloadNonce]);

  const triggerAction = async (bookingReference: string, action: 'cancel' | 'complete' | 'refund') => {
    await mutateBookingAction(bookingReference, action, {
      reason: `Action ${action} from Padler`,
      sourceAction: 'PADLER_ADMIN_CONSOLE',
      idempotencyKey: `${bookingReference}-${action}`
    });
    setReloadNonce((n) => n + 1);
  };

  const flushTripDrawerState = useCallback(() => {
    setTripDrawerOpen(false);
    setTripForDrawer(null);
    setTripDrawerError(null);
    setTripDrawerLoading(false);
    setCompleteFromDrawerBusy(false);
    setBookingLines([]);
    setTripAlternatives([]);
    setSelectedTripId(null);
    setDraftSeatNumbers([]);
    setActiveLineIdx(0);
    setReassignBusy(false);
    setReassignError(null);
  }, []);

  const startCloseTripDrawer = useCallback(() => {
    flushTripDrawerState();
  }, [flushTripDrawerState]);

  const completeBookingFromDrawer = useCallback(async () => {
    if (!detail?.bookingReference) {
      return;
    }
    setTripDrawerError(null);
    setCompleteFromDrawerBusy(true);
    try {
      const pay = await fetchPaymentByReference(detail.bookingReference);
      if (!isWalletPaymentSuccessful(pay.status)) {
        setTripDrawerError(
          `Payment status is “${pay.status}”. A completed wallet payment (COMPLETED or SUCCESSFUL) is required before completing this booking.`
        );
        return;
      }
      const ok = await mutateBookingAction(detail.bookingReference, 'complete', {
        reason: 'Action complete from Padler',
        sourceAction: 'PADLER_ADMIN_CONSOLE',
        idempotencyKey: `${detail.bookingReference}-complete`
      });
      if (!ok) {
        setTripDrawerError('Could not complete the booking. Try again or check the network.');
        return;
      }
      setReloadNonce((n) => n + 1);
      startCloseTripDrawer();
    } catch (e) {
      setTripDrawerError(e instanceof Error ? e.message : 'Could not complete the booking');
    } finally {
      setCompleteFromDrawerBusy(false);
    }
  }, [detail?.bookingReference, startCloseTripDrawer]);

  useEffect(() => {
    autoOpenTripDrawerDoneRef.current = false;
  }, [bookingId]);

  const openTripDrawer = useCallback(async () => {
    if (!detail?.tripId) {
      setTripDrawerError('This booking has no trip id.');
      setTripDrawerOpen(true);
      setTripDrawerLoading(false);
      return;
    }
    setTripDrawerOpen(true);
    setTripDrawerLoading(true);
    setTripDrawerError(null);
    setTripForDrawer(null);
    setBookingLines([]);
    setTripAlternatives([]);
    setReassignError(null);
    try {
      const trip = await fetchTripForBookingDetail({
        tripId: detail.tripId,
        allCompanies,
        transportCompanyEmail
      });
      setTripForDrawer(trip);
      setSelectedTripId(trip.id);
      if (canMutate) {
        try {
          const lines = await fetchAdminBookingLines(detail.bookingReference);
          setBookingLines(lines);
          setDraftSeatNumbers(
            lines.map((l) => (l.seatNumber != null && l.seatNumber.trim() !== '' ? l.seatNumber.trim() : ''))
          );
          setActiveLineIdx(0);
        } catch {
          setBookingLines([]);
          setDraftSeatNumbers([]);
        }
        const tid = trip.transportCompanyId;
        const oid = trip.originTerminalId;
        const did = trip.destinationTerminalId;
        if (tid != null && oid != null && did != null) {
          const alts = await fetchTripAlternativesForBooking({
            transportCompanyId: tid,
            originTerminalId: oid,
            destinationTerminalId: did,
            departureAfter: trip.departureTime,
            excludeTripId: trip.id
          });
          setTripAlternatives(
            alts
              .filter((t) => t.id > 0)
              .filter((a, i, arr) => arr.findIndex((x) => x.id === a.id) === i)
          );
        }
      }
    } catch (e) {
      setTripDrawerError(e instanceof Error ? e.message : 'Could not load trip');
    } finally {
      setTripDrawerLoading(false);
    }
  }, [detail, allCompanies, transportCompanyEmail, canMutate]);

  useEffect(() => {
    if (!detail || !openTripDrawerFromList || autoOpenTripDrawerDoneRef.current) {
      return;
    }
    autoOpenTripDrawerDoneRef.current = true;
    const next = new URLSearchParams(searchParams.toString());
    next.delete('openTripDrawer');
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    void openTripDrawer();
  }, [detail, openTripDrawerFromList, openTripDrawer, pathname, router, searchParams]);

  useEffect(() => {
    if (!tripDrawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        startCloseTripDrawer();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [tripDrawerOpen, startCloseTripDrawer]);

  useEffect(() => {
    if (!tripDrawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [tripDrawerOpen]);

  const seatGridModel = useMemo(() => {
    if (!tripForDrawer?.vehicleSeats?.length) {
      return {
        seats: [] as SeatData[],
        rowLayout: undefined as number[] | undefined,
        frontPassenger: null as SeatData | null,
        totalSeats: 0
      };
    }
    const cap = tripForDrawer.vehicleCapacity ?? tripForDrawer.vehicleSeats.length;
    const layout = getRowLayoutForCapacity(cap);
    const highlight = new Set(
      detail?.seatNumber?.trim() ? [detail.seatNumber.trim().toUpperCase()] : []
    );
    const built = buildSeatsFromVehicleSeats(
      tripForDrawer.vehicleSeats.map((s) => ({ number: s.number, status: s.status })),
      new Set(),
      highlight,
      new Set()
    );
    const frontPassenger = built.length > 0 ? built[0] : null;
    return { seats: built, rowLayout: layout, frontPassenger, totalSeats: cap };
  }, [tripForDrawer, detail?.seatNumber]);

  const tripOptions = useMemo(() => {
    if (!tripForDrawer) {
      return [];
    }
    const byId = new Map<number, TripDetail>();
    byId.set(tripForDrawer.id, tripForDrawer);
    for (const t of tripAlternatives) {
      if (t.id > 0) {
        byId.set(t.id, t);
      }
    }
    return Array.from(byId.values()).sort((a, b) =>
      (a.departureTime ?? '').localeCompare(b.departureTime ?? '')
    );
  }, [tripForDrawer, tripAlternatives]);

  const showReassignPanel =
    canMutate &&
    bookingLines.length > 0 &&
    tripForDrawer != null &&
    !tripDrawerLoading &&
    !tripDrawerError;

  const reassignGridModel = useMemo(() => {
    if (!tripForDrawer?.vehicleSeats?.length || bookingLines.length === 0) {
      return {
        seats: [] as SeatData[],
        rowLayout: undefined as number[] | undefined,
        frontPassenger: null as SeatData | null,
        totalSeats: 0
      };
    }
    const ourSeats = new Set(
      bookingLines
        .map((l) => (l.seatNumber ?? '').trim().toUpperCase())
        .filter(Boolean)
    );
    const vs = tripForDrawer.vehicleSeats.map((s) => {
      const u = s.number.trim().toUpperCase();
      if (ourSeats.has(u)) {
        return { ...s, status: 'AVAILABLE' };
      }
      return s;
    });
    const selected = new Set(
      draftSeatNumbers.filter(Boolean).map((x) => x.trim().toUpperCase())
    );
    const cap = tripForDrawer.vehicleCapacity ?? vs.length;
    const layout = getRowLayoutForCapacity(cap);
    const built = buildSeatsFromVehicleSeats(vs, new Set(), selected, new Set());
    const frontPassenger = built.length > 0 ? built[0] : null;
    return { seats: built, rowLayout: layout, frontPassenger, totalSeats: cap };
  }, [tripForDrawer, bookingLines, draftSeatNumbers]);

  const handleReassignSeatPick = useCallback(
    (n: string) => {
      setDraftSeatNumbers((prev) => {
        if (bookingLines.length === 0) {
          return prev;
        }
        const next = [...prev];
        const idx = Math.min(Math.max(0, activeLineIdxRef.current), next.length - 1);
        next[idx] = n;
        return next;
      });
      setActiveLineIdx((i) => {
        const nextI = Math.min(i + 1, Math.max(0, bookingLines.length - 1));
        activeLineIdxRef.current = nextI;
        return nextI;
      });
    },
    [bookingLines.length]
  );

  const handleTripOptionChange = useCallback(
    async (tripId: number) => {
      if (!detail?.tripId || !Number.isFinite(tripId)) {
        return;
      }
      setTripDrawerLoading(true);
      setReassignError(null);
      try {
        const t = await fetchTripForBookingDetail({
          tripId,
          allCompanies,
          transportCompanyEmail
        });
        setTripForDrawer(t);
        setSelectedTripId(t.id);
        setDraftSeatNumbers(bookingLines.map(() => ''));
        setActiveLineIdx(0);
      } catch (e) {
        setReassignError(e instanceof Error ? e.message : 'Could not load trip');
      } finally {
        setTripDrawerLoading(false);
      }
    },
    [detail?.tripId, allCompanies, transportCompanyEmail, bookingLines]
  );

  const submitReassign = useCallback(async () => {
    if (!detail?.bookingReference || !tripForDrawer) {
      return;
    }
    setReassignError(null);
    const seats = draftSeatNumbers.map((s) => s.trim());
    if (seats.length !== bookingLines.length || seats.some((s) => !s)) {
      setReassignError('Choose one seat for each passenger line.');
      return;
    }
    const seen = new Set<string>();
    for (const s of seats) {
      const u = s.toUpperCase();
      if (seen.has(u)) {
        setReassignError('Each seat must be unique.');
        return;
      }
      seen.add(u);
    }
    const sameTrip = detail.tripId != null && selectedTripId === detail.tripId;
    setReassignBusy(true);
    try {
      const pay = await fetchPaymentByReference(detail.bookingReference);
      if (!isWalletPaymentSuccessful(pay.status)) {
        setReassignError(
          `Payment status is “${pay.status}”. A completed wallet payment (COMPLETED or SUCCESSFUL) is required.`
        );
        return;
      }
      await reassignSeatsAfterPayment(detail.bookingReference, {
        newTripId: sameTrip ? undefined : selectedTripId ?? undefined,
        newSeatNumbers: seats,
        reason: 'Reassign seats/trip from Padler admin (after payment)',
        sourceAction: 'PADLER_ADMIN_REASSIGN'
      });
      setReloadNonce((n) => n + 1);
      startCloseTripDrawer();
    } catch (e) {
      setReassignError(e instanceof Error ? e.message : 'Reassign failed');
    } finally {
      setReassignBusy(false);
    }
  }, [
    detail?.bookingReference,
    detail?.tripId,
    tripForDrawer,
    draftSeatNumbers,
    bookingLines.length,
    selectedTripId,
    startCloseTripDrawer
  ]);

  const rowForGates = detail ? asItemForActions(detail) : null;
  const showCancelInDrawer = Boolean(
    rowForGates && canShowCancelForRow(rowForGates.departureTime)
  );
  const showCompleteInDrawer = Boolean(rowForGates && canShowCompleteForRow(rowForGates));
  const showStatusActionsInDrawer = showCancelInDrawer || showCompleteInDrawer;
  const showTripCta = detail ? canShowTripDrawerGate(detail) : false;

  return (
    <>
    <PadlerShell>
      <PageHeader
        eyebrow="Tools"
        title="Booking details"
        subtitle={`${detail?.bookingReference ? `${detail.bookingReference} · ` : ''}Welcome back, ${firstName} · ${todayLabel}`}
      />

      <div className="mb-4">
        <Button variant="link" asChild className="h-auto min-h-0 px-0">
          <Link href={returnTo.trim() || '/tools/trip-jotter'}>
            <ArrowLeft size={16} />
            Back to bookings
          </Link>
        </Button>
      </div>

      {loadError ? (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {loadError}
        </div>
      ) : null}

      {loading ? <StatePanel kind="loading" skeleton="detail" /> : null}

      {!loading && detail ? (
          <Card>
            <CardHeader>
              <div>
                <CardTitle className="text-xl">{detail.bookingReference}</CardTitle>
                <CardDescription>
                  Trip Jotter booking
                  {allCompanies ? ' · all companies scope' : ''}
                </CardDescription>
              </div>
              <StatusBadge status={detail.status} />
            </CardHeader>
            <CardContent>

            {showTripCta ? (
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 13, color: 'var(--padler-ink-muted)', margin: '0 0 10px 0' }}>
                  After payment has completed in the wallet, you can open a read-only view of the trip and seat
                  map for this reference (PENDING/CONFIRMED, before departure). Use the same panel to cancel or
                  complete the booking when those actions are available.
                </p>
                <Button type="button" variant="primary" onClick={() => void openTripDrawer()}>
                  View trip &amp; seats
                </Button>
              </div>
            ) : showStatusActionsInDrawer ? (
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 13, color: 'var(--padler-ink-muted)', margin: '0 0 10px 0' }}>
                  Open the side panel to cancel or complete this booking before departure.
                </p>
                <Button type="button" variant="primary" onClick={() => void openTripDrawer()}>
                  Open booking actions
                </Button>
              </div>
            ) : null}

            {detail.companyLogoUrl ? (
              <div style={{ marginBottom: 20 }}>
                <img
                  src={detail.companyLogoUrl}
                  alt=""
                  style={{ maxHeight: 48, maxWidth: 120, objectFit: 'contain' }}
                />
              </div>
            ) : null}

            <div>
              <DetailRow label="ID" value={String(detail.id)} />
              {detail.tripId != null ? <DetailRow label="Trip id" value={String(detail.tripId)} /> : null}
              <DetailRow label="Status" value={<StatusBadge status={detail.status} />} />
              <DetailRow label="Reference" value={detail.bookingReference} />
              <DetailRow label="Passenger" value={detail.customerName} />
              {detail.passengerEmail ? <DetailRow label="Email" value={detail.passengerEmail} /> : null}
              {detail.passengerPhone ? <DetailRow label="Phone" value={detail.passengerPhone} /> : null}
              {detail.seatNumber ? <DetailRow label="Seat" value={detail.seatNumber} /> : null}
              {detail.identificationType ? (
                <DetailRow label="ID type" value={detail.identificationType} />
              ) : null}
              <DetailRow label="Source" value={detail.sourceChannel} />
              {detail.companyName ? <DetailRow label="Transport company" value={detail.companyName} /> : null}
              <DetailRow label="Route" value={detail.routeLabel} />
              <DetailRow label="Departure" value={formatDateTime(detail.departureTime)} />
              <DetailRow label="Arrival" value={formatDateTime(detail.arrivalTime)} />
              <DetailRow
                label="Amount"
                value={Number.isFinite(detail.amount) ? formatMoney(detail.amount) : '—'}
              />
              {detail.paymentMethod ? <DetailRow label="Payment" value={detail.paymentMethod} /> : null}
              <DetailRow label="Created" value={formatDateTime(detail.createdAt)} />
              <DetailRow label="Updated" value={formatDateTime(detail.updatedAt)} />
            </div>

            {rowForGates && canShowRefundForRow(rowForGates) ? (
              <div
                style={{
                  marginTop: 24,
                  paddingTop: 20,
                  borderTop: '1px solid var(--padler-border)',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 8,
                  alignItems: 'center'
                }}
              >
                <Button
                  type="button"
                  disabled={!canMutate}
                  onClick={() => void triggerAction(detail.bookingReference, 'refund')}
                >
                  Refund
                </Button>
                {!canMutate ? (
                  <span style={{ fontSize: 12, color: 'var(--padler-ink-muted)' }}>
                    Your role cannot change booking status.
                  </span>
                ) : null}
              </div>
            ) : null}
            </CardContent>
          </Card>
        ) : null}
    </PadlerShell>

    <SideDrawer
      open={tripDrawerOpen}
      onOpenChange={(next) => {
        if (!next) startCloseTripDrawer();
      }}
      title="Trip & seats"
      description="Trip details, seat map, and booking actions when available."
      width="lg"
      footer={
        detail && rowForGates && showStatusActionsInDrawer ? (
          <div className="flex flex-wrap gap-2">
            {showCancelInDrawer ? (
              <Button
                type="button"
                variant="danger"
                disabled={!canMutate || completeFromDrawerBusy}
                onClick={() => void triggerAction(detail.bookingReference, 'cancel')}
              >
                Cancel
              </Button>
            ) : null}
            {showCompleteInDrawer ? (
              <Button
                type="button"
                variant="primary"
                disabled={!canMutate || completeFromDrawerBusy}
                onClick={() => void completeBookingFromDrawer()}
              >
                {completeFromDrawerBusy ? 'Verifying & completing…' : 'Complete'}
              </Button>
            ) : null}
            {!canMutate && (showCancelInDrawer || showCompleteInDrawer) ? (
              <span className="w-full text-xs text-slate-500">Your role cannot change booking status.</span>
            ) : null}
          </div>
        ) : undefined
      }
    >
      <div className="space-y-4">
        {tripDrawerLoading ? <DetailSkeleton /> : null}
        {tripDrawerError ? (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          >
            {tripDrawerError}
          </div>
        ) : null}
        {tripForDrawer ? (
          <>
            <DrawerSection title="Trip">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-slate-950">
                    {tripForDrawer.routeOrigin?.trim() || '—'}
                    <span className="mx-2 text-slate-400">→</span>
                    {tripForDrawer.routeDestination?.trim() || '—'}
                  </p>
                  {tripForDrawer.transportCompanyName ? (
                    <div className="mt-1.5 flex items-center gap-1.5 text-sm text-slate-500">
                      <MapPin size={16} />
                      {tripForDrawer.transportCompanyName}
                    </div>
                  ) : null}
                </div>
                <div className="text-right text-base font-semibold tabular-nums text-slate-900">
                  {tripForDrawer.basePrice != null ? formatMoney(tripForDrawer.basePrice) : '—'}
                </div>
              </div>
              <div className="mt-4 grid gap-2 border-t border-slate-100 pt-3 text-sm text-slate-700 sm:grid-cols-2">
                <span className="inline-flex items-center gap-2">
                  <CalendarClock size={16} className="text-blue-700" />
                  {formatDateTime(tripForDrawer.departureTime)}
                </span>
                <span className="inline-flex items-center gap-2">
                  <Clock size={16} className="text-blue-700" />
                  Arrive {formatDateTime(tripForDrawer.arrivalTime)}
                </span>
                <span className="inline-flex items-center gap-2">
                  <Bus size={16} className="text-blue-700" />
                  {tripForDrawer.vehicleType?.trim() || '—'}
                  {tripForDrawer.vehicleLicensePlate
                    ? ` · ${tripForDrawer.vehicleLicensePlate}`
                    : ''}
                </span>
                <span className="inline-flex items-center gap-2">
                  <User size={16} className="text-blue-700" />
                  {tripForDrawer.bookedSeats != null && tripForDrawer.vehicleCapacity != null
                    ? `${tripForDrawer.vehicleCapacity - tripForDrawer.bookedSeats} of ${tripForDrawer.vehicleCapacity} free`
                    : 'Seats —'}
                </span>
              </div>
              {tripForDrawer.driverName ? (
                <p className="mt-2 text-sm text-slate-500">
                  Driver: {tripForDrawer.driverName}
                  {tripForDrawer.driverPhone ? ` · ${tripForDrawer.driverPhone}` : ''}
                </p>
              ) : null}
            </DrawerSection>

            {showReassignPanel ? (
              <DrawerSection
                title="Reassign seats"
                description="Choose a trip and a seat for each passenger line, then apply changes. We verify a completed wallet payment when you submit."
              >
                {tripOptions.length > 0 ? (
                  <FieldLabel className="mb-3 max-w-md">
                    Trip
                    <Select
                      value={selectedTripId ?? tripForDrawer.id}
                      disabled={reassignBusy || tripDrawerLoading}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        if (Number.isFinite(v)) {
                          void handleTripOptionChange(v);
                        }
                      }}
                    >
                      {tripOptions.map((t) => (
                        <option key={t.id} value={t.id}>
                          {formatDateTime(t.departureTime)} (trip {t.id})
                          {t.id === detail?.tripId ? ' — current' : ''}
                        </option>
                      ))}
                    </Select>
                  </FieldLabel>
                ) : null}
                <div className="mb-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-400">
                    Passengers (active row highlighted)
                  </div>
                  <ul className="mt-2 space-y-1.5">
                    {bookingLines.map((line, i) => (
                      <li key={line.id ?? i}>
                        <Button
                          type="button"
                          variant={activeLineIdx === i ? 'secondary' : 'ghost'}
                          className="w-full justify-start text-left"
                          onClick={() => {
                            setActiveLineIdx(i);
                            activeLineIdxRef.current = i;
                          }}
                        >
                          {line.passengerName?.trim() || `Line ${i + 1}`} — pick:{' '}
                          <strong>{draftSeatNumbers[i]?.trim() || '—'}</strong>
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
                {reassignError ? (
                  <div
                    role="alert"
                    className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
                  >
                    {reassignError}
                  </div>
                ) : null}
                <div className="mb-1 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    disabled={reassignBusy}
                    onClick={() => {
                      setDraftSeatNumbers(
                        bookingLines.map((l) =>
                          l.seatNumber != null && l.seatNumber.trim() !== '' ? l.seatNumber.trim() : ''
                        )
                      );
                      setActiveLineIdx(0);
                      setReassignError(null);
                    }}
                  >
                    Reset to original seats
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    disabled={reassignBusy || tripDrawerLoading}
                    onClick={() => void submitReassign()}
                  >
                    {reassignBusy ? 'Saving…' : 'Save seats & trip'}
                  </Button>
                </div>
              </DrawerSection>
            ) : null}

            <DrawerSection title="Seat layout">
              {showReassignPanel && reassignGridModel.seats.length > 0 ? (
                <div className="mx-auto max-w-md overflow-auto rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex justify-center">
                    <TripSeatGrid
                      seats={reassignGridModel.seats}
                      onSeatSelect={handleReassignSeatPick}
                      frontPassenger={reassignGridModel.frontPassenger}
                      totalSeats={reassignGridModel.totalSeats}
                      rowLayout={reassignGridModel.rowLayout}
                      readOnly={false}
                    />
                  </div>
                  <div className="padler-seat-legend mt-3">
                    <span>
                      <span className="padler-seat-legend__swatch" style={{ background: '#3b82f6' }} />
                      Available
                    </span>
                    <span>
                      <span className="padler-seat-legend__swatch" style={{ background: 'var(--padler-primary)' }} />
                      Selected
                    </span>
                    <span>
                      <span className="padler-seat-legend__swatch" style={{ background: '#1e293b' }} />
                      Pending
                    </span>
                    <span>
                      <span className="padler-seat-legend__swatch" style={{ background: '#e2e8f0' }} />
                      Booked
                    </span>
                  </div>
                </div>
              ) : seatGridModel.seats.length > 0 ? (
                <div className="mx-auto max-w-md overflow-auto rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex justify-center">
                    <TripSeatGrid
                      seats={seatGridModel.seats}
                      onSeatSelect={() => {}}
                      frontPassenger={seatGridModel.frontPassenger}
                      totalSeats={seatGridModel.totalSeats}
                      rowLayout={seatGridModel.rowLayout}
                      readOnly
                    />
                  </div>
                  <div className="padler-seat-legend mt-3">
                    <span>
                      <span className="padler-seat-legend__swatch" style={{ background: '#3b82f6' }} />
                      Available
                    </span>
                    <span>
                      <span className="padler-seat-legend__swatch" style={{ background: 'var(--padler-primary)' }} />
                      This booking
                    </span>
                    <span>
                      <span className="padler-seat-legend__swatch" style={{ background: '#1e293b' }} />
                      Pending
                    </span>
                    <span>
                      <span className="padler-seat-legend__swatch" style={{ background: '#e2e8f0' }} />
                      Booked
                    </span>
                  </div>
                </div>
              ) : (
                <p className="m-0 text-sm text-slate-500">No seat layout was returned for this trip.</p>
              )}
            </DrawerSection>
          </>
        ) : !tripDrawerLoading && !tripDrawerError ? (
          <p className="m-0 text-sm text-slate-500">No trip data.</p>
        ) : null}
      </div>
    </SideDrawer>

    </>
  );
}

export default function BookingDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <PageSkeleton />
        </div>
      }
    >
      <BookingDetailContent />
    </Suspense>
  );
}
