"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import MarketplaceNavHeader from '@/components/marketplace/MarketplaceNavHeader';
import MarketplaceBottomNav from '@/components/marketplace/MarketplaceBottomNav';
import {
  Armchair,
  Upload,
  X,
  Plus,
  Trash2,
  MapPin,
  CheckCircle,
  AlertCircle,
  Loader2,
  ShieldAlert,
  Eye,
} from 'lucide-react';
import { MarketplacePreviewModal } from '@/components/marketplace/MarketplacePreviewModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useApplicationConfig } from '@/hooks/useApplicationConfig';
import {
  FURNITURE_CATEGORIES,
  type FurnitureCategory,
  type FurnitureCondition,
  type MarketplaceLocation,
} from '@/types/marketplace';
import dynamic from 'next/dynamic';
import { createFurnitureListingAction } from '@/app/actions/furnitureActions';
import { saveUserMarketplaceLocationAction } from '@/app/actions/marketplaceLocationActions';
import MarketplaceModalSelect from '@/components/marketplace/MarketplaceModalSelect';
import { compressImage } from '@/lib/imageCompressor';

const MarketplaceMapSelector = dynamic(
  () => import('@/components/marketplace/MarketplaceMapSelector'),
  { ssr: false }
);

export default function SellFurniturePage() {
  const router = useRouter();
  const { user, firestoreUser, isInitialAuthCheckComplete } = useAuth();
  const { toast } = useToast();
  const { config: appConfig } = useApplicationConfig();

  // Redirect to login if unauthenticated
  useEffect(() => {
    if (isInitialAuthCheckComplete && !user) {
      toast({
        title: "Login Required",
        description: "Please login to publish your furniture ad.",
      });
      router.push('/auth/login?redirect=/furniture/post');
    }
  }, [isInitialAuthCheckComplete, user, router, toast]);

  // Form state
  const [listingType, setListingType] = useState<FurnitureCondition>('used');
  const [category, setCategory] = useState<FurnitureCategory>('sofas');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState<string>('');
  const [isNegotiable, setIsNegotiable] = useState(false);

  // Photos
  const [photos, setPhotos] = useState<string[]>([]);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  // Damage
  const [hasDamage, setHasDamage] = useState(false);
  const [damageNotes, setDamageNotes] = useState<string[]>(['']);

  // Warranty
  const [hasWarranty, setHasWarranty] = useState(false);
  const [warrantyDetails, setWarrantyDetails] = useState('');

  // Location
  const [location, setLocation] = useState<MarketplaceLocation | null>(null);
  const [isMapOpen, setIsMapOpen] = useState(false);

  // Contact
  const [phone, setPhone] = useState('');
  const [sellerName, setSellerName] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Prepopulate location & phone from user profile
  useEffect(() => {
    if (firestoreUser) {
      if (firestoreUser.mobileNumber && !phone) {
        setPhone(firestoreUser.mobileNumber);
      }
      if (firestoreUser.displayName && !sellerName) {
        setSellerName(firestoreUser.displayName);
      }
      if (firestoreUser.marketplaceLocation && !location) {
        setLocation(firestoreUser.marketplaceLocation);
      }
    } else if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('fixbroMarketplaceLocation') || sessionStorage.getItem('fixbroMarketplaceLocation');
        if (cached && !location) {
          setLocation(JSON.parse(cached));
        }
      } catch {}
    }
  }, [firestoreUser]);

  // Upload photo handler with Authentication Bearer token
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (!user) {
      toast({
        title: "Login Required",
        description: "Please login to upload photos.",
        variant: "destructive",
      });
      router.push('/auth/login?redirect=/furniture/post');
      return;
    }

    if (photos.length + files.length > 5) {
      toast({
        title: "Photo limit reached",
        description: "You can upload a maximum of 5 photos.",
        variant: "destructive",
      });
      return;
    }

    setIsUploadingPhoto(true);
    try {
      const token = await user.getIdToken();
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        if (file.size > 100 * 1024 * 1024) {
          toast({
            title: "File Too Large",
            description: `"${file.name}" exceeds the 100MB limit.`,
            variant: "destructive",
          });
          continue;
        }

        let fileToUpload = file;
        try {
          fileToUpload = await compressImage(file);
        } catch (compErr) {
          console.warn("Client-side image compression fallback:", compErr);
        }

        const formData = new FormData();
        formData.append('file', fileToUpload);
        formData.append('uploadPath', 'marketplace/furniture');

        const res = await fetch('/api/upload', {
          method: 'POST',
          headers,
          body: formData,
        });

        const data = await res.json();
        const uploadedUrl = data.url || data.fileUrl;
        if (data.success && uploadedUrl) {
          setPhotos(prev => [...prev, uploadedUrl]);
        } else {
          toast({
            title: "Upload failed",
            description: data.error || "Failed to upload image.",
            variant: "destructive",
          });
        }
      }
    } catch (err: any) {
      console.error("Photo upload error:", err);
      toast({
        title: "Error uploading",
        description: err.message || "Network error uploading photo.",
        variant: "destructive",
      });
    } finally {
      setIsUploadingPhoto(false);
      e.target.value = '';
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const addDamageNote = () => {
    setDamageNotes(prev => [...prev, '']);
  };

  const updateDamageNote = (idx: number, val: string) => {
    setDamageNotes(prev => {
      const copy = [...prev];
      copy[idx] = val;
      return copy;
    });
  };

  const removeDamageNote = (idx: number) => {
    setDamageNotes(prev => prev.filter((_, i) => i !== idx));
  };

  const handleLocationSelected = async (loc: MarketplaceLocation) => {
    setLocation(loc);
    setIsMapOpen(false);

    try {
      localStorage.setItem('fixbroMarketplaceLocation', JSON.stringify(loc));
      sessionStorage.setItem('fixbroMarketplaceLocation', JSON.stringify(loc));
    } catch {}

    if (user?.uid && user.uid !== 'guest') {
      try {
        await saveUserMarketplaceLocationAction(user.uid, loc);
      } catch {}
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast({ title: "Title required", description: "Please enter a title for your furniture ad.", variant: "destructive" });
      return;
    }

    if (photos.length === 0) {
      toast({
        title: "Photos Required",
        description: "Please upload at least 1 photo of your furniture (up to 5 photos).",
        variant: "destructive",
      });
      return;
    }

    const numPrice = parseFloat(price);
    if (isNaN(numPrice) || numPrice < 0) {
      toast({ title: "Price required", description: "Please enter a valid price.", variant: "destructive" });
      return;
    }

    if (!location || !location.latitude || !location.longitude) {
      toast({ title: "Location required", description: "Please select your location on the map.", variant: "destructive" });
      setIsMapOpen(true);
      return;
    }

    if (!phone.trim()) {
      toast({ title: "Phone number required", description: "Please enter your contact number so buyers can call you.", variant: "destructive" });
      return;
    }

    if (!user) {
      toast({
        title: "Login Required",
        description: "Please login to publish your furniture ad.",
        variant: "destructive",
      });
      router.push('/auth/login?redirect=/furniture/post');
      return;
    }

    setIsSubmitting(true);
    try {
      const filteredDamage = hasDamage ? damageNotes.map(s => s.trim()).filter(Boolean) : [];

      const result = await createFurnitureListingAction({
        userId: user.uid,
        userName: sellerName.trim() || user.displayName || 'FixBro User',
        userPhone: phone.trim(),
        userEmail: user.email || undefined,
        listingType,
        category,
        title: title.trim(),
        description: description.trim(),
        photos,
        hasDamage,
        damageDetails: filteredDamage,
        hasWarranty,
        warrantyDetails: hasWarranty ? warrantyDetails.trim() : undefined,
        price: numPrice,
        isNegotiable,
        address: location.address,
        area: location.area || 'Selected Area',
        latitude: location.latitude,
        longitude: location.longitude,
      });

      if (result.success && result.id) {
        toast({
          title: "Ad Posted Successfully! 🎉",
          description: "Your furniture listing is now active for 30 days.",
        });
        router.push(`/furniture/${result.id}`);
      } else {
        toast({
          title: "Submission failed",
          description: result.error || "Could not publish your listing.",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-background pb-20 md:pb-12">
      <MarketplaceNavHeader
        currentLocation={location}
        onLocationChange={handleLocationSelected}
        activeSection="furniture"
      />

      <main className="max-w-3xl mx-auto px-4 py-6 sm:py-10">
        <div className="bg-white dark:bg-card border rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          {/* Header */}
          <div className="border-b pb-4">
            <div className="flex items-center gap-2.5 text-primary">
              <Armchair className="h-6 w-6" />
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                Sell Furniture – Free Ad
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              List your brand new or used furniture. Buyers will call you directly. Listing expires automatically in 30 days unless republished.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 1. Condition Selector */}
            <div className="space-y-2">
              <Label className="font-semibold text-sm">Condition of Furniture *</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setListingType('brand_new')}
                  className={`p-3.5 rounded-2xl border-2 text-center transition-all ${
                    listingType === 'brand_new'
                      ? 'border-primary bg-primary/5 text-primary font-bold shadow-sm'
                      : 'border-gray-200 dark:border-gray-800 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <span className="text-base">✨ Brand New</span>
                  <p className="text-[11px] font-normal text-muted-foreground mt-0.5">Unused, boxed, or newly made</p>
                </button>

                <button
                  type="button"
                  onClick={() => setListingType('used')}
                  className={`p-3.5 rounded-2xl border-2 text-center transition-all ${
                    listingType === 'used'
                      ? 'border-primary bg-primary/5 text-primary font-bold shadow-sm'
                      : 'border-gray-200 dark:border-gray-800 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <span className="text-base">🛋️ Pre-Owned / Used</span>
                  <p className="text-[11px] font-normal text-muted-foreground mt-0.5">Used in good or fair condition</p>
                </button>
              </div>
            </div>

            {/* 2. Category Modal Select (Matching Image 3) */}
            <MarketplaceModalSelect
              label="Furniture Category"
              modalTitle="Select Furniture Category"
              modalDescription="Search and select the category for your furniture listing."
              placeholder="Search and select furniture category..."
              searchPlaceholder="Type to search (e.g. Sofa, Bed, Table)..."
              value={category}
              onChange={(val) => setCategory(val as FurnitureCategory)}
              options={FURNITURE_CATEGORIES.map((cat) => ({
                id: cat.id,
                label: cat.label,
                icon: <Armchair className="h-4 w-4" />,
              }))}
              required
            />

            {/* 3. Title */}
            <div className="space-y-2">
              <Label htmlFor="title" className="font-semibold text-sm">Ad Title *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. 3-Seater L-Shape Wooden Sofa in Excellent Condition"
                maxLength={90}
                required
                className="rounded-xl h-11"
              />
              <p className="text-[11px] text-muted-foreground text-right">{title.length}/90</p>
            </div>

            {/* 4. Photos (Compulsory 1 to 5 photos) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="font-semibold text-sm">
                  Upload Photos (1 to 5 photos required) <span className="text-red-500">*</span>
                </Label>
                <span className="text-xs text-muted-foreground font-medium">{photos.length}/5 uploaded</span>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                {photos.map((url, idx) => (
                  <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden border bg-gray-100 group shadow-sm">
                    <img src={url} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removePhoto(idx)}
                      className="absolute top-1.5 right-1.5 p-1 bg-red-600 text-white rounded-full opacity-90 hover:opacity-100 shadow transition-opacity"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                    {idx === 0 && (
                      <span className="absolute bottom-1.5 left-1.5 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded-md font-medium">
                        Cover
                      </span>
                    )}
                  </div>
                ))}

                {photos.length < 5 && (
                  <label className="aspect-square rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-primary flex flex-col items-center justify-center cursor-pointer transition-colors text-center p-2 bg-gray-50/50 dark:bg-muted/30">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handlePhotoUpload}
                      disabled={isUploadingPhoto}
                      className="hidden"
                    />
                    {isUploadingPhoto ? (
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    ) : (
                      <>
                        <Upload className="h-6 w-6 text-gray-400 group-hover:text-primary mb-1" />
                        <span className="text-[11px] font-medium text-gray-600 dark:text-gray-300">Add Photo</span>
                      </>
                    )}
                  </label>
                )}
              </div>
            </div>

            {/* 5. Description */}
            <div className="space-y-2">
              <Label htmlFor="description" className="font-semibold text-sm">Description & Dimensions</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Mention details like material (teak, sheesham, metal), size/dimensions, age, reasons for selling, etc."
                rows={4}
                className="rounded-xl"
              />
            </div>

            {/* 6. Any Damage? (Dynamic details list) */}
            <div className="space-y-3 p-4 rounded-2xl border bg-gray-50/60 dark:bg-muted/20">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-semibold text-sm">Is there any defect or damage?</Label>
                  <p className="text-[11px] text-muted-foreground">Honest defect disclosure helps buyers trust you</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setHasDamage(false)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                      !hasDamage ? 'bg-primary text-white' : 'bg-gray-200 dark:bg-muted text-gray-700'
                    }`}
                  >
                    No Damage
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setHasDamage(true);
                      if (damageNotes.length === 0) setDamageNotes(['']);
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                      hasDamage ? 'bg-amber-600 text-white' : 'bg-gray-200 dark:bg-muted text-gray-700'
                    }`}
                  >
                    Yes, Has Defects
                  </button>
                </div>
              </div>

              {hasDamage && (
                <div className="space-y-2 pt-2 border-t">
                  <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
                    Add specific defects (scratches, loose hinge, broken fabric, etc.):
                  </p>
                  {damageNotes.map((note, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Input
                        value={note}
                        onChange={(e) => updateDamageNote(idx, e.target.value)}
                        placeholder={`Defect #${idx + 1} details...`}
                        className="rounded-xl h-9 text-xs"
                      />
                      {damageNotes.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeDamageNote(idx)}
                          className="p-2 text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addDamageNote}
                    className="text-xs rounded-xl flex items-center gap-1.5 mt-1"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Another Defect Item
                  </Button>
                </div>
              )}
            </div>

            {/* 7. Bill or Warranty Available */}
            <div className="space-y-3 p-4 rounded-2xl border bg-gray-50/60 dark:bg-muted/20">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-semibold text-sm">Original Bill or Warranty Available?</Label>
                  <p className="text-[11px] text-muted-foreground">e.g. 5-year mattress or Godrej warranty</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setHasWarranty(false)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                      !hasWarranty ? 'bg-primary text-white' : 'bg-gray-200 dark:bg-muted text-gray-700'
                    }`}
                  >
                    No
                  </button>
                  <button
                    type="button"
                    onClick={() => setHasWarranty(true)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                      hasWarranty ? 'bg-green-600 text-white' : 'bg-gray-200 dark:bg-muted text-gray-700'
                    }`}
                  >
                    Yes
                  </button>
                </div>
              </div>

              {hasWarranty && (
                <div className="pt-2 border-t">
                  <Input
                    value={warrantyDetails}
                    onChange={(e) => setWarrantyDetails(e.target.value)}
                    placeholder="e.g. 2 years warranty remaining with original Urban Ladder invoice"
                    className="rounded-xl h-10 text-xs"
                  />
                </div>
              )}
            </div>

            {/* 8. Price & Negotiable */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price" className="font-semibold text-sm">Expected Price (₹) *</Label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 font-bold">₹</span>
                  <Input
                    id="price"
                    type="number"
                    min="0"
                    step="50"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="e.g. 12000"
                    required
                    className="rounded-xl h-11 pl-8 font-semibold text-base"
                  />
                </div>
              </div>

              <div className="flex items-center pt-6">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isNegotiable}
                    onChange={(e) => setIsNegotiable(e.target.checked)}
                    className="h-4 w-4 rounded text-primary focus:ring-primary"
                  />
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                    Price is slightly negotiable
                  </span>
                </label>
              </div>
            </div>

            {/* 9. Location (Dedicated Map Selector) */}
            <div className="space-y-2">
              <Label className="font-semibold text-sm">Pickup Location & Area *</Label>
              <div className="p-3.5 border rounded-2xl flex items-center justify-between gap-3 bg-gray-50/50 dark:bg-muted/30">
                <div className="flex items-start gap-2.5 min-w-0">
                  <MapPin className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-gray-900 dark:text-white truncate">
                      {location?.area || 'No location selected'}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {location?.address || 'Click button to choose pin on map'}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsMapOpen(true)}
                  className="rounded-xl shrink-0 text-xs font-semibold"
                >
                  {location ? 'Change Map Pin' : 'Select on Map'}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Your location will be saved to your profile so future visits will remember it automatically.
              </p>
            </div>

            {/* 10. Contact Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl border bg-blue-50/40 dark:bg-blue-950/20">
              <div className="space-y-1.5">
                <Label htmlFor="sellerName" className="font-semibold text-xs">Your Name</Label>
                <Input
                  id="sellerName"
                  value={sellerName}
                  onChange={(e) => setSellerName(e.target.value)}
                  placeholder="Your Name"
                  className="rounded-xl h-10 text-xs bg-white dark:bg-card"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="phone" className="font-semibold text-xs">Direct Call Phone Number *</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="10-digit mobile number"
                  required
                  className="rounded-xl h-10 text-xs bg-white dark:bg-card font-medium"
                />
              </div>
              <p className="text-[11px] text-gray-600 dark:text-gray-400 sm:col-span-2">
                📞 Interested buyers will call this number directly after agreeing to inspect in person.
              </p>
            </div>

            {/* Action Buttons: Preview & Submit */}
            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsPreviewOpen(true)}
                  className="h-12 rounded-2xl text-base font-bold border-2 border-primary/30 text-primary hover:bg-primary hover:text-white transition-all flex items-center justify-center gap-2"
                >
                  <Eye className="h-5 w-5" />
                  Preview Ad
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting || isUploadingPhoto}
                  className="h-12 rounded-2xl text-base font-bold bg-primary hover:bg-primary/90 text-white shadow-lg flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Publishing Ad...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-5 w-5" />
                      Publish Free Ad
                    </>
                  )}
                </Button>
              </div>
              <p className="text-center text-xs font-semibold text-red-600 dark:text-red-400">
                (Active for 30 Days)
              </p>
            </div>
          </form>
        </div>
      </main>

      <MarketplaceBottomNav activeTab="furniture" />

      {/* Live Preview Modal */}
      <MarketplacePreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        type="furniture"
        data={{
          title,
          description,
          price,
          photos,
          location,
          sellerName,
          phone,
          listingType,
          category,
          hasWarranty,
          warrantyDetails,
          hasDamage,
          damageDetails: damageNotes.filter((d) => d.trim() !== ''),
        }}
      />

      {/* Standalone Map Selector Dialog */}
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
              Pinpoint Furniture Pickup Location
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Search or drag the pin to your exact building or area.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 w-full overflow-hidden flex flex-col">
            {appConfig.googleMapsApiKey ? (
              <MarketplaceMapSelector
                apiKey={appConfig.googleMapsApiKey}
                onLocationSelect={handleLocationSelected}
                onClose={() => setIsMapOpen(false)}
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
