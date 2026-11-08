"use client";

import React, { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Download, 
  FileText, 
  Image as ImageIcon, 
  RefreshCw, 
  Loader2, 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  Copy, 
  Check,
  CreditCard
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { ProviderIdCardRecord } from '@/types/providerAreaAndId';
import { trackIdCardDownloadAction } from '@/app/actions/providerIdCardActions';
import OfficialIdCardView from '@/components/shared/OfficialIdCardView';
import { 
  type IdCardRenderOptions, 
  renderFrontCardCanvas, 
  renderBackCardCanvas, 
  generatePvcPdf 
} from '@/lib/idCardRenderer';

interface ProviderIdCardModalProps {
  provider: ProviderIdCardRecord | null;
  isOpen: boolean;
  onClose: () => void;
  currencySymbol?: string;
  signatoryName?: string;
  helplinePhone?: string;
  disclaimerText?: string;
  validityYears?: number;
  validityMonths?: number;
}

export default function ProviderIdCardModal({
  provider,
  isOpen,
  onClose,
  currencySymbol = "₹",
  signatoryName = "Authorized Signatory - FixBro",
  helplinePhone = "+91 8000 123 456",
  disclaimerText = "This ID is not issued by Government.",
  validityYears = 2,
  validityMonths = 0,
}: ProviderIdCardModalProps) {
  const { toast } = useToast();
  const [activeSide, setActiveSide] = useState<'front' | 'back'>('front');
  const [isExporting, setIsExporting] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const frontCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const backCanvasRef = useRef<HTMLCanvasElement | null>(null);

  if (!provider) return null;

  const providerName = (provider.fullName || 'Authorized Partner').toUpperCase();
  const categoryLabel = provider.workCategoryName || 'Certified Technician';
  const idNumber = provider.idCardNumber || '3617 0760 1001';

  const issueDate = provider.idCardUnlockedAt || provider.idCardGeneratedAt ? new Date(provider.idCardUnlockedAt || provider.idCardGeneratedAt!) : new Date();
  const issueDateStr = `${String(issueDate.getMonth() + 1).padStart(2, '0')}/${issueDate.getFullYear()}`;
  
  const vYears = Number(validityYears ?? 0);
  const vMonths = Number(validityMonths ?? 0);
  const totalMonths = (vYears === 0 && vMonths === 0) ? 24 : (vYears * 12 + vMonths);

  let validThruDate: Date;
  if (provider.idCardExpiresAt) {
    validThruDate = new Date(provider.idCardExpiresAt);
  } else {
    validThruDate = new Date(issueDate.getTime());
    validThruDate.setMonth(validThruDate.getMonth() + totalMonths);
  }
  const validThruStr = `${String(validThruDate.getMonth() + 1).padStart(2, '0')}/${validThruDate.getFullYear()}`;

  const copyToClipboard = (text: string, fieldKey: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldKey);
    toast({ title: "Copied!", description: `Copied to clipboard.` });
    setTimeout(() => setCopiedField(null), 2000);
  };

  const cardRenderOptions: IdCardRenderOptions = {
    providerName,
    categoryName: categoryLabel,
    skillLevelLabel: provider.skillLevelLabel || 'Skilled Professional',
    gender: provider.gender || 'Male',
    dob: provider.dob,
    idCardNumber: idNumber,
    profilePhotoUrl: provider.profilePhotoUrl,
    signatureUrl: provider.signatureUrl,
    residentialAddress: provider.residentialAddress || provider.workAreaAddress || 'Address on record',
    mobileNumber: provider.mobileNumber || '',
    email: provider.email || '',
    helplinePhone,
    signatoryName,
    issueDateStr,
    validThruStr,
    disclaimerText,
    verifyUrl: `https://labour.fixbro.in/verify/provider/${provider.providerId}`,
  };

  // Download Front PNG
  const handleDownloadFrontPng = async () => {
    setIsExporting(true);
    try {
      const dataUrl = await renderFrontCardCanvas(cardRenderOptions, frontCanvasRef.current);
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `Indian_${categoryLabel.replace(/\s+/g, '_')}_ID_Front_${idNumber.replace(/\s+/g, '')}.png`;
      a.click();
      trackIdCardDownloadAction(provider.providerId, 'front_png').catch(console.error);
      toast({ title: "Downloaded Front PNG", description: "300 DPI high resolution front card saved." });
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to download image", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  // Download Back PNG
  const handleDownloadBackPng = async () => {
    setIsExporting(true);
    try {
      const dataUrl = await renderBackCardCanvas(cardRenderOptions, backCanvasRef.current);
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `Indian_${categoryLabel.replace(/\s+/g, '_')}_ID_Back_${idNumber.replace(/\s+/g, '')}.png`;
      a.click();
      trackIdCardDownloadAction(provider.providerId, 'back_png').catch(console.error);
      toast({ title: "Downloaded Back PNG", description: "300 DPI high resolution back card saved." });
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to download image", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  // Download PVC Print Ready PDF
  const handleDownloadPdf = async () => {
    setIsExporting(true);
    try {
      const frontDataUrl = await renderFrontCardCanvas(cardRenderOptions, frontCanvasRef.current);
      const backDataUrl = await renderBackCardCanvas(cardRenderOptions, backCanvasRef.current);

      generatePvcPdf(
        frontDataUrl,
        backDataUrl,
        `FixBro_PVC_Card_${idNumber.replace(/\s+/g, '')}.pdf`
      );

      trackIdCardDownloadAction(provider.providerId, 'pdf').catch(console.error);
      toast({
        title: "Downloaded PVC Print PDF",
        description: "Official 85.6mm x 54mm PDF generated successfully."
      });
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to generate PDF", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[92vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="pb-3 border-b">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <ShieldCheck className="h-6 w-6 text-primary" />
                Indian {categoryLabel} ID Card • {providerName}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Standard CR80 PVC Printable Plastic Card (85.6mm × 54mm) with Indian Flag theme & 3-Lion emblem
              </DialogDescription>
            </div>

            {/* Toggle Front / Back Preview */}
            <div className="flex items-center gap-2">
              <Button
                variant={activeSide === 'front' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveSide('front')}
                className="text-xs h-8"
              >
                Front Side
              </Button>
              <Button
                variant={activeSide === 'back' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveSide('back')}
                className="text-xs h-8"
              >
                Back Side
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveSide(activeSide === 'front' ? 'back' : 'front')}
                className="text-xs h-8 flex items-center gap-1"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Flip
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Live Interactive Card Preview (Exact CR80 aspect ratio) */}
        <div className="flex justify-center py-4">
          <OfficialIdCardView data={cardRenderOptions} activeSide={activeSide} />
        </div>

        {/* Hidden canvases for 300 DPI exports */}
        <canvas ref={frontCanvasRef} style={{ display: 'none' }} />
        <canvas ref={backCanvasRef} style={{ display: 'none' }} />

        {/* Admin Download Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-2 pt-1 pb-4 border-b">
          <Button
            onClick={handleDownloadPdf}
            disabled={isExporting}
            className="h-9 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-sm"
          >
            {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Download PVC Print PDF (CR80)
          </Button>

          <Button
            onClick={handleDownloadFrontPng}
            disabled={isExporting}
            variant="outline"
            className="h-9 text-xs font-semibold flex items-center gap-1.5"
          >
            <ImageIcon className="h-3.5 w-3.5 text-sky-600" />
            Download Front Image (PNG)
          </Button>

          <Button
            onClick={handleDownloadBackPng}
            disabled={isExporting}
            variant="outline"
            className="h-9 text-xs font-semibold flex items-center gap-1.5"
          >
            <ImageIcon className="h-3.5 w-3.5 text-indigo-600" />
            Download Back Image (PNG)
          </Button>
        </div>

        {/* Detailed Provider Metrics: Purchase Status & Download History */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3">
          {/* Purchase Details */}
          <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5">
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <CreditCard className="h-4 w-4 text-primary" /> Purchase & Unlock Info
            </h4>

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-200/60 dark:border-slate-800">
                <span className="text-muted-foreground">Unique ID Number:</span>
                <button
                  onClick={() => copyToClipboard(idNumber, 'ID Number')}
                  className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100 hover:underline flex items-center gap-1"
                >
                  <span>{idNumber}</span>
                  {copiedField === 'idNumber' ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3 text-slate-400" />}
                </button>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-slate-200/60 dark:border-slate-800">
                <span className="text-muted-foreground">Unlock Status:</span>
                {provider.idCardUnlocked ? (
                  <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[10px]">
                    <CheckCircle2 className="h-3 w-3 mr-1" /> Unlocked / Purchased
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-amber-600 dark:text-amber-400 border-amber-400/40 text-[10px]">
                    <Clock className="h-3 w-3 mr-1" /> Pending Unlock
                  </Badge>
                )}
              </div>

              <div className="flex justify-between items-center py-1 border-b border-slate-200/60 dark:border-slate-800">
                <span className="text-muted-foreground">Amount Paid:</span>
                <span className="font-semibold text-foreground">
                  {provider.idCardPaidAmount ? `${currencySymbol}${provider.idCardPaidAmount}` : (provider.idCardUnlocked ? 'Free (₹0)' : '—')}
                </span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-slate-200/60 dark:border-slate-800">
                <span className="text-muted-foreground">Razorpay Payment ID:</span>
                {provider.idCardPaymentId ? (
                  <button
                    onClick={() => copyToClipboard(provider.idCardPaymentId!, 'payId')}
                    className="font-mono text-[11px] text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1"
                  >
                    <span>{provider.idCardPaymentId}</span>
                    {copiedField === 'payId' ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3 text-slate-400" />}
                  </button>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </div>

              <div className="flex justify-between items-center py-1">
                <span className="text-muted-foreground">Razorpay Order ID:</span>
                {provider.idCardOrderId ? (
                  <button
                    onClick={() => copyToClipboard(provider.idCardOrderId!, 'orderId')}
                    className="font-mono text-[11px] text-slate-700 dark:text-slate-300 hover:underline flex items-center gap-1"
                  >
                    <span>{provider.idCardOrderId}</span>
                    {copiedField === 'orderId' ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3 text-slate-400" />}
                  </button>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </div>
            </div>
          </div>

          {/* Download Tracking Metrics */}
          <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5">
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <Download className="h-4 w-4 text-emerald-600" /> Download Statistics
            </h4>

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-200/60 dark:border-slate-800">
                <span className="text-muted-foreground">Total Downloads:</span>
                <span className="font-bold text-sm text-foreground">
                  {provider.idCardDownloadCount || 0} times
                </span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-slate-200/60 dark:border-slate-800">
                <span className="text-muted-foreground">Formats Breakdown:</span>
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className="text-[10px] py-0 px-1.5">PDF: {provider.idCardPdfDownloadCount || 0}</Badge>
                  <Badge variant="outline" className="text-[10px] py-0 px-1.5">Front: {provider.idCardFrontPngDownloadCount || 0}</Badge>
                  <Badge variant="outline" className="text-[10px] py-0 px-1.5">Back: {provider.idCardBackPngDownloadCount || 0}</Badge>
                </div>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-slate-200/60 dark:border-slate-800">
                <span className="text-muted-foreground">Last Downloaded:</span>
                <span className="font-medium text-foreground">
                  {provider.idCardLastDownloadedAt ? new Date(provider.idCardLastDownloadedAt).toLocaleString('en-IN', {
                    dateStyle: 'medium',
                    timeStyle: 'short'
                  }) : 'Never'}
                </span>
              </div>

              <div className="flex justify-between items-center py-1">
                <span className="text-muted-foreground">Gender & Skill Level:</span>
                <span className="font-medium text-foreground capitalize">
                  {provider.gender || 'Male'} • {provider.skillLevelLabel || 'Skilled'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Download Event History Log */}
        {provider.idCardDownloads && provider.idCardDownloads.length > 0 && (
          <div className="mt-3 pt-3 border-t">
            <h5 className="text-xs font-semibold text-muted-foreground mb-2">
              Recent Download History Log (Latest {provider.idCardDownloads.length})
            </h5>
            <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
              {provider.idCardDownloads.map((dl, idx) => (
                <div 
                  key={idx} 
                  className="flex items-center justify-between text-[11px] p-2 rounded bg-slate-100 dark:bg-slate-800/60"
                >
                  <span className="flex items-center gap-1.5 font-medium capitalize">
                    {dl.type === 'pdf' ? (
                      <FileText className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <ImageIcon className="h-3.5 w-3.5 text-sky-600" />
                    )}
                    {dl.type.replace('_', ' ').toUpperCase()} Download
                  </span>
                  <span className="text-muted-foreground font-mono text-[10px]">
                    {new Date(dl.downloadedAt).toLocaleString('en-IN', {
                      dateStyle: 'short',
                      timeStyle: 'medium'
                    })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
