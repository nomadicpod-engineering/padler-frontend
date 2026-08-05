'use client';

import Link from 'next/link';
import { FormEvent, useMemo, useState } from 'react';
import { PadlerShell } from '@/app/components/PadlerShell';
import { CaseTable } from '@/components/crm/CaseTable';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable, serialColumn, type DataTableColumn } from '@/components/ui/data-table';
import { FieldLabel, Input } from '@/components/ui/field';
import { FilterBar, PageHeader, StatePanel } from '@/components/ui/page';
import { cn } from '@/lib/utils';
import { crmLookup, crmSearch, isForbiddenError } from '@/lib/api';
import type { CaseSummary, IdentityCrosswalk } from '@/lib/types';

type Mode = 'search' | 'lookup';

export default function CustomersPage() {
  const [mode, setMode] = useState<Mode>('search');
  const [q, setQ] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [customerUserId, setCustomerUserId] = useState('');
  const [bookingRef, setBookingRef] = useState('');
  const [paymentRef, setPaymentRef] = useState('');

  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [identities, setIdentities] = useState<IdentityCrosswalk[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runSearch = async (e: FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    setForbidden(false);
    setSearched(true);
    try {
      const result = await crmSearch(q.trim());
      setCases(result.cases ?? []);
      setIdentities(result.identities ?? []);
    } catch (err) {
      setCases([]);
      setIdentities([]);
      if (isForbiddenError(err)) setForbidden(true);
      else setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const runLookup = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setForbidden(false);
    setSearched(true);
    try {
      const rows = await crmLookup({
        email,
        phone,
        customerUserId,
        bookingRef,
        paymentRef
      });
      setCases(rows);
      setIdentities([]);
    } catch (err) {
      setCases([]);
      setIdentities([]);
      if (isForbiddenError(err)) setForbidden(true);
      else setError(err instanceof Error ? err.message : 'Lookup failed');
    } finally {
      setLoading(false);
    }
  };

  const empty =
    searched && !loading && !error && !forbidden && cases.length === 0 && identities.length === 0;

  const identityColumns = useMemo<DataTableColumn<IdentityCrosswalk>[]>(
    () => [
      serialColumn<IdentityCrosswalk>(),
      {
        header: 'Name',
        accessorKey: 'displayName',
        cell: ({ row }) => row.original.displayName ?? '—'
      },
      {
        header: 'Email',
        accessorKey: 'email',
        cell: ({ row }) => row.original.email ?? '—'
      },
      {
        header: 'Phone',
        accessorKey: 'phone',
        cell: ({ row }) => row.original.phone ?? '—'
      },
      {
        header: 'Customer',
        id: 'userId',
        cell: ({ row }) => {
          const uid = row.original.customerUserId ?? row.original.partyKey;
          return uid ? (
            <Link
              href={`/customers/${encodeURIComponent(uid)}`}
              className="font-medium text-blue-700 hover:underline"
            >
              {uid}
            </Link>
          ) : (
            '—'
          );
        }
      }
    ],
    []
  );

  return (
    <PadlerShell>
      <PageHeader
        eyebrow="Care"
        title="Customers"
        subtitle="Find a person by name, contact details, booking, or payment"
      />

      <div
        className="mb-4 inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm"
        role="tablist"
        aria-label="Customer find modes"
      >
        {(
          [
            { id: 'search', label: 'Quick search' },
            { id: 'lookup', label: 'Exact lookup' }
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={mode === tab.id}
            className={cn(
              'rounded-lg px-3 py-2 text-sm font-semibold transition',
              mode === tab.id
                ? 'bg-blue-50 text-blue-800'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            )}
            onClick={() => setMode(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {mode === 'search' ? (
        <FilterBar onSubmit={runSearch}>
          <FieldLabel className="min-w-[240px] flex-1">
            Search
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Email, phone, name, user id…"
              required
            />
          </FieldLabel>
          <Button type="submit" variant="primary" disabled={loading}>
            Search
          </Button>
        </FilterBar>
      ) : (
        <FilterBar onSubmit={runLookup} className="items-end">
          <FieldLabel className="min-w-[160px]">
            Email
            <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
          </FieldLabel>
          <FieldLabel className="min-w-[140px]">
            Phone
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </FieldLabel>
          <FieldLabel className="min-w-[160px]">
            Customer id
            <Input value={customerUserId} onChange={(e) => setCustomerUserId(e.target.value)} />
          </FieldLabel>
          <FieldLabel className="min-w-[140px]">
            Booking ref
            <Input value={bookingRef} onChange={(e) => setBookingRef(e.target.value)} />
          </FieldLabel>
          <FieldLabel className="min-w-[140px]">
            Payment ref
            <Input value={paymentRef} onChange={(e) => setPaymentRef(e.target.value)} />
          </FieldLabel>
          <Button type="submit" variant="primary" disabled={loading}>
            Lookup
          </Button>
        </FilterBar>
      )}

      {loading ? <StatePanel kind="loading" /> : null}
      {forbidden ? <StatePanel kind="forbidden" /> : null}
      {error ? <StatePanel kind="error" message={error} /> : null}
      {empty ? <StatePanel kind="empty" message="No people or cases matched." /> : null}

      {!loading && !forbidden && !error && identities.length > 0 ? (
        <Card className="mb-5 overflow-hidden p-0">
          <CardHeader className="px-5 pt-5">
            <div>
              <CardTitle>People</CardTitle>
              <CardDescription>Open a profile to see bookings, payments, and cases.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <DataTable columns={identityColumns} data={identities} />
          </CardContent>
        </Card>
      ) : null}

      {!loading && !forbidden && !error && cases.length > 0 ? (
        <Card className="overflow-hidden p-0">
          <CardHeader className="px-5 pt-5">
            <div>
              <CardTitle>{mode === 'lookup' ? 'Matched cases' : 'Related cases'}</CardTitle>
              <CardDescription>Cases connected to this search.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <CaseTable rows={cases} />
            {mode === 'lookup' && cases[0]?.customerUserId ? (
              <p className="border-t border-slate-100 px-5 py-3 text-sm">
                <Link
                  href={`/customers/${encodeURIComponent(cases[0].customerUserId)}`}
                  className="font-medium text-blue-700 hover:underline"
                >
                  Open customer profile for {cases[0].customerUserId}
                </Link>
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {!searched && !loading ? (
        <StatePanel
          kind="empty"
          title="Find a customer"
          message="Search by contact details, then open their profile."
        />
      ) : null}
    </PadlerShell>
  );
}
