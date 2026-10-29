"use client";

import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Save,
  RotateCcw,
  Sliders,
  Armchair,
  Home,
  CheckCircle,
  Loader2,
  Plus,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import {
  DEFAULT_MARKETPLACE_SETTINGS,
  type MarketplaceSettings,
} from '@/types/marketplace';
import {
  getMarketplaceSettingsAction,
  saveMarketplaceSettingsAction,
} from '@/app/actions/marketplaceSettingsActions';

export default function AdminMarketplaceSettingsPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<MarketplaceSettings>(DEFAULT_MARKETPLACE_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const data = await getMarketplaceSettingsAction();
        setSettings(data);
      } catch (err) {
        console.error('Failed to load settings:', err);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await saveMarketplaceSettingsAction(settings);
      if (res.success) {
        toast({
          title: "Settings Saved Successfully! ✅",
          description: "Marketplace expiration, safety warning, and SEO updated.",
        });
      } else {
        toast({
          title: "Save Failed",
          description: res.message || "Could not save settings.",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to save settings.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (confirm("Reset marketplace settings to default values?")) {
      setSettings(DEFAULT_MARKETPLACE_SETTINGS);
    }
  };

  const addWarningPoint = () => {
    setSettings(prev => ({
      ...prev,
      safetyWarningPoints: [...prev.safetyWarningPoints, ''],
    }));
  };

  const updateWarningPoint = (idx: number, val: string) => {
    setSettings(prev => {
      const copy = [...prev.safetyWarningPoints];
      copy[idx] = val;
      return { ...prev, safetyWarningPoints: copy };
    });
  };

  const removeWarningPoint = (idx: number) => {
    setSettings(prev => ({
      ...prev,
      safetyWarningPoints: prev.safetyWarningPoints.filter((_, i) => i !== idx),
    }));
  };

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted-foreground">Loading marketplace settings...</span>
      </div>
    );
  }

  return (
    <div className="p-2 sm:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sliders className="h-6 w-6 text-primary" />
            Marketplace Settings
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure listing expiration, fraud warning pop-up disclaimer, and SEO for Buy & Sell Furniture and Rent a Home.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleReset} className="rounded-xl text-xs gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" />
            Reset Defaults
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
            className="bg-primary text-white rounded-xl text-xs gap-1.5 font-bold"
          >
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save Settings
          </Button>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* General Expiration Settings */}
        <Card className="rounded-3xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Ad Expiration & Lifecycle</CardTitle>
            <CardDescription className="text-xs">
              Listings will automatically expire and hide from public view after this many days, unless the user clicks Republish.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="expirationDays" className="font-semibold text-sm">
                  Listing Expiration Duration (Days) *
                </Label>
                <Input
                  id="expirationDays"
                  type="number"
                  min="1"
                  max="365"
                  value={settings.expirationDays}
                  onChange={(e) => setSettings({ ...settings, expirationDays: parseInt(e.target.value) || 30 })}
                  className="rounded-xl h-11"
                  required
                />
                <p className="text-[11px] text-muted-foreground">Default: 30 days. Users get 1-click republish.</p>
              </div>

              <div className="space-y-3 pt-4 sm:pt-6">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.isFurnitureEnabled}
                    onChange={(e) => setSettings({ ...settings, isFurnitureEnabled: e.target.checked })}
                    className="h-4 w-4 rounded text-primary focus:ring-primary"
                  />
                  <span className="text-sm font-semibold">Enable Buy & Sell Furniture Section</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.isRentalsEnabled}
                    onChange={(e) => setSettings({ ...settings, isRentalsEnabled: e.target.checked })}
                    className="h-4 w-4 rounded text-primary focus:ring-primary"
                  />
                  <span className="text-sm font-semibold">Enable Rent a Home Section</span>
                </label>

                <label className="flex items-start gap-2.5 cursor-pointer p-3 rounded-2xl bg-muted/40 border border-border/60 hover:bg-muted/60 transition-colors">
                  <input
                    type="checkbox"
                    checked={settings.showMarketplaceOnHomeServices !== false}
                    onChange={(e) => setSettings({ ...settings, showMarketplaceOnHomeServices: e.target.checked })}
                    className="h-4 w-4 rounded text-primary focus:ring-primary mt-0.5 shrink-0"
                  />
                  <div>
                    <span className="text-sm font-semibold block text-foreground">
                      Show Marketplace Entry on Home Services Page
                    </span>
                    <span className="text-xs text-muted-foreground block mt-0.5">
                      Controls visibility of both the top switcher tabs (Home Services | Buy &amp; Sell | Rent a Home) and the bottom navigation bar &quot;Sell&quot; button on the main home services page. When disabled, both sections are hidden.
                    </span>
                  </div>
                </label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Fraud Prevention Pop-up Warning */}
        <Card className="rounded-3xl shadow-sm border-amber-200 dark:border-amber-900/60 bg-amber-50/20">
          <CardHeader>
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <ShieldAlert className="h-5 w-5" />
              <CardTitle className="text-lg">Mandatory Call Button Warning Pop-Up</CardTitle>
            </div>
            <CardDescription className="text-xs">
              This disclaimer appears in both mobile and desktop view whenever any user attempts to click the "Call" button.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="safetyTitle" className="font-semibold text-sm">
                Pop-Up Header / Title *
              </Label>
              <Input
                id="safetyTitle"
                value={settings.safetyWarningTitle}
                onChange={(e) => setSettings({ ...settings, safetyWarningTitle: e.target.value })}
                className="rounded-xl h-11"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="safetyText" className="font-semibold text-sm">
                Platform Disclaimer Subtitle
              </Label>
              <Textarea
                id="safetyText"
                value={settings.safetyWarningText}
                onChange={(e) => setSettings({ ...settings, safetyWarningText: e.target.value })}
                rows={2}
                className="rounded-xl text-xs"
              />
            </div>

            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <Label className="font-semibold text-sm">Caution Bullet Points</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addWarningPoint}
                  className="rounded-xl text-xs gap-1"
                >
                  <Plus className="h-3 w-3" />
                  Add Point
                </Button>
              </div>

              <div className="space-y-2">
                {settings.safetyWarningPoints.map((point, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input
                      value={point}
                      onChange={(e) => updateWarningPoint(idx, e.target.value)}
                      placeholder={`Warning note #${idx + 1}`}
                      className="rounded-xl h-10 text-xs bg-white dark:bg-card"
                    />
                    <button
                      type="button"
                      onClick={() => removeWarningPoint(idx)}
                      className="p-2 text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* SEO Settings */}
        <Card className="rounded-3xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Marketplace SEO Configuration</CardTitle>
            <CardDescription className="text-xs">
              Page titles and meta descriptions for search engine indexing (Google, Bing).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3 p-4 rounded-2xl border bg-gray-50/50 dark:bg-muted/20">
              <div className="flex items-center gap-2 font-bold text-sm text-gray-900 dark:text-white">
                <Armchair className="h-4 w-4 text-primary" />
                <span>Buy & Sell Furniture (/furniture)</span>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">SEO Meta Title</Label>
                <Input
                  value={settings.furnitureSeoTitle}
                  onChange={(e) => setSettings({ ...settings, furnitureSeoTitle: e.target.value })}
                  className="rounded-xl h-10 text-xs bg-white dark:bg-card"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">SEO Meta Description</Label>
                <Textarea
                  value={settings.furnitureSeoDescription}
                  onChange={(e) => setSettings({ ...settings, furnitureSeoDescription: e.target.value })}
                  rows={2}
                  className="rounded-xl text-xs bg-white dark:bg-card"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="space-y-1.5">
                  <Label className="text-xs">SEO Keywords (Comma Separated)</Label>
                  <Input
                    value={settings.furnitureSeoKeywords || ''}
                    onChange={(e) => setSettings({ ...settings, furnitureSeoKeywords: e.target.value })}
                    placeholder="furniture near me, sofa, table, bed..."
                    className="rounded-xl h-9 text-xs bg-white dark:bg-card"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Canonical URL</Label>
                  <Input
                    value={settings.furnitureCanonicalUrl || ''}
                    onChange={(e) => setSettings({ ...settings, furnitureCanonicalUrl: e.target.value })}
                    placeholder="https://fixbro.in/furniture"
                    className="rounded-xl h-9 text-xs bg-white dark:bg-card"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3 p-4 rounded-2xl border bg-gray-50/50 dark:bg-muted/20">
              <div className="flex items-center gap-2 font-bold text-sm text-gray-900 dark:text-white">
                <Home className="h-4 w-4 text-primary" />
                <span>Rent a Home (/rent-home)</span>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">SEO Meta Title</Label>
                <Input
                  value={settings.rentalsSeoTitle}
                  onChange={(e) => setSettings({ ...settings, rentalsSeoTitle: e.target.value })}
                  className="rounded-xl h-10 text-xs bg-white dark:bg-card"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">SEO Meta Description</Label>
                <Textarea
                  value={settings.rentalsSeoDescription}
                  onChange={(e) => setSettings({ ...settings, rentalsSeoDescription: e.target.value })}
                  rows={2}
                  className="rounded-xl text-xs bg-white dark:bg-card"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="space-y-1.5">
                  <Label className="text-xs">SEO Keywords (Comma Separated)</Label>
                  <Input
                    value={settings.rentalsSeoKeywords || ''}
                    onChange={(e) => setSettings({ ...settings, rentalsSeoKeywords: e.target.value })}
                    placeholder="rent home near me, 1bhk, 2bhk, room rent..."
                    className="rounded-xl h-9 text-xs bg-white dark:bg-card"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Canonical URL</Label>
                  <Input
                    value={settings.rentalsCanonicalUrl || ''}
                    onChange={(e) => setSettings({ ...settings, rentalsCanonicalUrl: e.target.value })}
                    placeholder="https://fixbro.in/rent-home"
                    className="rounded-xl h-9 text-xs bg-white dark:bg-card"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end pt-2">
          <Button
            type="submit"
            disabled={isSaving}
            className="bg-primary text-white font-bold px-6 py-2 rounded-2xl shadow-md gap-2"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save All Marketplace Settings
          </Button>
        </div>
      </form>
    </div>
  );
}
