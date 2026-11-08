import type { Metadata } from 'next';
import type { PropsWithChildren } from 'react';
import ProviderClientLayout from './ProviderClientLayout';

export const metadata: Metadata = {
  title: {
    default: 'Fixbro Provider',
    template: '%s - Fixbro Provider',
  },
  description: 'Provider Dashboard for Fixbro Services',
  manifest: '/manifest-provider.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Fixbro Provider',
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any', rel: 'icon' },
      { url: '/pwa-192x192.png', type: 'image/png', sizes: '192x192' },
      { url: '/pwa-512x512.png', type: 'image/png', sizes: '512x512' },
    ],
    apple: '/pwa-192x192.png',
  },
};

export default function ProviderLayout({ children }: PropsWithChildren) {
  return <ProviderClientLayout>{children}</ProviderClientLayout>;
}
