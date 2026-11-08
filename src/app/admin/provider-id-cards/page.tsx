"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Contact2, 
  Search, 
  RefreshCw, 
  Download, 
  CreditCard, 
  CheckCircle2, 
  Clock, 
  Eye, 
  Copy, 
  Check, 
  Settings, 
  FileText, 
  ImageIcon, 
  Users, 
  IndianRupee,
  ShieldCheck,
  Filter
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useApplicationConfig } from "@/hooks/useApplicationConfig";
import PermissionGuard from "@/components/admin/PermissionGuard";
import ProviderIdCardModal from "@/components/admin/ProviderIdCardModal";
import ProviderIdCardSettingsTab from "@/components/admin/provider-controls/ProviderIdCardSettingsTab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  getProvidersWithIdCardsAction, 
  getProviderIdCardSettingsAction,
  deleteOrResetProviderIdCardAction,
  recordIdCardGenerationAction,
} from "@/app/actions/providerIdCardActions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Trash2, RotateCcw } from "lucide-react";
import type { ProviderIdCardRecord, ProviderIdCardSettings } from "@/types/providerAreaAndId";
import { DEFAULT_ID_CARD_SETTINGS } from "@/types/providerAreaAndId";

export default function AdminProviderIdCardsPage() {
  const { config: appConfig } = useApplicationConfig();
  const { toast } = useToast();
  const symbol = appConfig?.currencySymbol || "₹";

  const [records, setRecords] = useState<ProviderIdCardRecord[]>([]);
  const [settings, setSettings] = useState<ProviderIdCardSettings>(DEFAULT_ID_CARD_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [mainTab, setMainTab] = useState<'cards_list' | 'card_settings'>('cards_list');
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<'all_generated' | 'purchased' | 'pending_payment' | 'all_approved'>('all_generated');
  
  // Modal preview state
  const [selectedProvider, setSelectedProvider] = useState<ProviderIdCardRecord | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Reset / Delete state
  const [providerToReset, setProviderToReset] = useState<ProviderIdCardRecord | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  const handleConfirmReset = async () => {
    if (!providerToReset) return;
    setIsResetting(true);
    try {
      const result = await deleteOrResetProviderIdCardAction(providerToReset.providerId);
      if (result.success) {
        toast({ title: "Card Reset", description: result.message });
        setProviderToReset(null);
        await loadData();
      } else {
        toast({ title: "Error", description: result.message, variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to reset card", variant: "destructive" });
    } finally {
      setIsResetting(false);
    }
  };

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [fetchedRecords, fetchedSettings] = await Promise.all([
        getProvidersWithIdCardsAction(),
        getProviderIdCardSettingsAction(),
      ]);
      setRecords(fetchedRecords);
      setSettings(fetchedSettings);
    } catch (error) {
      console.error("Error loading ID card records:", error);
      toast({
        title: "Error",
        description: "Failed to load provider ID card records.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Copy helper
  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    toast({ title: "Copied!", description: `${label} copied to clipboard.` });
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Open modal & auto-assign next sequential number if viewing an ungenerated provider
  const handleViewCard = async (provider: ProviderIdCardRecord) => {
    let currentProvider = { ...provider };
    if (!currentProvider.idCardGenerated || !currentProvider.idCardNumber) {
      try {
        const res = await recordIdCardGenerationAction(currentProvider.providerId);
        if (res.success && res.idCardNumber) {
          currentProvider.idCardNumber = res.idCardNumber;
          currentProvider.idCardGenerated = true;
          await loadData();
        }
      } catch (err) {
        console.error("Auto-assign sequential ID failed:", err);
      }
    }
    setSelectedProvider(currentProvider);
    setIsModalOpen(true);
  };

  // Filtered list
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      // Filter by tab
      if (statusFilter === 'all_generated' && !r.idCardGenerated) return false;
      if (statusFilter === 'purchased' && !r.idCardUnlocked) return false;
      if (statusFilter === 'pending_payment' && (r.idCardUnlocked || !r.idCardGenerated)) return false;
      // 'all_approved' allows everything

      // Search query filter
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const nameMatch = r.fullName?.toLowerCase().includes(q);
      const phoneMatch = r.mobileNumber?.toLowerCase().includes(q);
      const techIdMatch = r.technicianId?.toLowerCase().includes(q);
      const payIdMatch = r.idCardPaymentId?.toLowerCase().includes(q);
      const categoryMatch = r.workCategoryName?.toLowerCase().includes(q);

      return nameMatch || phoneMatch || techIdMatch || payIdMatch || categoryMatch;
    });
  }, [records, statusFilter, searchQuery]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const totalGenerated = records.filter(r => r.idCardGenerated).length;
    const totalUnlocked = records.filter(r => r.idCardUnlocked).length;
    const totalRevenue = records.reduce((sum, r) => sum + (r.idCardPaidAmount || 0), 0);
    const totalDownloads = records.reduce((sum, r) => sum + (r.idCardDownloadCount || 0), 0);
    const totalPdf = records.reduce((sum, r) => sum + (r.idCardPdfDownloadCount || 0), 0);
    const totalFront = records.reduce((sum, r) => sum + (r.idCardFrontPngDownloadCount || 0), 0);
    const totalBack = records.reduce((sum, r) => sum + (r.idCardBackPngDownloadCount || 0), 0);

    return {
      totalGenerated,
      totalUnlocked,
      totalRevenue,
      totalDownloads,
      totalPdf,
      totalFront,
      totalBack,
    };
  }, [records]);

  return (
    <PermissionGuard moduleId="provider_id_cards" action="read">
      <div className="space-y-6 pb-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
              <Contact2 className="h-7 w-7 text-primary" />
              Provider ID Cards
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Monitor verified service partner ID cards, fee purchases, payment IDs, and printable downloads.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={mainTab === 'card_settings' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                const nextTab = mainTab === 'card_settings' ? 'cards_list' : 'card_settings';
                setMainTab(nextTab);
                if (nextTab === 'cards_list') loadData();
              }}
              className="h-9 gap-1.5 text-xs font-semibold"
            >
              <Settings className="h-3.5 w-3.5" />
              {mainTab === 'card_settings' ? 'View Cards List' : 'ID Card Settings'}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              disabled={isLoading}
              className="h-9 gap-1.5 text-xs font-semibold"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          </div>
        </div>

        {/* Main Tabs Navigation */}
        <Tabs value={mainTab} onValueChange={(val: any) => { setMainTab(val); if (val === 'cards_list') loadData(); }} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2 mb-6">
            <TabsTrigger value="cards_list" className="flex items-center gap-2 font-semibold">
              <Contact2 className="h-4 w-4" />
              Generated ID Cards
            </TabsTrigger>
            <TabsTrigger value="card_settings" className="flex items-center gap-2 font-semibold">
              <Settings className="h-4 w-4" />
              ID Card Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="cards_list" className="space-y-6 mt-0">

        {/* Metric Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Generated */}
          <Card className="shadow-sm border-slate-200 dark:border-slate-800">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Cards Generated
              </CardTitle>
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Contact2 className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{metrics.totalGenerated}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Out of {records.length} approved partners
              </p>
            </CardContent>
          </Card>

          {/* Card 2: Purchased / Unlocked */}
          <Card className="shadow-sm border-slate-200 dark:border-slate-800">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Unlocked / Purchased
              </CardTitle>
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{metrics.totalUnlocked}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {settings.downloadFee > 0 ? `Paid fee of ${symbol}${settings.downloadFee}` : 'Free download enabled'}
              </p>
            </CardContent>
          </Card>

          {/* Card 3: Revenue Collected */}
          <Card className="shadow-sm border-slate-200 dark:border-slate-800">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Total ID Card Revenue
              </CardTitle>
              <div className="p-2 rounded-lg bg-sky-500/10 text-sky-600">
                <IndianRupee className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {symbol}{metrics.totalRevenue.toLocaleString('en-IN')}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                From Razorpay digital card unlocks
              </p>
            </CardContent>
          </Card>

          {/* Card 4: Downloads Metrics */}
          <Card className="shadow-sm border-slate-200 dark:border-slate-800">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Total Downloads
              </CardTitle>
              <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600">
                <Download className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{metrics.totalDownloads}</div>
              <div className="flex items-center gap-1.5 mt-1 text-[11px] text-muted-foreground">
                <span>PDF: <strong className="text-foreground">{metrics.totalPdf}</strong></span>
                <span>•</span>
                <span>Front: <strong className="text-foreground">{metrics.totalFront}</strong></span>
                <span>•</span>
                <span>Back: <strong className="text-foreground">{metrics.totalBack}</strong></span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter and Search Bar */}
        <Card className="shadow-sm border-slate-200 dark:border-slate-800">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
              {/* Search input */}
              <div className="relative flex-grow max-w-md">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search provider name, ID, phone, or payment ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 text-xs"
                />
              </div>

              {/* Status Filter Buttons */}
              <div className="flex flex-wrap items-center gap-1.5">
                <Button
                  variant={statusFilter === 'all_generated' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter('all_generated')}
                  className="h-8 text-xs font-semibold"
                >
                  Generated Cards ({metrics.totalGenerated})
                </Button>

                <Button
                  variant={statusFilter === 'purchased' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter('purchased')}
                  className="h-8 text-xs font-semibold"
                >
                  Purchased ({metrics.totalUnlocked})
                </Button>

                <Button
                  variant={statusFilter === 'pending_payment' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter('pending_payment')}
                  className="h-8 text-xs font-semibold"
                >
                  Pending Unlock ({Math.max(0, metrics.totalGenerated - metrics.totalUnlocked)})
                </Button>

                <Button
                  variant={statusFilter === 'all_approved' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter('all_approved')}
                  className="h-8 text-xs font-semibold"
                >
                  All Approved ({records.length})
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Provider ID Cards Table */}
        <Card className="shadow-sm border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80 dark:bg-slate-900/60">
                  <TableHead className="font-semibold text-xs">Technician / Provider</TableHead>
                  <TableHead className="font-semibold text-xs">Unique ID Number</TableHead>
                  <TableHead className="font-semibold text-xs">Card Status</TableHead>
                  <TableHead className="font-semibold text-xs">Purchase / Payment Info</TableHead>
                  <TableHead className="font-semibold text-xs text-center">Downloads</TableHead>
                  <TableHead className="font-semibold text-xs text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-48 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <RefreshCw className="h-6 w-6 animate-spin text-primary" />
                        <span className="text-xs">Loading provider ID cards...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredRecords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-48 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Contact2 className="h-10 w-10 text-muted-foreground/40" />
                        <p className="text-sm font-medium">No provider ID cards found.</p>
                        <p className="text-xs text-muted-foreground">
                          {searchQuery ? "Try refining your search terms." : "Approved providers will appear here once they generate or unlock their cards."}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRecords.map((r) => {
                    const hasPaid = Boolean(r.idCardPaymentId);
                    const isUnlocked = r.idCardUnlocked;
                    const isGenerated = r.idCardGenerated;

                    return (
                      <TableRow key={r.providerId} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                        {/* Provider Details */}
                        <TableCell className="py-3">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10 border border-slate-200 dark:border-slate-800">
                              <AvatarImage src={r.profilePhotoUrl} alt={r.fullName} />
                              <AvatarFallback className="font-bold text-xs bg-primary/10 text-primary">
                                {r.fullName?.charAt(0) || 'P'}
                              </AvatarFallback>
                            </Avatar>

                            <div className="space-y-0.5">
                              <div className="font-bold text-sm text-foreground flex items-center gap-1.5">
                                <span>{r.fullName}</span>
                                {isGenerated && (
                                  <span title="ID Card Generated">
                                    <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground flex items-center gap-2">
                                <span className="font-medium text-slate-700 dark:text-slate-300">
                                  {r.workCategoryName || 'Technician'}
                                </span>
                                <span>•</span>
                                <span>{r.mobileNumber || 'No Phone'}</span>
                              </div>
                            </div>
                          </div>
                        </TableCell>

                        {/* Unique ID Number */}
                        <TableCell className="py-3">
                          <div className="space-y-0.5">
                            {r.idCardGenerated && r.idCardNumber ? (
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-xs font-bold text-foreground bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                                  {r.idCardNumber}
                                </span>
                                <button
                                  onClick={() => handleCopy(r.idCardNumber!, 'ID Card Number')}
                                  className="text-muted-foreground hover:text-foreground transition-colors p-1"
                                  title="Copy Unique ID Number"
                                >
                                  {copiedId === r.idCardNumber ? (
                                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                                  ) : (
                                    <Copy className="h-3.5 w-3.5" />
                                  )}
                                </button>
                              </div>
                            ) : (
                              <Badge variant="outline" className="text-[11px] text-muted-foreground font-medium border-dashed bg-slate-50 dark:bg-slate-900">
                                Not Generated Yet
                              </Badge>
                            )}
                            <div className="text-[10px] text-muted-foreground">
                              {r.gender || 'Male'} • {r.skillLevelLabel || 'Skilled'}
                            </div>
                          </div>
                        </TableCell>

                        {/* Card Status */}
                        <TableCell className="py-3">
                          {isUnlocked ? (
                            hasPaid ? (
                              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-xs">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Purchased ({symbol}{r.idCardPaidAmount || settings.downloadFee})
                              </Badge>
                            ) : (
                              <Badge className="bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30 text-xs">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Free Unlocked
                              </Badge>
                            )
                          ) : isGenerated ? (
                            <Badge variant="outline" className="text-amber-600 dark:text-amber-400 border-amber-400/40 text-xs">
                              <Clock className="h-3 w-3 mr-1" />
                              Pending Unlock ({symbol}{settings.downloadFee})
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-muted-foreground text-xs">
                              Not Generated Yet
                            </Badge>
                          )}
                        </TableCell>

                        {/* Purchase Details */}
                        <TableCell className="py-3">
                          {r.idCardPaymentId ? (
                            <div className="space-y-1 text-xs">
                              <div className="flex items-center gap-1.5">
                                <span className="text-muted-foreground">Pay ID:</span>
                                <button
                                  onClick={() => handleCopy(r.idCardPaymentId!, 'Payment ID')}
                                  className="font-mono text-[11px] font-semibold text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1"
                                >
                                  <span>{r.idCardPaymentId}</span>
                                  {copiedId === r.idCardPaymentId ? (
                                    <Check className="h-3 w-3 text-emerald-500" />
                                  ) : (
                                    <Copy className="h-3 w-3 text-slate-400" />
                                  )}
                                </button>
                              </div>

                              {r.idCardUnlockedAt && (
                                <div className="text-[11px] text-muted-foreground">
                                  {new Date(r.idCardUnlockedAt).toLocaleString('en-IN', {
                                    dateStyle: 'medium',
                                    timeStyle: 'short'
                                  })}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>

                        {/* Downloads */}
                        <TableCell className="py-3 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <Badge variant={r.idCardDownloadCount > 0 ? 'default' : 'outline'} className="text-xs font-bold">
                              <Download className="h-3 w-3 mr-1" />
                              {r.idCardDownloadCount} downloads
                            </Badge>

                            {r.idCardDownloadCount > 0 && (
                              <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-mono">
                                <span>PDF:{r.idCardPdfDownloadCount}</span>
                                <span>•</span>
                                <span>F:{r.idCardFrontPngDownloadCount}</span>
                                <span>•</span>
                                <span>B:{r.idCardBackPngDownloadCount}</span>
                              </div>
                            )}
                          </div>
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleViewCard(r)}
                              className="h-8 text-xs font-semibold gap-1.5"
                            >
                              <Eye className="h-3.5 w-3.5 text-primary" />
                              View Card
                            </Button>

                            {r.idCardGenerated && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setProviderToReset(r)}
                                className="h-8 px-2 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20 border-rose-200 dark:border-rose-900/40"
                                title="Reset / Delete ID Card so provider can regenerate"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </TabsContent>

      <TabsContent value="card_settings" className="mt-0">
        <ProviderIdCardSettingsTab />
      </TabsContent>
    </Tabs>

        {/* Card Preview and Download Modal */}
        <ProviderIdCardModal
          provider={selectedProvider}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          currencySymbol={symbol}
          signatoryName={settings.signatoryName}
          helplinePhone={settings.helplineNumber}
          disclaimerText={settings.disclaimerText}
          validityYears={settings.validityYears}
          validityMonths={settings.validityMonths}
        />

        {/* Delete / Reset ID Card Alert Dialog */}
        <AlertDialog open={!!providerToReset} onOpenChange={(open) => !open && setProviderToReset(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-rose-600">
                <RotateCcw className="h-5 w-5" /> Reset & Delete Provider ID Card?
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-2 text-xs text-muted-foreground">
                  <div>
                    Are you sure you want to reset the generated ID card for <strong>{providerToReset?.fullName}</strong>?
                  </div>
                  <div>
                    This will clear their assigned ID card number, purchase status, and download records. The provider will then be able to generate a fresh ID card with your latest sequence and prefix settings.
                  </div>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isResetting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmReset}
                disabled={isResetting}
                className="bg-rose-600 hover:bg-rose-700 text-white"
              >
                {isResetting ? "Resetting..." : "Reset & Delete Card"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </PermissionGuard>
  );
}
