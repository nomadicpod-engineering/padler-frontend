'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Banknote,
  LayoutDashboard,
  TicketsPlane,
  Wallet,
  Users,
  ScrollText,
  LogOut,
  Settings
} from 'lucide-react';
import { ReactNode, useEffect, useState } from 'react';
import { clearAuthSession, getAuthSession } from '@/lib/auth';

const navLinks = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/bookings', label: 'Bookings', icon: TicketsPlane },
  { href: '/payment', label: 'Payments', icon: Banknote },
  { href: '/wallet', label: 'Wallet', icon: Wallet },
  { href: '/customers', label: 'Customers', icon: Users },
  { href: '/audit-log', label: 'Audit Log', icon: ScrollText }
];

export function PadlerShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const session = getAuthSession();
    if (!session?.accessToken) {
      router.replace('/auth/login');
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready) {
    return <div style={{ padding: 24 }}>Loading...</div>;
  }

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === href : pathname.startsWith(href);

  const handleLogout = () => {
    clearAuthSession();
    router.replace('/auth/login');
  };

  return (
    <div className="padler-layout">
      <aside
        className={`padler-sidebar ${expanded ? 'is-expanded' : ''}`}
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
      >
        <div className="padler-sidebar-logo" aria-label="Padler">
          P
        </div>
        <nav className="padler-sidebar-nav">
          {navLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`padler-nav-item ${isActive(link.href) ? 'is-active' : ''}`}
                title={link.label}
              >
                <Icon size={20} strokeWidth={1.75} />
                <span className="padler-nav-label">{link.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="padler-sidebar-footer">
          <Link href="/settings" className="padler-nav-item" title="Settings">
            <Settings size={20} strokeWidth={1.75} />
            <span className="padler-nav-label">Settings</span>
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="padler-nav-item"
            title="Logout"
          >
            <LogOut size={20} strokeWidth={1.75} />
            <span className="padler-nav-label">Logout</span>
          </button>
        </div>
      </aside>
      <main className="padler-main">{children}</main>
    </div>
  );
}
