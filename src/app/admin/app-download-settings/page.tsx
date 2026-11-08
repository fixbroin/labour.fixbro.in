"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import PermissionGuard from "@/components/admin/PermissionGuard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Download,
  Save,
  Loader2,
  ExternalLink,
  Smartphone,
  Globe,
  Info,
  CheckCircle2,
  Radio,
  Apple,
  Store,
} from "lucide-react";
import type { AppDownloadSettings, AppDownloadMode } from "@/types/firestore";

const DEFAULT_SETTINGS: AppDownloadSettings = {
  mode: "pwa",
  androidUserUrl: "https://play.google.com/store/apps/details?id=com.fix.bro.user",
  androidProviderUrl: "https://play.google.com/store/apps/details?id=com.fixbro.provider",
  iosUserUrl: "",
  iosProviderUrl: "",
};

export default function AppDownloadSettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [settings, setSettings] = useState<AppDownloadSettings>(DEFAULT_SETTINGS);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/app-download-settings", { cache: "no-store" });
      const data = await res.json();
      if (data.success && data.settings) {
        setSettings(data.settings);
      }
    } catch (error: any) {
      console.error("Error fetching app download settings:", error);
      toast({
        title: "Error",
        description: "Failed to load app download settings.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handlePwaToggle = (checked: boolean) => {
    if (checked) {
      setSettings((prev) => ({ ...prev, mode: "pwa" }));
    } else {
      setSettings((prev) => ({ ...prev, mode: "disabled" }));
    }
  };

  const handleNativeToggle = (checked: boolean) => {
    if (checked) {
      setSettings((prev) => ({ ...prev, mode: "native_stores" }));
    } else {
      setSettings((prev) => ({ ...prev, mode: "disabled" }));
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const token = await user?.getIdToken();
      const res = await fetch("/api/app-download-settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(settings),
      });

      const data = await res.json();
      if (data.success) {
        toast({
          title: "Settings Saved",
          description: "App download configuration has been updated successfully.",
        });
        if (data.settings) {
          setSettings(data.settings);
        }
      } else {
        throw new Error(data.error || "Failed to save settings.");
      }
    } catch (error: any) {
      console.error("Save error:", error);
      toast({
        title: "Save Failed",
        description: error.message || "Failed to update settings.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm font-semibold text-muted-foreground">Loading app download settings...</p>
      </div>
    );
  }

  const isPwaActive = settings.mode === "pwa";
  const isNativeActive = settings.mode === "native_stores";

  return (
    <PermissionGuard moduleId="app_download_settings" action="read">
      <div className="mx-auto max-w-5xl space-y-8 p-4 sm:p-6 lg:p-8 animate-in fade-in duration-500">
        {/* Header */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Download className="h-5 w-5" />
              </div>
              <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">
                App Download Settings
              </h1>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Configure whether users and providers download the Progressive Web App (PWA) or are directed to Google Play & Apple App Store.
            </p>
          </div>

          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="rounded-xl px-6 font-bold shadow-lg shadow-primary/20"
          >
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Changes
          </Button>
        </div>

        {/* Mode Selector Card */}
        <Card className="border-2 border-primary/20 shadow-md">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-black flex items-center gap-2">
                  <Radio className="h-5 w-5 text-primary" />
                  App Distribution Mode
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm mt-1">
                  Choose which download method is active. Only one mode can be active at a time, or both can be disabled.
                </CardDescription>
              </div>

              <Badge
                variant="outline"
                className={`px-3 py-1 text-xs font-bold ${
                  isPwaActive
                    ? "border-teal-500 bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300"
                    : isNativeActive
                    ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                    : "border-slate-400 bg-slate-50 text-slate-600 dark:bg-slate-900 dark:text-slate-400"
                }`}
              >
                {isPwaActive ? "PWA Mode Active" : isNativeActive ? "Native App Stores Active" : "All Downloads Disabled"}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Option 1: PWA Mode */}
              <div
                className={`relative flex flex-col justify-between rounded-2xl border-2 p-5 transition-all ${
                  isPwaActive
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border bg-card hover:border-primary/40"
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300">
                        <Globe className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-foreground">PWA (Progressive Web App)</h4>
                        <span className="text-[11px] text-muted-foreground">Instant install from browser</span>
                      </div>
                    </div>
                    <Switch
                      checked={isPwaActive}
                      onCheckedChange={handlePwaToggle}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground pt-1 leading-relaxed">
                    Users and technicians install the web app straight from Chrome or Safari to their home screen without opening any app store.
                  </p>
                </div>

                {isPwaActive && (
                  <div className="mt-4 flex items-center gap-1.5 text-xs font-bold text-teal-600 dark:text-teal-400">
                    <CheckCircle2 className="h-4 w-4" /> Active on Customer & Provider Panels
                  </div>
                )}
              </div>

              {/* Option 2: Native App Stores */}
              <div
                className={`relative flex flex-col justify-between rounded-2xl border-2 p-5 transition-all ${
                  isNativeActive
                    ? "border-blue-500 bg-blue-50/50 shadow-sm dark:bg-blue-950/20"
                    : "border-border bg-card hover:border-blue-500/40"
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                        <Store className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-foreground">Native App Stores</h4>
                        <span className="text-[11px] text-muted-foreground">Google Play & Apple Store</span>
                      </div>
                    </div>
                    <Switch
                      checked={isNativeActive}
                      onCheckedChange={handleNativeToggle}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground pt-1 leading-relaxed">
                    Tapping the download button redirects Android users to Google Play Store and iPhone users to Apple App Store automatically.
                  </p>
                </div>

                {isNativeActive && (
                  <div className="mt-4 flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400">
                    <CheckCircle2 className="h-4 w-4" /> Active on Customer & Provider Panels
                  </div>
                )}
              </div>
            </div>

            {/* Admin Panel Notice */}
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-900 dark:text-amber-200">
              <div className="flex items-start gap-2.5">
                <Info className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-bold text-amber-950 dark:text-amber-100">Admin Panel Note:</p>
                  <p>
                    The Admin Panel always uses the <strong>PWA Web App</strong> method so administrators can install the admin interface onto their devices regardless of which store mode is selected.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Store Links Configuration */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Android URLs */}
          <Card className="border-border shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Smartphone className="h-5 w-5 text-green-600" />
                Android Apps (Google Play Store)
              </CardTitle>
              <CardDescription className="text-xs">
                Links used when an Android visitor clicks the download button.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="androidUserUrl" className="text-xs font-bold">
                  Customer Android App URL
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="androidUserUrl"
                    value={settings.androidUserUrl}
                    onChange={(e) => setSettings({ ...settings, androidUserUrl: e.target.value })}
                    placeholder="https://play.google.com/store/apps/details?id=..."
                    className="text-xs"
                  />
                  {settings.androidUserUrl && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => window.open(settings.androidUserUrl, "_blank")}
                      title="Test link"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="androidProviderUrl" className="text-xs font-bold">
                  Provider Android App URL
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="androidProviderUrl"
                    value={settings.androidProviderUrl}
                    onChange={(e) => setSettings({ ...settings, androidProviderUrl: e.target.value })}
                    placeholder="https://play.google.com/store/apps/details?id=..."
                    className="text-xs"
                  />
                  {settings.androidProviderUrl && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => window.open(settings.androidProviderUrl, "_blank")}
                      title="Test link"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* iOS URLs */}
          <Card className="border-border shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Apple className="h-5 w-5 text-slate-800 dark:text-slate-200" />
                iOS Apps (Apple App Store)
              </CardTitle>
              <CardDescription className="text-xs">
                Links used when an iPhone / iPad visitor clicks the download button.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="iosUserUrl" className="text-xs font-bold">
                  Customer iOS App URL
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="iosUserUrl"
                    value={settings.iosUserUrl}
                    onChange={(e) => setSettings({ ...settings, iosUserUrl: e.target.value })}
                    placeholder="https://apps.apple.com/app/fixbro/id..."
                    className="text-xs"
                  />
                  {settings.iosUserUrl && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => window.open(settings.iosUserUrl, "_blank")}
                      title="Test link"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="iosProviderUrl" className="text-xs font-bold">
                  Provider iOS App URL
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="iosProviderUrl"
                    value={settings.iosProviderUrl}
                    onChange={(e) => setSettings({ ...settings, iosProviderUrl: e.target.value })}
                    placeholder="https://apps.apple.com/app/fixbro-partner/id..."
                    className="text-xs"
                  />
                  {settings.iosProviderUrl && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => window.open(settings.iosProviderUrl, "_blank")}
                      title="Test link"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Footer Save */}
        <div className="flex justify-end pt-2">
          <Button
            onClick={handleSave}
            disabled={isSaving}
            size="lg"
            className="rounded-xl px-8 font-bold shadow-lg shadow-primary/20"
          >
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Changes
          </Button>
        </div>
      </div>
    </PermissionGuard>
  );
}
