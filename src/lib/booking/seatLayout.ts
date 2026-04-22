import { getRowLayoutForCapacity } from './seatRowLayouts';

export type SeatStatus = 'AVAILABLE' | 'SELECTED' | 'PENDING' | 'BOOKED';

export interface SeatData {
  number: string;
  rowLetter: string;
  position: number;
  status: SeatStatus;
  isDriverSeat: boolean;
}

export interface VehicleSeatApi {
  number: string;
  status: string;
}

export function getFirstRowSeatCount(totalSeats: number): number {
  return totalSeats % 2 === 1 ? 3 : 2;
}

export { getRowLayoutForCapacity };

export function groupSeatsByRowsWithoutFront(
  seats: SeatData[],
  backRowCount = 4,
  totalSeats?: number,
  rowLayout?: number[]
): { regularRows: SeatData[][]; backRow: SeatData[] } {
  if (seats.length === 0) {
    return { regularRows: [], backRow: [] };
  }

  if (rowLayout && rowLayout.length >= 2) {
    const layoutWithoutFront = rowLayout[0] === 1 ? rowLayout.slice(1) : rowLayout;
    const backCount = layoutWithoutFront[layoutWithoutFront.length - 1];
    const regularCounts = layoutWithoutFront.slice(0, -1);
    let i = 0;
    const regularRows: SeatData[][] = [];
    for (const count of regularCounts) {
      if (i + count <= seats.length) {
        regularRows.push(seats.slice(i, i + count));
        i += count;
      }
    }
    const backRow = i < seats.length ? seats.slice(i, i + backCount) : [];
    return { regularRows, backRow };
  }

  if (seats.length <= backRowCount) {
    return { regularRows: [], backRow: seats };
  }
  const total = totalSeats ?? seats.length;
  const firstRowCount = getFirstRowSeatCount(total);

  const regular = seats.slice(0, -backRowCount);
  const back = seats.slice(-backRowCount);
  const firstFullRow = regular.slice(0, firstRowCount);
  const middleSeats = regular.slice(firstRowCount);
  const middleRows: SeatData[][] = [];
  let j = 0;
  while (j < middleSeats.length) {
    const remaining = middleSeats.length - j;
    const take = remaining >= 4 && (remaining - 4 >= 3 || remaining === 4) ? 4 : 3;
    const chunk = middleSeats.slice(j, j + take);
    if (chunk.length > 0) middleRows.push(chunk);
    j += take;
  }
  const regularRows = firstFullRow.length > 0 ? [firstFullRow, ...middleRows] : middleRows;
  return { regularRows, backRow: back };
}

export function buildSeatsFromVehicleSeats(
  vehicleSeats: VehicleSeatApi[],
  bookedSeatNumbers: Set<string>,
  selectedSeatNumbers: Set<string>,
  pendingSeatNumbers: Set<string> = new Set()
): SeatData[] {
  if (!Array.isArray(vehicleSeats) || vehicleSeats.length === 0) return [];

  const sorted = [...vehicleSeats].sort((a, b) =>
    String(a.number).localeCompare(String(b.number), undefined, { numeric: true, sensitivity: 'base' })
  );

  return sorted.map((item, index) => {
    const num = String(item.number).trim();
    const upper = num.toUpperCase();
    const raw = String(item.status ?? '')
      .trim()
      .toUpperCase();
    let status: SeatStatus = (
      raw === 'BOOKED' || raw === 'PENDING' || raw === 'SELECTED' || raw === 'AVAILABLE'
        ? (raw as SeatStatus)
        : 'AVAILABLE'
    ) as SeatStatus;
    if (bookedSeatNumbers.has(upper)) status = 'BOOKED';
    else if (selectedSeatNumbers.has(upper)) status = 'SELECTED';
    else if (pendingSeatNumbers.has(upper)) status = 'PENDING';
    else if (status !== 'BOOKED' && status !== 'PENDING') status = 'AVAILABLE';

    return {
      number: num,
      rowLetter: '',
      position: index + 1,
      status,
      isDriverSeat: false
    };
  });
}
