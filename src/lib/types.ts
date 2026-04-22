export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'DEFAULT';

export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'REFUNDED' | 'FAILED';

export interface BookingItem {
  /** TripJotter booking row id (first seat row for grouped bookings) */
  id?: number;
  bookingReference: string;
  customerName: string;
  sourceChannel: 'TRIPJOTTER' | 'NPOD_CUSTOMER' | 'TSP_WEBSITE';
  routeLabel: string;
  /** Trip departure from Trip Jotter (string, often ISO-8601 local) */
  departureTime?: string;
  /** Display name of the transport company (e.g. when listing all companies) */
  companyName?: string;
  status: BookingStatus;
  amount: number;
  createdAt: string;
}

/** Full booking from Trip Jotter via Padler BFF (get-by-id). */
export interface BookingDetail {
  id: number;
  tripId?: number;
  bookingReference: string;
  customerName: string;
  sourceChannel: BookingItem['sourceChannel'];
  routeLabel: string;
  departureTime?: string;
  arrivalTime?: string;
  companyName?: string;
  companyLogoUrl?: string;
  status: BookingStatus;
  amount: number;
  seatNumber?: string;
  passengerEmail?: string;
  passengerPhone?: string;
  identificationType?: string;
  paymentMethod?: string;
  createdAt: string;
  updatedAt: string;
}

/** `PAYMENT_STATUS` in wallet-service (string in API). */
export type PaymentStatus =
  | 'PENDING'
  | 'INITIATED'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'SUCCESSFUL';

/** Wallet payment row (Padler admin / list from wallet-service). */
/** Trip for admin drawer (Trip Jotter public trip DTO via BFF). */
export interface TripSeatItem {
  number: string;
  status: string;
}

export interface TripDetail {
  id: number;
  /** Same route, later trips (Padler reassign / alternatives). */
  transportCompanyId?: number;
  originTerminalId?: number;
  destinationTerminalId?: number;
  routeOrigin?: string;
  routeDestination?: string;
  transportCompanyName?: string;
  vehicleCapacity?: number;
  vehicleType?: string;
  vehicleSeatLayout?: string;
  vehicleLicensePlate?: string;
  vehicleStatus?: string;
  driverName?: string;
  driverPhone?: string;
  departureTime?: string;
  arrivalTime?: string;
  basePrice?: number;
  status?: string;
  bookedSeats?: number;
  vehicleSeats?: TripSeatItem[];
  /** LOCAL or CROSS_BORDER when present */
  tripType?: string;
}

/** One line from Trip Jotter admin booking (multi-passenger / seat). */
export interface AdminBookingLine {
  id?: number;
  seatNumber?: string;
  passengerName?: string;
  status?: string;
}

export interface PaymentRow {
  id?: number;
  reference: string;
  amount: number;
  discountAmount: number;
  discountCode?: string;
  currency: string;
  service: string;
  paymentProcessor: string;
  purpose: string;
  message?: string;
  email: string;
  payerUserId: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
  /** Present when pay-by-link was initialized (e.g. Paystack). */
  authorizationUrl?: string;
}
