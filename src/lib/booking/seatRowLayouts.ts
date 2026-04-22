/**
 * Row layouts by bus capacity (from efex). Sum of array = capacity.
 */
export type RowLayout = number[];

const MAX_SEATS_PER_ROW = 4;

export const ROW_LAYOUT_BY_CAPACITY: Record<number, RowLayout> = {
  18: [1, 2, 3, 4, 4, 4],
  8: [1, 2, 2, 3],
  12: [1, 2, 3, 3, 3],
  14: [1, 2, 3, 4, 4],
  15: [1, 2, 3, 3, 3, 3],
  24: [1, 3, 4, 4, 4, 4, 4],
  32: [1, 3, 4, 4, 4, 4, 4, 4, 4],
  38: [1, 2, 3, 4, 4, 4, 4, 4, 4, 4, 4],
  42: [1, 2, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  46: [1, 2, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  50: [1, 2, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  9: [1, 2, 2, 2, 2],
  10: [1, 2, 3, 4],
  16: [1, 2, 3, 3, 3, 4],
  17: [1, 2, 3, 3, 4, 4],
  20: [1, 3, 4, 4, 4, 4],
  22: [1, 2, 3, 4, 4, 4, 4],
  26: [1, 2, 3, 4, 4, 4, 4, 4],
  28: [1, 3, 4, 4, 4, 4, 4, 4],
  30: [1, 2, 3, 4, 4, 4, 4, 4, 4],
  36: [1, 2, 3, 4, 4, 4, 4, 4, 4, 4, 4]
};

export function getRowLayoutForCapacity(capacity: number): RowLayout | undefined {
  return ROW_LAYOUT_BY_CAPACITY[capacity];
}
