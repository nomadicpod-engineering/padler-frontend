'use client';

import type { CSSProperties } from 'react';
import { User } from 'lucide-react';
import type { SeatData } from '@/lib/booking/seatLayout';
import { groupSeatsByRowsWithoutFront } from '@/lib/booking/seatLayout';

const baseSeat: CSSProperties = {
  width: 48,
  height: 48,
  borderRadius: 8,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 14,
  fontWeight: 600,
  fontFamily: 'var(--padler-font-heading)',
  border: 'none',
  boxSizing: 'border-box' as const
};

function isSeatSelectBlocked(seat: SeatData, readOnly: boolean): boolean {
  return readOnly || seat.isDriverSeat || seat.status === 'BOOKED' || seat.status === 'PENDING';
}

function styleForSeat(seat: SeatData, readOnly: boolean, blocked: boolean): CSSProperties {
  if (seat.isDriverSeat) {
    return {
      ...baseSeat,
      background: '#ffedd5',
      color: '#9a3412',
      cursor: 'not-allowed',
      pointerEvents: 'none'
    };
  }
  const isBookedOrPending = seat.status === 'BOOKED' || seat.status === 'PENDING';
  /** Booked/pending need pointer events so :hover can show the “not allowed” cursor. */
  const pointerEvents: CSSProperties['pointerEvents'] =
    isBookedOrPending ? 'auto' : blocked ? 'none' : 'auto';
  const baseCursor: CSSProperties['cursor'] = isBookedOrPending
    ? 'not-allowed'
    : readOnly
      ? 'default'
      : blocked
        ? 'not-allowed'
        : 'pointer';
  const common: CSSProperties = {
    ...baseSeat,
    cursor: baseCursor,
    pointerEvents
  };
  switch (seat.status) {
    case 'SELECTED':
      return { ...common, background: 'var(--padler-primary)', color: '#fff' };
    case 'PENDING':
      return { ...common, background: '#1e293b', color: '#fff' };
    case 'BOOKED':
      return { ...common, background: '#e2e8f0', color: '#64748b' };
    default:
      return { ...common, background: '#3b82f6', color: '#fff' };
  }
}

function SeatButton({
  seat,
  onSelect,
  readOnly
}: {
  seat: SeatData;
  onSelect: (n: string) => void;
  readOnly: boolean;
}) {
  const blocked = isSeatSelectBlocked(seat, readOnly);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (blocked) {
          return;
        }
        onSelect(seat.number);
      }}
      onKeyDown={(e) => {
        if (blocked && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
        }
      }}
      disabled={blocked}
      style={styleForSeat({ ...seat, isDriverSeat: seat.isDriverSeat }, readOnly, blocked)}
      title={
        seat.isDriverSeat
          ? 'Driver'
          : seat.status === 'BOOKED'
            ? `${seat.number} (booked — not available)`
            : seat.status === 'PENDING'
              ? `${seat.number} (pending — not available)`
              : seat.number
      }
    >
      {seat.isDriverSeat ? 'D' : seat.number}
    </button>
  );
}

export function TripSeatGrid({
  seats,
  onSeatSelect,
  frontPassenger,
  totalSeats,
  rowLayout,
  readOnly = true
}: {
  seats: SeatData[];
  onSeatSelect: (n: string) => void;
  frontPassenger: SeatData | null;
  totalSeats: number;
  rowLayout?: number[];
  readOnly?: boolean;
}) {
  const passengerSeats = seats.filter((s) => !s.isDriverSeat);
  const seatsForGrid = frontPassenger ? passengerSeats.filter((s) => s.number !== frontPassenger.number) : passengerSeats;
  const { regularRows, backRow } = groupSeatsByRowsWithoutFront(seatsForGrid, 4, totalSeats, rowLayout);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%' }}>
      {frontPassenger && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 8px 4px 8px'
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              border: '1px solid var(--padler-border)',
              background: 'var(--padler-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--padler-ink-muted)'
            }}
          >
            <User size={20} />
          </div>
          <SeatButton
            seat={{ ...frontPassenger, isDriverSeat: false }}
            onSelect={onSeatSelect}
            readOnly={readOnly}
          />
        </div>
      )}
      {regularRows.map((rowSeats, idx) => {
        const isFirstFullRow = idx === 0;
        if (isFirstFullRow) {
          return (
            <div
              key={`row-${idx}`}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 16, paddingLeft: 0 }}
            >
              {rowSeats.map((s) => (
                <SeatButton key={s.number} seat={s} onSelect={onSeatSelect} readOnly={readOnly} />
              ))}
            </div>
          );
        }
        const isThreeSeatRow = rowSeats.length === 3;
        const isFourSeatRow = rowSeats.length === 4;
        const leftSeats = isThreeSeatRow ? rowSeats.slice(0, 2) : isFourSeatRow ? rowSeats.slice(0, 2) : rowSeats;
        const rightSeats = isThreeSeatRow ? rowSeats.slice(2) : isFourSeatRow ? rowSeats.slice(2) : [];
        const hasAisle = isThreeSeatRow || isFourSeatRow;
        return (
          <div
            key={`row-${idx}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              width: '100%',
              justifyContent: hasAisle ? 'flex-start' : 'center',
              paddingLeft: hasAisle ? 0 : 0
            }}
          >
            {leftSeats.map((s) => (
              <SeatButton key={s.number} seat={s} onSelect={onSeatSelect} readOnly={readOnly} />
            ))}
            {hasAisle && (
              <span
                style={{ width: isThreeSeatRow ? 48 : 24, flexShrink: 0 }}
                aria-hidden
                title={isThreeSeatRow ? 'Aisle' : undefined}
              />
            )}
            {isThreeSeatRow && <span style={{ flex: 1, minWidth: 8 }} aria-hidden />}
            {rightSeats.map((s) => (
              <SeatButton key={s.number} seat={s} onSelect={onSeatSelect} readOnly={readOnly} />
            ))}
          </div>
        );
      })}
      {backRow.length > 0 && (
        <div
          style={{
            display: 'flex',
            width: '100%',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingTop: 12,
            borderTop: '1px solid var(--padler-border)'
          }}
        >
          {backRow.map((s) => (
            <SeatButton key={s.number} seat={s} onSelect={onSeatSelect} readOnly={readOnly} />
          ))}
        </div>
      )}
    </div>
  );
}
