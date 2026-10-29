"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Wrench, Armchair, Home } from 'lucide-react';
import { useMarketplaceSettings } from '@/hooks/useMarketplaceSettings';

export default function MarketplaceHeaderTabs() {
  const pathname = usePathname();
  const { settings } = useMarketplaceSettings();

  // If disabled in admin panel, do not render tabs section on the home page
  if (settings.showMarketplaceOnHomeServices === false) {
    return null;
  }

  const isServices = pathname === '/' || pathname.startsWith('/categories') || pathname.startsWith('/category');
  const isFurniture = pathname.startsWith('/furniture');
  const isRentals = pathname.startsWith('/rent-home');

  return (
    <>
      {/* Mobile view: Exactly matches the horizontal full-line 3-column row of marketplace pages */}
      <div className="md:hidden w-full border-b px-2 py-1.5 bg-gray-50/70 dark:bg-muted/30 grid grid-cols-3 gap-1 text-xs font-medium text-center z-30">
        <Link
          href="/"
          className={`flex items-center justify-center gap-1 py-1 px-1 rounded-lg shrink-0 transition-all truncate ${
            isServices
              ? 'bg-primary text-white font-bold shadow-sm'
              : 'text-gray-700 dark:text-gray-300 hover:text-primary'
          }`}
        >
          <Wrench className={`h-3.5 w-3.5 shrink-0 ${isServices ? 'text-white' : 'text-primary'}`} />
          <span className="truncate">Home Services</span>
        </Link>

        <Link
          href="/furniture"
          className={`flex items-center justify-center gap-1 py-1 px-1 rounded-lg shrink-0 transition-all truncate ${
            isFurniture
              ? 'bg-primary text-white font-bold shadow-sm'
              : 'text-gray-700 dark:text-gray-300 hover:text-primary'
          }`}
        >
          <Armchair className={`h-3.5 w-3.5 shrink-0 ${isFurniture ? 'text-white' : 'text-amber-600'}`} />
          <span className="truncate">Buy & Sell</span>
        </Link>

        <Link
          href="/rent-home"
          className={`flex items-center justify-center gap-1 py-1 px-1 rounded-lg shrink-0 transition-all truncate ${
            isRentals
              ? 'bg-primary text-white font-bold shadow-sm'
              : 'text-gray-700 dark:text-gray-300 hover:text-primary'
          }`}
        >
          <Home className={`h-3.5 w-3.5 shrink-0 ${isRentals ? 'text-white' : 'text-blue-600'}`} />
          <span className="truncate">Rent a Home</span>
        </Link>
      </div>

      {/* Desktop view: Centered pill bar under header */}
      <div className="hidden md:flex w-full bg-white/80 dark:bg-card/80 backdrop-blur-md border-b py-2 px-4 z-30 transition-all items-center justify-center">
        <div className="max-w-7xl mx-auto flex items-center justify-center">
          <div className="inline-flex items-center gap-1 sm:gap-1.5 p-1 rounded-xl bg-gray-100 dark:bg-muted/70 text-xs font-semibold shadow-inner">
            <Link
              href="/"
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-lg transition-all ${
                isServices
                  ? 'bg-white dark:bg-card text-primary shadow-sm font-bold'
                  : 'text-gray-600 dark:text-gray-300 hover:text-primary'
              }`}
            >
              <Wrench className="h-3.5 w-3.5 text-primary" />
              <span>Home Services</span>
            </Link>

            <Link
              href="/furniture"
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-lg transition-all ${
                isFurniture
                  ? 'bg-white dark:bg-card text-primary shadow-sm font-bold'
                  : 'text-gray-600 dark:text-gray-300 hover:text-primary'
              }`}
            >
              <Armchair className="h-3.5 w-3.5 text-amber-600" />
              <span>Buy & Sell Furniture</span>
            </Link>

            <Link
              href="/rent-home"
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-lg transition-all ${
                isRentals
                  ? 'bg-white dark:bg-card text-primary shadow-sm font-bold'
                  : 'text-gray-600 dark:text-gray-300 hover:text-primary'
              }`}
            >
              <Home className="h-3.5 w-3.5 text-blue-600" />
              <span>Rent a Home</span>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
