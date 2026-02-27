import "./globals.css";
import ClientProviders from "./client-providers";
import { Toaster } from "@/components/ui/toaster";
import { CookieConsent } from "@/components/cookie-consent";
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import type { Viewport, Metadata } from 'next';

// Metadata for SEO and social media sharing
export const metadata: Metadata = {
  metadataBase: new URL('https://donna-clean.vercel.app'),
  title: {
    default: 'The Donna - Financial Management',
    template: '%s | The Donna',
  },
  description: 'Manage your business finances with ease. Track entries, analyze cash flow, and make informed financial decisions.',
  keywords: ['financial management', 'small business', 'cash flow', 'accounting', 'bookkeeping'],
  authors: [{ name: 'The Donna Team' }],
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'The Donna',
    title: 'The Donna - Financial Management',
    description: 'Manage your business finances with ease',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'The Donna - Financial Management',
    description: 'Manage your business finances with ease',
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'The Donna',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#8b5cf6" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
      </head>
      <body className="min-h-screen bg-background font-sans">
        <Toaster />
        <ClientProviders>
          {children}
        </ClientProviders>
        <Analytics debug={process.env.NODE_ENV === 'development'} />
        <SpeedInsights />
        <CookieConsent />
        <ServiceWorkerRegister />
        <InstallPrompt />
      </body>
    </html>
  );
}
