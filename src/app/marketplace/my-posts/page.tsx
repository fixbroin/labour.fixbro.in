"use client";

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import MarketplaceNavHeader from '@/components/marketplace/MarketplaceNavHeader';
import MarketplaceBottomNav from '@/components/marketplace/MarketplaceBottomNav';
import {
  Armchair,
  Home,
  RefreshCw,
  Trash2,
  CheckCircle,
  Clock,
  PlusCircle,
  Eye,
  PhoneCall,
  Loader2,
  AlertCircle,
  ExternalLink,
  Pencil,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import type { FurnitureListing, RentalListing } from '@/types/marketplace';
import {
  getUserFurnitureListingsAction,
  republishFurnitureListingAction,
  updateFurnitureStatusAction,
  deleteFurnitureListingAction,
} from '@/app/actions/furnitureActions';
import {
  getUserRentalListingsAction,
  republishRentalListingAction,
  updateRentalStatusAction,
  deleteRentalListingAction,
} from '@/app/actions/rentalActions';
import { getSellerMarketplaceCallLogsAction, type SellerCallLogItem } from '@/app/actions/marketplaceCallActions';
import { getFurniturePublicUrl, getRentalPublicUrl } from '@/lib/marketplaceSlug';

export default function MyMarketplacePostsPage() {
  const { user, isLoading: isLoadingAuth } = useAuth();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<'furniture' | 'rentals' | 'calls'>('furniture');
  const [furniturePosts, setFurniturePosts] = useState<FurnitureListing[]>([]);
  const [rentalPosts, setRentalPosts] = useState<RentalListing[]>([]);
  const [callLogs, setCallLogs] = useState<SellerCallLogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const loadPosts = useCallback(async () => {
    if (!user?.uid) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const [fData, rData, logsData] = await Promise.all([
        getUserFurnitureListingsAction(user.uid),
        getUserRentalListingsAction(user.uid),
        getSellerMarketplaceCallLogsAction(user.uid),
      ]);
      setFurniturePosts(fData);
      setRentalPosts(rData);
      setCallLogs(logsData);
    } catch (err) {
      console.error("Error loading user posts:", err);
    } finally {
      setIsLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  // Republish (1-Click reset 30-day timer)
  const handleRepublish = async (id: string, type: 'furniture' | 'rental') => {
    if (!user?.uid) return;
    setProcessingId(id);
    try {
      const res =
        type === 'furniture'
          ? await republishFurnitureListingAction(id, user.uid)
          : await republishRentalListingAction(id, user.uid);

      if (res.success) {
        toast({
          title: "Republished Successfully! 🚀",
          description: "Your listing has been renewed for 30 more days.",
        });
        loadPosts();
      } else {
        toast({
          title: "Failed to republish",
          description: res.error || "Could not republish post.",
          variant: "destructive",
        });
      }
    } finally {
      setProcessingId(null);
    }
  };

  // Mark Sold or Rented
  const handleMarkComplete = async (id: string, type: 'furniture' | 'rental', currentStatus: string) => {
    if (!user?.uid) return;
    setProcessingId(id);
    try {
      if (type === 'furniture') {
        const nextStatus = currentStatus === 'sold' ? 'active' : 'sold';
        await updateFurnitureStatusAction(id, user.uid, nextStatus);
        toast({
          title: nextStatus === 'sold' ? "Marked as Sold! 🤝" : "Re-activated!",
        });
      } else {
        const nextStatus = currentStatus === 'rented' ? 'active' : 'rented';
        await updateRentalStatusAction(id, user.uid, nextStatus);
        toast({
          title: nextStatus === 'rented' ? "Marked as Rented! 🔑" : "Re-activated!",
        });
      }
      loadPosts();
    } finally {
      setProcessingId(null);
    }
  };

  // Delete
  const handleDelete = async (id: string, type: 'furniture' | 'rental') => {
    if (!user?.uid) return;
    if (!confirm("Are you sure you want to permanently delete this listing?")) return;

    setProcessingId(id);
    try {
      if (type === 'furniture') {
        await deleteFurnitureListingAction(id, user.uid);
      } else {
        await deleteRentalListingAction(id, user.uid);
      }
      toast({ title: "Deleted listing" });
      loadPosts();
    } finally {
      setProcessingId(null);
    }
  };

  const getDaysRemaining = (expiresAt: string) => {
    if (!expiresAt) return null;
    const diffMs = new Date(expiresAt).getTime() - Date.now();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-background pb-20 md:pb-12">
      <MarketplaceNavHeader activeSection="my-posts" />

      <main className="max-w-5xl mx-auto px-4 py-6 sm:py-8 space-y-6">
        {/* Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
              My Marketplace Posts
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Manage your free ads. Listings expire after 30 days — click Republish anytime to extend.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/furniture/post">
              <Button size="sm" variant="outline" className="rounded-xl text-xs gap-1.5">
                <Armchair className="h-3.5 w-3.5" />
                Sell Furniture
              </Button>
            </Link>
            <Link href="/rent-home/post">
              <Button size="sm" className="bg-primary text-white rounded-xl text-xs gap-1.5">
                <Home className="h-3.5 w-3.5" />
                Post Rental
              </Button>
            </Link>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 border-b">
          <button
            type="button"
            onClick={() => setActiveTab('furniture')}
            className={`flex items-center gap-2 pb-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition-all ${
              activeTab === 'furniture'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            <Armchair className="h-4 w-4" />
            <span>Furniture Ads ({furniturePosts.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('rentals')}
            className={`flex items-center gap-2 pb-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition-all ${
              activeTab === 'rentals'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            <Home className="h-4 w-4" />
            <span>Rental Homes ({rentalPosts.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('calls')}
            className={`flex items-center gap-2 pb-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition-all ${
              activeTab === 'calls'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            <PhoneCall className="h-4 w-4" />
            <span>Call Inquiries ({callLogs.length})</span>
          </button>
        </div>

        {/* Content */}
        {isLoading || isLoadingAuth ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-xs text-muted-foreground">Loading your posts...</p>
          </div>
        ) : !user ? (
          <div className="bg-white dark:bg-card border rounded-3xl p-8 text-center space-y-3">
            <p className="text-sm font-semibold">Please log in to manage your posted ads</p>
            <Link href="/auth/login">
              <Button className="rounded-xl text-xs">Log In</Button>
            </Link>
          </div>
        ) : activeTab === 'furniture' ? (
          furniturePosts.length === 0 ? (
            <div className="bg-white dark:bg-card border rounded-3xl p-10 text-center space-y-3">
              <Armchair className="h-10 w-10 mx-auto text-gray-400" />
              <h3 className="font-bold text-base">No furniture ads posted yet</h3>
              <p className="text-xs text-muted-foreground">Sell your pre-owned or brand new furniture in minutes.</p>
              <Link href="/furniture/post">
                <Button className="rounded-xl text-xs font-bold mt-2">Post Free Furniture Ad</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {furniturePosts.map((item) => {
                const daysRemaining = getDaysRemaining(item.expiresAt);
                const isExpired = item.status === 'expired' || (daysRemaining !== null && daysRemaining <= 0);
                const isSold = item.status === 'sold';

                return (
                  <div
                    key={item.id}
                    className="bg-white dark:bg-card border rounded-3xl p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-4 min-w-0 flex-1">
                      <div className="w-20 h-20 rounded-2xl overflow-hidden bg-gray-100 shrink-0 border">
                        {item.photos && item.photos[0] ? (
                          <img src={item.photos[0]} alt={item.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">
                            <Armchair className="h-6 w-6" />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              isSold
                                ? 'bg-gray-200 text-gray-700'
                                : isExpired
                                ? 'bg-red-100 text-red-700'
                                : 'bg-green-100 text-green-700'
                            }`}
                          >
                            {isSold ? 'SOLD' : isExpired ? 'EXPIRED' : 'ACTIVE'}
                          </span>
                          <span className="text-xs font-extrabold text-primary">
                            ₹{item.price.toLocaleString('en-IN')}
                          </span>
                        </div>

                        <Link href={getFurniturePublicUrl(item)} className="block">
                          <h3 className="font-bold text-sm text-gray-900 dark:text-white truncate hover:text-primary">
                            {item.title}
                          </h3>
                        </Link>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground pt-0.5">
                          <span>{item.area}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Eye className="h-3 w-3" />
                            {item.viewCount || 0} views
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <PhoneCall className="h-3 w-3" />
                            {item.callCount || 0} calls
                          </span>
                        </div>

                        {/* Expiration status */}
                        <div className="pt-1">
                          {isSold ? (
                            <span className="text-[11px] text-gray-500">Item marked as sold</span>
                          ) : isExpired ? (
                            <span className="text-[11px] font-semibold text-red-600">
                              Ad expired. Click Republish to activate for 30 more days.
                            </span>
                          ) : (
                            <span className="text-[11px] text-amber-700 dark:text-amber-400 font-medium flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Expires in {daysRemaining} days
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      {/* Preview Public Ad */}
                      <Link href={getFurniturePublicUrl(item)} target="_blank">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="rounded-xl text-xs gap-1 border-gray-300 dark:border-gray-700 bg-white dark:bg-card text-gray-800 dark:text-gray-200 hover:bg-primary hover:text-white hover:border-primary transition-all shadow-sm"
                          title="Preview how ad appears to buyers"
                        >
                          <Eye className="h-3.5 w-3.5 text-current" />
                          Preview
                        </Button>
                      </Link>

                      {/* Edit Ad */}
                      <Link href={`/furniture/edit/${item.id}`}>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="rounded-xl text-xs gap-1 border-gray-300 dark:border-gray-700 bg-white dark:bg-card text-gray-800 dark:text-gray-200 hover:bg-primary hover:text-white hover:border-primary transition-all shadow-sm"
                          title="Edit listing details and photos"
                        >
                          <Pencil className="h-3.5 w-3.5 text-current" />
                          Edit
                        </Button>
                      </Link>

                      {/* 1-Click Republish - ONLY visible when ad has expired */}
                      {isExpired && (
                        <Button
                          type="button"
                          size="sm"
                          disabled={processingId === item.id}
                          onClick={() => handleRepublish(item.id, 'furniture')}
                          className="rounded-xl text-xs gap-1 bg-amber-500 hover:bg-amber-600 text-white font-bold transition-all shadow-sm"
                          title="Reset 30-day countdown timer and reactivate ad"
                        >
                          <RefreshCw className="h-3.5 w-3.5 text-current" />
                          Republish (30d)
                        </Button>
                      )}

                      {/* Mark Sold/Active */}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={processingId === item.id}
                        onClick={() => handleMarkComplete(item.id, 'furniture', item.status)}
                        className="rounded-xl text-xs gap-1 border-gray-300 dark:border-gray-700 bg-white dark:bg-card text-gray-800 dark:text-gray-200 hover:bg-primary hover:text-white hover:border-primary transition-all shadow-sm"
                      >
                        {isSold ? 'Reactivate' : 'Mark Sold'}
                      </Button>

                      {/* Delete */}
                      <button
                        type="button"
                        disabled={processingId === item.id}
                        onClick={() => handleDelete(item.id, 'furniture')}
                        className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                        title="Delete listing and all photos"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : activeTab === 'rentals' ? (
          rentalPosts.length === 0 ? (
          <div className="bg-white dark:bg-card border rounded-3xl p-10 text-center space-y-3">
            <Home className="h-10 w-10 mx-auto text-gray-400" />
            <h3 className="font-bold text-base">No rental properties posted yet</h3>
            <p className="text-xs text-muted-foreground">List flats, rooms, or houses for rent with zero brokerage.</p>
            <Link href="/rent-home/post">
              <Button className="rounded-xl text-xs font-bold mt-2">Post Free Rental Property</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {rentalPosts.map((item) => {
              const daysRemaining = getDaysRemaining(item.expiresAt);
              const isExpired = item.status === 'expired' || (daysRemaining !== null && daysRemaining <= 0);
              const isRented = item.status === 'rented';

              return (
                <div
                  key={item.id}
                  className="bg-white dark:bg-card border rounded-3xl p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-4 min-w-0 flex-1">
                    <div className="w-20 h-20 rounded-2xl overflow-hidden bg-gray-100 shrink-0 border">
                      {item.photos && item.photos[0] ? (
                        <img src={item.photos[0]} alt={item.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          <Home className="h-6 w-6" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isRented
                              ? 'bg-gray-200 text-gray-700'
                              : isExpired
                              ? 'bg-red-100 text-red-700'
                              : 'bg-green-100 text-green-700'
                          }`}
                        >
                          {isRented ? 'RENTED' : isExpired ? 'EXPIRED' : 'ACTIVE'}
                        </span>
                        <span className="text-xs font-extrabold text-primary">
                          ₹{item.monthlyRent.toLocaleString('en-IN')}/mo
                        </span>
                      </div>

                      <Link href={getRentalPublicUrl(item)} className="block">
                        <h3 className="font-bold text-sm text-gray-900 dark:text-white truncate hover:text-primary">
                          {item.title}
                        </h3>
                      </Link>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground pt-0.5">
                        <span>{item.area}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          {item.viewCount || 0} views
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <PhoneCall className="h-3 w-3" />
                          {item.callCount || 0} calls
                        </span>
                      </div>

                      <div className="pt-1">
                        {isRented ? (
                          <span className="text-[11px] text-gray-500">Property marked as rented</span>
                        ) : isExpired ? (
                          <span className="text-[11px] font-semibold text-red-600">
                            Ad expired. Click Republish to activate for 30 more days.
                          </span>
                        ) : (
                          <span className="text-[11px] text-amber-700 dark:text-amber-400 font-medium flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Expires in {daysRemaining} days
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    {/* Preview Public Ad */}
                    <Link href={getRentalPublicUrl(item)} target="_blank">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="rounded-xl text-xs gap-1 border-gray-300 dark:border-gray-700 bg-white dark:bg-card text-gray-800 dark:text-gray-200 hover:bg-primary hover:text-white hover:border-primary transition-all shadow-sm"
                        title="Preview how ad appears to tenants"
                      >
                        <Eye className="h-3.5 w-3.5 text-current" />
                        Preview
                      </Button>
                    </Link>

                    {/* Edit Ad */}
                    <Link href={`/rent-home/edit/${item.id}`}>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="rounded-xl text-xs gap-1 border-gray-300 dark:border-gray-700 bg-white dark:bg-card text-gray-800 dark:text-gray-200 hover:bg-primary hover:text-white hover:border-primary transition-all shadow-sm"
                        title="Edit property details and photos"
                      >
                        <Pencil className="h-3.5 w-3.5 text-current" />
                        Edit
                      </Button>
                    </Link>

                    {/* 1-Click Republish - ONLY visible when ad has expired */}
                    {isExpired && (
                      <Button
                        type="button"
                        size="sm"
                        disabled={processingId === item.id}
                        onClick={() => handleRepublish(item.id, 'rental')}
                        className="rounded-xl text-xs gap-1 bg-amber-500 hover:bg-amber-600 text-white font-bold transition-all shadow-sm"
                        title="Reset 30-day countdown timer and reactivate ad"
                      >
                        <RefreshCw className="h-3.5 w-3.5 text-current" />
                        Republish (30d)
                      </Button>
                    )}

                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={processingId === item.id}
                      onClick={() => handleMarkComplete(item.id, 'rental', item.status)}
                      className="rounded-xl text-xs gap-1 border-gray-300 dark:border-gray-700 bg-white dark:bg-card text-gray-800 dark:text-gray-200 hover:bg-primary hover:text-white hover:border-primary transition-all shadow-sm"
                    >
                      {isRented ? 'Reactivate' : 'Mark Rented'}
                    </Button>

                    <button
                      type="button"
                      disabled={processingId === item.id}
                      onClick={() => handleDelete(item.id, 'rental')}
                      className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                      title="Delete listing and all photos"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        callLogs.length === 0 ? (
          <div className="bg-white dark:bg-card border rounded-3xl p-10 text-center space-y-3">
            <PhoneCall className="h-10 w-10 mx-auto text-gray-400" />
            <h3 className="font-bold text-base">No caller inquiries yet</h3>
            <p className="text-xs text-muted-foreground">
              When interested buyers or tenants click &quot;Proceed to Call&quot; on your listings, their inquiry details and phone numbers will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-2xl text-xs text-blue-900 dark:text-blue-300">
              💡 <strong>Caller Log:</strong> Interested users who clicked to call your ads. You can see who called, their phone number, and easily call them back if you missed their call.
            </div>
            <div className="divide-y bg-white dark:bg-card border rounded-3xl overflow-hidden shadow-sm">
              {callLogs.map((log) => (
                <div key={log.id} className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-gray-50/50 dark:hover:bg-muted/20">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-sm sm:text-base text-gray-900 dark:text-white flex items-center gap-1.5">
                        <PhoneCall className="h-4 w-4 text-green-600 shrink-0" />
                        {log.callerName}
                      </span>
                      {log.callerPhone ? (
                        <a
                          href={`tel:${log.callerPhone}`}
                          className="text-xs sm:text-sm font-bold text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-900/60 px-2 py-0.5 rounded-lg hover:underline flex items-center gap-1"
                        >
                          📞 {log.callerPhone}
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">(Phone not provided)</span>
                      )}
                      {log.callCount && log.callCount > 1 ? (
                        <span className="text-[10px] bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-300 font-bold px-2 py-0.5 rounded-full border border-amber-300 dark:border-amber-800">
                          Called {log.callCount} times
                        </span>
                      ) : (
                        <span className="text-[10px] bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 font-semibold px-2 py-0.5 rounded-full">
                          Dialed Call
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <span>Inquired on:</span>
                      <Link
                        href={log.listingType === 'furniture' ? `/furniture/${log.listingId}` : `/rent-home/${log.listingId}`}
                        className="font-semibold text-primary hover:underline truncate max-w-[280px] sm:max-w-md"
                      >
                        {log.listingTitle}
                      </Link>
                    </p>

                    {log.callerEmail && (
                      <p className="text-[11px] text-gray-400">
                        Email: {log.callerEmail}
                      </p>
                    )}
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0">
                    <span className="text-[11px] text-gray-500 font-medium">
                      {new Date(log.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>

                    {log.callerPhone && (
                      <a href={`tel:${log.callerPhone}`}>
                        <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs gap-1.5 font-bold shadow-sm">
                          <PhoneCall className="h-3.5 w-3.5" />
                          Call Back
                        </Button>
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      )}
      </main>

      <MarketplaceBottomNav activeTab="my-posts" />
    </div>
  );
}
