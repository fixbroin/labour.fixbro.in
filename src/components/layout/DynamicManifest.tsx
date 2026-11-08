"use client";

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

/**
 * DynamicManifest:
 * Supports multiple manifests (Admin, Provider, User) and dynamically syncs
 * both <link rel="manifest"> and iOS Safari <meta name="apple-mobile-web-app-title">
 * when navigating between sections.
 */
const DynamicManifest = () => {
  const pathname = usePathname();

  useEffect(() => {
    // Determine which manifest and app title to use based on the URL path
    let manifestPath = '/manifest.json';
    let appTitle = 'Fixbro';
    
    if (pathname.startsWith('/admin')) {
      manifestPath = '/manifest-admin.json';
      appTitle = 'Fixbro Admin';
    } else if (pathname.startsWith('/provider')) {
      manifestPath = '/manifest-provider.json';
      appTitle = 'Fixbro Provider';
    }

    // 1. Sync Web App Manifest link
    const manifestLink = document.querySelector('link[rel="manifest"]') as HTMLLinkElement;
    if (manifestLink) {
      if (manifestLink.getAttribute('href') !== manifestPath) {
        manifestLink.setAttribute('href', manifestPath);
      }
    } else {
      const link = document.createElement('link');
      link.rel = 'manifest';
      link.href = manifestPath;
      document.head.appendChild(link);
    }
    
    // 2. Sync Apple Web App Title for iOS Safari Home Screen installation
    let appleTitleMeta = document.querySelector('meta[name="apple-mobile-web-app-title"]') as HTMLMetaElement;
    if (appleTitleMeta) {
      appleTitleMeta.setAttribute('content', appTitle);
    } else {
      appleTitleMeta = document.createElement('meta');
      appleTitleMeta.name = 'apple-mobile-web-app-title';
      appleTitleMeta.content = appTitle;
      document.head.appendChild(appleTitleMeta);
    }

    // 3. Ensure apple-mobile-web-app-capable is set
    let appleCapableMeta = document.querySelector('meta[name="apple-mobile-web-app-capable"]') as HTMLMetaElement;
    if (!appleCapableMeta) {
      appleCapableMeta = document.createElement('meta');
      appleCapableMeta.name = 'apple-mobile-web-app-capable';
      appleCapableMeta.content = 'yes';
      document.head.appendChild(appleCapableMeta);
    }

    console.log(`PWA: Manifest switched to ${manifestPath} (${appTitle}) for path ${pathname}`);
  }, [pathname]);

  return null;
};

export default DynamicManifest;
