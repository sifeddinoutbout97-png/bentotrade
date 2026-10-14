/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Metadata } from 'next';
import './globals.css';

/**
 * Root SEO & OpenGraph Configuration for BentoTrade AI
 * Quantitative Execution Terminal & Professional Trade Journal
 */
export const metadata: Metadata = {
  title: {
    default: 'BentoTrade AI | Quantitative Execution Terminal & Trading Journal',
    template: '%s | BentoTrade AI',
  },
  description:
    'Institutional-grade trade journaling, real-time quantitative execution telemetry, MFE/MAE excursion analysis, and automated risk architecture for active traders.',
  keywords: [
    'Quantitative trading',
    'Trade journal',
    'MFE MAE excursion analysis',
    'Bento UI',
    'Trading telemetry',
    'Sharpe ratio',
    'Monte Carlo simulation',
    'Execution quality',
  ],
  authors: [{ name: 'BentoTrade Quantitative Systems' }],
  creator: 'BentoTrade AI',
  publisher: 'BentoTrade AI',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL('https://bentotrade.ai'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'BentoTrade AI | Quantitative Execution Terminal',
    description:
      'Institutional-grade trade journaling, real-time quantitative execution telemetry, MFE/MAE analysis, and automated risk architecture.',
    url: 'https://bentotrade.ai',
    siteName: 'BentoTrade AI',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'BentoTrade AI | Quantitative Execution Terminal',
    description:
      'Institutional-grade trade journaling, real-time quantitative execution telemetry, and risk architecture.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#050505] text-zinc-100 antialiased selection:bg-emerald-500/30 selection:text-emerald-200">
        {children}
      </body>
    </html>
  );
}
