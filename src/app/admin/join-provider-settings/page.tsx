"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Loader2, Save, RotateCcw, ExternalLink, Plus, Trash2, 
  HelpCircle, Sparkles, Globe, Compass, Wallet, Layers, 
  CheckCircle2, ArrowRight, ShieldAlert, CheckSquare, AlertTriangle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { 
  type JoinProviderPageSettings, 
  DEFAULT_JOIN_PROVIDER_SETTINGS 
} from '@/types/joinProvider';
import { 
  getJoinProviderPageSettingsAction, 
  saveJoinProviderPageSettingsAction, 
  resetJoinProviderPageSettingsAction 
} from '@/app/actions/joinProviderActions';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function AdminJoinProviderSettingsPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<JoinProviderPageSettings>(DEFAULT_JOIN_PROVIDER_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      setIsLoading(true);
      try {
        const data = await getJoinProviderPageSettingsAction();
        setSettings(data);
      } catch (err) {
        console.error("Failed to load join provider settings:", err);
        toast({
          title: "Error",
          description: "Could not load page settings.",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    }
    loadSettings();
  }, [toast]);

  const handleChange = (field: keyof JoinProviderPageSettings, value: any) => {
    setSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleStatChange = (statField: keyof JoinProviderPageSettings['stats'], value: string) => {
    setSettings(prev => ({
      ...prev,
      stats: {
        ...prev.stats,
        [statField]: value
      }
    }));
  };

  const handleFaqChange = (index: number, field: 'question' | 'answer', value: string) => {
    setSettings(prev => {
      const updatedFaqs = [...prev.faqs];
      updatedFaqs[index] = {
        ...updatedFaqs[index],
        [field]: value
      };
      return { ...prev, faqs: updatedFaqs };
    });
  };

  const handleAddFaq = () => {
    setSettings(prev => ({
      ...prev,
      faqs: [
        ...prev.faqs,
        { question: "New Question?", answer: "Answer description here..." }
      ]
    }));
  };

  const handleRemoveFaq = (index: number) => {
    setSettings(prev => ({
      ...prev,
      faqs: prev.faqs.filter((_, i) => i !== index)
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await saveJoinProviderPageSettingsAction(settings);
      if (res.success) {
        toast({
          title: "Saved Successfully",
          description: "Join Provider page content has been updated.",
        });
      } else {
        toast({
          title: "Save Failed",
          description: res.message || "Could not save changes.",
          variant: "destructive"
        });
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Unexpected error occurred.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    setIsResetting(true);
    try {
      const res = await resetJoinProviderPageSettingsAction();
      if (res.success) {
        setSettings(DEFAULT_JOIN_PROVIDER_SETTINGS);
        toast({
          title: "Reset Complete",
          description: "Settings have been reset to factory defaults.",
        });
      } else {
        toast({
          title: "Reset Failed",
          description: res.message,
          variant: "destructive"
        });
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setIsResetting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-headline font-black text-foreground flex items-center gap-2">
            <span>Join Provider Page Settings</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Customize the public SEO landing page (/join-provider) for prospective service partners, technicians & tradesmen.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 w-full sm:w-auto">
          {/* Above on Mobile: Preview Button */}
          <Link href="/join-provider" target="_blank" className="w-full sm:w-auto">
            <Button variant="outline" size="sm" className="w-full sm:w-auto gap-1.5 text-xs font-semibold h-9">
              <ExternalLink className="h-4 w-4" />
              <span>Preview Live Page</span>
            </Button>
          </Link>

          {/* Below on Mobile: Reset Defaults & Save Changes side by side */}
          <div className="grid grid-cols-2 gap-2 w-full sm:w-auto sm:flex sm:items-center">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="w-full sm:w-auto gap-1.5 text-xs text-destructive hover:bg-destructive/10 border-destructive/20 h-9">
                  <RotateCcw className="h-4 w-4" />
                  <span>Reset Defaults</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reset Page to Factory Defaults?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will overwrite all custom headlines, descriptions, and FAQs on the /join-provider page with the default SEO copy.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleReset} className="bg-destructive hover:bg-destructive/90 text-white">
                    {isResetting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Yes, Reset Everything"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <Button 
              onClick={handleSave} 
              disabled={isSaving} 
              size="sm"
              className="w-full sm:w-auto gap-1.5 text-xs font-bold bg-primary text-white shadow-md h-9"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              <span>Save Changes</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Main Tabs Container */}
      <Tabs defaultValue="seo" className="space-y-6">
        <TabsList className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 h-auto p-1 bg-muted/60 rounded-xl gap-1">
          <TabsTrigger value="seo" className="text-xs py-2 font-semibold flex items-center justify-center gap-1.5">
            <Globe className="h-3.5 w-3.5 shrink-0" /> SEO Meta
          </TabsTrigger>
          <TabsTrigger value="hero" className="text-xs py-2 font-semibold flex items-center justify-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 shrink-0" /> Hero & CTA
          </TabsTrigger>
          <TabsTrigger value="policies" className="text-xs py-2 font-semibold flex items-center justify-center gap-1.5">
            <ShieldAlert className="h-3.5 w-3.5 shrink-0" /> Policies
          </TabsTrigger>
          <TabsTrigger value="steps" className="text-xs py-2 font-semibold flex items-center justify-center gap-1.5">
            <CheckSquare className="h-3.5 w-3.5 shrink-0" /> 4 Steps
          </TabsTrigger>
          <TabsTrigger value="radius" className="text-xs py-2 font-semibold flex items-center justify-center gap-1.5">
            <Compass className="h-3.5 w-3.5 shrink-0" /> Radius
          </TabsTrigger>
          <TabsTrigger value="commission" className="text-xs py-2 font-semibold flex items-center justify-center gap-1.5">
            <Wallet className="h-3.5 w-3.5 shrink-0" /> Commission
          </TabsTrigger>
          <TabsTrigger value="categories" className="text-xs py-2 font-semibold flex items-center justify-center gap-1.5">
            <Layers className="h-3.5 w-3.5 shrink-0" /> Keywords
          </TabsTrigger>
          <TabsTrigger value="faqs" className="text-xs py-2 font-semibold flex items-center justify-center gap-1.5">
            <HelpCircle className="h-3.5 w-3.5 shrink-0" /> FAQs ({settings.faqs.length})
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: SEO & METADATA */}
        <TabsContent value="seo" className="space-y-4">
          <Card className="rounded-2xl border-border/80 shadow-sm">
            <CardHeader className="p-5 pb-3">
              <CardTitle className="text-lg font-bold">Search Engine Optimization (SEO)</CardTitle>
              <CardDescription className="text-xs">
                Configure meta tags and canonical URLs for Google and search engine crawlers.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-4 pt-0">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Page Title Tag (H1 / Title)</Label>
                <Input 
                  value={settings.pageTitle} 
                  onChange={(e) => handleChange('pageTitle', e.target.value)}
                  placeholder="e.g. Join as a Service Provider & Partner | High-Paying Jobs..."
                  className="font-medium"
                />
                <p className="text-[11px] text-muted-foreground">Appears as the clickable title in Google search results.</p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Meta Description</Label>
                <Textarea 
                  value={settings.metaDescription} 
                  onChange={(e) => handleChange('metaDescription', e.target.value)}
                  rows={3}
                  className="font-medium"
                />
                <p className="text-[11px] text-muted-foreground">Summary shown under the title on Google search snippets.</p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Meta Keywords (Comma separated)</Label>
                <Textarea 
                  value={settings.metaKeywords} 
                  onChange={(e) => handleChange('metaKeywords', e.target.value)}
                  rows={3}
                  className="font-medium"
                />
                <p className="text-[11px] text-muted-foreground">Target phrases for ranking across trades and cities (e.g. carpentry jobs, plumber work).</p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Canonical URL</Label>
                <Input 
                  value={settings.canonicalUrl} 
                  onChange={(e) => handleChange('canonicalUrl', e.target.value)}
                  placeholder="https://fixbro.in/join-provider"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: HERO & BANNERS */}
        <TabsContent value="hero" className="space-y-4">
          <Card className="rounded-2xl border-border/80 shadow-sm">
            <CardHeader className="p-5 pb-3">
              <CardTitle className="text-lg font-bold">Hero Section & Visual Callout</CardTitle>
              <CardDescription className="text-xs">
                Edit the main top banner and trust signals seen by prospective service technicians.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-4 pt-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Hero Badge Text</Label>
                  <Input 
                    value={settings.heroBadge} 
                    onChange={(e) => handleChange('heroBadge', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Hero Banner Image URL</Label>
                  <Input 
                    value={settings.heroBannerImage || ''} 
                    onChange={(e) => handleChange('heroBannerImage', e.target.value)}
                    placeholder="/default-image.png"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Hero Headline (H1)</Label>
                <Input 
                  value={settings.heroHeadline} 
                  onChange={(e) => handleChange('heroHeadline', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Hero Subtitle</Label>
                <Textarea 
                  value={settings.heroSubtitle} 
                  onChange={(e) => handleChange('heroSubtitle', e.target.value)}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Primary CTA Button Text</Label>
                  <Input 
                    value={settings.heroCtaText} 
                    onChange={(e) => handleChange('heroCtaText', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Primary CTA Link</Label>
                  <Input 
                    value={settings.heroCtaLink} 
                    onChange={(e) => handleChange('heroCtaLink', e.target.value)}
                  />
                </div>
              </div>

              {/* Statistics Grid */}
              <div className="pt-4 border-t space-y-3">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Highlights & Statistics Badges</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <Input value={settings.stats.stat1Number} onChange={(e) => handleStatChange('stat1Number', e.target.value)} placeholder="10,000+" />
                    <Input value={settings.stats.stat1Label} onChange={(e) => handleStatChange('stat1Label', e.target.value)} placeholder="Bookings Dispatched" />
                  </div>
                  <div className="space-y-1">
                    <Input value={settings.stats.stat2Number} onChange={(e) => handleStatChange('stat2Number', e.target.value)} placeholder="3 Days" />
                    <Input value={settings.stats.stat2Label} onChange={(e) => handleStatChange('stat2Label', e.target.value)} placeholder="Direct Bank Payouts" />
                  </div>
                  <div className="space-y-1">
                    <Input value={settings.stats.stat3Number} onChange={(e) => handleStatChange('stat3Number', e.target.value)} placeholder="100%" />
                    <Input value={settings.stats.stat3Label} onChange={(e) => handleStatChange('stat3Label', e.target.value)} placeholder="Schedule Flexibility" />
                  </div>
                  <div className="space-y-1">
                    <Input value={settings.stats.stat4Number} onChange={(e) => handleStatChange('stat4Number', e.target.value)} placeholder="₹0" />
                    <Input value={settings.stats.stat4Label} onChange={(e) => handleStatChange('stat4Label', e.target.value)} placeholder="Registration Fee" />
                  </div>
                </div>
              </div>

              {/* Bottom CTA Banner */}
              <div className="pt-4 border-t space-y-3">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Bottom Call-to-Action Banner</Label>
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Bottom CTA Title</Label>
                  <Input 
                    value={settings.bottomCtaTitle} 
                    onChange={(e) => handleChange('bottomCtaTitle', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Bottom CTA Subtitle</Label>
                  <Textarea 
                    value={settings.bottomCtaSubtitle} 
                    onChange={(e) => handleChange('bottomCtaSubtitle', e.target.value)}
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Bottom CTA Button Text</Label>
                  <Input 
                    value={settings.bottomCtaButtonText} 
                    onChange={(e) => handleChange('bottomCtaButtonText', e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: WORK & PENALTY POLICIES */}
        <TabsContent value="policies" className="space-y-4">
          {/* Work Expectations & Area Indexing Card */}
          <Card className="rounded-2xl border-border/80 shadow-sm">
            <CardHeader className="p-5 pb-3">
              <CardTitle className="text-lg font-bold">Work Expectations & Area Indexing Policy</CardTitle>
              <CardDescription className="text-xs">
                Clarifies that bookings are not guaranteed immediately upon approval and that Google takes time to index the area.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-4 pt-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Expectations Badge</Label>
                  <Input 
                    value={settings.expectationsBadge} 
                    onChange={(e) => handleChange('expectationsBadge', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Expectations Section Title</Label>
                  <Input 
                    value={settings.expectationsTitle} 
                    onChange={(e) => handleChange('expectationsTitle', e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Expectations Description</Label>
                <Textarea 
                  value={settings.expectationsDescription} 
                  onChange={(e) => handleChange('expectationsDescription', e.target.value)}
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t">
                {/* Point 1 */}
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-amber-700">Point 1 Title (Area Indexing)</Label>
                  <Input 
                    value={settings.expectationsPoint1Title} 
                    onChange={(e) => handleChange('expectationsPoint1Title', e.target.value)}
                  />
                  <Label className="text-xs font-medium text-muted-foreground pt-1 block">Point 1 Description</Label>
                  <Textarea 
                    value={settings.expectationsPoint1Desc} 
                    onChange={(e) => handleChange('expectationsPoint1Desc', e.target.value)}
                    rows={3}
                  />
                </div>

                {/* Point 2 */}
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-emerald-700">Point 2 Title (Genuine Jobs)</Label>
                  <Input 
                    value={settings.expectationsPoint2Title} 
                    onChange={(e) => handleChange('expectationsPoint2Title', e.target.value)}
                  />
                  <Label className="text-xs font-medium text-muted-foreground pt-1 block">Point 2 Description</Label>
                  <Textarea 
                    value={settings.expectationsPoint2Desc} 
                    onChange={(e) => handleChange('expectationsPoint2Desc', e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Availability & Penalty Policy Card */}
          <Card className="rounded-2xl border-destructive/30 shadow-sm">
            <CardHeader className="p-5 pb-3">
              <CardTitle className="text-lg font-bold text-destructive flex items-center gap-2">
                <ShieldAlert className="h-5 w-5" />
                <span>Strict Availability & Cancellation Penalty Policy</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Explain the 1-day advance offline toggle rule and the penalty (e.g. 100%) for refusing or abandoning customer bookings while online.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-4 pt-0">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Section Badge</Label>
                  <Input 
                    value={settings.penaltySectionBadge} 
                    onChange={(e) => handleChange('penaltySectionBadge', e.target.value)}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Section Title</Label>
                  <Input 
                    value={settings.penaltySectionTitle} 
                    onChange={(e) => handleChange('penaltySectionTitle', e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2 sm:col-span-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Section Description</Label>
                  <Textarea 
                    value={settings.penaltySectionDescription} 
                    onChange={(e) => handleChange('penaltySectionDescription', e.target.value)}
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-destructive">Cancellation Penalty (%)</Label>
                  <Input 
                    type="number"
                    value={settings.penaltyPercentage} 
                    onChange={(e) => handleChange('penaltyPercentage', Number(e.target.value) || 100)}
                  />
                  <p className="text-[11px] text-muted-foreground">Default: 100% of booking value.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t">
                {/* Rule 1 */}
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-primary">Rule 1 Title (Turn Off 1 Day Before)</Label>
                  <Input 
                    value={settings.penaltyRule1Title} 
                    onChange={(e) => handleChange('penaltyRule1Title', e.target.value)}
                  />
                  <Label className="text-xs font-medium text-muted-foreground pt-1 block">Rule 1 Description</Label>
                  <Textarea 
                    value={settings.penaltyRule1Desc} 
                    onChange={(e) => handleChange('penaltyRule1Desc', e.target.value)}
                    rows={3}
                  />
                </div>

                {/* Rule 2 */}
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-destructive">Rule 2 Title (100% Penalty If Online)</Label>
                  <Input 
                    value={settings.penaltyRule2Title} 
                    onChange={(e) => handleChange('penaltyRule2Title', e.target.value)}
                  />
                  <Label className="text-xs font-medium text-muted-foreground pt-1 block">Rule 2 Description</Label>
                  <Textarea 
                    value={settings.penaltyRule2Desc} 
                    onChange={(e) => handleChange('penaltyRule2Desc', e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: 4 MANDATORY REGISTRATION STEPS */}
        <TabsContent value="steps" className="space-y-4">
          <Card className="rounded-2xl border-border/80 shadow-sm">
            <CardHeader className="p-5 pb-3">
              <CardTitle className="text-lg font-bold">4 Mandatory Registration Steps</CardTitle>
              <CardDescription className="text-xs">
                Detail the four sequential onboarding requirements needed before any partner application is approved.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-4 pt-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Steps Section Badge</Label>
                  <Input 
                    value={settings.stepsSectionBadge} 
                    onChange={(e) => handleChange('stepsSectionBadge', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Steps Section Title</Label>
                  <Input 
                    value={settings.stepsSectionTitle} 
                    onChange={(e) => handleChange('stepsSectionTitle', e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Steps Section Description</Label>
                <Textarea 
                  value={settings.stepsSectionDescription} 
                  onChange={(e) => handleChange('stepsSectionDescription', e.target.value)}
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t">
                {/* Step 1 */}
                <div className="p-4 rounded-xl border bg-muted/20 space-y-2">
                  <span className="text-xs font-bold text-primary">Step 1</span>
                  <Input 
                    value={settings.step1Title} 
                    onChange={(e) => handleChange('step1Title', e.target.value)}
                    placeholder="Step 1 Title"
                  />
                  <Textarea 
                    value={settings.step1Desc} 
                    onChange={(e) => handleChange('step1Desc', e.target.value)}
                    rows={2}
                    placeholder="Step 1 Description"
                  />
                </div>

                {/* Step 2 */}
                <div className="p-4 rounded-xl border bg-muted/20 space-y-2">
                  <span className="text-xs font-bold text-primary">Step 2</span>
                  <Input 
                    value={settings.step2Title} 
                    onChange={(e) => handleChange('step2Title', e.target.value)}
                    placeholder="Step 2 Title"
                  />
                  <Textarea 
                    value={settings.step2Desc} 
                    onChange={(e) => handleChange('step2Desc', e.target.value)}
                    rows={2}
                    placeholder="Step 2 Description"
                  />
                </div>

                {/* Step 3 */}
                <div className="p-4 rounded-xl border bg-muted/20 space-y-2">
                  <span className="text-xs font-bold text-primary">Step 3</span>
                  <Input 
                    value={settings.step3Title} 
                    onChange={(e) => handleChange('step3Title', e.target.value)}
                    placeholder="Step 3 Title"
                  />
                  <Textarea 
                    value={settings.step3Desc} 
                    onChange={(e) => handleChange('step3Desc', e.target.value)}
                    rows={2}
                    placeholder="Step 3 Description"
                  />
                </div>

                {/* Step 4 */}
                <div className="p-4 rounded-xl border bg-muted/20 space-y-2">
                  <span className="text-xs font-bold text-primary">Step 4</span>
                  <Input 
                    value={settings.step4Title} 
                    onChange={(e) => handleChange('step4Title', e.target.value)}
                    placeholder="Step 4 Title"
                  />
                  <Textarea 
                    value={settings.step4Desc} 
                    onChange={(e) => handleChange('step4Desc', e.target.value)}
                    rows={2}
                    placeholder="Step 4 Description"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 5: RADIUS & DISPATCH */}
        <TabsContent value="radius" className="space-y-4">
          <Card className="rounded-2xl border-border/80 shadow-sm">
            <CardHeader className="p-5 pb-3">
              <CardTitle className="text-lg font-bold">Radius Dispatch & Schedule Flexibility</CardTitle>
              <CardDescription className="text-xs">
                Explain how bookings are matched strictly within the provider&apos;s location radius, and how the Online/Offline button gives them full freedom.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-4 pt-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Section Badge</Label>
                  <Input 
                    value={settings.radiusSectionBadge} 
                    onChange={(e) => handleChange('radiusSectionBadge', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Default Radius (KM)</Label>
                  <Input 
                    type="number"
                    value={settings.radiusDefaultKm} 
                    onChange={(e) => handleChange('radiusDefaultKm', Number(e.target.value) || 10)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Section Title</Label>
                <Input 
                  value={settings.radiusSectionTitle} 
                  onChange={(e) => handleChange('radiusSectionTitle', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Section Subtitle</Label>
                <Textarea 
                  value={settings.radiusSectionDescription} 
                  onChange={(e) => handleChange('radiusSectionDescription', e.target.value)}
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t">
                {/* Radius Card */}
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-primary">Radius Card Title</Label>
                  <Input 
                    value={settings.radiusCardTitle} 
                    onChange={(e) => handleChange('radiusCardTitle', e.target.value)}
                  />
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground pt-1 block">Radius Card Description</Label>
                  <Textarea 
                    value={settings.radiusCardDescription} 
                    onChange={(e) => handleChange('radiusCardDescription', e.target.value)}
                    rows={4}
                  />
                </div>

                {/* Online/Offline Card */}
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-primary">Flexibility Card Title</Label>
                  <Input 
                    value={settings.flexibilityCardTitle} 
                    onChange={(e) => handleChange('flexibilityCardTitle', e.target.value)}
                  />
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground pt-1 block">Flexibility Card Description</Label>
                  <Textarea 
                    value={settings.flexibilityCardDescription} 
                    onChange={(e) => handleChange('flexibilityCardDescription', e.target.value)}
                    rows={4}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: COMMISSION, WITHDRAWALS & WALLET */}
        <TabsContent value="commission" className="space-y-4">
          <Card className="rounded-2xl border-border/80 shadow-sm">
            <CardHeader className="p-5 pb-3">
              <CardTitle className="text-lg font-bold">Commission, Payouts & Wallet Rules</CardTitle>
              <CardDescription className="text-xs">
                Supports placeholders: <code className="text-primary font-bold">{'{commission}'}</code> (e.g. 10%), <code className="text-primary font-bold">{'{currency}'}</code> (e.g. ₹), and <code className="text-primary font-bold">{'{min_wallet_balance}'}</code> (e.g. 100).
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-5 pt-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Section Title</Label>
                  <Input 
                    value={settings.commissionSectionTitle} 
                    onChange={(e) => handleChange('commissionSectionTitle', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Withdrawal Timeline (Days)</Label>
                  <Input 
                    type="number"
                    value={settings.onlinePayoutTimelineDays} 
                    onChange={(e) => handleChange('onlinePayoutTimelineDays', Number(e.target.value) || 3)}
                  />
                </div>
              </div>

              {/* Online Payout Terms */}
              <div className="space-y-2 pt-2 border-t">
                <Label className="text-xs font-bold uppercase tracking-wider text-blue-600">Online Customer Bookings (Earnings Page & Withdrawal Request in 3 Days)</Label>
                <Input 
                  value={settings.onlinePayoutTitle} 
                  onChange={(e) => handleChange('onlinePayoutTitle', e.target.value)}
                  placeholder="Card title..."
                />
                <Textarea 
                  value={settings.onlinePayoutDescription} 
                  onChange={(e) => handleChange('onlinePayoutDescription', e.target.value)}
                  rows={3}
                />
              </div>

              {/* Cash on-site Terms */}
              <div className="space-y-2 pt-2 border-t">
                <Label className="text-xs font-bold uppercase tracking-wider text-green-700">Cash / Pay After Service (100% Collected On-Site)</Label>
                <Input 
                  value={settings.cashPaymentTitle} 
                  onChange={(e) => handleChange('cashPaymentTitle', e.target.value)}
                  placeholder="Card title..."
                />
                <Textarea 
                  value={settings.cashPaymentDescription} 
                  onChange={(e) => handleChange('cashPaymentDescription', e.target.value)}
                  rows={3}
                />
              </div>

              {/* Minimum Wallet Balance Rule */}
              <div className="space-y-2 pt-2 border-t">
                <Label className="text-xs font-bold uppercase tracking-wider text-amber-700">Minimum Prepaid Wallet Balance Rule</Label>
                <Input 
                  value={settings.walletRulesTitle} 
                  onChange={(e) => handleChange('walletRulesTitle', e.target.value)}
                  placeholder="Card title..."
                />
                <Textarea 
                  value={settings.walletRulesDescription} 
                  onChange={(e) => handleChange('walletRulesDescription', e.target.value)}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 5: CATEGORY KEYWORDS */}
        <TabsContent value="categories" className="space-y-4">
          <Card className="rounded-2xl border-border/80 shadow-sm">
            <CardHeader className="p-5 pb-3">
              <CardTitle className="text-lg font-bold">Category Jobs Directory & SEO Phrasing</CardTitle>
              <CardDescription className="text-xs">
                Supports placeholder <code className="text-primary font-bold">{'{category}'}</code>. Every active category from your database will automatically render with these keyword templates.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-4 pt-0">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Category Section Title</Label>
                <Input 
                  value={settings.categorySectionTitle} 
                  onChange={(e) => handleChange('categorySectionTitle', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Category Section Description</Label>
                <Textarea 
                  value={settings.categorySectionDescription} 
                  onChange={(e) => handleChange('categorySectionDescription', e.target.value)}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Dynamic Keyword Template (Rendered under each category card)</Label>
                <Input 
                  value={settings.categoryKeywordTemplate} 
                  onChange={(e) => handleChange('categoryKeywordTemplate', e.target.value)}
                  placeholder="e.g. Join {category} Category Provider | {category} Job & Work..."
                />
                <p className="text-[11px] text-muted-foreground">
                  Example preview: <em>Join Carpentry Category Provider | Carpentry Job & Work Opportunities | Register for Carpentry Service Work</em>
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Category Card Action Button Text</Label>
                <Input 
                  value={settings.categoryCardCtaText} 
                  onChange={(e) => handleChange('categoryCardCtaText', e.target.value)}
                  placeholder="Join as {category} Pro"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 6: FAQS */}
        <TabsContent value="faqs" className="space-y-4">
          <Card className="rounded-2xl border-border/80 shadow-sm">
            <CardHeader className="p-5 pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold">Frequently Asked Questions (FAQs)</CardTitle>
                <CardDescription className="text-xs">
                  These FAQs are rendered both visually and as Google FAQPage structured schema for rich snippets.
                </CardDescription>
              </div>
              <Button size="sm" onClick={handleAddFaq} className="gap-1 text-xs">
                <Plus className="h-4 w-4" /> Add FAQ
              </Button>
            </CardHeader>
            <CardContent className="p-5 space-y-4 pt-0">
              {settings.faqs.map((faq, index) => (
                <div key={index} className="p-4 rounded-xl border border-border/80 bg-muted/20 space-y-3 relative group">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-primary uppercase">FAQ #{index + 1}</span>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => handleRemoveFaq(index)} 
                      className="h-7 w-7 text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-bold text-muted-foreground">Question</Label>
                    <Input 
                      value={faq.question} 
                      onChange={(e) => handleFaqChange(index, 'question', e.target.value)}
                      className="bg-background font-semibold text-sm"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-bold text-muted-foreground">Answer</Label>
                    <Textarea 
                      value={faq.answer} 
                      onChange={(e) => handleFaqChange(index, 'answer', e.target.value)}
                      rows={3}
                      className="bg-background text-sm leading-relaxed"
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Floating Save Bar */}
      <div className="sticky bottom-4 z-40 bg-card border border-border shadow-xl rounded-2xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <span>Changes are reflected instantly on /join-provider upon saving.</span>
        </div>
        <Button onClick={handleSave} disabled={isSaving} className="font-bold gap-2">
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          <span>Save Changes</span>
        </Button>
      </div>
    </div>
  );
}
