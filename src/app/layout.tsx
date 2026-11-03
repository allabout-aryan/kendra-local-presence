import type { Metadata, Viewport } from 'next';
import './globals.css';
import { KendraProvider } from '@/lib/data/store';
import { ToastProvider } from '@/components/ui/overlay';

export const metadata: Metadata = {
  title: 'Kendra — local presence for multi-location brands',
  description:
    'Kendra keeps every outlet of your brand accurate, reviewed and ranking on Google — bulk edits, an AI-assisted review inbox, per-outlet reports and an audit score that tells you what to fix first.',
  applicationName: 'Kendra',
};

export const viewport: Viewport = {
  themeColor: '#0E0E12',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN">
      <body>
        <KendraProvider>
          <ToastProvider>{children}</ToastProvider>
        </KendraProvider>
      </body>
    </html>
  );
}
