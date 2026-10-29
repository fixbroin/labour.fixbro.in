'use client';

import React from 'react';
import Link from 'next/link';
import { Armchair, ShieldCheck, Tag, MapPin, Sparkles, ArrowRight, CheckCircle2 } from 'lucide-react';

export default function FurnitureFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full bg-muted/30 text-foreground border-t border-border/40 text-xs sm:text-sm mt-12 pb-20 md:pb-12">
      {/* Top Banner: Marketplace USP */}
      <div className="border-b border-border/40 bg-muted/20 py-6 px-4">
        <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0">
              <Tag className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-bold text-foreground text-sm">100% Free Ad Posting</h4>
              <p className="text-muted-foreground text-xs mt-0.5">Post used or brand new furniture without paying listing fees or commissions.</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-green-500/10 text-green-600 dark:text-green-400 shrink-0">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-bold text-foreground text-sm">Direct Buyer-to-Seller</h4>
              <p className="text-muted-foreground text-xs mt-0.5">Connect directly via phone call. No middlemen or broker cuts involved.</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-bold text-foreground text-sm">Defect Transparency</h4>
              <p className="text-muted-foreground text-xs mt-0.5">Sellers disclose condition, scratches, or wear so buyers know exactly what they get.</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
              <MapPin className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-bold text-foreground text-sm">Nearby Locality Radius</h4>
              <p className="text-muted-foreground text-xs mt-0.5">Discover verified furniture deals within 5 km to 50 km from your current pin.</p>
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
                Fix<span className="text-primary">Bro</span> Furniture
              </span>
            </div>
            <p className="text-muted-foreground text-xs leading-relaxed max-w-md">
              India&apos;s hyper-local marketplace for buying and selling used, refurbished, and brand-new furniture.
              From living room sofa sets and solid teak wardrobes to ergonomic work-from-home study desks, find quality furniture right in your neighborhood.
            </p>

            <div className="pt-2">
              <Link
                href="/furniture/post"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs shadow-md transition-all"
              >
                <Sparkles className="h-4 w-4" />
                Post Free Furniture Ad
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          {/* Popular Categories */}
          <div className="space-y-3">
            <h5 className="font-headline font-bold text-foreground text-xs uppercase tracking-wider">Furniture Categories</h5>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li>
                <Link href="/furniture?category=sofas" className="hover:text-primary transition-colors">
                  Used Sofas & Recliners
                </Link>
              </li>
              <li>
                <Link href="/furniture?category=beds" className="hover:text-primary transition-colors">
                  Beds, Mattresses & Cots
                </Link>
              </li>
              <li>
                <Link href="/furniture?category=wardrobes" className="hover:text-primary transition-colors">
                  Wardrobes & Cupboards
                </Link>
              </li>
              <li>
                <Link href="/furniture?category=dining" className="hover:text-primary transition-colors">
                  Dining Tables & Chairs
                </Link>
              </li>
              <li>
                <Link href="/furniture?category=tables" className="hover:text-primary transition-colors">
                  Study Tables & Office Desks
                </Link>
              </li>
              <li>
                <Link href="/furniture?category=chairs" className="hover:text-primary transition-colors">
                  Ergonomic Office Chairs
                </Link>
              </li>
              <li>
                <Link href="/furniture?category=tv_units" className="hover:text-primary transition-colors">
                  TV Units & Media Consoles
                </Link>
              </li>
            </ul>
          </div>

          {/* Popular Localities */}
          <div className="space-y-3">
            <h5 className="font-headline font-bold text-foreground text-xs uppercase tracking-wider">Bangalore Localities</h5>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li><span className="hover:text-foreground transition-colors cursor-default">Whitefield & ITPL</span></li>
              <li><span className="hover:text-foreground transition-colors cursor-default">Koramangala & HSR Layout</span></li>
              <li><span className="hover:text-foreground transition-colors cursor-default">Indiranagar & Domlur</span></li>
              <li><span className="hover:text-foreground transition-colors cursor-default">Bellandur & Outer Ring Road</span></li>
              <li><span className="hover:text-foreground transition-colors cursor-default">Electronic City Phase 1 & 2</span></li>
              <li><span className="hover:text-foreground transition-colors cursor-default">JP Nagar & BTM Layout</span></li>
              <li><span className="hover:text-foreground transition-colors cursor-default">Hebbal, Thanisandra & Yelahanka</span></li>
            </ul>
          </div>

          {/* Quick Links & Services */}
          <div className="space-y-3">
            <h5 className="font-headline font-bold text-foreground text-xs uppercase tracking-wider">FixBro Ecosystem</h5>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li>
                <Link href="/furniture" className="hover:text-primary transition-colors">
                  All Furniture Listings
                </Link>
              </li>
              <li>
                <Link href="/rent-home" className="hover:text-primary transition-colors">
                  Rent a Home (Zero Brokerage)
                </Link>
              </li>
              <li>
                <Link href="/marketplace/my-posts" className="hover:text-primary transition-colors">
                  Manage My Ads
                </Link>
              </li>
              <li>
                <Link href="/" className="hover:text-primary transition-colors">
                  Home Services & Repairs
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
            About FixBro Buy & Sell Furniture Marketplace
          </h6>
          <p>
            Looking to sell old furniture quickly or buy second-hand home and office furniture at affordable rates in Bangalore?
            FixBro Furniture Marketplace connects verified local owners directly with buyers. Browse pre-owned L-shape sofas, solid Sheesham wood beds, steel almirahs, dining table sets, study desks, and modern ergonomic chairs with zero platform brokerage.
            Every ad includes genuine photos, condition ratings, pickup location coordinates, and warranty information.
          </p>
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200">
            <strong>Buyer Safety Advisory:</strong> FixBro is a free open classifieds community. Always visit the seller&apos;s premises in person to inspect furniture quality, dimensions, and condition before completing transactions. Never send advance booking deposits or UPI tokens online.
          </div>
        </div>

        {/* Copyright */}
        <div className="pt-6 border-t border-border/40 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <p>© {currentYear} FixBro. All rights reserved. Free Furniture Classifieds.</p>
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
