"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Logo from '@/components/shared/Logo';
import {
  MapPin,
  PlusCircle,
  Armchair,
  Home,
  Wrench,
  FileText,
  User,
  ChevronDown,
  X,
  Sparkles,
  LogOut,
  UserCircle,
  Briefcase,
  Bell,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import ThemeToggle from '@/components/shared/ThemeToggle';
import type { MarketplaceLocation } from '@/types/marketplace';
import dynamic from 'next/dynamic';
import { useApplicationConfig } from '@/hooks/useApplicationConfig';
import { useAuth } from '@/hooks/useAuth';
import { useUnreadNotificationsCount } from '@/hooks/useUnreadNotificationsCount';
import { saveUserMarketplaceLocationAction } from '@/app/actions/marketplaceLocationActions';

const MarketplaceMapSelector = dynamic(
  () => import('@/components/marketplace/MarketplaceMapSelector'),
  { ssr: false }
);

interface MarketplaceNavHeaderProps {
  currentLocation?: MarketplaceLocation | null;
  onLocationChange?: (loc: MarketplaceLocation) => void;
  activeSection?: 'furniture' | 'rentals' | 'my-posts';
}

export default function MarketplaceNavHeader({
  currentLocation,
  onLocationChange,
  activeSection = 'furniture',
}: MarketplaceNavHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { config: appConfig } = useApplicationConfig();
  const { user, firestoreUser, logOut } = useAuth();

  const { count: unreadCount } = useUnreadNotificationsCount(user?.uid);

  const [isMapOpen, setIsMapOpen] = useState(false);
  const [isPostChooserOpen, setIsPostChooserOpen] = useState(false);

  const [internalLocation, setInternalLocation] = useState<MarketplaceLocation | null>(() => {
    if (currentLocation) return currentLocation;
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('fixbroMarketplaceLocation') || sessionStorage.getItem('fixbroMarketplaceLocation');
        if (stored) return JSON.parse(stored);
      } catch {}
    }
    return null;
  });

  useEffect(() => {
    if (currentLocation) {
      setInternalLocation(currentLocation);
    } else if (firestoreUser?.marketplaceLocation?.latitude) {
      setInternalLocation(firestoreUser.marketplaceLocation);
    }
  }, [currentLocation, firestoreUser]);

  const activeLoc = currentLocation || internalLocation;

  const handleLocationSelected = async (loc: MarketplaceLocation) => {
    setInternalLocation(loc);
    if (onLocationChange) {
      onLocationChange(loc);
    }
    try {
      localStorage.setItem('fixbroMarketplaceLocation', JSON.stringify(loc));
      sessionStorage.setItem('fixbroMarketplaceLocation', JSON.stringify(loc));
    } catch {}

    if (user?.uid && user.uid !== 'guest') {
      try {
        await saveUserMarketplaceLocationAction(user.uid, loc);
      } catch (e) {
        console.warn('Could not save location to DB:', e);
      }
    }
    setIsMapOpen(false);
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-card/95 backdrop-blur-md border-b shadow-sm transition-all">
        {/* Main Header Bar */}
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2 flex items-center justify-between gap-2">
          {/* Left: Logo & Desktop Switcher Tabs */}
          <div className="flex items-center gap-3 sm:gap-6 shrink-0">
            <div className="shrink-0 flex items-center">
              <Logo />
            </div>

            {/* Desktop Switcher Tabs */}
            <nav className="hidden md:flex items-center gap-1 bg-gray-100 dark:bg-muted/60 p-1 rounded-xl text-xs font-semibold">
              <Link
                href="/"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-gray-600 dark:text-gray-300 hover:text-primary transition-colors"
              >
                <Wrench className="h-3.5 w-3.5" />
                <span>Home Services</span>
              </Link>
              <Link
                href="/furniture"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                  activeSection === 'furniture'
                    ? 'bg-white dark:bg-card text-primary shadow-sm font-bold'
                    : 'text-gray-600 dark:text-gray-300 hover:text-primary'
                }`}
              >
                <Armchair className="h-3.5 w-3.5" />
                <span>Buy & Sell Furniture</span>
              </Link>
              <Link
                href="/rent-home"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                  activeSection === 'rentals'
                    ? 'bg-white dark:bg-card text-primary shadow-sm font-bold'
                    : 'text-gray-600 dark:text-gray-300 hover:text-primary'
                }`}
              >
                <Home className="h-3.5 w-3.5" />
                <span>Rent a Home</span>
              </Link>
            </nav>
          </div>

          {/* Right: Location, Post Ad, Theme button, User Account */}
          <div className="flex items-center gap-1.5 sm:gap-2.5">
            {/* Location Selector Pill */}
            <button
              type="button"
              onClick={() => setIsMapOpen(true)}
              className="flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/80 dark:bg-muted/40 hover:bg-gray-100 dark:hover:bg-muted text-xs font-medium text-gray-800 dark:text-gray-200 transition-all max-w-[105px] sm:max-w-[180px] shrink-0"
              title="Change your browsing location"
            >
              <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="truncate">
                {activeLoc?.area || activeLoc?.city || 'Select Location'}
              </span>
              <ChevronDown className="h-3 w-3 text-gray-400 shrink-0 hidden sm:block" />
            </button>

            {/* My Posts Link (Desktop) */}
            <Link
              href="/marketplace/my-posts"
              className={`hidden lg:flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                activeSection === 'my-posts'
                  ? 'bg-primary/10 text-primary'
                  : 'text-gray-700 dark:text-gray-300 hover:text-primary'
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              <span>My Posts</span>
            </Link>

            {/* Post Ad Button - Visible on desktop, hidden on mobile since mobile has hero + bottom bar */}
            <Button
              type="button"
              onClick={() => {
                if (!user) {
                  router.push('/auth/login?redirect=/furniture/post');
                  return;
                }
                setIsPostChooserOpen(true);
              }}
              className="hidden md:flex bg-primary hover:bg-primary/90 text-white font-bold text-xs px-2.5 sm:px-3.5 py-1.5 h-9 rounded-xl shadow-sm items-center gap-1 shrink-0"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              <span>Post Free Ad</span>
            </Button>

            {/* Notification Bell */}
            <Button
              variant="ghost"
              size="icon"
              aria-label="Notifications"
              onClick={() => {
                if (!user) {
                  router.push('/auth/login?redirect=/notifications');
                  return;
                }
                router.push('/notifications');
              }}
              className="relative rounded-xl bg-gray-50/80 dark:bg-muted/40 hover:bg-gray-100 dark:hover:bg-muted border border-gray-200 dark:border-gray-800 h-9 w-9 p-0 shrink-0"
              title="Notifications"
            >
              <Bell className="h-4 w-4 text-gray-700 dark:text-gray-300" />
              {user && unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[9px] font-bold text-white border-2 border-background">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Button>

            {/* Theme Toggle Button */}
            <div className="shrink-0 scale-90 sm:scale-100">
              <ThemeToggle />
            </div>

            {/* User Account Dropdown */}
            <div className="hidden md:block shrink-0">
              {!user ? (
                <Link
                  href="/auth/login"
                  className="inline-flex items-center justify-center rounded-xl px-2.5 sm:px-3.5 py-1.5 text-xs font-bold bg-muted/60 hover:bg-primary hover:text-white transition-all"
                >
                  Login
                </Link>
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 rounded-full bg-muted/50 hover:bg-primary/10 border border-primary/20 shadow-none p-0"
                    >
                      <Avatar className="h-7 w-7">
                        <AvatarImage
                          src={user.photoURL || undefined}
                          alt={firestoreUser?.displayName || user.displayName || "User"}
                        />
                        <AvatarFallback className="bg-primary/10 text-primary font-bold text-[10px]">
                          {firestoreUser?.displayName?.charAt(0).toUpperCase() ||
                            user.displayName?.charAt(0).toUpperCase() ||
                            "U"}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56 mt-2 rounded-2xl p-2 shadow-2xl border-border/40" align="end">
                    <DropdownMenuLabel className="font-normal p-3">
                      <p className="text-sm font-bold truncate">
                        {firestoreUser?.displayName || user.displayName || "User"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild className="rounded-xl px-3 py-2 cursor-pointer text-xs font-medium">
                      <Link href="/marketplace/my-posts" className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" />
                        <span>My Marketplace Posts</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="rounded-xl px-3 py-2 cursor-pointer text-xs font-medium">
                      <Link href="/my-bookings" className="flex items-center gap-2">
                        <Briefcase className="h-4 w-4 text-primary" />
                        <span>My Bookings</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="rounded-xl px-3 py-2 cursor-pointer text-xs font-medium">
                      <Link href="/profile" className="flex items-center gap-2">
                        <UserCircle className="h-4 w-4 text-primary" />
                        <span>My Profile</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => logOut()}
                      className="rounded-xl px-3 py-2 cursor-pointer text-xs font-medium text-destructive focus:text-destructive focus:bg-destructive/10 flex items-center gap-2"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>Sign Out</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </div>

        {/* Mobile secondary bar for switching section - Fixed 3-column layout without horizontal scroll */}
        <div className="md:hidden border-t px-2 py-1.5 bg-gray-50/70 dark:bg-muted/30 grid grid-cols-3 gap-1 text-xs font-medium text-center">
          <Link
            href="/"
            className="flex items-center justify-center gap-1 py-1 px-1 rounded-lg shrink-0 text-gray-700 dark:text-gray-300 hover:text-primary transition-all truncate"
          >
            <Wrench className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="truncate">Home Services</span>
          </Link>
          <Link
            href="/furniture"
            className={`flex items-center justify-center gap-1 py-1 px-1 rounded-lg shrink-0 transition-all truncate ${
              activeSection === 'furniture'
                ? 'bg-primary text-white font-bold shadow-sm'
                : 'text-gray-700 dark:text-gray-300 hover:text-primary'
            }`}
          >
            <Armchair className={`h-3.5 w-3.5 shrink-0 ${activeSection === 'furniture' ? 'text-white' : 'text-amber-600'}`} />
            <span className="truncate">Buy & Sell</span>
          </Link>
          <Link
            href="/rent-home"
            className={`flex items-center justify-center gap-1 py-1 px-1 rounded-lg shrink-0 transition-all truncate ${
              activeSection === 'rentals'
                ? 'bg-primary text-white font-bold shadow-sm'
                : 'text-gray-700 dark:text-gray-300 hover:text-primary'
            }`}
          >
            <Home className={`h-3.5 w-3.5 shrink-0 ${activeSection === 'rentals' ? 'text-white' : 'text-blue-600'}`} />
            <span className="truncate">Rent a Home</span>
          </Link>
        </div>
      </header>

      {/* Post Category Chooser Modal */}
      <Dialog open={isPostChooserOpen} onOpenChange={setIsPostChooserOpen}>
        <DialogContent className="max-w-md w-[92vw] p-5 sm:p-6 rounded-3xl bg-white dark:bg-card">
          <DialogHeader className="text-center space-y-2">
            <div className="mx-auto p-3 bg-primary/10 rounded-2xl text-primary w-fit">
              <Sparkles className="h-6 w-6" />
            </div>
            <DialogTitle className="text-xl font-bold text-gray-900 dark:text-white">
              What would you like to post?
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Posting on FixBro Marketplace is 100% free with direct phone call contacts.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-3">
            <Link
              href="/furniture/post"
              onClick={() => setIsPostChooserOpen(false)}
              className="group p-4 rounded-2xl border-2 border-gray-100 dark:border-gray-800 hover:border-primary/60 hover:bg-primary/5 transition-all flex flex-col items-center text-center space-y-2"
            >
              <div className="p-3 bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-2xl group-hover:scale-105 transition-transform">
                <Armchair className="h-7 w-7" />
              </div>
              <p className="font-bold text-sm text-gray-900 dark:text-white">
                Sell Furniture
              </p>
              <p className="text-xs text-gray-500">
                Post Brand New or Used beds, sofas, wardrobes, and tables
              </p>
            </Link>

            <Link
              href="/rent-home/post"
              onClick={() => setIsPostChooserOpen(false)}
              className="group p-4 rounded-2xl border-2 border-gray-100 dark:border-gray-800 hover:border-primary/60 hover:bg-primary/5 transition-all flex flex-col items-center text-center space-y-2"
            >
              <div className="p-3 bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-2xl group-hover:scale-105 transition-transform">
                <Home className="h-7 w-7" />
              </div>
              <p className="font-bold text-sm text-gray-900 dark:text-white">
                Post Rental Property
              </p>
              <p className="text-xs text-gray-500">
                List 1RK, 1/2/3 BHK flats, rooms, or houses for rent
              </p>
            </Link>
          </div>
        </DialogContent>
      </Dialog>

      {/* Standalone Map Selector Modal with Perfect Desktop & Mobile Visibility */}
      <Dialog open={isMapOpen} onOpenChange={setIsMapOpen}>
        <DialogContent
          className="max-w-3xl w-[95vw] sm:w-[90vw] max-h-[92vh] h-[85vh] sm:h-[88vh] p-0 flex flex-col overflow-hidden rounded-3xl"
          onPointerDownOutside={(e) => {
            const target = e.target as HTMLElement;
            if (target?.closest('.pac-container')) e.preventDefault();
          }}
        >
          <DialogHeader className="flex-shrink-0 p-3.5 sm:p-4 border-b bg-background">
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              Choose Your Location
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              We will display furniture and rental listings closest to your chosen area.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 w-full overflow-hidden flex flex-col">
            {appConfig.googleMapsApiKey ? (
              <MarketplaceMapSelector
                apiKey={appConfig.googleMapsApiKey}
                onLocationSelect={handleLocationSelected}
                onClose={() => setIsMapOpen(false)}
                initialCenter={
                  currentLocation?.latitude && currentLocation?.longitude
                    ? { lat: currentLocation.latitude, lng: currentLocation.longitude }
                    : null
                }
              />
            ) : (
              <div className="p-6 text-center text-muted-foreground">
                Google Maps API key is not configured.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
