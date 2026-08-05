'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TripSeatGrid } from '@/components/booking/TripSeatGrid';
import { Button } from '@/components/ui/button';
import { DetailSkeleton } from '@/components/ui/skeleton';
import { DrawerSection, SideDrawer } from '@/components/ui/side-drawer';
import {
  fetchAdminBookingLines,
  fetchBookingById,
  fetchTripForBookingDetail,
  reassignSeatsAfterPayment
} from '@/lib/api';
import { formatDateTime, formatMoney } from '@/lib/utils';
import {
  reconcileTripJotterCheckout,
  type CheckoutReconcileResult,
  type CheckoutSeatOutcome
} from '@/lib/api/trip-jotter';
import {
  buildSeatsFromVehicleSeats,
  getRowLayoutForCapacity,
  type SeatData
} from '@/lib/booking/seatLayout';
import type { AdminBookingLine, BookingDetail, TripDetail } from '@/lib/types';

export type StuckCheckoutRow = {
  bookingReference: string;
  status?: string;
  tripId?: number;
  companyName?: string;
  transportCompanyEmail?: string;
  passengerEmail?: string;
  customerUserId?: string;
  paymentProcessor?: string;
  lastErrorHint?: string;
  updatedAt?: string;
};

type Props = {
  open: boolean;
  row: StuckCheckoutRow | null;
  onClose: () => void;
  onResolved?: () => void;
};

function textOrUndefined(value: unknown): string | undefined {
  if (value == null) return undefined;
  const s = String(value).trim();
  return s === '' ? undefined : s;
}

/** Stuck samples arrive as loose maps from the BFF. */
export function toStuckCheckoutRow(row: Record<string, unknown>): StuckCheckoutRow {
  return {
    bookingReference: String(row.bookingReference ?? ''),
    status: textOrUndefined(row.status),
    tripId: row.tripId != null ? Number(row.tripId) : undefined,
    companyName: textOrUndefined(row.companyName),
    transportCompanyEmail: textOrUndefined(row.transportCompanyEmail),
    passengerEmail: textOrUndefined(row.passengerEmail),
    customerUserId: textOrUndefined(row.customerUserId),
    paymentProcessor: textOrUndefined(row.paymentProcessor),
    lastErrorHint: textOrUndefined(row.lastErrorHint),
    updatedAt: textOrUndefined(row.updatedAt)
  };
}


function summarizeResult(result: CheckoutReconcileResult): string {
  const bits = [
    `settled=${String(result.walletSettled)}`,
    `confirmed=${String(result.confirmed)}`,
    result.needsSeatAction ? 'needsSeatAction=true' : null,
    result.detail ? String(result.detail) : null
  ].filter(Boolean);
  return bits.join(' · ');
}

function Row({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div className="grid gap-1 border-b border-slate-100 py-2.5 last:border-b-0 sm:grid-cols-[130px_1fr]">
      <dt className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-400">{label}</dt>
      <dd className="text-sm text-slate-900">{value?.trim() ? value : '—'}</dd>
    </div>
  );
}

export function StuckCheckoutHealDrawer({ open, row, onClose, onResolved }: Props) {
  const ref = (row?.bookingReference ?? '').trim();
  const companyEmail = row?.transportCompanyEmail?.trim() ?? '';

  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reassignBusy, setReassignBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [result, setResult] = useState<CheckoutReconcileResult | null>(null);
  const [detail, setDetail] = useState<BookingDetail | null>(null);
  const [trip, setTrip] = useState<TripDetail | null>(null);
  const [lines, setLines] = useState<AdminBookingLine[]>([]);
  const [draftSeats, setDraftSeats] = useState<string[]>([]);
  const [activeLineIdx, setActiveLineIdx] = useState(0);
  const activeLineIdxRef = useRef(0);

  const needsSeatAction = Boolean(result?.needsSeatAction);
  const tripId = Number(result?.tripId ?? row?.tripId ?? 0);
  const tripSource = String(result?.tripSource ?? '').toUpperCase();
  const isMiddleware = tripSource === 'MIDDLEWARE';

  const loadTrip = useCallback(
    async (id: number) => {
      if (!Number.isFinite(id) || id <= 0) return;
      try {
        setTrip(
          await fetchTripForBookingDetail({
            tripId: id,
            allCompanies: true,
            transportCompanyEmail: companyEmail
          })
        );
      } catch (e) {
        setTrip(null);
        setError(e instanceof Error ? e.message : 'Unable to load trip');
      }
    },
    [companyEmail]
  );

  /** Traveller, trip and seat map load on open so staff can inspect before reconciling. */
  const loadContext = useCallback(async () => {
    if (!ref) return;
    setLoading(true);
    setError(null);
    try {
      const bookingLines = await fetchAdminBookingLines(ref);
      setLines(bookingLines);
      setDraftSeats(bookingLines.map((l) => (l.seatNumber ?? '').trim()));
      setActiveLineIdx(0);
      activeLineIdxRef.current = 0;

      const bookingId = bookingLines.find((l) => l.id != null)?.id;
      if (bookingId != null) {
        try {
          setDetail(
            await fetchBookingById({
              id: bookingId,
              allCompanies: true,
              transportCompanyEmail: companyEmail
            })
          );
        } catch {
          setDetail(null);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load booking lines');
      setLines([]);
    } finally {
      setLoading(false);
    }
  }, [ref, companyEmail]);

  useEffect(() => {
    if (open && ref) void loadContext();
  }, [open, ref, loadContext]);

  useEffect(() => {
    if (open && tripId > 0 && trip?.id !== tripId) void loadTrip(tripId);
  }, [open, tripId, trip?.id, loadTrip]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy && !reassignBusy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, reassignBusy, onClose]);

  const editable = needsSeatAction && !isMiddleware && lines.length > 0;

  const gridModel = useMemo(() => {
    const empty = {
      seats: [] as SeatData[],
      rowLayout: undefined as number[] | undefined,
      frontPassenger: null as SeatData | null,
      totalSeats: 0
    };
    const vehicleSeats = trip?.vehicleSeats ?? [];
    if (vehicleSeats.length === 0) return empty;

    const ourSeats = new Set(
      lines.map((l) => (l.seatNumber ?? '').trim().toUpperCase()).filter(Boolean)
    );
    /** In edit mode our own seats are freed so they can be re-picked. */
    const vs = editable
      ? vehicleSeats.map((s) => (ourSeats.has(s.number.trim().toUpperCase()) ? { ...s, status: 'AVAILABLE' } : s))
      : vehicleSeats;
    const highlighted = editable ? draftSeats.filter(Boolean) : Array.from(ourSeats);
    const selected = new Set(highlighted.map((x) => x.trim().toUpperCase()));
    const cap = trip?.vehicleCapacity ?? vs.length;
    const built = buildSeatsFromVehicleSeats(vs, new Set(), selected, new Set());
    return {
      seats: built,
      rowLayout: getRowLayoutForCapacity(cap),
      frontPassenger: built.length > 0 ? built[0] : null,
      totalSeats: cap
    };
  }, [trip, lines, draftSeats, editable]);

  const onPickSeat = useCallback(
    (n: string) => {
      if (!editable) return;
      setDraftSeats((prev) => {
        const next = [...prev];
        const idx = Math.min(Math.max(0, activeLineIdxRef.current), next.length - 1);
        next[idx] = n;
        return next;
      });
      setActiveLineIdx((i) => {
        const nextI = Math.min(i + 1, Math.max(0, lines.length - 1));
        activeLineIdxRef.current = nextI;
        return nextI;
      });
    },
    [editable, lines.length]
  );

  const runReconcile = useCallback(async () => {
    if (!ref) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const next = await reconcileTripJotterCheckout(ref);
      setResult(next);
      setMessage(`Match ${ref}: ${summarizeResult(next)}`);
      if (next.confirmed) {
        onResolved?.();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reconcile failed');
    } finally {
      setBusy(false);
    }
  }, [ref, onResolved]);

  const runReassignThenReconcile = useCallback(async () => {
    if (!ref || !trip) return;
    setReassignBusy(true);
    setError(null);
    setMessage(null);
    try {
      const seats = draftSeats.map((s) => s.trim());
      if (seats.length !== lines.length || seats.some((s) => !s)) {
        setError('Choose one seat for each passenger line.');
        return;
      }
      const seen = new Set<string>();
      for (const s of seats) {
        const u = s.toUpperCase();
        if (seen.has(u)) {
          setError('Each seat must be unique.');
          return;
        }
        seen.add(u);
      }
      await reassignSeatsAfterPayment(ref, {
        newSeatNumbers: seats,
        reason: 'Reassign seats from Trip Jotter stuck heal (after payment)',
        sourceAction: 'PADLER_TJ_STUCK_REASSIGN'
      });
      setMessage(`Seats reassigned for ${ref}. Reconciling to confirm and send email…`);
      const next = await reconcileTripJotterCheckout(ref);
      setResult(next);
      setMessage(`Match ${ref}: ${summarizeResult(next)}`);
      if (next.confirmed) {
        onResolved?.();
      } else {
        await loadContext();
        if (tripId > 0) await loadTrip(tripId);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reassign / reconcile failed');
    } finally {
      setReassignBusy(false);
    }
  }, [ref, trip, draftSeats, lines.length, onResolved, tripId, loadContext, loadTrip]);

  if (!row) return null;

  const seatOutcomes: CheckoutSeatOutcome[] = Array.isArray(result?.seats) ? result!.seats! : [];
  const passengerName = detail?.customerName?.trim() || lines[0]?.passengerName?.trim() || undefined;
  const routeLabel =
    detail?.routeLabel?.trim()
    || (trip?.routeOrigin && trip?.routeDestination
      ? `${trip.routeOrigin} → ${trip.routeDestination}`
      : undefined);
  const vehicleLabel = [trip?.vehicleType?.trim(), trip?.vehicleLicensePlate?.trim()]
    .filter(Boolean)
    .join(' · ');

  return (
    <SideDrawer
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={ref || 'Unfinished payment'}
      description="Match the payment and confirm the booking when seats are clear."
      width="lg"
      footer={
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="primary"
            disabled={!ref || busy || reassignBusy}
            onClick={() => void runReconcile()}
          >
            {busy ? 'Matching…' : 'Match payment'}
          </Button>
          {needsSeatAction ? (
            <Button
              type="button"
              disabled={!trip || !editable || busy || reassignBusy || loading}
              onClick={() => void runReassignThenReconcile()}
            >
              {reassignBusy ? 'Saving & confirming…' : 'Save seats & confirm'}
            </Button>
          ) : null}
        </div>
      }
    >
      <div className="space-y-5">
        {loading ? <DetailSkeleton /> : null}
        {message ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
            {error}
          </div>
        ) : null}

        <DrawerSection title="Traveller">
          <dl>
            <Row label="Passenger" value={passengerName} />
            <Row label="Email" value={detail?.passengerEmail?.trim() || row.passengerEmail} />
            <Row label="Phone" value={detail?.passengerPhone} />
            <Row label="Customer id" value={row.customerUserId} />
            <Row label="Booking status" value={detail?.status ?? row.status} />
            <Row
              label="Amount"
              value={
                detail?.amount != null && Number.isFinite(detail.amount)
                  ? formatMoney(detail.amount)
                  : undefined
              }
            />
            <Row label="Payment" value={detail?.paymentMethod ?? row.paymentProcessor} />
            <Row label="Last updated" value={formatDateTime(detail?.updatedAt ?? row.updatedAt)} />
            {row.lastErrorHint ? <Row label="Last error" value={row.lastErrorHint} /> : null}
          </dl>
        </DrawerSection>

        <DrawerSection title="Trip">
          <dl>
            <Row label="Trip id" value={tripId > 0 ? String(tripId) : undefined} />
            <Row label="Route" value={routeLabel} />
            <Row label="Departure" value={formatDateTime(trip?.departureTime ?? detail?.departureTime)} />
            <Row label="Arrival" value={formatDateTime(trip?.arrivalTime ?? detail?.arrivalTime)} />
            <Row
              label="Company"
              value={trip?.transportCompanyName ?? row.companyName ?? row.transportCompanyEmail}
            />
            <Row label="Vehicle" value={vehicleLabel || undefined} />
            <Row
              label="Seats"
              value={
                trip?.vehicleCapacity != null
                  ? `${trip.bookedSeats ?? 0} booked of ${trip.vehicleCapacity}`
                  : undefined
              }
            />
            <Row label="Trip status" value={trip?.status} />
            {tripSource ? <Row label="Trip source" value={tripSource} /> : null}
          </dl>
        </DrawerSection>

        <DrawerSection title="Seats on this booking">
          {lines.length > 0 ? (
            <ul className="space-y-1 text-sm text-slate-600">
              {lines.map((line, i) => (
                <li
                  key={line.id ?? i}
                  className={editable && i === activeLineIdx ? 'font-semibold text-slate-900' : undefined}
                >
                  {line.passengerName?.trim() || `Passenger ${i + 1}`} · seat{' '}
                  {(editable ? draftSeats[i] : line.seatNumber)?.trim() || '—'}
                  {line.status ? ` · ${line.status}` : ''}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">No booking lines found for this reference.</p>
          )}
        </DrawerSection>

        {isMiddleware ? (
          <p className="text-sm text-slate-500">
            This trip is from the external ticket system. Local seat changes may not clear a pending
            ticket. Prefer matching payment again after upstream settles.
          </p>
        ) : null}

        {editable ? (
          <p className="text-sm text-slate-500">
            Payment is settled but seats need action. Picking for passenger{' '}
            {Math.min(activeLineIdx + 1, lines.length)} of {lines.length}
            {lines[activeLineIdx]?.passengerName ? ` (${lines[activeLineIdx]?.passengerName})` : ''}.
            Save, then the traveller confirmation email sends on successful confirm.
          </p>
        ) : null}

        {gridModel.seats.length > 0 ? (
          <DrawerSection title="Seat map">
            <div className="mx-auto max-w-[280px]">
              <TripSeatGrid
                seats={gridModel.seats}
                onSeatSelect={onPickSeat}
                frontPassenger={gridModel.frontPassenger}
                totalSeats={gridModel.totalSeats}
                rowLayout={gridModel.rowLayout}
                readOnly={!editable}
              />
            </div>
          </DrawerSection>
        ) : !loading && tripId > 0 ? (
          <p className="text-sm text-slate-500">No vehicle seats on trip {tripId}.</p>
        ) : null}

        {seatOutcomes.length > 0 ? (
          <DrawerSection title="Seat check">
            <ul className="space-y-2 text-sm text-slate-700">
              {seatOutcomes.map((s, i) => (
                <li key={`${s.seatNumber ?? 'x'}-${i}`}>
                  <strong>{s.outcome ?? '—'}</strong>
                  {' · '}
                  seat {s.seatNumber ?? '—'}
                  {s.passengerName ? ` · ${s.passengerName}` : ''}
                  {s.seatStatus ? ` · vehicle=${s.seatStatus}` : ''}
                  {s.detail ? <div className="text-slate-500">{s.detail}</div> : null}
                </li>
              ))}
            </ul>
          </DrawerSection>
        ) : null}
      </div>
    </SideDrawer>
  );
}
