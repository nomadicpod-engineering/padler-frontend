'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { PadlerShell } from '@/app/components/PadlerShell';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/field';
import { FilterBar, PageHeader, StatePanel } from '@/components/ui/page';
import {
  fetchNpodHub,
  fetchNpodStuckOps,
  searchNpodTravellers,
  type NpodTravellerSearchResult
} from '@/lib/api/npod-tools';
import { isForbiddenError } from '@/lib/api';

export default function NpodHubPage() {
  const router = useRouter();
  const [hub, setHub] = useState<Record<string, unknown> | null>(null);
  const [stuck, setStuck] = useState<Record<string, unknown> | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NpodTravellerSearchResult[]>([]);
  const [searchedQuery, setSearchedQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setForbidden(false);
    try {
      const [h, s] = await Promise.all([
        fetchNpodHub(),
        fetchNpodStuckOps().catch(() => null)
      ]);
      setHub(h);
      setStuck(s);
    } catch (e) {
      if (isForbiddenError(e)) setForbidden(true);
      else setError(e instanceof Error ? e.message : 'Unable to load NPod hub');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onSearch = async (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setError(null);
    setSearchedQuery('');
    try {
      const matches = await searchNpodTravellers(q);
      setResults(matches);
      setSearchedQuery(q);
      if (matches.length === 1) {
        router.push(`/tools/npod/travellers/${encodeURIComponent(matches[0].userId)}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to search travellers');
    } finally {
      setSearching(false);
    }
  };

  return (
    <PadlerShell>
      <PageHeader
        eyebrow="Fix problems"
        title="Npod"
        subtitle="Traveller journey: signup → code → bus / car / ride links → rewards."
        actions={
          <Button type="button" onClick={() => void load()} disabled={loading}>
            {loading ? 'Loading…' : 'Refresh'}
          </Button>
        }
      />

      <p className="mb-4 text-sm text-slate-500">
        <Link href="/tools" className="font-semibold text-blue-700 hover:underline">
          ← Tools
        </Link>
      </p>

      <FilterBar onSubmit={onSearch}>
        <label className="min-w-[260px] flex-1 text-sm font-medium text-slate-700">
          Search travellers
          <Input
            type="search"
            placeholder="User ID, email, or traveller code"
            aria-label="Search travellers"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setResults([]);
              setSearchedQuery('');
            }}
            className="mt-1"
          />
        </label>
        <Button type="submit" variant="primary" disabled={searching}>
          {searching ? 'Searching…' : 'Search'}
        </Button>
      </FilterBar>

      {results.length > 1 ? (
        <section className="mb-4">
          <h2 className="mb-3 text-base font-semibold text-slate-950">Matching travellers</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {results.map((result) => (
              <Link
                key={result.userId}
                href={`/tools/npod/travellers/${encodeURIComponent(result.userId)}`}
                className="group block"
              >
                <Card className="h-full transition duration-200 group-hover:-translate-y-0.5 group-hover:border-blue-200 group-hover:shadow-md motion-reduce:transform-none">
                  <CardHeader>
                    <CardTitle className="truncate">
                      {result.displayName || result.email || result.userId}
                    </CardTitle>
                    <CardDescription className="truncate">
                      {[result.email, result.travellerCode, result.userId].filter(Boolean).join(' · ')}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {!searching && searchedQuery && results.length === 0 && !error ? (
        <StatePanel kind="empty" message="No traveller matched that user ID, email, or traveller code." />
      ) : null}

      {forbidden ? <StatePanel kind="forbidden" /> : null}
      {loading ? <StatePanel kind="loading" skeleton="cards" /> : null}
      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {error}
        </div>
      ) : null}

      {!loading && !forbidden ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Link href="/tools/npod/stuck" className="group block">
            <Card className="h-full transition duration-200 group-hover:-translate-y-0.5 group-hover:border-blue-200 group-hover:shadow-md motion-reduce:transform-none">
              <CardHeader>
                <CardTitle>Stuck ops</CardTitle>
                <CardDescription>
                  {stuck ? 'Summary loaded' : 'Unavailable'} · deep-link to product heals
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
          <Link href="/tools/trip-jotter" className="group block">
            <Card className="h-full transition duration-200 group-hover:-translate-y-0.5 group-hover:border-blue-200 group-hover:shadow-md motion-reduce:transform-none">
              <CardHeader>
                <CardTitle>Trip Jotter</CardTitle>
                <CardDescription>Bookings & stuck checkouts</CardDescription>
              </CardHeader>
            </Card>
          </Link>
          <Link href="/tools/classycar" className="group block">
            <Card className="h-full transition duration-200 group-hover:-translate-y-0.5 group-hover:border-blue-200 group-hover:shadow-md motion-reduce:transform-none">
              <CardHeader>
                <CardTitle>Npod-Auto</CardTitle>
                <CardDescription>Rental / sale</CardDescription>
              </CardHeader>
            </Card>
          </Link>
          <Link href="/tools/drift" className="group block">
            <Card className="h-full transition duration-200 group-hover:-translate-y-0.5 group-hover:border-blue-200 group-hover:shadow-md motion-reduce:transform-none">
              <CardHeader>
                <CardTitle>Drift</CardTitle>
                <CardDescription>Dispatch</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        </div>
      ) : null}

      {hub?.note ? <p className="mt-4 text-sm text-slate-500">{String(hub.note)}</p> : null}
    </PadlerShell>
  );
}
