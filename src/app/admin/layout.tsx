import type { Metadata } from 'next';
import type { PropsWithChildren } from 'react';
import AdminClientLayout from './AdminClientLayout';

export const metadata: Metadata = {
  title: {
    default: 'Fixbro Admin',
    template: '%s - Fixbro Admin',
  },
  description: 'Admin Management Panel for Fixbro Services',
  manifest: '/manifest-admin.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Fixbro Admin',
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

export default function AdminLayout({ children }: PropsWithChildren) {
  return <AdminClientLayout>{children}</AdminClientLayout>;
}
