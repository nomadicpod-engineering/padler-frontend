'use client';

import Link from 'next/link';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { PadlerShell } from '@/app/components/PadlerShell';
import { TripSeatGrid } from '@/components/booking/TripSeatGrid';
import { AdminBookingLine, BookingDetail, BookingItem, BookingStatus, Role, type TripDetail } from '@/lib/types';
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
import {
  buildSeatsFromVehicleSeats,
  getRowLayoutForCapacity,
  type SeatData
} from '@/lib/booking/seatLayout';
import { getAuthSession } from '@/lib/auth';
import { ArrowLeft, Bell, Bus, CalendarClock, Clock, MapPin, User, X } from 'lucide-react';

const STATUS_CLASS: Record<BookingStatus, string> = {
  PENDING: 'padler-status padler-status--pending',
  CONFIRMED: 'padler-status padler-status--confirmed',
  COMPLETED: 'padler-status padler-status--completed',
  CANCELLED: 'padler-status padler-status--cancelled',
  REFUNDED: 'padler-status padler-status--refunded',
  FAILED: 'padler-status padler-status--failed'
};

function formatTripDeparture(raw: string | undefined): string {
  if (!raw?.trim()) {
    return '—';
  }
  const t = raw.trim();
  const d = new Date(t);
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  }
  return t;
}

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
  const transportCompanyEmail = searchParams.get('transportCompanyEmail') ?? '';
  const openTripDrawerFromList = searchParams.get('openTripDrawer') === '1';

  const [detail, setDetail] = useState<BookingDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [firstName, setFirstName] = useState('Padler');
  const [role, setRole] = useState<Role>('ADMIN');

  const [tripDrawerOpen, setTripDrawerOpen] = useState(false);
  const [drawerSlideIn, setDrawerSlideIn] = useState(false);
  const drawerCloseTransitionRef = useRef(false);
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

  const canMutate = role === 'SUPER_ADMIN' || role === 'ADMIN';

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
    if (s?.designation === 'SUPER_ADMIN' || s?.designation === 'ADMIN' || s?.designation === 'DEFAULT') {
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
    drawerCloseTransitionRef.current = false;
    setTripDrawerOpen(false);
    setDrawerSlideIn(false);
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
    if (!tripDrawerOpen) {
      return;
    }
    if (!drawerSlideIn) {
      flushTripDrawerState();
      return;
    }
    drawerCloseTransitionRef.current = true;
    setDrawerSlideIn(false);
  }, [tripDrawerOpen, drawerSlideIn, flushTripDrawerState]);

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

  const onDrawerPanelTransitionEnd = useCallback(
    (e: React.TransitionEvent<HTMLDivElement>) => {
      if (e.target !== e.currentTarget) {
        return;
      }
      if (e.propertyName !== 'transform') {
        return;
      }
      if (!drawerCloseTransitionRef.current) {
        return;
      }
      flushTripDrawerState();
    },
    [flushTripDrawerState]
  );

  useEffect(() => {
    if (!tripDrawerOpen) {
      setDrawerSlideIn(false);
      return;
    }
    setDrawerSlideIn(false);
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setDrawerSlideIn(true);
      });
    });
    return () => cancelAnimationFrame(id);
  }, [tripDrawerOpen]);

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
      <section className="padler-hero">
        <div className="padler-hero-topbar">
          <div className="padler-hero-title">
            Booking details
            <small>
              {detail?.bookingReference ? `${detail.bookingReference} · ` : ''}
              Welcome back, {firstName} · {todayLabel}
            </small>
          </div>

          <div className="padler-hero-search" style={{ opacity: 0.5, pointerEvents: 'none' }} aria-hidden>
            <span style={{ fontSize: 13, color: 'rgba(15,23,42,0.45)' }}>Read-only fields</span>
          </div>

          <div className="padler-hero-actions">
            <button type="button" className="padler-icon-btn" aria-label="Calendar">
              <CalendarClock size={18} />
            </button>
            <button
              type="button"
              className="padler-icon-btn"
              aria-label="Notifications"
              style={{ position: 'relative' }}
            >
              <Bell size={18} />
              <span className="padler-badge-dot" />
            </button>
            <div className="padler-avatar" title={firstName}>
              {firstName.charAt(0).toUpperCase()}
            </div>
          </div>
        </div>
      </section>

      <div className="padler-page padler-page--below-hero">
        <div style={{ marginBottom: 16 }}>
          <Link
            href="/bookings"
            className="padler-action"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}
          >
            <ArrowLeft size={16} />
            Back to bookings
          </Link>
        </div>

        {loadError ? (
          <div
            role="alert"
            className="padler-panel"
            style={{
              padding: '16px 20px',
              background: '#fef2f2',
              color: '#991b1b',
              border: '1px solid #fecaca',
              fontSize: 14
            }}
          >
            {loadError}
          </div>
        ) : null}

        {loading ? (
          <div className="padler-panel" style={{ padding: 24 }}>
            <p style={{ margin: 0, color: 'var(--padler-ink-muted)' }}>Loading booking…</p>
          </div>
        ) : detail ? (
          <div className="padler-panel" style={{ padding: '20px 24px' }}>
            <h2 className="padler-section-title" style={{ marginTop: 0, marginBottom: 8, fontSize: 20 }}>
              {detail.bookingReference}
            </h2>
            <p className="padler-section-subtitle" style={{ marginBottom: 20 }}>
              Trip Jotter booking
              {allCompanies ? ' · all companies scope' : ''}
            </p>

            {showTripCta ? (
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 13, color: 'var(--padler-ink-muted)', margin: '0 0 10px 0' }}>
                  After payment has completed in the wallet, you can open a read-only view of the trip and seat
                  map for this reference (PENDING/CONFIRMED, before departure). Use the same panel to cancel or
                  complete the booking when those actions are available.
                </p>
                <button
                  type="button"
                  className="padler-action padler-action--primary"
                  onClick={() => void openTripDrawer()}
                >
                  View trip &amp; seats
                </button>
              </div>
            ) : showStatusActionsInDrawer ? (
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 13, color: 'var(--padler-ink-muted)', margin: '0 0 10px 0' }}>
                  Open the side panel to cancel or complete this booking before departure.
                </p>
                <button
                  type="button"
                  className="padler-action padler-action--primary"
                  onClick={() => void openTripDrawer()}
                >
                  Open booking actions
                </button>
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
              <DetailRow
                label="Status"
                value={<span className={STATUS_CLASS[detail.status]}>{detail.status}</span>}
              />
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
              <DetailRow label="Departure" value={formatTripDeparture(detail.departureTime)} />
              <DetailRow label="Arrival" value={formatTripDeparture(detail.arrivalTime)} />
              <DetailRow
                label="Amount"
                value={Number.isFinite(detail.amount) ? `NGN ${detail.amount.toLocaleString()}` : '—'}
              />
              {detail.paymentMethod ? <DetailRow label="Payment" value={detail.paymentMethod} /> : null}
              <DetailRow label="Created" value={formatTripDeparture(detail.createdAt)} />
              <DetailRow label="Updated" value={formatTripDeparture(detail.updatedAt)} />
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
                <button
                  type="button"
                  className="padler-action"
                  disabled={!canMutate}
                  onClick={() => void triggerAction(detail.bookingReference, 'refund')}
                >
                  refund
                </button>
                {!canMutate ? (
                  <span style={{ fontSize: 12, color: 'var(--padler-ink-muted)' }}>
                    Your role cannot change booking status.
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </PadlerShell>

    {tripDrawerOpen ? (
      <>
        <div
          className="padler-drawer-backdrop"
          onClick={startCloseTripDrawer}
          onKeyDown={(e) => e.key === 'Escape' && startCloseTripDrawer()}
          role="presentation"
        />
        <div
          className={
            'padler-drawer-panel' + (drawerSlideIn ? ' padler-drawer-panel--open' : '')
          }
          role="dialog"
          aria-modal="true"
          aria-labelledby="padler-trip-drawer-title"
          onTransitionEnd={onDrawerPanelTransitionEnd}
        >
          <div className="padler-drawer-header">
            <span id="padler-trip-drawer-title">Trip &amp; seats</span>
            <button
              type="button"
              className="padler-icon-btn"
              onClick={startCloseTripDrawer}
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>
          <div className="padler-drawer-body">
            {tripDrawerLoading ? (
              <p style={{ margin: 0, color: 'var(--padler-ink-muted)' }}>Loading trip…</p>
            ) : null}
            {tripDrawerError ? (
              <div
                role="alert"
                style={{
                  padding: '12px 14px',
                  borderRadius: 8,
                  background: '#fef2f2',
                  color: '#991b1b',
                  border: '1px solid #fecaca',
                  fontSize: 14,
                  marginBottom: 16
                }}
              >
                {tripDrawerError}
              </div>
            ) : null}
            {tripForDrawer ? (
              <>
                <div className="padler-trip-card">
                  <div className="padler-trip-card__row">
                    <div className="padler-trip-card__route">
                      <p style={{ margin: 0, fontSize: 18, fontWeight: 600, color: 'var(--padler-ink)' }}>
                        {tripForDrawer.routeOrigin?.trim() || '—'}
                        <span style={{ margin: '0 8px', color: 'var(--padler-ink-muted)' }}>→</span>
                        {tripForDrawer.routeDestination?.trim() || '—'}
                      </p>
                      {tripForDrawer.transportCompanyName ? (
                        <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: 'var(--padler-ink-muted)' }}>
                          <MapPin size={16} />
                          {tripForDrawer.transportCompanyName}
                        </div>
                      ) : null}
                    </div>
                    <div className="padler-trip-card__amount" style={{ textAlign: 'right' }}>
                      {tripForDrawer.basePrice != null
                        ? `NGN ${tripForDrawer.basePrice.toLocaleString()}`
                        : '—'}
                    </div>
                  </div>
                  <div className="padler-trip-card__row" style={{ borderTop: '1px solid var(--padler-border)' }}>
                    <div className="padler-trip-meta" style={{ width: '100%' }}>
                      <span>
                        <CalendarClock size={16} color="var(--padler-primary)" />
                        {formatTripDeparture(tripForDrawer.departureTime)}
                      </span>
                      <span>
                        <Clock size={16} color="var(--padler-primary)" />
                        Arrive {formatTripDeparture(tripForDrawer.arrivalTime)}
                      </span>
                      <span>
                        <Bus size={16} color="var(--padler-primary)" />
                        {tripForDrawer.vehicleType?.trim() || '—'}
                        {tripForDrawer.vehicleLicensePlate
                          ? ` · ${tripForDrawer.vehicleLicensePlate}`
                          : ''}
                      </span>
                      <span>
                        <User size={16} color="var(--padler-primary)" />
                        {tripForDrawer.bookedSeats != null && tripForDrawer.vehicleCapacity != null
                          ? `${tripForDrawer.vehicleCapacity - tripForDrawer.bookedSeats} of ${tripForDrawer.vehicleCapacity} free`
                          : 'Seats —'}
                      </span>
                    </div>
                    {tripForDrawer.driverName ? (
                      <p style={{ margin: 0, fontSize: 13, color: 'var(--padler-ink-muted)', width: '100%' }}>
                        Driver: {tripForDrawer.driverName}
                        {tripForDrawer.driverPhone ? ` · ${tripForDrawer.driverPhone}` : ''}
                      </p>
                    ) : null}
                  </div>
                </div>

                {showReassignPanel ? (
                  <div style={{ marginBottom: 20 }}>
                    <p
                      style={{
                        fontSize: 13,
                        color: 'var(--padler-ink-muted)',
                        margin: '0 0 12px 0',
                        lineHeight: 1.45
                      }}
                    >
                      Choose a trip and a seat for each passenger line, then apply changes. We verify a completed
                      wallet payment (COMPLETED or SUCCESSFUL) when you submit. Tap a passenger row to set the active
                      line, then pick a seat. Seats already held for this booking are shown as available.
                    </p>
                    {tripOptions.length > 0 ? (
                      <label
                        style={{
                          display: 'block',
                          fontSize: 13,
                          fontWeight: 600,
                          color: 'var(--padler-ink)',
                          marginBottom: 6
                        }}
                      >
                        Trip
                        <select
                          className="padler-action"
                          style={{ marginTop: 6, width: '100%', maxWidth: 360, padding: '8px 10px' }}
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
                              {formatTripDeparture(t.departureTime)} (trip {t.id})
                              {t.id === detail?.tripId ? ' — current' : ''}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                    <div style={{ marginTop: 12, marginBottom: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--padler-ink-muted)' }}>
                        Passengers (active row highlighted)
                      </div>
                      <ul style={{ listStyle: 'none', margin: '8px 0 0', padding: 0 }}>
                        {bookingLines.map((line, i) => (
                          <li key={line.id ?? i}>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveLineIdx(i);
                                activeLineIdxRef.current = i;
                              }}
                              className="padler-action"
                              style={{
                                width: '100%',
                                textAlign: 'left',
                                marginBottom: 6,
                                fontWeight: activeLineIdx === i ? 600 : 400,
                                borderColor: activeLineIdx === i ? 'var(--padler-primary)' : 'var(--padler-border)',
                                background: activeLineIdx === i ? 'rgba(14, 165, 233, 0.08)' : 'transparent'
                              }}
                            >
                              {line.passengerName?.trim() || `Line ${i + 1}`} — pick:{' '}
                              <strong>{draftSeatNumbers[i]?.trim() || '—'}</strong>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                    {reassignError ? (
                      <div
                        role="alert"
                        style={{
                          padding: '10px 12px',
                          borderRadius: 8,
                          background: '#fef2f2',
                          color: '#991b1b',
                          border: '1px solid #fecaca',
                          fontSize: 13,
                          marginBottom: 12
                        }}
                      >
                        {reassignError}
                      </div>
                    ) : null}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                      <button
                        type="button"
                        className="padler-action"
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
                      </button>
                      <button
                        type="button"
                        className="padler-action padler-action--primary"
                        disabled={reassignBusy || tripDrawerLoading}
                        onClick={() => void submitReassign()}
                      >
                        {reassignBusy ? 'Saving…' : 'Save seats & trip'}
                      </button>
                    </div>
                  </div>
                ) : null}

                <h3
                  className="padler-section-title"
                  style={{ margin: '0 0 12px 0', fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}
                >
                  <Bus size={20} color="var(--padler-primary)" />
                  Seat layout
                </h3>
                {showReassignPanel && reassignGridModel.seats.length > 0 ? (
                  <div
                    style={{
                      border: '1px solid var(--padler-border)',
                      borderRadius: 12,
                      padding: 16,
                      background: '#fff',
                      maxWidth: '100%',
                      overflow: 'auto',
                      margin : '0 60px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <TripSeatGrid
                        seats={reassignGridModel.seats}
                        onSeatSelect={handleReassignSeatPick}
                        frontPassenger={reassignGridModel.frontPassenger}
                        totalSeats={reassignGridModel.totalSeats}
                        rowLayout={reassignGridModel.rowLayout}
                        readOnly={false}
                      />
                    </div>
                    <div className="padler-seat-legend">
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
                  <div
                    style={{
                      border: '1px solid var(--padler-border)',
                      borderRadius: 12,
                      padding : 16,
                      background: '#fff',
                      maxWidth: '100%',
                      overflow: 'auto',
                      margin : '0 60px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <TripSeatGrid
                        seats={seatGridModel.seats}
                        onSeatSelect={() => {}}
                        frontPassenger={seatGridModel.frontPassenger}
                        totalSeats={seatGridModel.totalSeats}
                        rowLayout={seatGridModel.rowLayout}
                        readOnly
                      />
                    </div>
                    <div className="padler-seat-legend">
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
                  <p style={{ color: 'var(--padler-ink-muted)', fontSize: 14, margin: 0 }}>
                    No seat layout was returned for this trip.
                  </p>
                )}
              </>
            ) : !tripDrawerLoading && !tripDrawerError ? (
              <p style={{ margin: 0, color: 'var(--padler-ink-muted)' }}>No trip data.</p>
            ) : null}
          </div>
          {detail && rowForGates && showStatusActionsInDrawer ? (
            <div className="padler-drawer-footer">
              {showCancelInDrawer ? (
                <button
                  type="button"
                  className="padler-action padler-drawer-footer__action"
                  disabled={!canMutate || completeFromDrawerBusy}
                  onClick={() => void triggerAction(detail.bookingReference, 'cancel')}
                >
                  cancel
                </button>
              ) : null}
              {showCompleteInDrawer ? (
                <button
                  type="button"
                  className="padler-action padler-action--primary padler-drawer-footer__action"
                  disabled={!canMutate || completeFromDrawerBusy}
                  onClick={() => void completeBookingFromDrawer()}
                >
                  {completeFromDrawerBusy ? 'Verifying & completing…' : 'complete'}
                </button>
              ) : null}
              {!canMutate && (showCancelInDrawer || showCompleteInDrawer) ? (
                <span style={{ fontSize: 12, color: 'var(--padler-ink-muted)', width: '100%' }}>
                  Your role cannot change booking status.
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </>
    ) : null}
    </>
  );
}

export default function BookingDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="padler-page" style={{ padding: 48, color: 'var(--padler-ink-muted)' }}>
          Loading…
        </div>
      }
    >
      <BookingDetailContent />
    </Suspense>
  );
}
