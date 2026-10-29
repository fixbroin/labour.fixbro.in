"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import MarketplaceNavHeader from '@/components/marketplace/MarketplaceNavHeader';
import MarketplaceBottomNav from '@/components/marketplace/MarketplaceBottomNav';
import FurnitureFooter from '@/components/marketplace/FurnitureFooter';
import MarketplaceImageCarousel from '@/components/marketplace/MarketplaceImageCarousel';
import CallSafetyModal from '@/components/marketplace/CallSafetyModal';
import FurnitureFilterModal, { type FurnitureFilterState } from '@/components/marketplace/FurnitureFilterModal';
import {
  Armchair,
  PhoneCall,
  MapPin,
  Calendar,
  Sparkles,
  Search,
  SlidersHorizontal,
  Loader2,
  PlusCircle,
  X,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  FURNITURE_CATEGORIES,
  type FurnitureListing,
  type MarketplaceLocation,
} from '@/types/marketplace';
import {
  getFurnitureListingsAction,
  recordFurnitureCallAction,
} from '@/app/actions/furnitureActions';
import { recordMarketplaceCallAction } from '@/app/actions/marketplaceCallActions';
import { useAuth } from '@/hooks/useAuth';
import { useApplicationConfig } from '@/hooks/useApplicationConfig';
import { saveUserMarketplaceLocationAction } from '@/app/actions/marketplaceLocationActions';
import { getFurniturePublicUrl } from '@/lib/marketplaceSlug';
import { useToast } from '@/hooks/use-toast';
import dynamic from 'next/dynamic';

import { useMarketplaceUserLocation } from '@/hooks/useMarketplaceUserLocation';

const MarketplaceMapSelector = dynamic(
  () => import('@/components/marketplace/MarketplaceMapSelector'),
  { ssr: false }
);

export default function FurnitureMarketplacePage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, firestoreUser } = useAuth();
  const { config: appConfig } = useApplicationConfig();

  // Unified Location Hook (Checks DB for logged in, localStorage for guests, syncs guest to DB upon login)
  const {
    location,
    isLoaded: isLocationLoaded,
    hasLocation,
    isLocationModalOpen,
    setIsLocationModalOpen,
    setLocationAndSave,
  } = useMarketplaceUserLocation();

  // Filter state
  const [filters, setFilters] = useState<FurnitureFilterState>({
    condition: 'all',
    category: 'all',
    radiusKm: 20,
    sort: 'distance',
    minPrice: '',
    maxPrice: '',
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  // Listings state
  const [listings, setListings] = useState<FurnitureListing[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Call Safety Modal State
  const [selectedCallListing, setSelectedCallListing] = useState<FurnitureListing | null>(null);
  const [isCallModalOpen, setIsCallModalOpen] = useState(false);

  // Fetch Listings: Only executes once location coordinates are checked
  const loadListings = useCallback(async () => {
    // Wait until location check has resolved
    if (!isLocationLoaded) return;

    // If there are no coordinates, do not load unlocated listings; prompt location modal
    if (!location?.latitude || !location?.longitude) {
      setListings([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const data = await getFurnitureListingsAction({
        lat: location.latitude,
        lng: location.longitude,
        radiusKm: filters.radiusKm > 0 ? filters.radiusKm : undefined,
        condition: filters.condition,
        category: filters.category,
        minPrice: filters.minPrice ? parseFloat(filters.minPrice) : undefined,
        maxPrice: filters.maxPrice ? parseFloat(filters.maxPrice) : undefined,
        search: searchQuery,
        sort: filters.sort,
      });
      setListings(data);
    } catch (err) {
      console.error('Failed to load furniture listings:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isLocationLoaded, location, filters, searchQuery]);

  useEffect(() => {
    loadListings();
  }, [loadListings]);

  const handleLocationChange = (newLoc: MarketplaceLocation) => {
    setLocationAndSave(newLoc);
  };

  // Card click requires login
  const handleCardClick = (item: FurnitureListing, e: React.MouseEvent) => {
    e.preventDefault();
    const publicUrl = getFurniturePublicUrl(item);
    if (!user) {
      router.push(`/auth/login?redirect=${encodeURIComponent(publicUrl)}`);
      return;
    }
    router.push(publicUrl);
  };

  // Call click requires login
  const handleCallClick = (item: FurnitureListing, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const publicUrl = getFurniturePublicUrl(item);
    if (!user) {
      router.push(`/auth/login?redirect=${encodeURIComponent(publicUrl)}`);
      return;
    }
    if (user.uid === item.userId) {
      toast({
        title: "Your Listing",
        description: "You posted this ad, so you cannot call yourself.",
      });
      return;
    }
    setSelectedCallListing(item);
    setIsCallModalOpen(true);
  };

  const handleCallConfirmed = async (callerDetails?: { name: string; phone: string; email: string }) => {
    if (selectedCallListing?.id && user) {
      recordMarketplaceCallAction({
        listingType: 'furniture',
        listingId: selectedCallListing.id,
        listingTitle: selectedCallListing.title,
        sellerUserId: selectedCallListing.userId,
        sellerName: selectedCallListing.userName,
        sellerPhone: selectedCallListing.userPhone,
        callerUserId: user.uid,
        callerName: callerDetails?.name || firestoreUser?.displayName || user.displayName || 'FixBro User',
        callerPhone: callerDetails?.phone || firestoreUser?.mobileNumber || user.phoneNumber || '',
        callerEmail: callerDetails?.email || user.email || '',
      }).catch(console.error);
    }
  };

  const formatPostingDate = (isoStr: string) => {
    if (!isoStr) return 'Recently';
    const d = new Date(isoStr);
    const diffDays = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 30) return `${diffDays} days ago`;
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  // Count active applied filters
  const activeFilterCount =
    (filters.condition !== 'all' ? 1 : 0) +
    (filters.category !== 'all' ? 1 : 0) +
    (filters.radiusKm !== 20 ? 1 : 0) +
    (filters.minPrice || filters.maxPrice ? 1 : 0) +
    (filters.sort !== 'distance' ? 1 : 0);

  return (
    <div className="min-h-screen bg-gray-50/60 dark:bg-background pb-20 md:pb-12">
      <MarketplaceNavHeader
        currentLocation={location}
        onLocationChange={handleLocationChange}
        activeSection="furniture"
      />

      {/* Hero Banner */}
      <section className="bg-gradient-to-r from-amber-500/10 via-primary/5 to-blue-500/10 border-b py-4 px-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="space-y-0.5 text-center md:text-left">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[11px] font-bold">
              <Sparkles className="h-3 w-3" />
              100% Free Peer-to-Peer Furniture Marketplace
            </div>
            <h1 className="text-lg sm:text-2xl font-extrabold text-gray-900 dark:text-white">
              Buy & Sell Used or Brand New Furniture
            </h1>
            <p className="text-xs text-gray-600 dark:text-gray-300">
              Direct phone call connections with zero commission.
            </p>
          </div>

          <div className="shrink-0">
            <Link href="/furniture/post">
              <Button className="bg-primary hover:bg-primary/90 text-white font-bold rounded-xl shadow-sm text-xs h-9 px-3.5 gap-1.5">
                <PlusCircle className="h-4 w-4" />
                Post Free Ad
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 space-y-4">
        {/* Compact Single-Line Search & Filter Bar */}
        <div className="bg-white dark:bg-card p-2 sm:p-2.5 rounded-2xl border shadow-sm flex items-center gap-2">
          <div className="relative flex-1">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search sofa, bed, wooden table, wardrobe, area..."
              className="pl-9 pr-8 h-9 rounded-xl text-xs bg-gray-50/70 dark:bg-muted/40"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Filter Modal Trigger Button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsFilterModalOpen(true)}
            className={`h-9 px-3 rounded-xl gap-1.5 text-xs font-semibold shrink-0 transition-all ${
              activeFilterCount > 0
                ? 'border-primary text-primary bg-primary/10 shadow-sm font-bold'
                : 'bg-gray-50/70 dark:bg-muted/40 text-gray-700 dark:text-gray-300 hover:border-primary/50'
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5 text-primary" />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-primary text-white text-[10px]">
                {activeFilterCount}
              </span>
            )}
          </Button>
        </div>

        {/* Listings Count & Location summary */}
        <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
          <p>
            Showing <strong className="text-gray-900 dark:text-white">{listings.length}</strong> furniture items
            {location?.area ? ` near ${location.area}` : ''}
          </p>
        </div>

        {/* Listings Grid */}
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Finding furniture near you...</p>
          </div>
        ) : !hasLocation ? (
          <div className="bg-white dark:bg-card border rounded-3xl p-10 text-center space-y-4 shadow-sm">
            <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
              <MapPin className="h-8 w-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Select Your Location to See Deals Near You
              </h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                FixBro connects you with verified local furniture sellers. Pick your area to discover items nearby.
              </p>
            </div>
            <div className="pt-2">
              <Button
                onClick={() => setIsLocationModalOpen(true)}
                className="bg-primary text-white rounded-xl text-xs font-bold gap-1.5 px-6 shadow-sm"
              >
                <MapPin className="h-4 w-4" />
                Select Location
              </Button>
            </div>
          </div>
        ) : listings.length === 0 ? (
          <div className="bg-white dark:bg-card border rounded-3xl p-10 text-center space-y-4 shadow-sm">
            <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center mx-auto">
              <Armchair className="h-8 w-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                No Furniture Found Near Your Location
              </h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Try widening your distance filter to "Within 50 km" or "All Across City", or be the first person to post a furniture ad!
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setFilters({
                    condition: 'all',
                    category: 'all',
                    radiusKm: 0,
                    sort: 'distance',
                    minPrice: '',
                    maxPrice: '',
                  });
                  setSearchQuery('');
                }}
                className="rounded-xl text-xs"
              >
                Reset Filters
              </Button>
              <Link href="/furniture/post">
                <Button className="bg-primary text-white rounded-xl text-xs font-bold">
                  Post Free Furniture Ad
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
            {listings.map((item) => {
              const coverPhoto = item.photos && item.photos.length > 0 ? item.photos[0] : null;
              const isBrandNew = item.listingType === 'brand_new';

              return (
                <div
                  key={item.id}
                  className="group bg-white dark:bg-card border rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col"
                >
                  <MarketplaceImageCarousel
                    photos={item.photos || []}
                    alt={item.title}
                    type="furniture"
                    aspectRatio="aspect-[4/3]"
                    onImageClick={() => handleCardClick(item, { preventDefault: () => {} } as any)}
                    badge={
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm backdrop-blur-md ${
                          isBrandNew
                            ? 'bg-green-600/90 text-white'
                            : 'bg-amber-600/90 text-white'
                        }`}
                      >
                        {isBrandNew ? '✨ Brand New' : '🛋️ Pre-Owned'}
                      </span>
                    }
                    topRightBadge={
                      typeof item.distanceKm === 'number' ? (
                        <span className="bg-black/65 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full backdrop-blur-md flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {item.distanceKm} km
                        </span>
                      ) : null
                    }
                  />

                  {/* Details */}
                  <div className="p-4 flex flex-col flex-grow justify-between space-y-3">
                    <div className="space-y-1.5">
                      {/* Price */}
                      <div className="flex items-baseline justify-between">
                        <p className="text-lg sm:text-xl font-extrabold text-primary">
                          ₹{item.price.toLocaleString('en-IN')}
                        </p>
                        {item.isNegotiable && (
                          <span className="text-[10px] text-green-700 dark:text-green-400 font-semibold bg-green-50 dark:bg-green-950/40 px-1.5 py-0.5 rounded">
                            Negotiable
                          </span>
                        )}
                      </div>

                      {/* Title */}
                      <div onClick={(e) => handleCardClick(item, e)} className="cursor-pointer">
                        <h3 className="font-bold text-sm text-gray-900 dark:text-white line-clamp-2 hover:text-primary transition-colors">
                          {item.title}
                        </h3>
                      </div>

                      {/* Area & Date */}
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                        <span className="truncate max-w-[140px] flex items-center gap-1">
                          <MapPin className="h-3 w-3 shrink-0" />
                          {item.area || 'Bangalore'}
                        </span>
                        <span className="shrink-0 flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatPostingDate(item.createdAt)}
                        </span>
                      </div>
                    </div>

                    {/* Direct Call Button with Safety Alert */}
                    <div className="pt-2 border-t">
                      <Button
                        type="button"
                        onClick={(e) => handleCallClick(item, e)}
                        className={`w-full font-bold rounded-xl text-xs h-9 shadow-sm flex items-center justify-center gap-1.5 ${
                          user?.uid === item.userId
                            ? 'bg-gray-100 dark:bg-muted text-gray-500 hover:bg-gray-200'
                            : 'bg-green-600 hover:bg-green-700 text-white'
                        }`}
                      >
                        <PhoneCall className="h-3.5 w-3.5" />
                        {user?.uid === item.userId ? 'Your Listing' : 'Direct Call Seller'}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SEO Dedicated Footer for Furniture Marketplace */}
      <FurnitureFooter />

      <MarketplaceBottomNav activeTab="furniture" />

      {/* Amazon-style Pop-Up Filter Modal */}
      <FurnitureFilterModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        filters={filters}
        onApply={(newFilters) => setFilters(newFilters)}
      />

      {/* Safety Warning Pop-Up Dialog */}
      {selectedCallListing && (
        <CallSafetyModal
          isOpen={isCallModalOpen}
          onClose={() => setIsCallModalOpen(false)}
          sellerName={selectedCallListing.userName}
          sellerPhone={selectedCallListing.userPhone}
          listingTitle={selectedCallListing.title}
          listingType="furniture"
          callerName={firestoreUser?.displayName || user?.displayName || ''}
          callerPhone={firestoreUser?.mobileNumber || user?.phoneNumber || (firestoreUser?.addresses && firestoreUser.addresses[0]?.phone) || ''}
          callerEmail={user?.email || firestoreUser?.email || ''}
          onCallConfirmed={handleCallConfirmed}
        />
      )}

      {/* Standalone Map Selector Modal with 100% Button Visibility */}
      <Dialog open={isLocationModalOpen} onOpenChange={setIsLocationModalOpen}>
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
              We will display furniture listings closest to your chosen area.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 w-full overflow-hidden flex flex-col">
            {appConfig.googleMapsApiKey ? (
              <MarketplaceMapSelector
                apiKey={appConfig.googleMapsApiKey}
                onLocationSelect={handleLocationChange}
                onClose={() => setIsLocationModalOpen(false)}
                initialCenter={
                  location?.latitude && location?.longitude
                    ? { lat: location.latitude, lng: location.longitude }
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
    </div>
  );
}
