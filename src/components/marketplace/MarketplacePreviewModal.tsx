'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Eye,
  MapPin,
  ShieldAlert,
  Phone,
  CheckCircle,
  AlertTriangle,
  Armchair,
  Home,
  Sparkles,
  Calendar,
  X,
  Layers,
  LayoutGrid,
} from 'lucide-react';

export interface MarketplacePreviewData {
  title: string;
  description?: string;
  price: number | string;
  photos: string[];
  location?: {
    address?: string;
    area?: string;
    city?: string;
  } | null;
  sellerName?: string;
  phone?: string;
  // Furniture specific
  listingType?: 'brand_new' | 'used';
  category?: string;
  brand?: string;
  ageYears?: number | string;
  conditionRating?: number;
  hasWarranty?: boolean;
  warrantyDetails?: string;
  hasDamage?: boolean;
  damageDetails?: string[];
  // Rental specific
  propertyType?: string;
  bhk?: string;
  furnishing?: string;
  deposit?: number | string;
  availableFrom?: string;
  tenantPreference?: string;
  amenities?: string[];
  billsIncluded?: string[];
}

interface MarketplacePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'furniture' | 'rental';
  data: MarketplacePreviewData;
}

export const MarketplacePreviewModal: React.FC<MarketplacePreviewModalProps> = ({
  isOpen,
  onClose,
  type,
  data,
}) => {
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);

  const priceNum = typeof data.price === 'string' ? parseFloat(data.price) || 0 : data.price || 0;
  const depositNum = typeof data.deposit === 'string' ? parseFloat(data.deposit) || 0 : data.deposit || 0;
  const photos = data.photos && data.photos.length > 0 ? data.photos : [];
  const activePhoto = photos[selectedPhotoIndex] || photos[0];
  const displayTitle = data.title.trim() || (type === 'furniture' ? 'Untitled Furniture Listing' : 'Untitled Rental Property');
  const displayArea = data.location?.area || data.location?.city || 'Bengaluru';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl w-[95vw] sm:w-[90vw] max-h-[92vh] h-[88vh] p-0 flex flex-col overflow-hidden rounded-3xl">
        <DialogHeader className="p-4 border-b bg-background flex-shrink-0 flex flex-row items-center justify-between">
          <div>
            <DialogTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              Live Ad Preview
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Review how your {type === 'furniture' ? 'furniture item' : 'rental property'} will look to buyers and tenants.
            </DialogDescription>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
            Preview Mode
          </span>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 bg-gray-50/50 dark:bg-background">
          <Tabs defaultValue="detail" className="w-full space-y-4">
            <div className="flex justify-center">
              <TabsList className="bg-gray-200 dark:bg-muted p-1 rounded-xl">
                <TabsTrigger value="detail" className="rounded-lg text-xs font-semibold flex items-center gap-1.5 px-3">
                  <Layers className="h-3.5 w-3.5" />
                  Full Ad Page View
                </TabsTrigger>
                <TabsTrigger value="card" className="rounded-lg text-xs font-semibold flex items-center gap-1.5 px-3">
                  <LayoutGrid className="h-3.5 w-3.5" />
                  Search Card View
                </TabsTrigger>
              </TabsList>
            </div>

            {/* TAB 1: FULL DETAIL PAGE VIEW */}
            <TabsContent value="detail" className="space-y-4 focus-visible:outline-none">
              {/* Media gallery preview */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                <div className="md:col-span-7 space-y-3">
                  <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-gray-200 dark:bg-muted border shadow-sm relative group flex items-center justify-center">
                    {activePhoto ? (
                      <img
                        src={activePhoto}
                        alt={displayTitle}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-center p-6 space-y-2 text-muted-foreground">
                        {type === 'furniture' ? (
                          <Armchair className="h-12 w-12 mx-auto stroke-1 text-gray-400" />
                        ) : (
                          <Home className="h-12 w-12 mx-auto stroke-1 text-gray-400" />
                        )}
                        <p className="text-xs">No photos uploaded yet. (Up to 5 photos supported)</p>
                      </div>
                    )}

                    {/* Badge */}
                    <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                      {type === 'furniture' ? (
                        <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full shadow-md text-white ${
                          data.listingType === 'brand_new' ? 'bg-green-600' : 'bg-amber-600'
                        }`}>
                          {data.listingType === 'brand_new' ? '✨ Brand New' : '🛋️ Pre-Owned'}
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full shadow-md text-white bg-primary">
                          🏠 {data.bhk || 'Rental'} • {data.furnishing || 'Property'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Thumbnail bar */}
                  {photos.length > 1 && (
                    <div className="flex items-center gap-2 overflow-x-auto pb-1">
                      {photos.map((p, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setSelectedPhotoIndex(idx)}
                          className={`w-16 h-12 rounded-lg overflow-hidden border-2 shrink-0 transition-all ${
                            selectedPhotoIndex === idx
                              ? 'border-primary ring-2 ring-primary/30'
                              : 'border-transparent opacity-70 hover:opacity-100'
                          }`}
                        >
                          <img src={p} alt={`Preview ${idx + 1}`} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Description Box */}
                  <div className="bg-white dark:bg-card border rounded-2xl p-4 shadow-sm space-y-2">
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                      Description & Details
                    </h4>
                    <p className="text-xs text-gray-600 dark:text-gray-300 whitespace-pre-line leading-relaxed">
                      {data.description?.trim() || 'No description provided yet.'}
                    </p>

                    {/* Defect/Damage alert if any */}
                    {data.hasDamage && data.damageDetails && data.damageDetails.length > 0 && (
                      <div className="p-3 rounded-xl border border-amber-300 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 space-y-1">
                        <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300 font-bold text-xs">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          <span>Disclosed Defects:</span>
                        </div>
                        <ul className="list-disc pl-4 text-[11px] text-amber-900 dark:text-amber-200">
                          {data.damageDetails.map((defect, i) => (
                            <li key={i}>{defect}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Warranty Details */}
                    {data.hasWarranty && data.warrantyDetails && (
                      <div className="p-3 rounded-xl border border-green-200 dark:border-green-900/60 bg-green-50 dark:bg-green-950/30 flex items-start gap-2 text-xs text-green-900 dark:text-green-200">
                        <CheckCircle className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold">Warranty: </span>
                          <span>{data.warrantyDetails}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right side: Key Info */}
                <div className="md:col-span-5 space-y-3">
                  <div className="bg-white dark:bg-card border rounded-2xl p-5 shadow-sm space-y-3">
                    <div className="flex items-baseline justify-between">
                      <div className="text-2xl font-extrabold text-primary">
                        ₹{priceNum.toLocaleString('en-IN')}
                        {type === 'rental' && <span className="text-xs font-normal text-muted-foreground"> / month</span>}
                      </div>
                      {depositNum > 0 && (
                        <span className="text-xs font-medium text-muted-foreground">
                          Dep: ₹{depositNum.toLocaleString('en-IN')}
                        </span>
                      )}
                    </div>

                    <h3 className="text-base font-bold text-gray-900 dark:text-white leading-snug">
                      {displayTitle}
                    </h3>

                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span className="truncate">{data.location?.address || displayArea}</span>
                    </div>

                    {/* Key Attributes Grid */}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t text-xs">
                      {type === 'furniture' ? (
                        <>
                          <div className="p-2 rounded-xl bg-gray-50 dark:bg-muted/40">
                            <span className="text-muted-foreground block text-[10px]">Category</span>
                            <span className="font-semibold capitalize">{data.category || 'Furniture'}</span>
                          </div>
                          {data.brand && (
                            <div className="p-2 rounded-xl bg-gray-50 dark:bg-muted/40">
                              <span className="text-muted-foreground block text-[10px]">Brand</span>
                              <span className="font-semibold">{data.brand}</span>
                            </div>
                          )}
                          {data.ageYears !== undefined && data.ageYears !== '' && (
                            <div className="p-2 rounded-xl bg-gray-50 dark:bg-muted/40">
                              <span className="text-muted-foreground block text-[10px]">Age</span>
                              <span className="font-semibold">{data.ageYears} yrs</span>
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          <div className="p-2 rounded-xl bg-gray-50 dark:bg-muted/40">
                            <span className="text-muted-foreground block text-[10px]">Type / BHK</span>
                            <span className="font-semibold">{data.bhk || data.propertyType || 'Apartment'}</span>
                          </div>
                          <div className="p-2 rounded-xl bg-gray-50 dark:bg-muted/40">
                            <span className="text-muted-foreground block text-[10px]">Furnishing</span>
                            <span className="font-semibold">{data.furnishing || 'Semi'}</span>
                          </div>
                          {data.tenantPreference && (
                            <div className="p-2 rounded-xl bg-gray-50 dark:bg-muted/40">
                              <span className="text-muted-foreground block text-[10px]">Tenants</span>
                              <span className="font-semibold">{data.tenantPreference}</span>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* Seller box preview */}
                    <div className="pt-3 border-t space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Posted By:</span>
                        <span className="font-bold">{data.sellerName || 'FixBro User'}</span>
                      </div>
                      <Button
                        type="button"
                        disabled
                        className="w-full h-10 rounded-xl bg-primary/80 text-white font-bold text-xs flex items-center justify-center gap-1.5 opacity-90 cursor-default"
                      >
                        <Phone className="h-3.5 w-3.5" />
                        Call Seller (Interactive on Live Ad)
                      </Button>
                    </div>

                    {/* Safety notice preview */}
                    <div className="p-3 rounded-xl border border-amber-300 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/20 text-[11px] text-amber-900 dark:text-amber-200 flex items-start gap-2">
                      <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                      <p className="leading-snug">
                        <strong>Safety First:</strong> FixBro is a free direct-connect platform. Never transfer advance funds before inspecting in person.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* TAB 2: SEARCH CARD VIEW */}
            <TabsContent value="card" className="flex justify-center py-6 focus-visible:outline-none">
              <div className="w-full max-w-sm bg-white dark:bg-card border rounded-2xl overflow-hidden shadow-md space-y-0">
                <div className="aspect-[4/3] bg-gray-200 dark:bg-muted relative flex items-center justify-center">
                  {activePhoto ? (
                    <img src={activePhoto} alt={displayTitle} className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center p-4 text-gray-400">
                      {type === 'furniture' ? <Armchair className="h-10 w-10 mx-auto" /> : <Home className="h-10 w-10 mx-auto" />}
                      <span className="text-xs">No Photo</span>
                    </div>
                  )}

                  <div className="absolute top-2.5 left-2.5">
                    {type === 'furniture' ? (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full text-white ${
                        data.listingType === 'brand_new' ? 'bg-green-600' : 'bg-amber-600'
                      }`}>
                        {data.listingType === 'brand_new' ? 'Brand New' : 'Pre-Owned'}
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white bg-primary">
                        {data.bhk || 'Rental'}
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-4 space-y-2">
                  <div className="text-lg font-extrabold text-primary">
                    ₹{priceNum.toLocaleString('en-IN')}
                    {type === 'rental' && <span className="text-xs font-normal text-muted-foreground"> /mo</span>}
                  </div>
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white line-clamp-1">
                    {displayTitle}
                  </h4>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3 text-primary shrink-0" />
                    <span className="truncate">{displayArea}</span>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t bg-background flex items-center justify-between flex-shrink-0">
          <p className="text-xs text-muted-foreground hidden sm:block">
            Need adjustments? Close preview and modify any field before publishing.
          </p>
          <Button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto h-10 px-6 rounded-xl font-bold text-xs"
          >
            Close Preview
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
