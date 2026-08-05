import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { SessionProviders } from '@/components/auth/SessionProviders';
import { AppToaster } from '@/components/ui/toaster';

export const metadata: Metadata = {
  title: 'Padler Care Console',
  description: 'Customer care console for Nomadicpod services'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased tabular-nums [font-feature-settings:'tnum']">
        <SessionProviders>
          {children}
          <AppToaster />
        </SessionProviders>
      </body>
    </html>
  );
}
