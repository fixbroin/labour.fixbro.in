"use client";

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import MarketplaceNavHeader from '@/components/marketplace/MarketplaceNavHeader';
import MarketplaceBottomNav from '@/components/marketplace/MarketplaceBottomNav';
import RentHomeFooter from '@/components/marketplace/RentHomeFooter';
import MarketplaceImageCarousel from '@/components/marketplace/MarketplaceImageCarousel';
import CallSafetyModal from '@/components/marketplace/CallSafetyModal';
import {
  Home,
  PhoneCall,
  MapPin,
  Calendar,
  ShieldAlert,
  Share2,
  ChevronLeft,
  Loader2,
  CheckCircle,
  AlertTriangle,
  BedDouble,
  Bath,
  Building,
  Users,
  Flame,
  Check,
  Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import {
  RENTAL_AMENITIES,
  BILLS_INCLUDED_OPTIONS,
  type RentalListing,
  type MarketplaceLocation,
} from '@/types/marketplace';
import {
  getRentalListingByIdAction,
  recordRentalCallAction,
  incrementRentalViewCountAction,
} from '@/app/actions/rentalActions';
import { recordMarketplaceCallAction } from '@/app/actions/marketplaceCallActions';
import { extractMarketplaceId } from '@/lib/marketplaceSlug';

export default function RentalDetailsPage() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();
  const { user, firestoreUser } = useAuth();
  const { toast } = useToast();

  const [listing, setListing] = useState<RentalListing | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [isCallModalOpen, setIsCallModalOpen] = useState(false);
  const [viewerLocation, setViewerLocation] = useState<MarketplaceLocation | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('fixbroMarketplaceLocation') || sessionStorage.getItem('fixbroMarketplaceLocation');
        if (cached) return JSON.parse(cached);
      } catch {}
    }
    return null;
  });
  const hasTrackedView = useRef(false);

  useEffect(() => {
    if (firestoreUser?.marketplaceLocation?.latitude) {
      setViewerLocation(firestoreUser.marketplaceLocation);
    }
  }, [firestoreUser]);

  useEffect(() => {
    async function loadItem() {
      if (!id) return;
      if (!listing) setIsLoading(true);
      try {
        const item = await getRentalListingByIdAction(
          id,
          viewerLocation?.latitude,
          viewerLocation?.longitude
        );
        setListing(item);
      } catch (err) {
        console.error("Error loading rental:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadItem();
  }, [id, viewerLocation]);

  // Track unique view (once per session, excluding owner themselves)
  useEffect(() => {
    if (!listing?.id || hasTrackedView.current) return;

    // Do not count owner's own views
    if (user?.uid && listing.userId && user.uid === listing.userId) {
      return;
    }

    // Check sessionStorage deduplication: 1 view per session
    const storageKey = `fixbro_viewed_rental_${listing.id}`;
    if (typeof window !== 'undefined') {
      try {
        if (sessionStorage.getItem(storageKey)) {
          return;
        }
        sessionStorage.setItem(storageKey, 'true');
      } catch {}
    }

    hasTrackedView.current = true;
    incrementRentalViewCountAction(listing.id).catch(console.error);
  }, [listing?.id, listing?.userId, user?.uid]);

  const handleShare = async () => {
    if (typeof window === 'undefined') return;
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: listing?.title || 'Rental Property on FixBro',
          text: `Check out this rental property for ₹${listing?.monthlyRent}/month on FixBro!`,
          url,
        });
      } catch {}
    } else {
      navigator.clipboard.writeText(url);
      toast({
        title: "Link Copied! 📋",
        description: "Rental link copied to clipboard.",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50/50 dark:bg-background">
        <MarketplaceNavHeader activeSection="rentals" />
        <div className="py-24 flex flex-col items-center justify-center space-y-3">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading rental details...</p>
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="min-h-screen bg-gray-50/50 dark:bg-background">
        <MarketplaceNavHeader activeSection="rentals" />
        <div className="max-w-md mx-auto px-4 py-20 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
            <AlertTriangle className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-bold">Property Not Found or Expired</h2>
          <p className="text-xs text-muted-foreground">
            This ad may have expired or been rented out by the owner.
          </p>
          <Link href="/rent-home">
            <Button className="rounded-xl">Browse Other Rentals</Button>
          </Link>
        </div>
      </div>
    );
  }

  const photos = listing.photos && listing.photos.length > 0 ? listing.photos : [];

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-background pb-20 md:pb-12">
      <MarketplaceNavHeader activeSection="rentals" />

      <main className="max-w-6xl mx-auto px-4 py-5 space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href="/rent-home"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:text-primary transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Rental Listings
          </Link>

          <Button
            variant="outline"
            size="sm"
            onClick={handleShare}
            className="rounded-xl text-xs flex items-center gap-1.5"
          >
            <Share2 className="h-3.5 w-3.5" />
            Share Property
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Photos & Details (7 cols) */}
          <div className="lg:col-span-7 space-y-5">
            {/* Main Photo Carousel */}
            <MarketplaceImageCarousel
              photos={photos}
              alt={listing.title}
              type="rental"
              aspectRatio="aspect-[16/10]"
              className="rounded-3xl border shadow-sm"
              initialIndex={selectedPhotoIndex}
              onIndexChange={setSelectedPhotoIndex}
              clickOpensFullscreen={true}
              badge={
                <span className="text-xs font-bold px-3 py-1 rounded-full shadow-md backdrop-blur-md bg-blue-600 text-white uppercase tracking-wider">
                  {listing.propertyType?.replace('_', ' ')}
                </span>
              }
              topRightBadge={
                typeof listing.distanceKm === 'number' ? (
                  <span className="bg-black/70 text-white text-xs font-semibold px-2.5 py-1 rounded-full backdrop-blur-md flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {listing.distanceKm} km away
                  </span>
                ) : null
              }
            />

            {/* Thumbnails */}
            {photos.length > 1 && (
              <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
                {photos.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedPhotoIndex(idx)}
                    className={`relative w-24 h-16 rounded-xl overflow-hidden border-2 shrink-0 transition-all ${
                      selectedPhotoIndex === idx
                        ? 'border-primary ring-2 ring-primary/30'
                        : 'border-transparent opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={p} alt={`Thumb ${idx + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}

            {/* Key Property Specs */}
            <div className="bg-white dark:bg-card border rounded-3xl p-5 shadow-sm grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              <div className="p-3 bg-gray-50 dark:bg-muted/30 rounded-2xl">
                <BedDouble className="h-5 w-5 mx-auto text-primary mb-1" />
                <p className="text-[11px] text-muted-foreground">Bedrooms</p>
                <p className="font-bold text-sm">{listing.bedrooms} BHK</p>
              </div>

              <div className="p-3 bg-gray-50 dark:bg-muted/30 rounded-2xl">
                <Bath className="h-5 w-5 mx-auto text-primary mb-1" />
                <p className="text-[11px] text-muted-foreground">Bathrooms</p>
                <p className="font-bold text-sm">{listing.bathrooms} Bath</p>
              </div>

              <div className="p-3 bg-gray-50 dark:bg-muted/30 rounded-2xl">
                <Building className="h-5 w-5 mx-auto text-primary mb-1" />
                <p className="text-[11px] text-muted-foreground">Floor</p>
                <p className="font-bold text-sm">
                  {listing.floor ? `${listing.floor} of ${listing.totalFloors || '—'}` : 'Ground'}
                </p>
              </div>

              <div className="p-3 bg-gray-50 dark:bg-muted/30 rounded-2xl">
                <Users className="h-5 w-5 mx-auto text-primary mb-1" />
                <p className="text-[11px] text-muted-foreground">Preference</p>
                <p className="font-bold text-sm capitalize">{listing.tenantPreference || 'Anyone'}</p>
              </div>
            </div>

            {/* Description */}
            <div className="bg-white dark:bg-card border rounded-3xl p-6 shadow-sm space-y-4">
              <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
                Property Overview & Rules
              </h2>
              <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line leading-relaxed">
                {listing.description || 'No detailed description provided by the landlord.'}
              </div>

              {/* Amenities */}
              {listing.amenities && listing.amenities.length > 0 && (
                <div className="space-y-2.5 pt-3 border-t">
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                    Amenities & Facilities
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {listing.amenities.map((aId) => {
                      const match = RENTAL_AMENITIES.find(x => x.id === aId);
                      return (
                        <span
                          key={aId}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-xs font-semibold text-blue-800 dark:text-blue-300"
                        >
                          <Check className="h-3.5 w-3.5" />
                          {match?.label || aId}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Bills Included */}
              {listing.billsIncluded && listing.billsIncluded.length > 0 && (
                <div className="space-y-2 pt-3 border-t">
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                    Bills Included in Rent
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {listing.billsIncluded.map((bId) => {
                      const match = BILLS_INCLUDED_OPTIONS.find(x => x.id === bId);
                      return (
                        <span
                          key={bId}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-900 text-xs font-semibold text-green-800 dark:text-green-300"
                        >
                          <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                          {match?.label || bId}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Rent, Contact & Safety Advice (5 cols) */}
          <div className="lg:col-span-5 space-y-5">
            <div className="bg-white dark:bg-card border rounded-3xl p-6 shadow-sm space-y-5">
              <div className="space-y-1">
                <p className="text-2xl sm:text-3xl font-extrabold text-primary">
                  ₹{listing.monthlyRent.toLocaleString('en-IN')}
                  <span className="text-sm font-normal text-muted-foreground"> / month</span>
                </p>
                {listing.deposit && (
                  <p className="text-xs text-gray-600 dark:text-gray-300 font-medium">
                    Security Deposit: <strong>₹{listing.deposit.toLocaleString('en-IN')}</strong>
                  </p>
                )}
                <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white pt-2">
                  {listing.title}
                </h1>
              </div>

              {/* Location & Metadata */}
              <div className="space-y-2 py-3 border-y text-xs text-gray-600 dark:text-gray-300">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary shrink-0" />
                  <span className="font-medium truncate">{listing.address || listing.area}</span>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-gray-400" />
                    Available From: {listing.availableFrom || 'Immediately'}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Eye className="h-3.5 w-3.5 text-gray-400" />
                    {listing.viewCount || 1} views
                  </span>
                </div>
              </div>

              {/* Owner Info */}
              <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-muted/30 border flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Landlord / Owner</p>
                  <p className="font-bold text-sm text-gray-900 dark:text-white">
                    {listing.userName || 'FixBro User'}
                  </p>
                </div>
                <span className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-bold px-2.5 py-1 rounded-full">
                  Zero Brokerage
                </span>
              </div>

              {/* Direct Call Landlord Button (Triggers Safety Modal) */}
              <Button
                type="button"
                onClick={() => {
                  if (!user) {
                    router.push(`/auth/login?redirect=/rent-home/${id}`);
                    return;
                  }
                  if (user.uid === listing.userId) {
                    toast({
                      title: "Your Listing",
                      description: "You posted this property, so you cannot call yourself.",
                    });
                    return;
                  }
                  setIsCallModalOpen(true);
                }}
                disabled={user?.uid === listing.userId}
                className={`w-full h-12 rounded-2xl text-base font-bold shadow-lg flex items-center justify-center gap-2 ${
                  user?.uid === listing.userId
                    ? 'bg-gray-100 dark:bg-muted text-gray-500 cursor-not-allowed border'
                    : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
              >
                <PhoneCall className="h-5 w-5" />
                {user?.uid === listing.userId ? 'Your Listing' : 'Call Landlord Directly'}
              </Button>
              <p className="text-[11px] text-center text-muted-foreground">
                {user?.uid === listing.userId
                  ? 'This is your own rental listing.'
                  : 'Connect directly with the owner over phone without waiting for chat.'}
              </p>
            </div>

            {/* Safety Tips Card */}
            <div className="bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/60 rounded-3xl p-5 space-y-3">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold text-sm">
                <ShieldAlert className="h-5 w-5" />
                <span>FixBro Tenant Protection Advice</span>
              </div>
              <ul className="text-xs text-amber-900 dark:text-amber-200 space-y-2 list-disc pl-4 font-medium leading-relaxed">
                <li>
                  <strong>Never pay advance or token rent online:</strong> Do not send advance money to anyone on Google Pay, PhonePe, or UPI before inspecting the home.
                </li>
                <li>
                  <strong>Physical visit is mandatory:</strong> Always visit the apartment, meet the owner/housemate, check the water/power backup, and verify ownership documents.
                </li>
                <li>
                  FixBro is a 100% free community platform and is not responsible for transactions or agreements.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </main>

      {/* SEO Dedicated Footer for Rental Marketplace */}
      <RentHomeFooter />

      <MarketplaceBottomNav activeTab="rentals" />

      {/* Safety Warning Pop-Up Modal */}
      <CallSafetyModal
        isOpen={isCallModalOpen}
        onClose={() => setIsCallModalOpen(false)}
        sellerName={listing.userName}
        sellerPhone={listing.userPhone}
        listingTitle={listing.title}
        listingType="rental"
        callerName={firestoreUser?.displayName || user?.displayName || ''}
        callerPhone={firestoreUser?.mobileNumber || user?.phoneNumber || (firestoreUser?.addresses && firestoreUser.addresses[0]?.phone) || ''}
        callerEmail={user?.email || firestoreUser?.email || ''}
        onCallConfirmed={(callerDetails) => {
          recordRentalCallAction(listing.id).catch(console.error);
          if (user) {
            recordMarketplaceCallAction({
              listingType: 'rental',
              listingId: listing.id,
              listingTitle: listing.title,
              sellerUserId: listing.userId,
              sellerName: listing.userName,
              sellerPhone: listing.userPhone,
              callerUserId: user.uid,
              callerName: callerDetails?.name || firestoreUser?.displayName || user.displayName || 'FixBro User',
              callerPhone: callerDetails?.phone || firestoreUser?.mobileNumber || user.phoneNumber || '',
              callerEmail: callerDetails?.email || user.email || '',
            }).catch(console.error);
          }
        }}
      />
    </div>
  );
}
