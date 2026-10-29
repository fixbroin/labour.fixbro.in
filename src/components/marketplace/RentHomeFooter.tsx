'use client';

import React from 'react';
import Link from 'next/link';
import { Home, Key, ShieldCheck, MapPin, Sparkles, ArrowRight, Building, CheckCircle2 } from 'lucide-react';

export default function RentHomeFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full bg-muted/30 text-foreground border-t border-border/40 text-xs sm:text-sm mt-12 pb-20 md:pb-12">
      {/* Top Banner: Marketplace USP */}
      <div className="border-b border-border/40 bg-muted/20 py-6 px-4">
        <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0">
              <Key className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-bold text-foreground text-sm">Zero Brokerage Rentals</h4>
              <p className="text-muted-foreground text-xs mt-0.5">Contact property owners directly. Pay zero brokerage fees on 1BHK, 2BHK, 3BHK flats.</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-green-500/10 text-green-600 dark:text-green-400 shrink-0">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-bold text-foreground text-sm">Direct Owner Listings</h4>
              <p className="text-muted-foreground text-xs mt-0.5">All rental properties posted by verified home owners and landlords.</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
              <Building className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-bold text-foreground text-sm">Transparent Amenities</h4>
              <p className="text-muted-foreground text-xs mt-0.5">Filter by lift, covered car parking, power backup, gas pipeline, and security.</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
              <MapPin className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-bold text-foreground text-sm">Near Tech Parks & Metros</h4>
              <p className="text-muted-foreground text-xs mt-0.5">Search rental houses by exact distance from your office or desired metro station.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Links & SEO Content */}
      <div className="max-w-7xl mx-auto px-4 py-10 sm:py-14 space-y-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
          {/* Brand info */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-black text-lg shadow-sm">
                F
              </div>
              <span className="text-xl font-black text-foreground tracking-tight">
                Fix<span className="text-primary">Bro</span> Rentals
              </span>
            </div>
            <p className="text-muted-foreground text-xs leading-relaxed max-w-md">
              Find your ideal home with zero brokerage. FixBro Rentals connects tenants directly with verified homeowners across Bangalore and major tech corridors.
              Browse studio rooms, 1RK, 1BHK, 2BHK, 3BHK flats, and gated community villas with complete rental transparency.
            </p>

            <div className="pt-2">
              <Link
                href="/rent-home/post"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs shadow-md transition-all"
              >
                <Sparkles className="h-4 w-4" />
                Post Free Rental Property
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          {/* Property Types */}
          <div className="space-y-3">
            <h5 className="font-headline font-bold text-foreground text-xs uppercase tracking-wider">Rental Types</h5>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li>
                <Link href="/rent-home?propertyType=1bhk" className="hover:text-primary transition-colors">
                  1 BHK Flats for Rent
                </Link>
              </li>
              <li>
                <Link href="/rent-home?propertyType=2bhk" className="hover:text-primary transition-colors">
                  2 BHK Flats & Apartments
                </Link>
              </li>
              <li>
                <Link href="/rent-home?propertyType=3bhk" className="hover:text-primary transition-colors">
                  3 BHK Family Homes
                </Link>
              </li>
              <li>
                <Link href="/rent-home?propertyType=1rk" className="hover:text-primary transition-colors">
                  1 RK & Studio Apartments
                </Link>
              </li>
              <li>
                <Link href="/rent-home?propertyType=villa" className="hover:text-primary transition-colors">
                  Independent Houses & Villas
                </Link>
              </li>
              <li>
                <Link href="/rent-home?propertyType=commercial" className="hover:text-primary transition-colors">
                  Commercial & Office Spaces
                </Link>
              </li>
            </ul>
          </div>

          {/* Top Tech Hub Localities */}
          <div className="space-y-3">
            <h5 className="font-headline font-bold text-foreground text-xs uppercase tracking-wider">Prime Tech Hubs</h5>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li><span className="hover:text-foreground transition-colors cursor-default">Whitefield & ITPL</span></li>
              <li><span className="hover:text-foreground transition-colors cursor-default">Bellandur & Outer Ring Road (ORR)</span></li>
              <li><span className="hover:text-foreground transition-colors cursor-default">Manyata Tech Park & Hebbal</span></li>
              <li><span className="hover:text-foreground transition-colors cursor-default">HSR Layout & Koramangala</span></li>
              <li><span className="hover:text-foreground transition-colors cursor-default">Electronic City Phase 1 & 2</span></li>
              <li><span className="hover:text-foreground transition-colors cursor-default">Sarjapur Road & Haralur</span></li>
              <li><span className="hover:text-foreground transition-colors cursor-default">Thanisandra & Bagalur</span></li>
            </ul>
          </div>

          {/* Quick Links & Services */}
          <div className="space-y-3">
            <h5 className="font-headline font-bold text-foreground text-xs uppercase tracking-wider">FixBro Ecosystem</h5>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li>
                <Link href="/rent-home" className="hover:text-primary transition-colors">
                  All Rental Properties
                </Link>
              </li>
              <li>
                <Link href="/furniture" className="hover:text-primary transition-colors">
                  Buy & Sell Furniture
                </Link>
              </li>
              <li>
                <Link href="/marketplace/my-posts" className="hover:text-primary transition-colors">
                  Manage My Rental Ads
                </Link>
              </li>
              <li>
                <Link href="/" className="hover:text-primary transition-colors">
                  Home Deep Cleaning & Repairs
                </Link>
              </li>
              <li>
                <Link href="/terms-and-conditions" className="hover:text-primary transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/privacy-policy" className="hover:text-primary transition-colors">
                  Privacy Policy
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* SEO Editorial Keyword Description */}
        <div className="pt-6 border-t border-border/40 text-[11px] sm:text-xs text-muted-foreground space-y-2 leading-relaxed">
          <h6 className="font-headline font-bold text-foreground text-xs uppercase tracking-wider">
            Zero Brokerage House Rent Portal in Bangalore
          </h6>
          <p>
            Looking for a flat for rent without paying heavy brokerage? FixBro Rentals helps families, bachelors, and working professionals connect directly with real landlords and homeowners.
            Explore verified 1BHK, 2BHK, 3BHK rental apartments with clear details on monthly rent, security deposit, maintenance charges, furnishing status (unfurnished, semi-furnished, fully-furnished), water supply, and parking facilities.
          </p>
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200">
            <strong>Tenant Safety Notice:</strong> FixBro provides a direct classifieds connection between landlords and tenants. Always visit the rental flat in person, meet the owner, and verify property ownership before transferring security deposits or token amounts. Never send advance money to unknown bank accounts or QR codes.
          </div>
        </div>

        {/* Copyright */}
        <div className="pt-6 border-t border-border/40 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <p>© {currentYear} FixBro. All rights reserved. Zero Brokerage Rental Portal.</p>
          <div className="flex items-center gap-4">
            <Link href="/terms-and-conditions" className="hover:text-foreground transition-colors">Terms</Link>
            <span className="text-muted-foreground/50">•</span>
            <Link href="/privacy-policy" className="hover:text-foreground transition-colors">Privacy</Link>
            <span className="text-muted-foreground/50">•</span>
            <Link href="/" className="hover:text-foreground transition-colors">FixBro Services</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
