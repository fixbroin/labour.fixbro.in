"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import {
  Armchair,
  Home,
  Plus,
  FileText,
  Wrench,
  Sparkles,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface MarketplaceBottomNavProps {
  activeTab?: 'furniture' | 'rentals' | 'my-posts' | 'services';
}

export default function MarketplaceBottomNav({
  activeTab,
}: MarketplaceBottomNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const [isPostChooserOpen, setIsPostChooserOpen] = useState(false);

  const currentTab =
    activeTab ||
    (pathname.startsWith('/furniture')
      ? 'furniture'
      : pathname.startsWith('/rent-home')
      ? 'rentals'
      : pathname.startsWith('/marketplace/my-posts')
      ? 'my-posts'
      : 'furniture');

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-card/95 backdrop-blur-md border-t border-gray-200 dark:border-gray-800 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] md:hidden">
        <div className="max-w-md mx-auto px-3 py-1.5 flex items-center justify-between relative">
          {/* Furniture */}
          <Link
            href="/furniture"
            className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
              currentTab === 'furniture'
                ? 'text-primary font-bold'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900'
            }`}
          >
            <Armchair className="h-5 w-5 mb-0.5" />
            <span className="text-[10px]">Furniture</span>
          </Link>

          {/* Rent Home */}
          <Link
            href="/rent-home"
            className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
              currentTab === 'rentals'
                ? 'text-primary font-bold'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900'
            }`}
          >
            <Home className="h-5 w-5 mb-0.5" />
            <span className="text-[10px]">Rent Home</span>
          </Link>

          {/* Central Elevated Post (+) Button */}
          <div className="flex flex-col items-center justify-center flex-1 -mt-5">
            <button
              type="button"
              onClick={() => {
                if (!user) {
                  router.push('/auth/login?redirect=/furniture/post');
                  return;
                }
                setIsPostChooserOpen(true);
              }}
              className="w-12 h-12 rounded-full bg-gradient-to-tr from-primary to-blue-600 text-white shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center border-4 border-white dark:border-card focus:outline-none"
              aria-label="Post Free Ad"
            >
              <Plus className="h-6 w-6 stroke-[3]" />
            </button>
            <span className="text-[10px] font-bold text-primary mt-0.5">Post (+)</span>
          </div>

          {/* My Posts */}
          <button
            type="button"
            onClick={() => {
              if (!user) {
                router.push('/auth/login?redirect=/marketplace/my-posts');
                return;
              }
              router.push('/marketplace/my-posts');
            }}
            className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
              currentTab === 'my-posts'
                ? 'text-primary font-bold'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900'
            }`}
          >
            <FileText className="h-5 w-5 mb-0.5" />
            <span className="text-[10px]">My Posts</span>
          </button>

          {/* Home Services */}
          <Link
            href="/"
            className="flex flex-col items-center justify-center flex-1 py-1 transition-colors text-gray-500 dark:text-gray-400 hover:text-gray-900"
          >
            <Wrench className="h-5 w-5 mb-0.5" />
            <span className="text-[10px]">Services</span>
          </Link>
        </div>
      </div>

      {/* Post Category Chooser Modal for Mobile */}
      <Dialog open={isPostChooserOpen} onOpenChange={setIsPostChooserOpen}>
        <DialogContent className="max-w-sm w-[92vw] p-5 rounded-3xl bg-white dark:bg-card">
          <DialogHeader className="text-center space-y-1.5">
            <div className="mx-auto p-2.5 bg-primary/10 rounded-2xl text-primary w-fit">
              <Sparkles className="h-5 w-5" />
            </div>
            <DialogTitle className="text-lg font-bold text-gray-900 dark:text-white">
              What do you want to post?
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              FixBro Marketplace is 100% free with direct phone connections.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-2.5 pt-2">
            <Link
              href="/furniture/post"
              onClick={() => setIsPostChooserOpen(false)}
              className="p-3.5 rounded-2xl border-2 border-gray-100 dark:border-gray-800 hover:border-primary/50 hover:bg-primary/5 flex items-center gap-3.5 transition-all"
            >
              <div className="p-2.5 bg-amber-100 dark:bg-amber-950/60 text-amber-600 rounded-xl shrink-0">
                <Armchair className="h-6 w-6" />
              </div>
              <div className="text-left">
                <p className="font-bold text-sm text-gray-900 dark:text-white">
                  Sell Furniture
                </p>
                <p className="text-[11px] text-gray-500">
                  Used or brand new sofas, beds, tables & more
                </p>
              </div>
            </Link>

            <Link
              href="/rent-home/post"
              onClick={() => setIsPostChooserOpen(false)}
              className="p-3.5 rounded-2xl border-2 border-gray-100 dark:border-gray-800 hover:border-primary/50 hover:bg-primary/5 flex items-center gap-3.5 transition-all"
            >
              <div className="p-2.5 bg-blue-100 dark:bg-blue-950/60 text-blue-600 rounded-xl shrink-0">
                <Home className="h-6 w-6" />
              </div>
              <div className="text-left">
                <p className="font-bold text-sm text-gray-900 dark:text-white">
                  Post Rental Property
                </p>
                <p className="text-[11px] text-gray-500">
                  Flats, 1RK, 1/2/3 BHK, rooms, or houses for rent
                </p>
              </div>
            </Link>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
