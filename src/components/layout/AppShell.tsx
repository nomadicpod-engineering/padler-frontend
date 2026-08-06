'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import * as Collapsible from '@radix-ui/react-collapsible';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bike,
  Briefcase,
  Car,
  CheckSquare,
  ChevronDown,
  ClipboardCheck,
  ClipboardList,
  Home,
  KeyRound,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  TicketsPlane,
  TriangleAlert,
  UserRound,
  UserPlus,
  Users,
  Wrench,
  Banknote,
  ListTodo,
  Terminal
} from 'lucide-react';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { clearAuthSession, getAuthSession, type AuthSession } from '@/lib/auth';
import { canAccessWalletConfig, canInviteTeam, canRequestCommands, canViewApprovals } from '@/lib/types';
import { PageSkeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

type NavItem = {
  href: string;
  label: string;
  icon: typeof Home;
  adminOnly?: boolean;
  seniorPlus?: boolean;
  /** BACK_OFFICE_SUPER_ADMIN or ADMIN only (team invite). */
  inviteOnly?: boolean;
  /** BACK_OFFICE_SUPER_ADMIN only (wallet config). */
  superAdminOnly?: boolean;
};

type NavGroup = {
  id: string;
  label: string;
  items: NavItem[];
  adminOnly?: boolean;
};

const NAV_GROUPS: NavGroup[] = [
  {
    id: 'my-day',
    label: 'My day',
    items: [
      { href: '/today', label: 'Today', icon: Home },
      { href: '/cases/mine', label: 'My cases', icon: Briefcase },
      { href: '/approvals', label: 'Approvals', icon: ShieldCheck, seniorPlus: true }
    ]
  },
  {
    id: 'care',
    label: 'Care',
    items: [
      { href: '/cases', label: 'Cases', icon: ListTodo },
      { href: '/customers', label: 'Customers', icon: Users },
      { href: '/payments', label: 'Payments', icon: Banknote }
    ]
  },
  {
    id: 'actions',
    label: 'Actions',
    items: [{ href: '/actions', label: 'Actions', icon: Terminal, seniorPlus: true }]
  },
  {
    id: 'trust',
    label: 'Trust',
    items: [
      { href: '/verification', label: 'Business verification', icon: ClipboardList },
      { href: '/sign-ins/staff', label: 'Staff sign-ins', icon: KeyRound },
      { href: '/sign-ins/customers', label: 'Customer sign-ins', icon: UserRound }
    ]
  },
  {
    id: 'outages',
    label: 'Outages',
    items: [{ href: '/incidents', label: 'Incidents', icon: AlertTriangle }]
  },
  {
    id: 'tools',
    label: 'Fix problems',
    items: [
      { href: '/tools', label: 'All tools', icon: Wrench },
      { href: '/tools/trip-jotter', label: 'Trip Jotter', icon: TicketsPlane },
      { href: '/tools/drift', label: 'Npod Rider', icon: Bike },
      { href: '/tools/classycar', label: 'Npod-Auto', icon: Car },
      { href: '/tools/npod', label: 'Npod', icon: UserRound },
      { href: '/tools/withdrawals', label: 'Failed bank payouts', icon: TriangleAlert }
    ]
  },
  {
    id: 'platform',
    label: 'Platform',
    adminOnly: true,
    items: [
      { href: '/reports', label: 'Reports', icon: BarChart3 },
      { href: '/activity', label: 'Activity', icon: Activity },
      { href: '/platform/events', label: 'Event health', icon: ClipboardCheck },
      { href: '/platform/acceptance', label: 'Launch checklist', icon: CheckSquare },
      { href: '/platform/reviews', label: 'Reviews', icon: ClipboardList },
      { href: '/settings/wallet-config', label: 'Wallet config', icon: SlidersHorizontal, superAdminOnly: true },
      { href: '/settings/add-padler', label: 'Add Padler', icon: UserPlus, inviteOnly: true },
      { href: '/settings', label: 'Settings', icon: Settings }
    ]
  }
];

function isAdmin(designation?: string | null) {
  return canViewApprovals(designation);
}

function isSeniorPlus(designation?: string | null) {
  return canRequestCommands(designation) || canViewApprovals(designation);
}

function canSeeInvite(designation?: string | null) {
  return canInviteTeam(designation);
}

function canSeeWalletConfig(designation?: string | null) {
  return canAccessWalletConfig(designation);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    'my-day': true,
    care: true,
    tools: true
  });

  useEffect(() => {
    const current = getAuthSession();
    if (!current?.accessToken) {
      router.replace('/auth/login');
      return;
    }
    setSession(current);
    setReady(true);
  }, [router]);

  const groups = useMemo(() => {
    return NAV_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (item.adminOnly && !isAdmin(session?.designation)) return false;
        if (item.inviteOnly && !canSeeInvite(session?.designation)) return false;
        if (item.superAdminOnly && !canSeeWalletConfig(session?.designation)) return false;
        if (item.seniorPlus && !isSeniorPlus(session?.designation)) return false;
        return true;
      })
    })).filter((group) => {
      if (group.adminOnly && !isAdmin(session?.designation)) return false;
      return group.items.length > 0;
    });
  }, [session?.designation]);

  if (!ready) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <PageSkeleton />
      </div>
    );
  }

  const isActive = (href: string) =>
    href === '/today'
      ? pathname === '/today' || pathname === '/home'
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="min-h-screen bg-transparent text-slate-900">
      <a
        href="#padler-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-blue-700 focus:px-3 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>
      <div className="flex min-h-screen">
        <aside
          className={cn(
            'sticky top-0 flex h-screen flex-col border-r border-slate-200 bg-white transition-[width] duration-300 ease-out motion-reduce:transition-none',
            collapsed ? 'w-[76px]' : 'w-[280px]'
          )}
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-4">
            <div className={cn('flex items-center gap-3 overflow-hidden', collapsed && 'justify-center')}>
              <div className="grid size-10 place-items-center rounded-2xl bg-blue-700 text-sm font-bold text-white shadow-sm">
                P
              </div>
              {!collapsed ? (
                <div>
                  <div className="text-sm font-semibold tracking-tight">Padler</div>
                  <div className="text-xs text-slate-500">Care console</div>
                </div>
              ) : null}
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label={collapsed ? 'Expand menu' : 'Collapse menu'}
              onClick={() => setCollapsed((value) => !value)}
            >
              {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            </Button>
          </div>

          <nav className="flex-1 space-y-2 overflow-y-auto px-2 py-3" aria-label="Padler">
            {groups.map((group) => (
              <Collapsible.Root
                key={group.id}
                open={collapsed ? true : openGroups[group.id] ?? false}
                onOpenChange={(open) =>
                  setOpenGroups((current) => ({ ...current, [group.id]: open }))
                }
              >
                {!collapsed ? (
                  <Collapsible.Trigger className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-400 transition hover:bg-slate-50 hover:text-slate-600">
                    <span>{group.label}</span>
                    <ChevronDown
                      size={14}
                      className={cn(
                        'transition-transform duration-200',
                        (openGroups[group.id] ?? false) && 'rotate-180'
                      )}
                    />
                  </Collapsible.Trigger>
                ) : null}
                <Collapsible.Content className="space-y-1 overflow-hidden data-[state=closed]:animate-collapse-up data-[state=open]:animate-collapse-down">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        title={item.label}
                        className={cn(
                          'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
                          active
                            ? 'bg-blue-50 text-blue-800 shadow-sm'
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                          collapsed && 'justify-center px-2'
                        )}
                      >
                        <Icon size={18} strokeWidth={1.8} />
                        {!collapsed ? <span className="truncate">{item.label}</span> : null}
                      </Link>
                    );
                  })}
                </Collapsible.Content>
              </Collapsible.Root>
            ))}
          </nav>

          <div className="border-t border-slate-200 p-2">
            <button
              type="button"
              className={cn(
                'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900',
                collapsed && 'justify-center px-2'
              )}
              onClick={() => {
                clearAuthSession();
                router.replace('/auth/login');
              }}
              title="Sign out"
            >
              <LogOut size={18} strokeWidth={1.8} />
              {!collapsed ? <span>Sign out</span> : null}
            </button>
          </div>
        </aside>

        <main id="padler-main" className="min-w-0 flex-1 outline-none" tabIndex={-1}>
          <div className="mx-auto w-full max-w-[1400px] px-4 py-5 sm:px-6 lg:px-8">{children}</div>
        </main>
      </div>
    </div>
  );
}

/** Compatibility wrapper for existing page imports. */
export function PadlerShell({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
