"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
  ChevronLeft,
  Save,
  Eye,
} from 'lucide-react';
import { MarketplacePreviewModal } from '@/components/marketplace/MarketplacePreviewModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import {
  FURNITURE_CATEGORIES,
  type FurnitureCategory,
  type FurnitureCondition,
  type FurnitureListing,
  type MarketplaceLocation,
} from '@/types/marketplace';
import dynamic from 'next/dynamic';
import {
  getFurnitureListingByIdAction,
  updateFurnitureListingAction,
} from '@/app/actions/furnitureActions';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useApplicationConfig } from '@/hooks/useApplicationConfig';
import MarketplaceModalSelect from '@/components/marketplace/MarketplaceModalSelect';
import { compressImage } from '@/lib/imageCompressor';
import Link from 'next/link';

const MarketplaceMapSelector = dynamic(
  () => import('@/components/marketplace/MarketplaceMapSelector'),
  { ssr: false }
);

export default function EditFurniturePage() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();
  const { user, firestoreUser, isLoading: isLoadingAuth } = useAuth();
  const { config: appConfig } = useApplicationConfig();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Form State
  const [listingType, setListingType] = useState<FurnitureCondition>('used');
  const [category, setCategory] = useState<FurnitureCategory>('sofas');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [isNegotiable, setIsNegotiable] = useState(true);
  const [photos, setPhotos] = useState<string[]>([]);
  const [hasDamage, setHasDamage] = useState(false);
  const [damageNotes, setDamageNotes] = useState<string[]>([]);
  const [hasWarranty, setHasWarranty] = useState(false);
  const [warrantyDetails, setWarrantyDetails] = useState('');
  const [location, setLocation] = useState<MarketplaceLocation | null>(null);
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [phone, setPhone] = useState('');
  const [sellerName, setSellerName] = useState('');

  // Load existing listing
  useEffect(() => {
    async function loadItem() {
      if (!id) return;
      setIsLoading(true);
      try {
        const item = await getFurnitureListingByIdAction(id);
        if (!item) {
          toast({
            title: "Not Found",
            description: "Listing not found or has been removed.",
            variant: "destructive",
          });
          router.push('/marketplace/my-posts');
          return;
        }

        // Check ownership
        if (user && user.uid !== item.userId && !firestoreUser?.roles?.includes('admin')) {
          toast({
            title: "Unauthorized",
            description: "You do not have permission to edit this listing.",
            variant: "destructive",
          });
          router.push('/marketplace/my-posts');
          return;
        }

        setListingType(item.listingType || 'used');
        setCategory((item.category as FurnitureCategory) || 'sofas');
        setTitle(item.title || '');
        setDescription(item.description || '');
        setPrice(item.price ? item.price.toString() : '');
        setIsNegotiable(item.isNegotiable ?? true);
        setPhotos(item.photos || []);
        setHasDamage(item.hasDamage || false);
        setDamageNotes(item.damageDetails || []);
        setHasWarranty(item.hasWarranty || false);
        setWarrantyDetails(item.warrantyDetails || '');
        setPhone(item.userPhone || '');
        setSellerName(item.userName || '');
        if (item.latitude && item.longitude) {
          setLocation({
            latitude: item.latitude,
            longitude: item.longitude,
            address: item.address,
            area: item.area,
          });
        }
      } catch (err) {
        console.error("Error loading listing for edit:", err);
      } finally {
        setIsLoading(false);
      }
    }

    if (!isLoadingAuth) {
      if (!user) {
        router.push(`/auth/login?redirect=/furniture/edit/${id}`);
      } else {
        loadItem();
      }
    }
  }, [id, user, isLoadingAuth, firestoreUser, router, toast]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (!user) {
      toast({
        title: "Login Required",
        description: "Please login to upload photos.",
        variant: "destructive",
      });
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
          setPhotos((prev) => [...prev, uploadedUrl]);
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
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const addDamageNote = () => {
    setDamageNotes((prev) => [...prev, '']);
  };

  const updateDamageNote = (idx: number, val: string) => {
    setDamageNotes((prev) => {
      const copy = [...prev];
      copy[idx] = val;
      return copy;
    });
  };

  const removeDamageNote = (idx: number) => {
    setDamageNotes((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleLocationSelected = (loc: MarketplaceLocation) => {
    setLocation(loc);
    setIsMapOpen(false);
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
      toast({ title: "Phone number required", description: "Please enter your contact number.", variant: "destructive" });
      return;
    }

    if (!user) return;

    setIsSubmitting(true);
    try {
      const filteredDamage = hasDamage ? damageNotes.map(s => s.trim()).filter(Boolean) : [];

      const result = await updateFurnitureListingAction(
        id,
        user.uid,
        {
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
          latitude: location.latitude,
          longitude: location.longitude,
          address: location.address,
          area: location.area,
        },
        !!firestoreUser?.roles?.includes('admin')
      );

      if (result.success) {
        toast({
          title: "Ad Updated Successfully! ✅",
          description: "Your furniture listing changes have been saved.",
        });
        router.push('/marketplace/my-posts');
      } else {
        toast({
          title: "Failed to update ad",
          description: result.error || "An error occurred while updating.",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to update listing.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading || isLoadingAuth) {
    return (
      <div className="min-h-screen bg-gray-50/50 dark:bg-background">
        <MarketplaceNavHeader activeSection="furniture" />
        <div className="py-24 flex flex-col items-center justify-center space-y-3">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading listing for edit...</p>
        </div>
      </div>
    );
  }

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
          <div className="border-b pb-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2.5 text-primary">
                <Armchair className="h-6 w-6" />
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                  Edit Furniture Ad
                </h1>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                Update your furniture details, price, condition, or photos.
              </p>
            </div>
            <Link href="/marketplace/my-posts">
              <Button variant="outline" size="sm" className="rounded-xl text-xs gap-1">
                <ChevronLeft className="h-4 w-4" />
                Back
              </Button>
            </Link>
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
                        <Upload className="h-6 w-6 text-gray-400 mb-1" />
                        <span className="text-[11px] font-medium text-gray-600 dark:text-gray-300">Add Photo</span>
                        <span className="text-[9px] text-muted-foreground mt-0.5">Up to 100MB</span>
                      </>
                    )}
                  </label>
                )}
              </div>
            </div>

            {/* 5. Price & Negotiable */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price" className="font-semibold text-sm">Selling Price (₹) *</Label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 font-bold">₹</span>
                  <Input
                    id="price"
                    type="number"
                    min="0"
                    step="50"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="e.g. 8500"
                    required
                    className="rounded-xl h-11 pl-8 font-semibold text-base"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-3 pt-6">
                <input
                  type="checkbox"
                  id="negotiable"
                  checked={isNegotiable}
                  onChange={(e) => setIsNegotiable(e.target.checked)}
                  className="h-4 w-4 rounded text-primary focus:ring-primary border-gray-300"
                />
                <Label htmlFor="negotiable" className="font-medium text-xs sm:text-sm cursor-pointer">
                  Price is negotiable
                </Label>
              </div>
            </div>

            {/* 6. Description */}
            <div className="space-y-2">
              <Label htmlFor="description" className="font-semibold text-sm">Description & Dimensions</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe material (e.g. Sheesham wood), dimensions (L x W x H), years used, reason for selling..."
                rows={4}
                className="rounded-2xl resize-none text-xs sm:text-sm"
              />
            </div>

            {/* 7. Damage & Defects */}
            <div className="space-y-3 p-4 rounded-2xl border bg-gray-50/50 dark:bg-muted/20">
              <div className="flex items-center justify-between">
                <Label htmlFor="damageToggle" className="font-semibold text-sm cursor-pointer">
                  Does this item have any visible scratches, tears, or defects?
                </Label>
                <input
                  type="checkbox"
                  id="damageToggle"
                  checked={hasDamage}
                  onChange={(e) => setHasDamage(e.target.checked)}
                  className="h-4 w-4 rounded text-primary focus:ring-primary"
                />
              </div>

              {hasDamage && (
                <div className="space-y-2 pt-2 border-t">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground">List Known Defects</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addDamageNote}
                      className="rounded-xl text-xs h-7 px-2 gap-1"
                    >
                      <Plus className="h-3 w-3" />
                      Add Note
                    </Button>
                  </div>

                  {damageNotes.map((note, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Input
                        value={note}
                        onChange={(e) => updateDamageNote(idx, e.target.value)}
                        placeholder="e.g. Small scratch on right armrest"
                        className="rounded-xl h-9 text-xs bg-white dark:bg-card"
                      />
                      <button
                        type="button"
                        onClick={() => removeDamageNote(idx)}
                        className="p-1.5 text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 8. Warranty */}
            <div className="space-y-3 p-4 rounded-2xl border bg-gray-50/50 dark:bg-muted/20">
              <div className="flex items-center justify-between">
                <Label htmlFor="warrantyToggle" className="font-semibold text-sm cursor-pointer">
                  Is there any active brand/manufacturer warranty remaining?
                </Label>
                <input
                  type="checkbox"
                  id="warrantyToggle"
                  checked={hasWarranty}
                  onChange={(e) => setHasWarranty(e.target.checked)}
                  className="h-4 w-4 rounded text-primary focus:ring-primary"
                />
              </div>

              {hasWarranty && (
                <div className="pt-2 border-t space-y-1.5">
                  <Label htmlFor="warrantyDetails" className="text-xs font-semibold text-muted-foreground">
                    Warranty Info & Bill Availability
                  </Label>
                  <Input
                    id="warrantyDetails"
                    value={warrantyDetails}
                    onChange={(e) => setWarrantyDetails(e.target.value)}
                    placeholder="e.g. 2 years foam warranty left, original invoice available"
                    className="rounded-xl h-9 text-xs bg-white dark:bg-card"
                  />
                </div>
              )}
            </div>

            {/* 9. Location Pin */}
            <div className="space-y-2">
              <Label className="font-semibold text-sm">Item Pickup Location *</Label>
              <div className="p-4 rounded-2xl border bg-gray-50/70 dark:bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <p className="font-semibold text-sm text-gray-900 dark:text-white flex items-center gap-1.5">
                    <MapPin className="h-4 w-4 text-primary shrink-0" />
                    <span>{location?.area || location?.address || 'No location selected'}</span>
                  </p>
                  <p className="text-xs text-muted-foreground truncate max-w-md">
                    {location?.address || 'Pin where buyers can inspect & collect the furniture.'}
                  </p>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsMapOpen(true)}
                  className="rounded-xl text-xs font-semibold shrink-0"
                >
                  {location ? 'Change Location' : 'Select on Map'}
                </Button>
              </div>
            </div>

            {/* 10. Contact Information */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="sellerName" className="font-semibold text-sm">Your Name</Label>
                <Input
                  id="sellerName"
                  value={sellerName}
                  onChange={(e) => setSellerName(e.target.value)}
                  placeholder="Your Name"
                  className="rounded-xl h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="font-semibold text-sm">Contact Mobile Number *</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 9876543210"
                  required
                  className="rounded-xl h-11"
                />
              </div>
            </div>

            {/* Action Buttons: Preview & Submit */}
            <div className="pt-4 border-t space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsPreviewOpen(true)}
                  className="h-12 rounded-2xl text-base font-bold border-2 border-primary/30 text-primary hover:bg-primary hover:text-white transition-all flex items-center justify-center gap-2"
                >
                  <Eye className="h-5 w-5" />
                  Preview Changes
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting || isUploadingPhoto}
                  className="h-12 rounded-2xl text-base font-bold bg-primary hover:bg-primary/90 text-white shadow-lg flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Saving Changes...
                    </>
                  ) : (
                    <>
                      <Save className="h-5 w-5" />
                      Save & Update Ad
                    </>
                  )}
                </Button>
              </div>
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

      {/* Map Selector Dialog */}
      <Dialog open={isMapOpen} onOpenChange={setIsMapOpen}>
        <DialogContent className="max-w-4xl p-0 h-[85vh] sm:h-[80vh] flex flex-col rounded-3xl overflow-hidden">
          <DialogHeader className="p-4 border-b flex-shrink-0">
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              Pin Furniture Pickup Location
            </DialogTitle>
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
