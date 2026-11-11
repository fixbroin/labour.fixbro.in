"use client";

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import AppImage from '@/components/ui/AppImage';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { PlusCircle, Edit, Trash2, Users2, Loader2, Search, MapPin, CheckCircle, XCircle, Award, TrendingUp, Check, X, Clock, AlertCircle } from "lucide-react";
import type { ProviderApplication, FirestoreCategory } from '@/types/firestore';
import ProviderForm from '@/components/admin/ProviderForm';
import { createProviderAccountAction } from '@/app/actions/providerAccountActions';
import { approveRateAndSkillChangeAction, rejectRateAndSkillChangeAction } from '@/app/actions/rateAndSkillChangeActions';
import { db } from '@/lib/firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, getDoc, orderBy, query, Timestamp } from '@/lib/mysqlDb';
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Skeleton } from '@/components/ui/skeleton';
import { triggerRefresh } from '@/lib/revalidateUtils';
import { Switch } from '@/components/ui/switch';
import { Input } from "@/components/ui/input";
import PermissionGuard from '@/components/admin/PermissionGuard';
import { useApplicationConfig } from '@/hooks/useApplicationConfig';
import { formatCurrency } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const generateSlug = (name: string) => {
  if (!name) return "";
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
};

export default function AdminProvidersPage() {
  const { config: appConfig } = useApplicationConfig();
  const symbol = appConfig?.currencySymbol || '₹';
  const decimals = appConfig?.currencyDecimalPoints !== undefined ? appConfig.currencyDecimalPoints : 0;
  const code = appConfig?.currencyCode || 'INR';

  const [providers, setProviders] = useState<ProviderApplication[]>([]);
  const [categories, setCategories] = useState<FirestoreCategory[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<ProviderApplication | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<'providers' | 'rate_requests'>('providers');
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const { toast } = useToast();

  const pendingRateRequests = useMemo(() => {
    return providers.filter(
      p => p.rateAndSkillChangeRequest && p.rateAndSkillChangeRequest.status === 'pending'
    );
  }, [providers]);

  const handleApproveRateRequest = async (providerId: string) => {
    setApprovingId(providerId);
    try {
      const res = await approveRateAndSkillChangeAction(providerId);
      if (!res.success) {
        throw new Error(res.message);
      }
      toast({
        title: "Request Approved",
        description: res.message,
      });
      fetchData();
    } catch (err: any) {
      toast({
        title: "Approval Failed",
        description: err.message || "Could not approve request.",
        variant: "destructive",
      });
    } finally {
      setApprovingId(null);
    }
  };

  const handleRejectRateRequest = async (providerId: string) => {
    const reason = window.prompt("Reason for rejecting this rate/skill update (optional):");
    if (reason === null) return;
    setRejectingId(providerId);
    try {
      const res = await rejectRateAndSkillChangeAction(providerId, reason || undefined);
      if (!res.success) {
        throw new Error(res.message);
      }
      toast({
        title: "Request Rejected",
        description: "The request has been marked rejected.",
      });
      fetchData();
    } catch (err: any) {
      toast({
        title: "Rejection Failed",
        description: err.message || "Could not reject request.",
        variant: "destructive",
      });
    } finally {
      setRejectingId(null);
    }
  };

  const providersCollectionRef = collection(db, "providerApplications");
  const categoriesCollectionRef = collection(db, "adminCategories");

  const fetchData = async () => {
    setIsLoadingData(true);
    try {
      let fetchedCats: FirestoreCategory[] = [];
      let fetchedProviders: ProviderApplication[] = [];

      try {
        const catData = await getDocs(query(categoriesCollectionRef, orderBy("order", "asc")));
        fetchedCats = catData.docs.map((d) => ({ ...d.data(), id: d.id } as FirestoreCategory));
      } catch (e) {
        console.error("Error fetching categories:", e);
      }

      try {
        const provData = await getDocs(query(providersCollectionRef));
        fetchedProviders = provData.docs.map((d) => {
          const data = d.data() as ProviderApplication;
          return {
            ...data,
            id: d.id,
            slug: data.slug || generateSlug(data.fullName || `provider-${d.id.slice(0, 5)}`),
            dailyRate: data.dailyRate ?? 1200,
            isActive: data.isActive !== false && data.status === 'approved',
            isOnline: data.isOnline !== false,
          };
        });
      } catch (e) {
        console.error("Error fetching providers:", e);
      }

      setCategories(fetchedCats);
      setProviders(fetchedProviders);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: "Error",
        description: "Could not fetch categories or providers.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    setIsMounted(true);
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAddProvider = () => {
    setEditingProvider(null);
    setIsFormOpen(true);
  };

  const handleEditProvider = (provider: ProviderApplication) => {
    setEditingProvider(provider);
    setIsFormOpen(true);
  };

  const handleToggleActive = async (provider: ProviderApplication) => {
    if (!provider.id) return;
    setIsSubmitting(true);
    const newActiveState = !provider.isActive;
    const newStatus = newActiveState ? 'approved' : 'rejected';
    try {
      await updateDoc(doc(db, "providerApplications", provider.id), {
        isActive: newActiveState,
        status: newStatus,
        updatedAt: Timestamp.now(),
      });
      setProviders(prev => prev.map(p => p.id === provider.id ? { ...p, isActive: newActiveState, status: newStatus } : p));
      toast({
        title: "Status Updated",
        description: `Provider "${provider.fullName}" is now ${newActiveState ? "active & approved" : "inactive"}.`,
      });
      await triggerRefresh('categories');
    } catch (error) {
      console.error("Error toggling active:", error);
      toast({ title: "Error", description: "Could not update status.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleOnline = async (provider: ProviderApplication) => {
    if (!provider.id) return;
    setIsSubmitting(true);
    const newOnlineState = !provider.isOnline;
    try {
      await updateDoc(doc(db, "providerApplications", provider.id), {
        isOnline: newOnlineState,
        updatedAt: Timestamp.now(),
      });
      setProviders(prev => prev.map(p => p.id === provider.id ? { ...p, isOnline: newOnlineState } : p));
      toast({
        title: "Online Status Updated",
        description: `Provider "${provider.fullName}" is now ${newOnlineState ? "online" : "offline"}.`,
      });
    } catch (error) {
      console.error("Error toggling online:", error);
      toast({ title: "Error", description: "Could not update online status.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteProvider = async (providerId: string) => {
    setIsSubmitting(true);
    try {
      await deleteDoc(doc(db, "providerApplications", providerId));
      setProviders(prev => prev.filter(p => p.id !== providerId));
      toast({ title: "Success", description: "Provider deleted successfully." });
      await triggerRefresh('categories');
    } catch (error) {
      console.error("Error deleting provider:", error);
      toast({ title: "Error", description: "Could not delete provider.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFormSubmit = async (formData: Partial<ProviderApplication> & { password?: string }) => {
    setIsSubmitting(true);
    try {
      if (editingProvider && editingProvider.id) {
        // Update existing provider
        const { password, ...restPayload } = formData;
        const provRef = doc(db, "providerApplications", editingProvider.id);
        const updatePayload = {
          ...restPayload,
          updatedAt: Timestamp.now(),
        };
        await updateDoc(provRef, updatePayload);
        setProviders(prev => prev.map(p => p.id === editingProvider.id ? { ...p, ...updatePayload } as ProviderApplication : p));
        toast({ title: "Success", description: `Provider "${formData.fullName}" updated.` });
      } else {
        // Create full provider account (users + providerApplications + Auth)
        const result = await createProviderAccountAction({
          fullName: formData.fullName || '',
          mobileNumber: formData.mobileNumber || '',
          email: formData.email,
          password: (formData as any).password,
          slug: formData.slug,
          workCategoryId: formData.workCategoryId || '',
          workCategoryName: formData.workCategoryName,
          seniorityLevel: formData.seniorityLevel || 'Senior',
          dailyRate: formData.dailyRate || 1200,
          bio: formData.bio,
          profilePhotoUrl: formData.profilePhotoUrl,
          age: formData.age,
          experienceYears: formData.experienceYears,
          workAreaAddress: formData.workAreaAddress,
          workAreaRadiusKm: formData.workAreaRadiusKm,
          isActive: formData.isActive !== false,
          isOnline: formData.isOnline !== false,
        });

        if (result.success && result.provider) {
          setProviders(prev => [{ ...result.provider, id: result.uid } as ProviderApplication, ...prev]);
          toast({
            title: "Provider Account Created",
            description: `Account created for "${formData.fullName}". Login Password: ${result.temporaryPassword}. They can log in with Email or Mobile OTP.`,
          });
        } else {
          toast({
            title: "Creation Error",
            description: result.error || "Could not create provider account.",
            variant: "destructive",
          });
          setIsSubmitting(false);
          return;
        }
      }
      setIsFormOpen(false);
      setEditingProvider(null);
      await triggerRefresh('categories');
    } catch (error) {
      console.error("Error saving provider:", error);
      toast({ title: "Error", description: "Could not save provider.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Group providers by category
  const filteredProviders = useMemo(() => {
    if (!searchQuery.trim()) return providers;
    const q = searchQuery.toLowerCase().trim();
    return providers.filter(p =>
      (p.fullName && p.fullName.toLowerCase().includes(q)) ||
      (p.workCategoryName && p.workCategoryName.toLowerCase().includes(q)) ||
      (p.mobileNumber && p.mobileNumber.toLowerCase().includes(q)) ||
      (p.seniorityLevel && p.seniorityLevel.toLowerCase().includes(q))
    );
  }, [providers, searchQuery]);

  const groupedProviders = useMemo(() => {
    const map = new Map<string, { category: FirestoreCategory | { id: string; name: string }; providers: ProviderApplication[] }>();

    // Initialize all active categories
    categories.forEach(cat => {
      map.set(cat.id, { category: cat, providers: [] });
    });

    // Populate providers into groups
    filteredProviders.forEach(p => {
      const catId = p.workCategoryId;
      if (catId && map.has(catId)) {
        map.get(catId)!.providers.push(p);
      } else {
        // Fallback matching by category name
        const foundCat = categories.find(c => c.name.toLowerCase() === (p.workCategoryName || '').toLowerCase());
        if (foundCat && map.has(foundCat.id)) {
          map.get(foundCat.id)!.providers.push(p);
        } else {
          // Other / Unassigned
          const unassignedKey = 'unassigned';
          if (!map.has(unassignedKey)) {
            map.set(unassignedKey, { category: { id: unassignedKey, name: 'Other / Unassigned' }, providers: [] });
          }
          map.get(unassignedKey)!.providers.push(p);
        }
      }
    });

    return Array.from(map.values()).filter(group => {
      if (searchQuery.trim()) {
        return group.providers.length > 0;
      }
      return true;
    });
  }, [categories, filteredProviders, searchQuery]);

  if (!isMounted) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <PermissionGuard moduleId="services" action="read">
      <div className="space-y-6">
        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-2xl font-bold flex items-center gap-2">
                <Users2 className="h-6 w-6 text-primary" />
                Admin Daily Providers
              </CardTitle>
              <CardDescription>
                Add, edit, or manage daily labour providers. Grouped by category.
              </CardDescription>
            </div>
            <Button onClick={handleAddProvider} className="self-start sm:self-auto">
              <PlusCircle className="mr-2 h-4 w-4" />
              Add New Provider
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* View Switcher Tabs */}
            <div className="flex flex-wrap items-center gap-2 border-b pb-3">
              <Button
                variant={activeTab === 'providers' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveTab('providers')}
                className="rounded-xl font-bold"
              >
                <Users2 className="mr-1.5 h-4 w-4" />
                All Daily Providers ({providers.length})
              </Button>
              <Button
                variant={activeTab === 'rate_requests' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveTab('rate_requests')}
                className="rounded-xl font-bold relative"
              >
                <Award className="mr-1.5 h-4 w-4" />
                Skill &amp; Rate Requests
                {pendingRateRequests.length > 0 && (
                  <Badge className="ml-2 bg-red-600 text-white font-extrabold text-[11px] px-2 py-0.5 shadow-xs">
                    {pendingRateRequests.length}
                  </Badge>
                )}
              </Button>
            </div>

            {activeTab === 'rate_requests' ? (
              /* Review Pending Skill & Rate Requests Section */
              <div className="space-y-4 pt-1">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <Award className="h-5 w-5 text-primary" />
                      Pending Skill &amp; Daily Rate Requests
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Providers can request adjustments to their seniority tier and daily wage. Approved updates will immediately become live on FixBro.
                    </p>
                  </div>
                  <Badge variant="outline" className="font-mono text-xs">
                    {pendingRateRequests.length} Pending
                  </Badge>
                </div>

                {pendingRateRequests.length === 0 ? (
                  <div className="text-center py-12 border-2 border-dashed rounded-2xl bg-muted/5 text-muted-foreground">
                    <CheckCircle className="h-10 w-10 text-emerald-500/50 mx-auto mb-2" />
                    <p className="font-semibold text-sm">All caught up!</p>
                    <p className="text-xs">No pending skill level or daily rate requests awaiting review.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {pendingRateRequests.map((p) => {
                      const req = p.rateAndSkillChangeRequest!;
                      const isApproving = approvingId === p.id;
                      const isRejecting = rejectingId === p.id;

                      return (
                        <Card key={p.id} className="border shadow-xs rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
                          <CardHeader className="bg-muted/30 pb-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <Avatar className="h-11 w-11 border">
                                  <AvatarImage src={p.profilePhotoUrl || undefined} alt={p.fullName} />
                                  <AvatarFallback className="font-bold">{p.fullName ? p.fullName[0] : 'P'}</AvatarFallback>
                                </Avatar>
                                <div>
                                  <CardTitle className="text-base font-bold">{p.fullName}</CardTitle>
                                  <CardDescription className="text-xs">
                                    {p.workCategoryName || 'Daily Labour'} {p.mobileNumber && `• ${p.mobileNumber}`}
                                  </CardDescription>
                                </div>
                              </div>
                              <Badge className="bg-amber-600 text-white text-[10px] uppercase font-bold">
                                Pending Review
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="p-4 space-y-3 text-xs">
                            {/* Before vs After Comparison */}
                            <div className="grid grid-cols-2 gap-2">
                              <div className="p-3 rounded-xl bg-muted/40 border">
                                <span className="text-[10px] text-muted-foreground uppercase font-semibold block">BEFORE (Current Live)</span>
                                <p className="font-bold text-foreground text-sm mt-0.5">{req.previousSeniorityLevel}</p>
                                <p className="text-muted-foreground font-semibold">₹{req.previousDailyRate} / day</p>
                              </div>
                              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-300 dark:border-emerald-800">
                                <span className="text-[10px] text-emerald-700 dark:text-emerald-400 uppercase font-bold block">AFTER (Requested)</span>
                                <p className="font-extrabold text-emerald-900 dark:text-emerald-200 text-sm mt-0.5">{req.newSeniorityLevel}</p>
                                <p className="text-emerald-700 dark:text-emerald-300 font-extrabold text-base">₹{req.newDailyRate} / day</p>
                              </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-2 border-t">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRejectRateRequest(p.id!)}
                                disabled={isApproving || isRejecting}
                                className="rounded-xl text-red-600 hover:text-red-700 border-red-200"
                              >
                                {isRejecting ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <X className="mr-1 h-3.5 w-3.5" />}
                                Reject
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleApproveRateRequest(p.id!)}
                                disabled={isApproving || isRejecting}
                                className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                              >
                                {isApproving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1 h-3.5 w-3.5" />}
                                Approve &amp; Make Live
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              /* All Daily Providers Tab Content */
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by provider name, mobile, category, or seniority..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>

            {isLoadingData ? (
              <div className="space-y-4 py-8">
                <div className="flex items-center justify-center text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading providers...
                </div>
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-lg" />
                ))}
              </div>
            ) : groupedProviders.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No providers found. Click &quot;Add New Provider&quot; to register a provider.
              </div>
            ) : (
              <Accordion
                type="multiple"
                defaultValue={groupedProviders.map(g => g.category.id)}
                className="w-full space-y-3"
              >
                {groupedProviders.map(({ category, providers: catProviders }) => (
                  <AccordionItem
                    key={category.id}
                    value={category.id}
                    className="border rounded-lg px-4 bg-card"
                  >
                    <AccordionTrigger className="hover:no-underline py-3">
                      <div className="flex items-center justify-between w-full pr-4">
                        <span className="font-semibold text-base">{category.name}</span>
                        <Badge variant="secondary" className="text-xs">
                          {catProviders.length} {catProviders.length === 1 ? 'provider' : 'providers'}
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-2 pb-4">
                      {catProviders.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-6">
                          No providers registered under this category yet.
                        </p>
                      ) : (
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-16">Img</TableHead>
                                <TableHead>Name</TableHead>
                                <TableHead>Seniority</TableHead>
                                <TableHead>Slug</TableHead>
                                <TableHead>Daily Rate ({symbol})</TableHead>
                                <TableHead>Location</TableHead>
                                <TableHead className="text-center">Online</TableHead>
                                <TableHead className="text-center">Active</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {catProviders.map((provider) => (
                                <TableRow key={provider.id}>
                                  <TableCell>
                                    <Avatar className="h-10 w-10 border">
                                      <AvatarImage src={provider.profilePhotoUrl} alt={provider.fullName || 'Provider'} className="object-cover" />
                                      <AvatarFallback>
                                        {(provider.fullName || 'P').charAt(0).toUpperCase()}
                                      </AvatarFallback>
                                    </Avatar>
                                  </TableCell>
                                  <TableCell>
                                    <div className="font-medium text-foreground">
                                      {provider.fullName || 'Unnamed Provider'}
                                    </div>
                                    <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                                      {provider.age ? <span>{provider.age} yrs</span> : null}
                                      {provider.experienceLevelLabel ? <span>• {provider.experienceLevelLabel}</span> : null}
                                      {provider.mobileNumber ? <span>• {provider.mobileNumber}</span> : null}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className="font-normal text-xs">
                                      {provider.seniorityLevel || provider.skillLevelLabel || 'Senior'}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-xs text-muted-foreground font-mono">
                                    {provider.slug || generateSlug(provider.fullName || '')}
                                  </TableCell>
                                  <TableCell className="font-semibold text-foreground">
                                    {formatCurrency(provider.dailyRate ?? 1200, symbol, decimals, code)}/day
                                  </TableCell>
                                  <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate" title={provider.workAreaAddress || ''}>
                                    <div className="flex items-center gap-1">
                                      <MapPin className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                                      <span className="truncate">{provider.workAreaAddress || 'Anywhere'}</span>
                                      {provider.workAreaRadiusKm ? (
                                        <span className="text-[10px] text-primary">({provider.workAreaRadiusKm}km)</span>
                                      ) : null}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <Switch
                                      checked={provider.isOnline !== false}
                                      onCheckedChange={() => handleToggleOnline(provider)}
                                      disabled={isSubmitting}
                                      aria-label="Toggle Online"
                                    />
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <Switch
                                      checked={provider.isActive !== false}
                                      onCheckedChange={() => handleToggleActive(provider)}
                                      disabled={isSubmitting}
                                      aria-label="Toggle Active"
                                    />
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-1">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-primary hover:text-primary/80"
                                        onClick={() => handleEditProvider(provider)}
                                        title="Edit Provider"
                                      >
                                        <Edit className="h-4 w-4" />
                                      </Button>
                                      <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-destructive hover:text-destructive/80"
                                            title="Delete Provider"
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                          <AlertDialogHeader>
                                            <AlertDialogTitle>Delete Provider?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                              Are you sure you want to delete &quot;{provider.fullName}&quot;? This action cannot be undone.
                                            </AlertDialogDescription>
                                          </AlertDialogHeader>
                                          <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction
                                              onClick={() => provider.id && handleDeleteProvider(provider.id)}
                                              className="bg-destructive hover:bg-destructive/90 text-white"
                                            >
                                              Delete
                                            </AlertDialogAction>
                                          </AlertDialogFooter>
                                        </AlertDialogContent>
                                      </AlertDialog>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </>
        )}
      </CardContent>
        </Card>

        {/* Add/Edit Provider Modal Dialog */}
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>
                {editingProvider ? `Edit Provider: ${editingProvider.fullName}` : "Add New Provider"}
              </DialogTitle>
              <DialogDescription>
                {editingProvider
                  ? "Update provider details, daily rate, category, and availability."
                  : "Register a new daily labour provider to be listed on the platform."}
              </DialogDescription>
            </DialogHeader>
            <ProviderForm
              initialData={editingProvider}
              categories={categories}
              onSubmit={handleFormSubmit}
              onClose={() => setIsFormOpen(false)}
              isSubmitting={isSubmitting}
            />
          </DialogContent>
        </Dialog>
      </div>
    </PermissionGuard>
  );
}
