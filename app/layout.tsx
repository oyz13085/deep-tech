import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PalmScan — Plantation Disease Monitor',
  description: 'AI-powered palm oil plantation disease monitoring dashboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
