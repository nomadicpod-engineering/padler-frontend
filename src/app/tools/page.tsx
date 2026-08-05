'use client';

import Link from 'next/link';
import { PadlerShell } from '@/app/components/PadlerShell';
import { PageHeader } from '@/components/ui/page';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Banknote,
  Bike,
  Car,
  LayoutDashboard,
  TicketsPlane,
  TriangleAlert,
  UserRound,
  Wallet
} from 'lucide-react';

const hubs = [
  {
    href: '/tools/trip-jotter',
    title: 'Trip Jotter',
    description: 'Companies, journeys, users, terminals, bookings, and unfinished payments.',
    icon: TicketsPlane
  },
  {
    href: '/tools/drift',
    title: 'Npod Rider',
    description: 'Dispatch parties, ride journey, payments, and withdrawals.',
    icon: Bike
  },
  {
    href: '/tools/classycar',
    title: 'Classycar',
    description: 'Dealers, booking confirmation, stuck payments, and withdrawals.',
    icon: Car
  },
  {
    href: '/tools/npod',
    title: 'Npod',
    description: 'Signup → code → bus / car / ride links → rewards.',
    icon: UserRound
  },
  {
    href: '/tools/dashboard',
    title: 'Dashboard',
    description: 'Booking numbers and company overview.',
    icon: LayoutDashboard
  },
  {
    href: '/tools/payment',
    title: 'Payments',
    description: 'Wallet payment list and payment detail.',
    icon: Banknote
  },
  {
    href: '/tools/withdrawals',
    title: 'Failed bank payouts',
    description: 'Bank payouts that failed — retry or cancel across products.',
    icon: TriangleAlert
  },
  {
    href: '/tools/wallet',
    title: 'Wallet',
    description: 'System wallet and account operations.',
    icon: Wallet
  }
];

export default function ToolsPage() {
  return (
    <PadlerShell>
      <PageHeader
        eyebrow="Fix problems"
        title="All tools"
        subtitle="Use these when a case runbook says to fix a booking, payment, or product account."
      />
      <div className="mb-5 rounded-2xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-sm text-blue-900">
        Start from a case when you can. Tools are for follow-the-runbook fixes, not everyday browsing.
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {hubs.map((hub) => {
          const Icon = hub.icon;
          return (
            <Link key={hub.href} href={hub.href} className="group block">
              <Card className="h-full transition duration-200 group-hover:-translate-y-0.5 group-hover:border-blue-200 group-hover:shadow-md motion-reduce:transform-none">
                <CardHeader>
                  <div className="flex items-start gap-3">
                    <div className="grid size-10 place-items-center rounded-2xl bg-slate-100 text-slate-700 transition group-hover:bg-blue-50 group-hover:text-blue-800">
                      <Icon size={18} strokeWidth={1.8} />
                    </div>
                    <div>
                      <CardTitle>{hub.title}</CardTitle>
                      <CardDescription>{hub.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          );
        })}
      </div>
    </PadlerShell>
  );
}
