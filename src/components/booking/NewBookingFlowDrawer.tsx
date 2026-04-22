'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react';
import { X } from 'lucide-react';
import { BookingDownloadSuccessModal } from '@/components/booking/BookingDownloadSuccessModal';
import { TripSeatGrid } from '@/components/booking/TripSeatGrid';
import {
  downloadBookingTicketPdf,
  type BookingTicketPdfInput
} from '@/lib/booking/downloadBookingTicketPdf';
import { TripDetail } from '@/lib/types';
import {
  buildSeatsFromVehicleSeats,
  getRowLayoutForCapacity
} from '@/lib/booking/seatLayout';
import {
  createAdminBooking,
  defaultTransportCompanyEmail,
  fetchAdminTerminals,
  fetchTripForBookingDetail,
  searchTextFromTerminal,
  searchTripsForAdmin,
  type AdminTravellerDetailPayload,
  type TerminalListItem,
  type TransportCompanyOption
} from '@/lib/api';

const TITLES = ['Mr', 'Miss', 'Mrs', 'Chief', 'Dr'] as const;
const GENDERS = ['Male', 'Female'] as const;
const RELATIONSHIPS = [
  'Husband',
  'Wife',
  'Brother',
  'Sister',
  'Niece',
  'Nephew',
  'Aunt',
  'Father',
  'Mother',
  'Relative',
  'Friend'
] as const;
const ID_TYPES = [
  { value: 'NO_IDENTIFICATION', label: 'No identification' },
  { value: 'NIN', label: 'NIN' },
  { value: 'VIRGIN_PASSPORT', label: 'Virgin (new) passport' },
  { value: 'NORMAL_PASSPORT', label: 'Passport' }
] as const;

type Step = 'search' | 'trips' | 'seats' | 'details';

type ExtraPass = { firstName: string; lastName: string; email: string; phoneNumber: string };

type TravellerForm = {
  title: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  dateOfBirth: string;
  gender: string;
  street: string;
  city: string;
  state: string;
  country: string;
  nextOfKinFirstName: string;
  nextOfKinLastName: string;
  nextOfKinEmail: string;
  nextOfKinPhoneNumber: string;
  relationship: string;
  identificationType: string;
};

const emptyTraveller = (): TravellerForm => ({
  title: 'Mr',
  firstName: '',
  lastName: '',
  email: '',
  phoneNumber: '',
  dateOfBirth: '',
  gender: 'Male',
  street: '',
  city: '',
  state: '',
  country: '',
  nextOfKinFirstName: '',
  nextOfKinLastName: '',
  nextOfKinEmail: '',
  nextOfKinPhoneNumber: '',
  relationship: 'Relative',
  identificationType: 'NO_IDENTIFICATION'
});

function buildExtras(count: number): ExtraPass[] {
  return Array.from({ length: Math.max(0, count) }, () => ({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: ''
  }));
}

function formatTerminalOption(t: TerminalListItem): string {
  const loc = [t.city, t.state].filter(Boolean).join(', ');
  return loc ? `${t.name} — ${loc}` : t.name;
}

function compareTerminals(a: TerminalListItem, b: TerminalListItem): number {
  const sa = `${a.state ?? ''}\t${a.city ?? ''}\t${a.name}`.toLowerCase();
  const sb = `${b.state ?? ''}\t${b.city ?? ''}\t${b.name}`.toLowerCase();
  return sa.localeCompare(sb);
}

function formatDepartureForTicket(iso?: string): string {
  if (!iso?.trim()) {
    return 'N/A';
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return iso.trim();
  }
  return d.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

function buildTicketPdfInput(
  trip: TripDetail,
  primary: TravellerForm,
  selectedSeats: string[],
  bookingRef: string
): BookingTicketPdfInput {
  const seatStr = selectedSeats.map((s) => s.trim().toUpperCase()).join(', ');
  const n = Math.max(1, selectedSeats.length);
  const unit = trip.basePrice ?? 0;
  const total = unit * n;
  const priceLabel = `₦${total.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;
  const ro = (trip.routeOrigin ?? '').trim();
  const rd = (trip.routeDestination ?? '').trim();
  const routeLine = ro && rd ? `${ro} → ${rd}` : undefined;
  return {
    bookingReference: bookingRef.trim() || 'N/A',
    passengerName: [primary.firstName, primary.lastName].filter(Boolean).join(' ').trim() || 'Passenger',
    tripId: trip.id,
    seatNumber: seatStr || 'N/A',
    status: 'Confirmed',
    priceLabel,
    dateLabel: formatDepartureForTicket(trip.departureTime),
    companyName: trip.transportCompanyName?.trim() || 'Transport',
    routeLine
  };
}

const fieldStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid var(--padler-border)',
  fontSize: 14,
  fontFamily: 'inherit',
  boxSizing: 'border-box',
  background: '#fff'
};

const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--padler-ink-muted)',
  marginBottom: 4
};

function filterTerminals(needle: string, all: TerminalListItem[]): TerminalListItem[] {
  const q = needle.trim().toLowerCase();
  if (!q) {
    return all;
  }
  return all.filter((t) => {
    const blob = `${t.name} ${t.city ?? ''} ${t.state ?? ''} ${formatTerminalOption(t)}`.toLowerCase();
    return blob.includes(q);
  });
}

type TerminalComboboxProps = {
  label: string;
  terminals: TerminalListItem[];
  inputValue: string;
  selectedTerminalId: string;
  onChange: (next: { inputValue: string; selectedTerminalId: string }) => void;
  disabled?: boolean;
  placeholder?: string;
};

/**
 * Combobox: type to filter terminals; pick from the list or enter a free-text area/city (public search).
 */
function TerminalCombobox({
  label,
  terminals,
  inputValue,
  selectedTerminalId,
  onChange,
  disabled,
  placeholder
}: TerminalComboboxProps) {
  const baseId = useId();
  const listId = `${baseId}-listbox`;
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(
    () => filterTerminals(inputValue, terminals),
    [inputValue, terminals]
  );

  useEffect(() => {
    setHighlight((h) => Math.min(h, Math.max(0, filtered.length - 1)));
  }, [filtered.length, inputValue]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const applyTerminal = (t: TerminalListItem) => {
    onChange({ inputValue: formatTerminalOption(t), selectedTerminalId: String(t.id) });
    setOpen(false);
  };

  const onInputChange = (v: string) => {
    onChange({ inputValue: v, selectedTerminalId: '' });
    setHighlight(0);
    setOpen(true);
  };

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <label style={labelStyle} htmlFor={baseId}>
        {label}
      </label>
      <input
        id={baseId}
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && filtered[highlight] ? `${listId}-opt-${filtered[highlight].id}` : undefined}
        value={inputValue}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onInputChange(e.target.value)}
        onFocus={() => {
          if (!disabled) {
            setOpen(true);
          }
        }}
        onKeyDown={(e) => {
          if (disabled) {
            return;
          }
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (filtered.length === 0) {
              return;
            }
            setOpen(true);
            setHighlight((h) => Math.min(filtered.length - 1, h + 1));
            return;
          }
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (filtered.length === 0) {
              return;
            }
            setOpen(true);
            setHighlight((h) => Math.max(0, h - 1));
            return;
          }
          if (e.key === 'Enter' && open && filtered[highlight]) {
            e.preventDefault();
            applyTerminal(filtered[highlight]);
            return;
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            setOpen(false);
          }
        }}
        onBlur={() => {
          window.setTimeout(() => {
            const t = inputValue.trim();
            if (!t) {
              return;
            }
            const exact = terminals.find((x) => formatTerminalOption(x) === t);
            if (exact) {
              onChange({ inputValue: formatTerminalOption(exact), selectedTerminalId: String(exact.id) });
            }
            setOpen(false);
          }, 120);
        }}
        style={fieldStyle}
        autoComplete="off"
      />
      {open && filtered.length > 0 && !disabled ? (
        <ul
          id={listId}
          role="listbox"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: '100%',
            margin: '2px 0 0 0',
            padding: 0,
            listStyle: 'none',
            maxHeight: 220,
            overflowY: 'auto',
            background: '#fff',
            border: '1px solid var(--padler-border)',
            borderRadius: 8,
            boxShadow: '0 4px 16px rgba(15, 23, 42, 0.12)',
            zIndex: 50,
            fontSize: 14
          }}
        >
          {filtered.map((t, i) => (
            <li
              id={`${listId}-opt-${t.id}`}
              key={t.id}
              role="option"
              aria-selected={selectedTerminalId === String(t.id)}
              onMouseDown={(ev) => {
                ev.preventDefault();
                applyTerminal(t);
              }}
              onMouseEnter={() => setHighlight(i)}
              style={{
                padding: '8px 10px',
                cursor: 'pointer',
                background: i === highlight ? 'rgba(29, 78, 216, 0.08)' : 'transparent',
                borderBottom: '1px solid #f1f5f9'
              }}
            >
              {formatTerminalOption(t)}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** When the admin did not pick a company, infer owner email from trip + option list (id or name). */
function resolveTransportCompanyEmailForBooking(
  trip: TripDetail,
  companyOptions: TransportCompanyOption[],
  explicitEmail: string
): string | undefined {
  const ex = explicitEmail.trim();
  if (ex) {
    return ex;
  }
  const id = trip.transportCompanyId;
  if (id != null) {
    const byId = companyOptions.find((o) => o.id != null && o.id === id);
    if (byId?.email?.trim()) {
      return byId.email.trim();
    }
  }
  const name = trip.transportCompanyName?.trim().toLowerCase();
  if (name) {
    const byName = companyOptions.find((o) => o.displayName.trim().toLowerCase() === name);
    if (byName?.email?.trim()) {
      return byName.email.trim();
    }
  }
  return undefined;
}

type Props = {
  open: boolean;
  onClose: () => void;
  onBooked: () => void;
  companyOptions: TransportCompanyOption[];
  allCompanies: boolean;
  pageTransportEmail: string;
  pageAllCompanies: boolean;
};

export function NewBookingFlowDrawer({
  open,
  onClose,
  onBooked,
  companyOptions,
  allCompanies: allowAllCompanies,
  pageTransportEmail,
  pageAllCompanies
}: Props) {
  const [step, setStep] = useState<Step>('search');
  const [companyEmail, setCompanyEmail] = useState('');
  const [originInput, setOriginInput] = useState('');
  const [destinationInput, setDestinationInput] = useState('');
  const [originTerminalId, setOriginTerminalId] = useState('');
  const [destinationTerminalId, setDestinationTerminalId] = useState('');
  const [travelDate, setTravelDate] = useState('');
  const [terminals, setTerminals] = useState<TerminalListItem[]>([]);
  const [terminalsLoading, setTerminalsLoading] = useState(false);
  const [terminalsError, setTerminalsError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [results, setResults] = useState<TripDetail[]>([]);
  const [tripDetail, setTripDetail] = useState<TripDetail | null>(null);
  const [loadTripError, setLoadTripError] = useState<string | null>(null);
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [t, setT] = useState<TravellerForm>(emptyTraveller);
  const [extraPass, setExtraPass] = useState<ExtraPass[]>([]);
  const [drawerError, setDrawerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [ticketDownload, setTicketDownload] = useState<BookingTicketPdfInput | null>(null);

  const scopeAllCompanies = allowAllCompanies && pageAllCompanies;
  /** Scopes trip search filter, trip load, and booking; empty means “all companies” (Trip Jotter public search). */
  const resolvedTransportEmail = useMemo(() => {
    if (!scopeAllCompanies) {
      return (pageTransportEmail || defaultTransportCompanyEmail).trim() || companyEmail.trim();
    }
    return companyEmail.trim();
  }, [scopeAllCompanies, pageTransportEmail, companyEmail]);

  useEffect(() => {
    if (!open) {
      return;
    }
    if (!scopeAllCompanies) {
      setCompanyEmail((pageTransportEmail || defaultTransportCompanyEmail).trim());
    } else {
      setCompanyEmail('');
    }
  }, [open, scopeAllCompanies, pageTransportEmail]);

  const reset = useCallback(() => {
    setStep('search');
    setOriginInput('');
    setDestinationInput('');
    setOriginTerminalId('');
    setDestinationTerminalId('');
    setTravelDate('');
    setSearchError(null);
    setResults([]);
    setTripDetail(null);
    setLoadTripError(null);
    setSelectedSeats([]);
    setT(emptyTraveller());
    setExtraPass([]);
    setDrawerError(null);
    setSubmitting(false);
    setTicketDownload(null);
  }, []);

  useEffect(() => {
    if (!open) {
      reset();
    }
  }, [open, reset]);

  const closeSuccessAndDrawer = useCallback(() => {
    setTicketDownload(null);
    reset();
    onClose();
  }, [onClose, reset]);

  /** Closes the drawer: if the success download modal is open, dismiss it and reset; otherwise just close. */
  const dismissDrawer = useCallback(() => {
    if (ticketDownload) {
      closeSuccessAndDrawer();
    } else {
      onClose();
    }
  }, [ticketDownload, closeSuccessAndDrawer, onClose]);

  useEffect(() => {
    if (!open) {
      return;
    }
    let cancelled = false;
    setTerminalsLoading(true);
    setTerminalsError(null);
    void fetchAdminTerminals()
      .then((rows) => {
        if (!cancelled) {
          setTerminals([...rows].sort(compareTerminals));
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setTerminalsError(e instanceof Error ? e.message : 'Failed to load terminals');
          setTerminals([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setTerminalsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const companyDisplayForFilter = useMemo(() => {
    const em = resolvedTransportEmail;
    if (!em) {
      return '';
    }
    const o = companyOptions.find((c) => c.email === em);
    return o?.displayName?.trim() ?? '';
  }, [resolvedTransportEmail, companyOptions]);

  const filteredResults = useMemo(() => {
    if (!results.length) {
      return [];
    }
    if (!companyDisplayForFilter) {
      return results;
    }
    const c = companyDisplayForFilter.toLowerCase();
    return results.filter(
      (r) =>
        r.transportCompanyName != null && r.transportCompanyName.toLowerCase().includes(c.split(' ')[0] || c)
    );
  }, [results, companyDisplayForFilter]);

  const runSearch = async () => {
    setSearchError(null);
    setTripDetail(null);
    const originT = originTerminalId ? terminals.find((x) => String(x.id) === originTerminalId) : undefined;
    const destT = destinationTerminalId
      ? terminals.find((x) => String(x.id) === destinationTerminalId)
      : undefined;
    const originQ = originT ? searchTextFromTerminal(originT) : originInput.trim();
    const destQ = destT ? searchTextFromTerminal(destT) : destinationInput.trim();
    if (!originQ || !destQ || !travelDate.trim()) {
      setSearchError('Enter origin, destination, and travel date (pick a terminal or type an area/city).');
      return;
    }
    setSearching(true);
    try {
      const rows = await searchTripsForAdmin({
        origin: originQ,
        destination: destQ,
        date: travelDate.trim()
      });
      setResults(rows);
      setStep('trips');
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  const openSeats = async (trip: TripDetail) => {
    if (!trip.id) {
      return;
    }
    setLoadTripError(null);
    setTripDetail(null);
    setSelectedSeats([]);
    setExtraPass([]);
    setStep('seats');
    try {
      const email = resolvedTransportEmail.trim();
      const d = await fetchTripForBookingDetail({
        tripId: trip.id,
        allCompanies: !email,
        transportCompanyEmail: email
      });
      setTripDetail(d);
    } catch (e) {
      setLoadTripError(e instanceof Error ? e.message : 'Could not load trip');
    }
  };

  const seatModel = useMemo(() => {
    if (!tripDetail?.vehicleSeats?.length) {
      return { seats: [], rowLayout: undefined as number[] | undefined, front: null, total: 0 };
    }
    const cap = tripDetail.vehicleCapacity ?? tripDetail.vehicleSeats.length;
    const layout = getRowLayoutForCapacity(cap);
    const selected = new Set(selectedSeats.map((s) => s.trim().toUpperCase()));
    const booked = new Set(
      tripDetail.vehicleSeats
        .filter((s) => s.status === 'BOOKED' || s.status === 'PENDING')
        .map((s) => s.number.trim().toUpperCase())
    );
    const built = buildSeatsFromVehicleSeats(
      tripDetail.vehicleSeats.map((s) => ({ number: s.number, status: s.status })),
      booked,
      selected,
      new Set()
    );
    return {
      seats: built,
      rowLayout: layout,
      front: built.length > 0 ? built[0] : null,
      total: cap
    };
  }, [tripDetail, selectedSeats]);

  const handleSeat = useCallback(
    (n: string) => {
      const u = n.trim();
      if (!u) {
        return;
      }
      setSelectedSeats((prev) => {
        const up = u.toUpperCase();
        if (prev.some((p) => p.toUpperCase() === up)) {
          return prev.filter((p) => p.toUpperCase() !== up);
        }
        if (prev.length >= 6) {
          return prev;
        }
        return [...prev, u];
      });
    },
    [setSelectedSeats]
  );

  useEffect(() => {
    setExtraPass(buildExtras(Math.max(0, selectedSeats.length - 1)));
  }, [selectedSeats.length]);

  const crossBorder = tripDetail?.tripType === 'CROSS_BORDER';

  const submit = async () => {
    setDrawerError(null);
    if (!tripDetail) {
      setDrawerError('No trip selected.');
      return;
    }
    if (!t.firstName.trim() || !t.lastName.trim() || !t.email.trim() || !t.phoneNumber.trim()) {
      setDrawerError('First name, last name, email, and phone are required.');
      return;
    }
    if (!t.dateOfBirth) {
      setDrawerError('Date of birth is required.');
      return;
    }
    if (!t.street.trim() || !t.city.trim() || !t.state.trim() || !t.country.trim()) {
      setDrawerError('Address fields are required.');
      return;
    }
    if (!t.nextOfKinFirstName.trim() || !t.nextOfKinLastName.trim() || !t.nextOfKinEmail.trim() || !t.nextOfKinPhoneNumber.trim()) {
      setDrawerError('All next of kin fields are required.');
      return;
    }
    for (const p of extraPass) {
      if (!p.firstName.trim() || !p.lastName.trim() || !p.phoneNumber.trim() || !p.email.trim()) {
        setDrawerError('Each additional passenger needs first name, last name, email, and phone.');
        return;
      }
    }
    const tid = tripDetail.id;
    const o = tripDetail.originTerminalId;
    const d = tripDetail.destinationTerminalId;
    if (!tid || o == null || d == null) {
      setDrawerError('Trip is missing terminal ids. Choose another trip.');
      return;
    }
    if (selectedSeats.length === 0) {
      setDrawerError('Select at least one seat.');
      return;
    }
    const em = resolveTransportCompanyEmailForBooking(tripDetail, companyOptions, resolvedTransportEmail);
    const nokName = [t.nextOfKinFirstName, t.nextOfKinLastName].filter(Boolean).join(' ').trim();
    const nokPhone = t.nextOfKinPhoneNumber.trim();
    const extObj = {
      title: t.title,
      dateOfBirth: t.dateOfBirth,
      gender: t.gender,
      address: { street: t.street, city: t.city, state: t.state, country: t.country },
      nextOfKinEmail: t.nextOfKinEmail,
      nextOfKinRelationship: t.relationship
    };
    const sourceName = `profile:${JSON.stringify(extObj)}`;
    const travellers: AdminTravellerDetailPayload[] = selectedSeats.map((seat, i) => {
      if (i === 0) {
        return {
          firstName: t.firstName.trim(),
          lastName: t.lastName.trim(),
          phoneNumber: t.phoneNumber.trim(),
          email: t.email.trim(),
          seatNumber: seat.trim(),
          nextOfKinName: nokName,
          nextOfKinPhone: nokPhone,
          identificationType: crossBorder ? t.identificationType : undefined
        };
      }
      const p = extraPass[i - 1];
      return {
        firstName: p?.firstName?.trim() ?? '',
        lastName: p?.lastName?.trim() ?? '',
        phoneNumber: p?.phoneNumber?.trim() ?? '',
        email: p?.email?.trim() ?? '',
        seatNumber: seat.trim(),
        nextOfKinName: nokName,
        nextOfKinPhone: nokPhone,
        identificationType: crossBorder ? t.identificationType : undefined
      };
    });
    setSubmitting(true);
    try {
      const created = await createAdminBooking({
        sourceChannel: 'TRIPJOTTER',
        sourceAction: 'PADLER_ADMIN_NEW_BOOKING',
        sourceName,
        ...(em ? { transportCompanyEmail: em } : {}),
        tripId: tid,
        departureTerminalId: o,
        destinationTerminalId: d,
        travellerDetails: travellers,
        additionalLuggageAmount: 0,
        paymentMethod: 'CASH',
        seatHoldSessionId: undefined
      });
      const ref =
        created.primaryBookingReference?.trim() ||
        created.bookingReferences?.map((r) => r?.trim()).find(Boolean) ||
        '';
      setTicketDownload(buildTicketPdfInput(tripDetail, t, selectedSeats, ref));
      onBooked();
    } catch (e) {
      setDrawerError(e instanceof Error ? e.message : 'Booking failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) {
    return null;
  }

  return (
    <>
      <div
        className="padler-drawer-backdrop"
        role="presentation"
        onClick={dismissDrawer}
        onKeyDown={(e) => e.key === 'Escape' && dismissDrawer()}
      />
      <div
        className="padler-drawer-panel padler-drawer-panel--open padler-drawer-panel--wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="padler-new-booking-title"
      >
        <div className="padler-drawer-header">
          <span id="padler-new-booking-title">New booking</span>
          <button type="button" className="padler-icon-btn" onClick={dismissDrawer} aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <div className="padler-drawer-body">
          {drawerError ? (
            <div
              role="alert"
              style={{
                padding: 12,
                borderRadius: 8,
                background: '#fef2f2',
                color: '#991b1b',
                marginBottom: 12,
                fontSize: 14
              }}
            >
              {drawerError}
            </div>
          ) : null}

          {step === 'search' ? (
            <>
              <p style={{ fontSize: 13, color: 'var(--padler-ink-muted)', marginTop: 0 }}>
                Search by origin and destination: use the comboboxes to find a terminal (type to filter) or type any
                area or city. Same public trip search as Trip Jotter. Then select a trip, choose seats, and enter
                traveller details (aligned with the customer traveller profile).
              </p>
              {scopeAllCompanies ? (
                <div style={{ marginBottom: 12 }}>
                  <label style={labelStyle}>Transport company (optional)</label>
                  <select
                    value={companyEmail}
                    onChange={(e) => setCompanyEmail(e.target.value)}
                    style={fieldStyle}
                  >
                    <option value="">All companies — search all trips</option>
                    {companyOptions.map((o) => (
                      <option key={o.email} value={o.email}>
                        {o.displayName} — {o.email}
                      </option>
                    ))}
                  </select>
                  <p style={{ fontSize: 12, color: 'var(--padler-ink-muted)', margin: '6px 0 0' }}>
                    Leave as “all companies” to search every operator. Pick a company to narrow the trip list to that
                    operator.
                  </p>
                </div>
              ) : null}
              {terminalsLoading ? (
                <p style={{ fontSize: 13, color: 'var(--padler-ink-muted)' }}>Loading terminals…</p>
              ) : null}
              {terminalsError ? (
                <div
                  role="alert"
                  style={{
                    padding: 10,
                    borderRadius: 8,
                    background: '#fef2f2',
                    color: '#991b1b',
                    fontSize: 13,
                    marginBottom: 8
                  }}
                >
                  {terminalsError}
                </div>
              ) : null}
              <div style={{ display: 'grid', gap: 10 }}>
                <TerminalCombobox
                  label="Origin terminal"
                  terminals={terminals}
                  inputValue={originInput}
                  selectedTerminalId={originTerminalId}
                  onChange={({ inputValue, selectedTerminalId: id }) => {
                    setOriginInput(inputValue);
                    setOriginTerminalId(id);
                  }}
                  disabled={terminalsLoading}
                  placeholder="Type to filter or enter area/city…"
                />
                <TerminalCombobox
                  label="Destination terminal"
                  terminals={terminals}
                  inputValue={destinationInput}
                  selectedTerminalId={destinationTerminalId}
                  onChange={({ inputValue, selectedTerminalId: id }) => {
                    setDestinationInput(inputValue);
                    setDestinationTerminalId(id);
                  }}
                  disabled={terminalsLoading}
                  placeholder="Type to filter or enter area/city…"
                />
                <div>
                  <label style={labelStyle}>Travel date</label>
                  <input
                    type="date"
                    value={travelDate}
                    onChange={(e) => setTravelDate(e.target.value)}
                    style={fieldStyle}
                  />
                </div>
              </div>
              {!terminalsLoading && !terminalsError && terminals.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--padler-ink-muted)' }}>
                  No terminals loaded — you can still type an origin and destination (area or city) above.
                </p>
              ) : null}
              {searchError ? <p style={{ color: '#b91c1c', fontSize: 13 }}>{searchError}</p> : null}
              <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="padler-action padler-action--primary"
                  onClick={() => void runSearch()}
                  disabled={searching || terminalsLoading}
                >
                  {searching ? 'Searching…' : 'Search trips'}
                </button>
              </div>
            </>
          ) : null}

          {step === 'trips' ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h3 style={{ margin: 0, fontSize: 16 }}>Choose a trip</h3>
                <button type="button" className="padler-action" onClick={() => setStep('search')}>
                  Back
                </button>
              </div>
              {companyDisplayForFilter && filteredResults.length < results.length ? (
                <p style={{ fontSize: 12, color: 'var(--padler-ink-muted)' }}>
                  Filtered to trips matching the selected company ({companyDisplayForFilter}).
                </p>
              ) : null}
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, maxHeight: 360, overflow: 'auto' }}>
                {filteredResults.length === 0 ? (
                  <li style={{ color: 'var(--padler-ink-muted)' }}>No trips found. Go back and adjust search.</li>
                ) : (
                  filteredResults.map((r) => (
                    <li
                      key={r.id}
                      style={{ border: '1px solid var(--padler-border)', borderRadius: 8, marginBottom: 8, padding: 12 }}
                    >
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{r.routeOrigin} → {r.routeDestination}</div>
                      <div style={{ fontSize: 12, color: 'var(--padler-ink-muted)' }}>{r.transportCompanyName}</div>
                      <div style={{ fontSize: 12 }}>Departs {r.departureTime ? String(r.departureTime) : '—'}</div>
                      <div style={{ fontSize: 12 }}>From NGN {r.basePrice != null ? r.basePrice.toLocaleString() : '—'}</div>
                      <button
                        type="button"
                        className="padler-action padler-action--primary"
                        style={{ marginTop: 8 }}
                        onClick={() => void openSeats(r)}
                      >
                        Select
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </>
          ) : null}

          {step === 'seats' || step === 'details' ? (
            <>
              {step === 'seats' ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: 16 }}>Select seat(s)</h3>
                    <button
                      type="button"
                      className="padler-action"
                      onClick={() => {
                        setStep('trips');
                        setSelectedSeats([]);
                        setTripDetail(null);
                      }}
                    >
                      Back
                    </button>
                  </div>
                  {loadTripError ? <p style={{ color: '#b91c1c' }}>{loadTripError}</p> : null}
                  {tripDetail && !loadTripError ? (
                    <>
                      <p style={{ fontSize: 12, color: 'var(--padler-ink-muted)' }}>
                        Tap up to 6 available seats. Selected seats are highlighted. Booked and pending seats cannot be
                        chosen.
                      </p>
                      <div
                    style={{
                      border: '1px solid var(--padler-border)',
                      borderRadius: 12,
                      padding: 16,
                      background: '#fff',
                      maxWidth: '100%',
                      overflow: 'auto',
                      margin : '0 110px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'center' }}></div>
                      <TripSeatGrid
                        seats={seatModel.seats}
                        onSeatSelect={handleSeat}
                        frontPassenger={seatModel.front}
                        totalSeats={seatModel.total}
                        rowLayout={seatModel.rowLayout}
                        readOnly={false}
                      />
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
                      <p style={{ fontSize: 13 }}>
                        Selected: {selectedSeats.length ? selectedSeats.join(', ') : '—'}
                      </p>
                      <button
                        type="button"
                        className="padler-action padler-action--primary"
                        disabled={selectedSeats.length === 0}
                        onClick={() => setStep('details')}
                      >
                        Continue
                      </button>
                    </>
                  ) : !loadTripError ? (
                    <p>Loading…</p>
                  ) : null}
                </>
              ) : null}

              {step === 'details' ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: 16 }}>Traveller details</h3>
                    <button type="button" className="padler-action" onClick={() => setStep('seats')}>
                      Back
                    </button>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--padler-ink-muted)' }}>
                    Primary passenger: full profile. Additional passengers: name, email, and phone.
                  </p>
                  <section style={{ marginBottom: 16 }}>
                    <h4 style={{ fontSize: 14, margin: '0 0 8px' }}>Personal</h4>
                    <div style={{ display: 'grid', gap: 8 }}>
                      <div>
                        <label style={labelStyle}>Title</label>
                        <select value={t.title} onChange={(e) => setT((p) => ({ ...p, title: e.target.value }))} style={fieldStyle}>
                          {TITLES.map((x) => (
                            <option key={x} value={x}>
                              {x}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label style={labelStyle}>First name</label>
                        <input
                          value={t.firstName}
                          onChange={(e) => setT((p) => ({ ...p, firstName: e.target.value }))}
                          style={fieldStyle}
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>Last name</label>
                        <input
                          value={t.lastName}
                          onChange={(e) => setT((p) => ({ ...p, lastName: e.target.value }))}
                          style={fieldStyle}
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>Email</label>
                        <input
                          value={t.email}
                          onChange={(e) => setT((p) => ({ ...p, email: e.target.value }))}
                          type="email"
                          style={fieldStyle}
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>Phone</label>
                        <input
                          value={t.phoneNumber}
                          onChange={(e) => setT((p) => ({ ...p, phoneNumber: e.target.value }))}
                          style={fieldStyle}
                          placeholder="e.g. +234 801 234 5678"
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>Date of birth</label>
                        <input
                          type="date"
                          value={t.dateOfBirth}
                          onChange={(e) => setT((p) => ({ ...p, dateOfBirth: e.target.value }))}
                          style={fieldStyle}
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>Gender</label>
                        <select value={t.gender} onChange={(e) => setT((p) => ({ ...p, gender: e.target.value }))} style={fieldStyle}>
                          {GENDERS.map((g) => (
                            <option key={g} value={g}>
                              {g}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </section>
                  <section style={{ marginBottom: 16 }}>
                    <h4 style={{ fontSize: 14, margin: '0 0 8px' }}>Address</h4>
                    <div style={{ display: 'grid', gap: 8 }}>
                      {(
                        [
                          ['street', 'Street', t.street, (v: string) => setT((p) => ({ ...p, street: v }))],
                          ['city', 'City', t.city, (v: string) => setT((p) => ({ ...p, city: v }))],
                          ['state', 'State / region', t.state, (v: string) => setT((p) => ({ ...p, state: v }))],
                          ['country', 'Country', t.country, (v: string) => setT((p) => ({ ...p, country: v }))]
                        ] as const
                      ).map(([k, label, value, on]) => (
                        <div key={k}>
                          <label style={labelStyle}>{label}</label>
                          <input value={value} onChange={(e) => on(e.target.value)} style={fieldStyle} />
                        </div>
                      ))}
                    </div>
                  </section>
                  <section style={{ marginBottom: 16 }}>
                    <h4 style={{ fontSize: 14, margin: '0 0 8px' }}>Next of kin</h4>
                    <div style={{ display: 'grid', gap: 8 }}>
                      <div>
                        <label style={labelStyle}>First name</label>
                        <input
                          value={t.nextOfKinFirstName}
                          onChange={(e) => setT((p) => ({ ...p, nextOfKinFirstName: e.target.value }))}
                          style={fieldStyle}
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>Last name</label>
                        <input
                          value={t.nextOfKinLastName}
                          onChange={(e) => setT((p) => ({ ...p, nextOfKinLastName: e.target.value }))}
                          style={fieldStyle}
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>Email</label>
                        <input
                          type="email"
                          value={t.nextOfKinEmail}
                          onChange={(e) => setT((p) => ({ ...p, nextOfKinEmail: e.target.value }))}
                          style={fieldStyle}
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>Phone</label>
                        <input
                          value={t.nextOfKinPhoneNumber}
                          onChange={(e) => setT((p) => ({ ...p, nextOfKinPhoneNumber: e.target.value }))}
                          style={fieldStyle}
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>Relationship</label>
                        <select
                          value={t.relationship}
                          onChange={(e) => setT((p) => ({ ...p, relationship: e.target.value }))}
                          style={fieldStyle}
                        >
                          {RELATIONSHIPS.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </section>
                  {crossBorder ? (
                    <section style={{ marginBottom: 16 }}>
                      <h4 style={{ fontSize: 14, margin: '0 0 8px' }}>Identification (cross-border)</h4>
                      <select
                        value={t.identificationType}
                        onChange={(e) => setT((p) => ({ ...p, identificationType: e.target.value }))}
                        style={fieldStyle}
                      >
                        {ID_TYPES.map((i) => (
                          <option key={i.value} value={i.value}>
                            {i.label}
                          </option>
                        ))}
                      </select>
                    </section>
                  ) : null}
                  {extraPass.map((p, i) => (
                    <section key={i} style={{ marginBottom: 12, borderTop: '1px solid var(--padler-border)', paddingTop: 8 }}>
                      <h4 style={{ fontSize: 14, margin: '0 0 8px' }}>Passenger {i + 2} (seat {selectedSeats[i + 1]})</h4>
                      <div style={{ display: 'grid', gap: 8 }}>
                        <div>
                          <label style={labelStyle}>First name</label>
                          <input
                            value={p.firstName}
                            onChange={(e) => {
                              const v = e.target.value;
                              setExtraPass((rows) => rows.map((row, j) => (j === i ? { ...row, firstName: v } : row)));
                            }}
                            style={fieldStyle}
                          />
                        </div>
                        <div>
                          <label style={labelStyle}>Last name</label>
                          <input
                            value={p.lastName}
                            onChange={(e) => {
                              const v = e.target.value;
                              setExtraPass((rows) => rows.map((row, j) => (j === i ? { ...row, lastName: v } : row)));
                            }}
                            style={fieldStyle}
                          />
                        </div>
                        <div>
                          <label style={labelStyle}>Email</label>
                          <input
                            value={p.email}
                            onChange={(e) => {
                              const v = e.target.value;
                              setExtraPass((rows) => rows.map((row, j) => (j === i ? { ...row, email: v } : row)));
                            }}
                            style={fieldStyle}
                          />
                        </div>
                        <div>
                          <label style={labelStyle}>Phone</label>
                          <input
                            value={p.phoneNumber}
                            onChange={(e) => {
                              const v = e.target.value;
                              setExtraPass((rows) => rows.map((row, j) => (j === i ? { ...row, phoneNumber: v } : row)));
                            }}
                            style={fieldStyle}
                          />
                        </div>
                      </div>
                    </section>
                  ))}
                  <div style={{ marginTop: 16 }}>
                    <button
                      type="button"
                      className="padler-action padler-action--primary"
                      disabled={submitting}
                      onClick={() => void submit()}
                    >
                      {submitting ? 'Submitting…' : 'Submit booking'}
                    </button>
                  </div>
                </>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
      <BookingDownloadSuccessModal
        open={!!ticketDownload}
        message={
          ticketDownload
            ? `Booking reference: ${ticketDownload.bookingReference}. You can download a PDF ticket for the lead passenger, or use Done to close.`
            : ''
        }
        onClose={closeSuccessAndDrawer}
        onDownload={() => (ticketDownload ? downloadBookingTicketPdf(ticketDownload) : Promise.resolve())}
      />
    </>
  );
}
