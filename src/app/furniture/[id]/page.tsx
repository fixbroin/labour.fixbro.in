"use client";

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import MarketplaceNavHeader from '@/components/marketplace/MarketplaceNavHeader';
import MarketplaceBottomNav from '@/components/marketplace/MarketplaceBottomNav';
import FurnitureFooter from '@/components/marketplace/FurnitureFooter';
import MarketplaceImageCarousel from '@/components/marketplace/MarketplaceImageCarousel';
import CallSafetyModal from '@/components/marketplace/CallSafetyModal';
import {
  Armchair,
  PhoneCall,
  MapPin,
  Calendar,
  ShieldAlert,
  Share2,
  ChevronLeft,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Clock,
  Eye,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import type { FurnitureListing, MarketplaceLocation } from '@/types/marketplace';
import {
  getFurnitureListingByIdAction,
  recordFurnitureCallAction,
  incrementFurnitureViewCountAction,
} from '@/app/actions/furnitureActions';
import { recordMarketplaceCallAction } from '@/app/actions/marketplaceCallActions';
import { extractMarketplaceId } from '@/lib/marketplaceSlug';

export default function FurnitureDetailsPage() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();
  const { user, firestoreUser } = useAuth();
  const { toast } = useToast();

  const [listing, setListing] = useState<FurnitureListing | null>(null);
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
        const item = await getFurnitureListingByIdAction(
          id,
          viewerLocation?.latitude,
          viewerLocation?.longitude
        );
        setListing(item);
      } catch (err) {
        console.error("Error loading furniture item:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadItem();
  }, [id, viewerLocation]);

  // Track unique view (once per session, excluding seller themselves)
  useEffect(() => {
    if (!listing?.id || hasTrackedView.current) return;

    // Do not count the seller's own views
    if (user?.uid && listing.userId && user.uid === listing.userId) {
      return;
    }

    // Check sessionStorage deduplication: 1 view per session
    const storageKey = `fixbro_viewed_furniture_${listing.id}`;
    if (typeof window !== 'undefined') {
      try {
        if (sessionStorage.getItem(storageKey)) {
          return;
        }
        sessionStorage.setItem(storageKey, 'true');
      } catch {}
    }

    hasTrackedView.current = true;
    incrementFurnitureViewCountAction(listing.id).catch(console.error);
  }, [listing?.id, listing?.userId, user?.uid]);

  const handleShare = async () => {
    if (typeof window === 'undefined') return;
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: listing?.title || 'Furniture on FixBro',
          text: `Check out this ${listing?.title} for ₹${listing?.price} on FixBro!`,
          url,
        });
      } catch {}
    } else {
      navigator.clipboard.writeText(url);
      toast({
        title: "Link Copied! 📋",
        description: "Ad link copied to clipboard.",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50/50 dark:bg-background">
        <MarketplaceNavHeader activeSection="furniture" />
        <div className="py-24 flex flex-col items-center justify-center space-y-3">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading furniture details...</p>
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="min-h-screen bg-gray-50/50 dark:bg-background">
        <MarketplaceNavHeader activeSection="furniture" />
        <div className="max-w-md mx-auto px-4 py-20 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
            <AlertTriangle className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-bold">Listing Not Found or Expired</h2>
          <p className="text-xs text-muted-foreground">
            This ad may have expired or been removed by the owner.
          </p>
          <Link href="/furniture">
            <Button className="rounded-xl">Browse Other Furniture</Button>
          </Link>
        </div>
      </div>
    );
  }

  const isBrandNew = listing.listingType === 'brand_new';
  const photos = listing.photos && listing.photos.length > 0 ? listing.photos : [];

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-background pb-20 md:pb-12">
      <MarketplaceNavHeader activeSection="furniture" />

      <main className="max-w-6xl mx-auto px-4 py-5 space-y-6">
        {/* Breadcrumb / Back button */}
        <div className="flex items-center justify-between">
          <Link
            href="/furniture"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:text-primary transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Furniture Listings
          </Link>

          <Button
            variant="outline"
            size="sm"
            onClick={handleShare}
            className="rounded-xl text-xs flex items-center gap-1.5"
          >
            <Share2 className="h-3.5 w-3.5" />
            Share Ad
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Photos (7 cols) */}
          <div className="lg:col-span-7 space-y-3">
            {/* Main Featured Photo Carousel */}
            <MarketplaceImageCarousel
              photos={photos}
              alt={listing.title}
              type="furniture"
              aspectRatio="aspect-[4/3]"
              className="rounded-3xl border shadow-sm"
              initialIndex={selectedPhotoIndex}
              onIndexChange={setSelectedPhotoIndex}
              clickOpensFullscreen={true}
              badge={
                <span
                  className={`text-xs font-bold px-3 py-1 rounded-full shadow-md backdrop-blur-md ${
                    isBrandNew ? 'bg-green-600 text-white' : 'bg-amber-600 text-white'
                  }`}
                >
                  {isBrandNew ? '✨ Brand New' : '🛋️ Pre-Owned'}
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
                    className={`relative w-20 h-16 rounded-xl overflow-hidden border-2 shrink-0 transition-all ${
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

            {/* Description & Details */}
            <div className="bg-white dark:bg-card border rounded-3xl p-6 shadow-sm space-y-4">
              <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
                Product Description
              </h2>
              <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line leading-relaxed">
                {listing.description || 'No detailed description provided by the seller.'}
              </div>

              {/* Defect / Damage alert box if any */}
              {listing.hasDamage && listing.damageDetails && listing.damageDetails.length > 0 && (
                <div className="p-4 rounded-2xl border border-amber-300 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 space-y-2">
                  <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold text-sm">
                    <AlertTriangle className="h-4 w-4" />
                    <span>Disclosed Defects & Wear:</span>
                  </div>
                  <ul className="list-disc pl-5 text-xs sm:text-sm text-amber-900 dark:text-amber-200 space-y-1">
                    {listing.damageDetails.map((defect, i) => (
                      <li key={i}>{defect}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Warranty details */}
              {listing.hasWarranty && listing.warrantyDetails && (
                <div className="p-3.5 rounded-2xl border border-green-200 dark:border-green-900/60 bg-green-50 dark:bg-green-950/30 flex items-start gap-2.5 text-xs sm:text-sm text-green-900 dark:text-green-200">
                  <CheckCircle className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Original Bill & Warranty: </span>
                    <span>{listing.warrantyDetails}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Key Details, Call Button & Safety Tips (5 cols) */}
          <div className="lg:col-span-5 space-y-5">
            {/* Price & Contact Card */}
            <div className="bg-white dark:bg-card border rounded-3xl p-6 shadow-sm space-y-5">
              <div className="space-y-1">
                <div className="flex items-baseline justify-between">
                  <p className="text-2xl sm:text-3xl font-extrabold text-primary">
                    ₹{listing.price.toLocaleString('en-IN')}
                  </p>
                  {listing.isNegotiable && (
                    <span className="text-xs text-green-700 dark:text-green-400 font-bold bg-green-50 dark:bg-green-950/50 px-2 py-0.5 rounded-md">
                      Price Negotiable
                    </span>
                  )}
                </div>
                <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white pt-1">
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
                    Posted {new Date(listing.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Eye className="h-3.5 w-3.5 text-gray-400" />
                    {listing.viewCount || 1} views
                  </span>
                </div>
              </div>

              {/* Seller Info */}
              <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-muted/30 border flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Seller</p>
                  <p className="font-bold text-sm text-gray-900 dark:text-white">
                    {listing.userName || 'FixBro User'}
                  </p>
                </div>
                <span className="text-xs bg-primary/10 text-primary font-bold px-2.5 py-1 rounded-full">
                  Verified Ad
                </span>
              </div>

              {/* Mandatory Call Button with Safety Modal Trigger */}
              <Button
                type="button"
                onClick={() => {
                  if (!user) {
                    router.push(`/auth/login?redirect=/furniture/${id}`);
                    return;
                  }
                  if (user.uid === listing.userId) {
                    toast({
                      title: "Your Listing",
                      description: "You posted this ad, so you cannot call yourself.",
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
                {user?.uid === listing.userId ? 'Your Listing' : 'Call Seller Directly'}
              </Button>
              <p className="text-[11px] text-center text-muted-foreground">
                {user?.uid === listing.userId
                  ? 'This is your own listing.'
                  : 'No chat waiting. Call the seller directly on phone.'}
              </p>
            </div>

            {/* Safety Tips Card */}
            <div className="bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/60 rounded-3xl p-5 space-y-3">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold text-sm">
                <ShieldAlert className="h-5 w-5" />
                <span>FixBro Buyer Protection Advice</span>
              </div>
              <ul className="text-xs text-amber-900 dark:text-amber-200 space-y-2 list-disc pl-4 font-medium leading-relaxed">
                <li>
                  <strong>Never pay advance money:</strong> Do not send token money via Google Pay, PhonePe, or UPI before visiting.
                </li>
                <li>
                  <strong>Inspect in person:</strong> Always meet the seller, physically check the furniture joints and condition, and pay on pickup.
                </li>
                <li>
                  FixBro is a 100% free community platform connecting buyers and sellers directly.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </main>

      {/* SEO Dedicated Footer for Furniture Marketplace */}
      <FurnitureFooter />

      <MarketplaceBottomNav activeTab="furniture" />

      {/* Safety Warning Pop-Up Modal */}
      <CallSafetyModal
        isOpen={isCallModalOpen}
        onClose={() => setIsCallModalOpen(false)}
        sellerName={listing.userName}
        sellerPhone={listing.userPhone}
        listingTitle={listing.title}
        listingType="furniture"
        callerName={firestoreUser?.displayName || user?.displayName || ''}
        callerPhone={firestoreUser?.mobileNumber || user?.phoneNumber || (firestoreUser?.addresses && firestoreUser.addresses[0]?.phone) || ''}
        callerEmail={user?.email || firestoreUser?.email || ''}
        onCallConfirmed={(callerDetails) => {
          if (user) {
            recordMarketplaceCallAction({
              listingType: 'furniture',
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
