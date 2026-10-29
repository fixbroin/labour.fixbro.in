"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Home,
  Search,
  Trash2,
  ExternalLink,
  Eye,
  PhoneCall,
  CheckCircle,
  XCircle,
  Loader2,
  Pencil,
  Ban,
  ShieldAlert,
  Upload,
  X,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import { compressImage } from '@/lib/imageCompressor';
import { useToast } from '@/hooks/use-toast';
import {
  RENTAL_PROPERTY_TYPES,
  FURNISHING_OPTIONS,
  TENANT_PREFERENCES,
  type RentalListing,
  type RentalPropertyType,
  type FurnishingStatus,
  type TenantPreference,
  type MarketplaceListingStatus,
  type MarketplaceCallLog,
} from '@/types/marketplace';
import {
  getAdminRentalListingsAction,
  updateRentalStatusAction,
  updateRentalListingAction,
  deleteRentalListingAction,
} from '@/app/actions/rentalActions';
import { banMarketplaceUserAction } from '@/app/actions/furnitureActions';
import { getAdminMarketplaceCallLogsAction } from '@/app/actions/marketplaceCallActions';
import { getRentalPublicUrl } from '@/lib/marketplaceSlug';

export default function AdminRentalsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [adminTab, setAdminTab] = useState<'listings' | 'calls'>('listings');
  const [listings, setListings] = useState<RentalListing[]>([]);
  const [callLogs, setCallLogs] = useState<MarketplaceCallLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Admin In-Panel Edit State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<RentalListing | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editPropertyType, setEditPropertyType] = useState<RentalPropertyType>('1bhk');
  const [editMonthlyRent, setEditMonthlyRent] = useState('');
  const [editDeposit, setEditDeposit] = useState('');
  const [editFurnishing, setEditFurnishing] = useState<FurnishingStatus>('semi_furnished');
  const [editBedrooms, setEditBedrooms] = useState('1');
  const [editBathrooms, setEditBathrooms] = useState('1');
  const [editTenantPreference, setEditTenantPreference] = useState<TenantPreference>('any');
  const [editDescription, setEditDescription] = useState('');
  const [editArea, setEditArea] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editUserName, setEditUserName] = useState('');
  const [editUserPhone, setEditUserPhone] = useState('');
  const [editStatus, setEditStatus] = useState<MarketplaceListingStatus>('active');
  const [editPhotos, setEditPhotos] = useState<string[]>([]);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  const handleOpenEdit = (item: RentalListing) => {
    setEditingItem(item);
    setEditTitle(item.title || '');
    setEditPropertyType(item.propertyType || '1bhk');
    setEditMonthlyRent(item.monthlyRent ? item.monthlyRent.toString() : '');
    setEditDeposit(item.deposit ? item.deposit.toString() : '');
    setEditFurnishing(item.furnishing || 'semi_furnished');
    setEditBedrooms(item.bedrooms ? item.bedrooms.toString() : '1');
    setEditBathrooms(item.bathrooms ? item.bathrooms.toString() : '1');
    setEditTenantPreference(item.tenantPreference || 'any');
    setEditDescription(item.description || '');
    setEditArea(item.area || '');
    setEditAddress(item.address || '');
    setEditUserName(item.userName || '');
    setEditUserPhone(item.userPhone || '');
    setEditStatus(item.status || 'active');
    setEditPhotos(item.photos ? [...item.photos] : []);
    setIsEditModalOpen(true);
  };

  const handleRemovePhoto = (index: number) => {
    setEditPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (editPhotos.length + files.length > 5) {
      toast({
        title: "Photo limit reached",
        description: "You can upload a maximum of 5 photos.",
        variant: "destructive",
      });
      return;
    }

    setIsUploadingPhoto(true);
    try {
      const token = user ? await user.getIdToken() : '';
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.size > 100 * 1024 * 1024) {
          toast({
            title: "File too large",
            description: `${file.name} exceeds 100MB limit.`,
            variant: "destructive",
          });
          continue;
        }

        let fileToUpload = file;
        try {
          fileToUpload = await compressImage(file);
        } catch (compErr) {
          console.warn("Compression fallback:", compErr);
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
          setEditPhotos((prev) => [...prev, uploadedUrl]);
        } else {
          toast({
            title: "Upload failed",
            description: data.error || "Failed to upload image",
            variant: "destructive",
          });
        }
      }
    } catch (err: any) {
      toast({
        title: "Upload error",
        description: err?.message || "Failed to upload photo",
        variant: "destructive",
      });
    } finally {
      setIsUploadingPhoto(false);
      e.target.value = '';
    }
  };

  const handleSaveEdit = async () => {
    if (!editingItem) return;
    if (!editTitle.trim()) {
      toast({ title: "Title is required", variant: "destructive" });
      return;
    }
    const parsedRent = parseFloat(editMonthlyRent) || 0;
    if (parsedRent < 0) {
      toast({ title: "Valid monthly rent is required", variant: "destructive" });
      return;
    }

    setIsSavingEdit(true);
    try {
      const payload: Partial<RentalListing> = {
        title: editTitle.trim(),
        propertyType: editPropertyType,
        monthlyRent: parsedRent,
        deposit: parseFloat(editDeposit) || 0,
        furnishing: editFurnishing,
        bedrooms: parseInt(editBedrooms, 10) || 1,
        bathrooms: parseInt(editBathrooms, 10) || 1,
        tenantPreference: editTenantPreference,
        description: editDescription.trim(),
        area: editArea.trim(),
        address: editAddress.trim(),
        userName: editUserName.trim(),
        userPhone: editUserPhone.trim(),
        status: editStatus,
        photos: editPhotos,
      };

      const res = await updateRentalListingAction(editingItem.id, '', payload, true);
      if (res.success) {
        toast({
          title: "Rental ad updated successfully! ✨",
          description: "All changes and photo updates have been saved.",
        });
        setIsEditModalOpen(false);
        setEditingItem(null);
        await loadListings();
      } else {
        toast({
          title: "Update failed",
          description: res.error || "Failed to update listing.",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({
        title: "Error saving rental listing",
        description: err?.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsSavingEdit(false);
    }
  };

  const loadListings = async () => {
    setIsLoading(true);
    try {
      const [data, logs] = await Promise.all([
        getAdminRentalListingsAction(),
        getAdminMarketplaceCallLogsAction(),
      ]);
      setListings(data);
      setCallLogs(logs.filter((l) => l.listingType === 'rental'));
    } catch (err) {
      console.error("Error loading admin rentals:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadListings();
  }, []);

  const handleStatusChange = async (id: string, currentStatus: string, newStatus: MarketplaceListingStatus) => {
    setProcessingId(id);
    try {
      const res = await updateRentalStatusAction(id, '', newStatus, true);
      if (res.success) {
        toast({ title: `Status changed to ${newStatus}` });
        loadListings();
      } else {
        toast({ title: "Failed to update status", description: res.error, variant: "destructive" });
      }
    } finally {
      setProcessingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to permanently delete this rental listing?")) return;
    setProcessingId(id);
    try {
      const res = await deleteRentalListingAction(id, '', true);
      if (res.success) {
        toast({ title: "Rental listing deleted" });
        loadListings();
      } else {
        toast({ title: "Delete failed", description: res.error, variant: "destructive" });
      }
    } finally {
      setProcessingId(null);
    }
  };

  const handleDisapprove = async (id: string) => {
    if (!confirm("Are you sure you want to disapprove and remove this rental property ad from the public marketplace?")) return;
    setProcessingId(id);
    try {
      const res = await updateRentalStatusAction(id, '', 'removed', true);
      if (res.success) {
        toast({ title: "Rental property disapproved and removed" });
        loadListings();
      } else {
        toast({ title: "Failed to disapprove", description: res.error, variant: "destructive" });
      }
    } finally {
      setProcessingId(null);
    }
  };

  const handleBanUser = async (userId: string, userName: string) => {
    if (!userId) return;
    if (
      !confirm(
        `Are you sure you want to BAN landlord/user "${userName || 'Unknown'}"?\n\nThis will:\n1. Deactivate their user account.\n2. Disapprove and remove ALL their ads (furniture & rentals).\n3. Block them from creating any further listings.`
      )
    ) {
      return;
    }
    setIsLoading(true);
    try {
      const res = await banMarketplaceUserAction(userId, 'Banned by admin via Rental moderation');
      if (res.success) {
        toast({
          title: "User Banned Successfully 🚫",
          description: `User ${userName} has been banned and all their listings removed.`,
        });
        loadListings();
      } else {
        toast({
          title: "Ban Failed",
          description: res.error || "Could not ban user.",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const filtered = listings.filter((item) => {
    if (statusFilter !== 'all' && item.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchTitle = item.title?.toLowerCase().includes(q);
      const matchLandlord = item.userName?.toLowerCase().includes(q);
      const matchPhone = item.userPhone?.toLowerCase().includes(q);
      const matchArea = item.area?.toLowerCase().includes(q);
      if (!matchTitle && !matchLandlord && !matchPhone && !matchArea) return false;
    }
    return true;
  });

  return (
    <div className="p-2 sm:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Home className="h-6 w-6 text-primary" />
            Home Rentals Management
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            View, moderate, or remove property and room rental ads posted by landlords and users.
          </p>
        </div>

        <Link href="/rent-home/post" target="_blank">
          <Button size="sm" className="bg-primary text-white rounded-xl text-xs font-bold gap-1.5">
            + Post Sample Rental Ad
          </Button>
        </Link>
      </div>

      {/* Sub Tabs: Listings vs Call Inquiries */}
      <div className="flex items-center gap-3 border-b">
        <button
          type="button"
          onClick={() => setAdminTab('listings')}
          className={`pb-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition-all ${
            adminTab === 'listings'
              ? 'border-primary text-primary'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          Rental Properties ({listings.length})
        </button>
        <button
          type="button"
          onClick={() => setAdminTab('calls')}
          className={`pb-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-1.5 ${
            adminTab === 'calls'
              ? 'border-primary text-primary'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <PhoneCall className="h-4 w-4" />
          <span>Call Logs & Inquiries ({callLogs.length})</span>
        </button>
      </div>

      {adminTab === 'calls' ? (
        callLogs.length === 0 ? (
          <div className="p-12 text-center bg-white dark:bg-card border rounded-3xl">
            <PhoneCall className="h-8 w-8 mx-auto text-gray-400 mb-2" />
            <p className="text-sm font-semibold">No tenant call logs recorded yet.</p>
            <p className="text-xs text-muted-foreground">Every direct call attempt will record caller info here.</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-card border rounded-3xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 dark:bg-muted/40 text-gray-500 font-semibold border-b">
                  <tr>
                    <th className="p-3.5">Date & Time</th>
                    <th className="p-3.5">Caller (Tenant)</th>
                    <th className="p-3.5">Landlord</th>
                    <th className="p-3.5">Rental Property</th>
                    <th className="p-3.5 text-right">Listing Page</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {callLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50/50 dark:hover:bg-muted/20">
                      <td className="p-3.5 text-gray-500 whitespace-nowrap">
                        {log.createdAt
                          ? new Date(log.createdAt).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '—'}
                      </td>
                      <td className="p-3.5">
                        <p className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                          <PhoneCall className="h-3 w-3 text-green-600" />
                          <span>{log.callerName || 'FixBro User'}</span>
                          {log.callCount && log.callCount > 1 && (
                            <span className="text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 px-1.5 py-0.5 rounded-full border border-amber-300">
                              {log.callCount} calls
                            </span>
                          )}
                        </p>
                        {log.callerPhone ? (
                          <a href={`tel:${log.callerPhone}`} className="text-[12px] font-bold text-green-700 dark:text-green-400 hover:underline">
                            📞 {log.callerPhone}
                          </a>
                        ) : (
                          <p className="text-[11px] text-gray-400">—</p>
                        )}
                        {log.callerEmail && <p className="text-[10px] text-gray-400">{log.callerEmail}</p>}
                      </td>
                      <td className="p-3.5">
                        <p className="font-semibold text-gray-900 dark:text-white">{log.sellerName || 'Landlord'}</p>
                        <p className="text-[11px] text-gray-600">{log.sellerPhone || '—'}</p>
                      </td>
                      <td className="p-3.5">
                        <p className="font-bold text-gray-900 dark:text-white max-w-[220px] truncate">
                          {log.listingTitle}
                        </p>
                        <p className="text-[10px] text-muted-foreground">ID: {log.listingId}</p>
                      </td>
                      <td className="p-3.5 text-right">
                        <Link href={`/rent-home/${log.listingId}`} target="_blank">
                          <Button size="sm" variant="outline" className="rounded-xl text-xs gap-1">
                            <ExternalLink className="h-3 w-3" />
                            View Listing
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : (
        <>
          {/* Filters & Search */}
          <div className="bg-white dark:bg-card p-4 rounded-3xl border shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by title, landlord, phone, or area..."
                className="pl-9 rounded-xl h-10 text-xs"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto text-xs font-semibold">
              {['all', 'active', 'rented', 'expired'].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-xl border capitalize transition-all ${
                    statusFilter === st
                      ? 'bg-primary text-white border-primary shadow-sm font-bold'
                      : 'bg-white dark:bg-card text-gray-700 dark:text-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {st} ({listings.filter((x) => (st === 'all' ? true : x.status === st)).length})
                </button>
              ))}
            </div>
          </div>

      {/* Table */}
      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center space-y-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground">Loading rental listings...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-card border rounded-3xl">
          <p className="text-sm font-semibold">No rental listings found.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-card border rounded-3xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 dark:bg-muted/40 text-gray-500 font-semibold border-b">
                <tr>
                  <th className="p-3.5">Property</th>
                  <th className="p-3.5">Landlord</th>
                  <th className="p-3.5">Type</th>
                  <th className="p-3.5">Rent</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Stats</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50/50 dark:hover:bg-muted/20">
                    <td className="p-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-gray-100 overflow-hidden shrink-0 border">
                          {item.photos && item.photos[0] ? (
                            <img src={item.photos[0]} alt={item.title} className="w-full h-full object-cover" />
                          ) : (
                            <Home className="h-5 w-5 m-3.5 text-gray-400" />
                          )}
                        </div>
                        <div className="min-w-0 max-w-[200px]">
                          <p className="font-bold text-gray-900 dark:text-white truncate">{item.title}</p>
                          <p className="text-[11px] text-gray-500 truncate">{item.area}</p>
                        </div>
                      </div>
                    </td>

                    <td className="p-3.5">
                      <p className="font-semibold text-gray-900 dark:text-white">{item.userName}</p>
                      <p className="text-[11px] text-gray-500">{item.userPhone}</p>
                      {item.userEmail && <p className="text-[10px] text-gray-400">{item.userEmail}</p>}
                    </td>

                    <td className="p-3.5 font-bold uppercase tracking-wider text-blue-600">
                      {item.propertyType?.replace('_', ' ')}
                    </td>

                    <td className="p-3.5 font-bold text-primary">
                      ₹{item.monthlyRent?.toLocaleString('en-IN')}/mo
                    </td>

                    <td className="p-3.5">
                      <select
                        value={item.status}
                        onChange={(e) => handleStatusChange(item.id, item.status, e.target.value as any)}
                        disabled={processingId === item.id}
                        className={`text-xs font-bold rounded-lg px-2 py-1 border ${
                          item.status === 'active'
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : item.status === 'rented'
                            ? 'bg-gray-100 text-gray-700 border-gray-300'
                            : 'bg-red-50 text-red-700 border-red-200'
                        }`}
                      >
                        <option value="active">Active</option>
                        <option value="rented">Rented</option>
                        <option value="expired">Expired</option>
                        <option value="removed">Removed</option>
                      </select>
                    </td>

                    <td className="p-3.5 text-[11px] text-gray-500 space-y-0.5">
                      <p>👁️ {item.viewCount || 0} views</p>
                      <p>📞 {item.callCount || 0} calls</p>
                    </td>

                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link href={getRentalPublicUrl(item)} target="_blank">
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="View Public Page">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleOpenEdit(item)}
                          className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          title="Edit Listing Details"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {item.status !== 'removed' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={processingId === item.id}
                            onClick={() => handleDisapprove(item.id)}
                            className="h-8 w-8 p-0 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                            title="Disapprove / Remove Ad"
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={processingId === item.id || !item.userId}
                          onClick={() => handleBanUser(item.userId, item.userName)}
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                          title={`Ban Landlord (${item.userName}) & Disapprove All Ads`}
                        >
                          <Ban className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={processingId === item.id}
                          onClick={() => handleDelete(item.id)}
                          className="h-8 w-8 p-0 text-gray-400 hover:text-red-600"
                          title="Permanently Delete Listing"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )}

      {/* Admin In-Panel Edit Pop-up Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Pencil className="h-5 w-5 text-primary" />
              Edit Home Rental Listing
            </DialogTitle>
            <DialogDescription asChild>
              <div className="text-xs text-muted-foreground">
                Edit property details, pricing, landlord information, and photos directly in the admin panel.
              </div>
            </DialogDescription>
          </DialogHeader>

          {editingItem && (
            <div className="space-y-4 py-2 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <Label className="text-xs font-semibold">Listing Title</Label>
                  <Input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="e.g. Spacious 2BHK Apartment with Balcony"
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Property Type</Label>
                  <select
                    value={editPropertyType}
                    onChange={(e) => setEditPropertyType(e.target.value as any)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs"
                  >
                    {RENTAL_PROPERTY_TYPES.map((t) => (
                      <option key={t.id} value={t.id}>{t.label}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Furnishing</Label>
                  <select
                    value={editFurnishing}
                    onChange={(e) => setEditFurnishing(e.target.value as any)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs"
                  >
                    {FURNISHING_OPTIONS.map((f) => (
                      <option key={f.id} value={f.id}>{f.label}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Monthly Rent (₹)</Label>
                  <Input
                    type="number"
                    value={editMonthlyRent}
                    onChange={(e) => setEditMonthlyRent(e.target.value)}
                    placeholder="e.g. 18000"
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Security Deposit (₹)</Label>
                  <Input
                    type="number"
                    value={editDeposit}
                    onChange={(e) => setEditDeposit(e.target.value)}
                    placeholder="e.g. 50000"
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Bedrooms</Label>
                  <Input
                    type="number"
                    min="1"
                    max="10"
                    value={editBedrooms}
                    onChange={(e) => setEditBedrooms(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Bathrooms</Label>
                  <Input
                    type="number"
                    min="1"
                    max="10"
                    value={editBathrooms}
                    onChange={(e) => setEditBathrooms(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Preferred Tenants</Label>
                  <select
                    value={editTenantPreference}
                    onChange={(e) => setEditTenantPreference(e.target.value as any)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs"
                  >
                    {TENANT_PREFERENCES.map((p) => (
                      <option key={p.id} value={p.id}>{p.label}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Status</Label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as any)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs"
                  >
                    <option value="active">Active</option>
                    <option value="rented">Rented</option>
                    <option value="expired">Expired</option>
                    <option value="removed">Removed (Disapproved)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Landlord / Contact Name</Label>
                  <Input
                    value={editUserName}
                    onChange={(e) => setEditUserName(e.target.value)}
                    placeholder="Contact Name"
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Contact Phone</Label>
                  <Input
                    value={editUserPhone}
                    onChange={(e) => setEditUserPhone(e.target.value)}
                    placeholder="10-digit mobile number"
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Area / Locality</Label>
                  <Input
                    value={editArea}
                    onChange={(e) => setEditArea(e.target.value)}
                    placeholder="e.g. HSR Layout, Sector 2"
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Full Address</Label>
                  <Input
                    value={editAddress}
                    onChange={(e) => setEditAddress(e.target.value)}
                    placeholder="House/Building address"
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Description</Label>
                <Textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={3}
                  placeholder="Property features, water supply, floor number, deposit terms..."
                  className="text-xs resize-none"
                />
              </div>

              {/* Photos Management */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">Photos ({editPhotos.length}/5)</Label>
                  <span className="text-[11px] text-muted-foreground">Removing with X and saving deletes the file from storage.</span>
                </div>

                <div className="grid grid-cols-5 gap-2">
                  {editPhotos.map((url, idx) => (
                    <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border bg-gray-50 dark:bg-muted group">
                      <img src={url} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(idx)}
                        className="absolute top-1 right-1 h-5 w-5 rounded-full bg-red-600 text-white flex items-center justify-center hover:bg-red-700 shadow"
                        title="Remove photo"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}

                  {editPhotos.length < 5 && (
                    <label className="relative aspect-square rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-primary flex flex-col items-center justify-center cursor-pointer bg-gray-50/50 dark:bg-muted/30 transition-colors">
                      {isUploadingPhoto ? (
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      ) : (
                        <>
                          <Plus className="h-5 w-5 text-gray-400 group-hover:text-primary" />
                          <span className="text-[10px] text-gray-500 mt-1">Upload</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        disabled={isUploadingPhoto}
                        onChange={handlePhotoUpload}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* Footer Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditModalOpen(false)}
                  disabled={isSavingEdit}
                  className="text-xs h-9"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={isSavingEdit || isUploadingPhoto}
                  className="text-xs h-9 font-bold bg-primary hover:bg-primary/90 text-white gap-1"
                >
                  {isSavingEdit && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Save Changes
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
