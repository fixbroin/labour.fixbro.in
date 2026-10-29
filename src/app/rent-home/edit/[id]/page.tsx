"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import MarketplaceNavHeader from '@/components/marketplace/MarketplaceNavHeader';
import MarketplaceBottomNav from '@/components/marketplace/MarketplaceBottomNav';
import {
  Home,
  Upload,
  X,
  Plus,
  Trash2,
  MapPin,
  CheckCircle,
  AlertCircle,
  Loader2,
  ChevronLeft,
  Save,
  Check,
  Eye,
} from 'lucide-react';
import { MarketplacePreviewModal } from '@/components/marketplace/MarketplacePreviewModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import {
  RENTAL_PROPERTY_TYPES,
  FURNISHING_OPTIONS,
  TENANT_PREFERENCES,
  RENTAL_AMENITIES,
  BILLS_INCLUDED_OPTIONS,
  type RentalPropertyType,
  type FurnishingStatus,
  type TenantPreference,
  type GasFacility,
  type RentalListing,
  type MarketplaceLocation,
} from '@/types/marketplace';
import dynamic from 'next/dynamic';
import {
  getRentalListingByIdAction,
  updateRentalListingAction,
} from '@/app/actions/rentalActions';
import MarketplaceModalSelect from '@/components/marketplace/MarketplaceModalSelect';
import { compressImage } from '@/lib/imageCompressor';
import { useApplicationConfig } from '@/hooks/useApplicationConfig';
import Link from 'next/link';

const MarketplaceMapSelector = dynamic(
  () => import('@/components/marketplace/MarketplaceMapSelector'),
  { ssr: false }
);

export default function EditRentalPropertyPage() {
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
  const [propertyType, setPropertyType] = useState<RentalPropertyType>('2bhk');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [monthlyRent, setMonthlyRent] = useState('');
  const [deposit, setDeposit] = useState('');
  const [bedrooms, setBedrooms] = useState<number>(2);
  const [bathrooms, setBathrooms] = useState<number>(2);
  const [furnishing, setFurnishing] = useState<FurnishingStatus>('semi_furnished');
  const [floor, setFloor] = useState('2nd');
  const [totalFloors, setTotalFloors] = useState('4');
  const [availableFrom, setAvailableFrom] = useState('');
  const [tenantPreference, setTenantPreference] = useState<TenantPreference>('any');
  const [gasFacility, setGasFacility] = useState<GasFacility>('piped_gas');
  const [amenities, setAmenities] = useState<string[]>([]);
  const [billsIncluded, setBillsIncluded] = useState<string[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [location, setLocation] = useState<MarketplaceLocation | null>(null);
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [phone, setPhone] = useState('');
  const [userName, setUserName] = useState('');

  // Load existing rental listing
  useEffect(() => {
    async function loadItem() {
      if (!id) return;
      setIsLoading(true);
      try {
        const item = await getRentalListingByIdAction(id);
        if (!item) {
          toast({
            title: "Not Found",
            description: "Rental property not found or has expired.",
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

        setPropertyType(item.propertyType || '2bhk');
        setTitle(item.title || '');
        setDescription(item.description || '');
        setMonthlyRent(item.monthlyRent ? item.monthlyRent.toString() : '');
        setDeposit(item.deposit ? item.deposit.toString() : '');
        setBedrooms(item.bedrooms ?? 2);
        setBathrooms(item.bathrooms ?? 2);
        setFurnishing(item.furnishing || 'semi_furnished');
        setFloor(String(item.floor || ''));
        setTotalFloors(String(item.totalFloors || ''));
        setAvailableFrom(item.availableFrom || '');
        setTenantPreference(item.tenantPreference || 'any');
        setGasFacility(item.gasFacility || 'piped_gas');
        setAmenities(item.amenities || []);
        setBillsIncluded(item.billsIncluded || []);
        setPhotos(item.photos || []);
        setPhone(item.userPhone || '');
        setUserName(item.userName || '');
        if (item.latitude && item.longitude) {
          setLocation({
            latitude: item.latitude,
            longitude: item.longitude,
            address: item.address,
            area: item.area,
          });
        }
      } catch (err) {
        console.error("Error loading rental for edit:", err);
      } finally {
        setIsLoading(false);
      }
    }

    if (!isLoadingAuth) {
      if (!user) {
        router.push(`/auth/login?redirect=/rent-home/edit/${id}`);
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
        description: "You can upload up to 5 photos.",
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
        formData.append('uploadPath', 'marketplace/rentals');

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
      toast({
        title: "Error uploading",
        description: err.message || "Failed to upload photo.",
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

  const toggleAmenity = (id: string) => {
    setAmenities((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleBillIncluded = (id: string) => {
    setBillsIncluded((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleLocationSelected = (loc: MarketplaceLocation) => {
    setLocation(loc);
    setIsMapOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast({ title: "Title required", description: "Please enter property title.", variant: "destructive" });
      return;
    }

    if (photos.length === 0) {
      toast({
        title: "Photos Required",
        description: "Please upload at least 1 photo of the rental property (up to 5 photos).",
        variant: "destructive",
      });
      return;
    }

    const rentNum = parseFloat(monthlyRent);
    if (isNaN(rentNum) || rentNum < 0) {
      toast({ title: "Rent required", description: "Please enter valid monthly rent.", variant: "destructive" });
      return;
    }

    const depositNum = deposit ? parseFloat(deposit) : rentNum * 2;

    if (!location || !location.latitude || !location.longitude) {
      toast({ title: "Location required", description: "Please pin property location on the map.", variant: "destructive" });
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
      const result = await updateRentalListingAction(
        id,
        user.uid,
        {
          userName: userName.trim() || user.displayName || 'FixBro User',
          userPhone: phone.trim(),
          userEmail: user.email || undefined,
          propertyType,
          title: title.trim(),
          description: description.trim(),
          monthlyRent: rentNum,
          deposit: depositNum,
          bedrooms,
          bathrooms,
          furnishing,
          floor: floor.trim(),
          totalFloors: totalFloors.trim(),
          availableFrom: availableFrom.trim(),
          tenantPreference,
          gasFacility,
          amenities,
          billsIncluded,
          photos,
          latitude: location.latitude,
          longitude: location.longitude,
          address: location.address,
          area: location.area,
        },
        !!firestoreUser?.roles?.includes('admin')
      );

      if (result.success) {
        toast({
          title: "Rental Ad Updated! ✅",
          description: "Your rental listing changes have been saved.",
        });
        router.push('/marketplace/my-posts');
      } else {
        toast({
          title: "Failed to update",
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
        <MarketplaceNavHeader activeSection="rentals" />
        <div className="py-24 flex flex-col items-center justify-center space-y-3">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading rental listing for edit...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-background pb-20 md:pb-12">
      <MarketplaceNavHeader
        currentLocation={location}
        onLocationChange={handleLocationSelected}
        activeSection="rentals"
      />

      <main className="max-w-3xl mx-auto px-4 py-6 sm:py-10">
        <div className="bg-white dark:bg-card border rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="border-b pb-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2.5 text-primary">
                <Home className="h-6 w-6" />
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                  Edit Rental Property Ad
                </h1>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                Update your rental property details, rent, photos, or amenities.
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
            {/* 1. Property Type Modal Select (Matching Image 3) */}
            <MarketplaceModalSelect
              label="Property Type"
              modalTitle="Select Property Type"
              modalDescription="Choose the category of property or room you want to rent."
              placeholder="Search and select property type..."
              searchPlaceholder="Type BHK or property type (e.g. 1 BHK, 2 BHK, Villa)..."
              value={propertyType}
              onChange={(val) => setPropertyType(val as RentalPropertyType)}
              options={RENTAL_PROPERTY_TYPES.map((t) => ({
                id: t.id,
                label: t.label,
                icon: <Home className="h-4 w-4" />,
              }))}
              required
            />

            {/* 2. Title */}
            <div className="space-y-2">
              <Label htmlFor="title" className="font-semibold text-sm">Property Title *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Spacious Semi-Furnished 2BHK Flat with Car Parking near Metro"
                maxLength={100}
                required
                className="rounded-xl h-11"
              />
              <p className="text-[11px] text-muted-foreground text-right">{title.length}/100</p>
            </div>

            {/* 3. Photos (Compulsory 1 to 5 photos) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="font-semibold text-sm">
                  Upload Photos (1 to 5 photos required) <span className="text-red-500">*</span>
                </Label>
                <span className="text-xs text-muted-foreground font-medium">{photos.length}/5 uploaded</span>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                {photos.map((url, idx) => (
                  <div key={idx} className="relative aspect-video rounded-2xl overflow-hidden border bg-gray-100 group shadow-sm">
                    <img src={url} alt={`Property Photo ${idx + 1}`} className="w-full h-full object-cover" />
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
                  <label className="aspect-video rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-primary flex flex-col items-center justify-center cursor-pointer transition-colors text-center p-2 bg-gray-50/50 dark:bg-muted/30">
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
                        <span className="text-[11px] font-medium text-gray-600 dark:text-gray-300">Add Photos</span>
                        <span className="text-[9px] text-muted-foreground mt-0.5">Up to 100MB</span>
                      </>
                    )}
                  </label>
                )}
              </div>
            </div>

            {/* 4. Rent & Deposit */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="monthlyRent" className="font-semibold text-sm">Monthly Rent (₹) *</Label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 font-bold">₹</span>
                  <Input
                    id="monthlyRent"
                    type="number"
                    min="0"
                    step="500"
                    value={monthlyRent}
                    onChange={(e) => setMonthlyRent(e.target.value)}
                    placeholder="e.g. 18000"
                    required
                    className="rounded-xl h-11 pl-8 font-semibold text-base"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="deposit" className="font-semibold text-sm">Security Deposit (₹)</Label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 font-bold">₹</span>
                  <Input
                    id="deposit"
                    type="number"
                    min="0"
                    step="1000"
                    value={deposit}
                    onChange={(e) => setDeposit(e.target.value)}
                    placeholder="e.g. 50000"
                    className="rounded-xl h-11 pl-8 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* 5. Bedrooms, Bathrooms, Furnishing */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bedrooms" className="font-semibold text-sm">Bedrooms</Label>
                <Input
                  id="bedrooms"
                  type="number"
                  min="0"
                  max="10"
                  value={bedrooms}
                  onChange={(e) => setBedrooms(parseInt(e.target.value) || 0)}
                  className="rounded-xl h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bathrooms" className="font-semibold text-sm">Bathrooms</Label>
                <Input
                  id="bathrooms"
                  type="number"
                  min="1"
                  max="10"
                  value={bathrooms}
                  onChange={(e) => setBathrooms(parseInt(e.target.value) || 1)}
                  className="rounded-xl h-11"
                />
              </div>

              <div>
                <MarketplaceModalSelect
                  label="Furnishing Status"
                  modalTitle="Select Furnishing Status"
                  modalDescription="Choose whether the home is fully furnished, semi-furnished, or unfurnished."
                  placeholder="Select Furnishing"
                  searchPlaceholder="Search furnishing status..."
                  value={furnishing}
                  onChange={(val) => setFurnishing(val as FurnishingStatus)}
                  options={FURNISHING_OPTIONS.map((opt) => ({
                    id: opt.id,
                    label: opt.label,
                  }))}
                  required
                />
              </div>
            </div>

            {/* 6. Floor, Total Floors, Available From, Tenants */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="floor" className="font-semibold text-xs">Floor</Label>
                <Input
                  id="floor"
                  value={floor}
                  onChange={(e) => setFloor(e.target.value)}
                  placeholder="e.g. 2nd"
                  className="rounded-xl h-10 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="totalFloors" className="font-semibold text-xs">Total Floors</Label>
                <Input
                  id="totalFloors"
                  value={totalFloors}
                  onChange={(e) => setTotalFloors(e.target.value)}
                  placeholder="e.g. 4"
                  className="rounded-xl h-10 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="availableFrom" className="font-semibold text-xs">Available From</Label>
                <Input
                  id="availableFrom"
                  type="date"
                  value={availableFrom}
                  onChange={(e) => setAvailableFrom(e.target.value)}
                  className="rounded-xl h-10 text-xs"
                />
              </div>

              <div>
                <MarketplaceModalSelect
                  label="Tenant Preference"
                  modalTitle="Select Tenant Preference"
                  modalDescription="Select preferred tenant type (Family, Bachelors, Any)."
                  placeholder="Select Tenant"
                  searchPlaceholder="Search tenant preference..."
                  value={tenantPreference}
                  onChange={(val) => setTenantPreference(val as TenantPreference)}
                  options={TENANT_PREFERENCES.map((p) => ({
                    id: p.id,
                    label: p.label,
                  }))}
                />
              </div>

              <div>
                <MarketplaceModalSelect
                  label="Gas Facility"
                  modalTitle="Select Gas Facility"
                  modalDescription="Select cooking gas source available at the property."
                  placeholder="Select Gas Connection"
                  searchPlaceholder="Search gas facility..."
                  value={gasFacility}
                  onChange={(val) => setGasFacility(val as GasFacility)}
                  options={[
                    { id: 'piped_gas', label: 'Piped Natural Gas (PNG)', description: 'Direct pipeline connection' },
                    { id: 'cylinder', label: 'LPG Gas Cylinder', description: 'Cylinder provided / slot available' },
                    { id: 'none', label: 'No Gas Connection', description: 'Tenant arranges or induction only' },
                  ]}
                />
              </div>
            </div>

            {/* 7. Amenities Checklist */}
            <div className="space-y-2 p-4 rounded-2xl border bg-gray-50/50 dark:bg-muted/20">
              <Label className="font-semibold text-sm">Amenities & Facilities</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
                {RENTAL_AMENITIES.map((item) => {
                  const isChecked = amenities.includes(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => toggleAmenity(item.id)}
                      className={`flex items-center gap-2 p-2.5 rounded-xl border text-left text-xs transition-all ${
                        isChecked
                          ? 'border-primary bg-primary/10 text-primary font-bold shadow-sm'
                          : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-card text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-md border flex items-center justify-center ${
                        isChecked ? 'bg-primary border-primary text-white' : 'border-gray-300'
                      }`}>
                        {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
                      </div>
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 8. Bills Included */}
            <div className="space-y-2 p-4 rounded-2xl border bg-gray-50/50 dark:bg-muted/20">
              <Label className="font-semibold text-sm">Bills Included in Rent</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                {BILLS_INCLUDED_OPTIONS.map((item) => {
                  const isChecked = billsIncluded.includes(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => toggleBillIncluded(item.id)}
                      className={`flex items-center gap-2 p-2 rounded-xl border text-left text-xs transition-all ${
                        isChecked
                          ? 'border-green-600 bg-green-50 text-green-700 font-bold'
                          : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-card text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${
                        isChecked ? 'bg-green-600 border-green-600 text-white' : 'border-gray-300'
                      }`}>
                        {isChecked && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                      </div>
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 9. Description */}
            <div className="space-y-2">
              <Label htmlFor="description" className="font-semibold text-sm">Description & House Rules</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Mention distance to metro/bus stop, society amenities, water/electricity backup, restrictions (pets, non-veg), gate timings..."
                rows={4}
                className="rounded-2xl resize-none text-xs sm:text-sm"
              />
            </div>

            {/* 10. Location Pin */}
            <div className="space-y-2">
              <Label className="font-semibold text-sm">Property Location *</Label>
              <div className="p-4 rounded-2xl border bg-gray-50/70 dark:bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <p className="font-semibold text-sm text-gray-900 dark:text-white flex items-center gap-1.5">
                    <MapPin className="h-4 w-4 text-primary shrink-0" />
                    <span>{location?.area || location?.address || 'No location pinned'}</span>
                  </p>
                  <p className="text-xs text-muted-foreground truncate max-w-md">
                    {location?.address || 'Pin the building location on map.'}
                  </p>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsMapOpen(true)}
                  className="rounded-xl text-xs font-semibold shrink-0"
                >
                  {location ? 'Change Location' : 'Pin on Map'}
                </Button>
              </div>
            </div>

            {/* 11. Contact Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="userName" className="font-semibold text-sm">Your Name</Label>
                <Input
                  id="userName"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="Your Name"
                  className="rounded-xl h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="font-semibold text-sm">Direct Phone Number *</Label>
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
                      Save & Update Rental Ad
                    </>
                  )}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </main>

      <MarketplaceBottomNav activeTab="rentals" />

      {/* Live Preview Modal */}
      <MarketplacePreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        type="rental"
        data={{
          title,
          description,
          price: monthlyRent,
          deposit,
          photos,
          location,
          sellerName: userName,
          phone,
          propertyType,
          bhk: propertyType,
          furnishing,
          availableFrom,
          tenantPreference,
          amenities,
          billsIncluded,
        }}
      />

      {/* Map Selector Dialog */}
      <Dialog open={isMapOpen} onOpenChange={setIsMapOpen}>
        <DialogContent className="max-w-4xl p-0 h-[85vh] sm:h-[80vh] flex flex-col rounded-3xl overflow-hidden">
          <DialogHeader className="p-4 border-b flex-shrink-0">
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              Pin Property Location
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
