"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import PermissionGuard from "@/components/admin/PermissionGuard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Smartphone,
  Save,
  Loader2,
  ExternalLink,
  ShieldAlert,
  RefreshCw,
  Sparkles,
  ArrowUpRight,
  Info,
  Apple,
} from "lucide-react";
import type { AppUpdateTargetConfig } from "@/types/firestore";

const DEFAULT_CUSTOMER_CONFIG: AppUpdateTargetConfig = {
  enabled: false,
  forceUpdate: false,
  minVersionCode: 61,
  latestVersionName: "3.0.3",
  playStoreUrl: "https://play.google.com/store/apps/details?id=com.fix.bro.user",
  title: "New Update Available",
  message:
    "A new version of Fixbro is available with important improvements and bug fixes. Please update to continue enjoying a smooth experience.",
  
  iosEnabled: false,
  iosForceUpdate: false,
  iosMinVersionCode: 1,
  iosLatestVersionName: "3.0.0",
  appStoreUrl: "",
  iosTitle: "New Update Available",
  iosMessage:
    "A new version of Fixbro is available on the App Store with important improvements and bug fixes. Please update to continue enjoying a smooth experience.",
};

const DEFAULT_PROVIDER_CONFIG: AppUpdateTargetConfig = {
  enabled: false,
  forceUpdate: false,
  minVersionCode: 26,
  latestVersionName: "3.0.1",
  playStoreUrl: "https://play.google.com/store/apps/details?id=com.fixbro.provider",
  title: "Fixbro Partner Update Available",
  message:
    "A new version of Fixbro Partner is available with critical performance enhancements and booking improvements. Please update to continue.",

  iosEnabled: false,
  iosForceUpdate: false,
  iosMinVersionCode: 1,
  iosLatestVersionName: "3.0.0",
  appStoreUrl: "",
  iosTitle: "Fixbro Partner Update Available",
  iosMessage:
    "A new version of Fixbro Partner is available on the App Store with critical performance enhancements and booking improvements. Please update to continue.",
};

export default function AppUpdatePage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [customerConfig, setCustomerConfig] = useState<AppUpdateTargetConfig>(DEFAULT_CUSTOMER_CONFIG);
  const [providerConfig, setProviderConfig] = useState<AppUpdateTargetConfig>(DEFAULT_PROVIDER_CONFIG);
  const [activeTab, setActiveTab] = useState<"customer" | "provider">("customer");
  const [activePlatform, setActivePlatform] = useState<"android" | "ios">("android");

  const fetchConfig = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/app-update-config", { cache: "no-store" });
      const data = await res.json();
      if (data.success) {
        if (data.customer) {
          setCustomerConfig({
            ...DEFAULT_CUSTOMER_CONFIG,
            ...data.customer,
          });
        }
        if (data.provider) {
          setProviderConfig({
            ...DEFAULT_PROVIDER_CONFIG,
            ...data.provider,
          });
        }
      }
    } catch (error: any) {
      console.error("Failed to fetch app update config:", error);
      toast({
        title: "Error",
        description: "Failed to load update settings. Using defaults.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleSave = async () => {
    if (!user) {
      toast({ title: "Unauthorized", description: "You must be logged in as an admin.", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/app-update-config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          customer: customerConfig,
          provider: providerConfig,
        }),
      });

      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.error || "Failed to save configuration.");
      }

      toast({
        title: "Settings Saved",
        description: "Android & iOS app update settings saved successfully.",
      });
    } catch (error: any) {
      console.error("Error saving app update settings:", error);
      toast({
        title: "Save Failed",
        description: error.message || "Could not save update settings.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground font-medium">Loading App Update Configuration...</p>
      </div>
    );
  }

  return (
    <PermissionGuard moduleId="app_update" action="read">
      <div className="max-w-6xl mx-auto space-y-8 pb-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                <Smartphone className="w-6 h-6" />
              </div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight text-foreground">
                Mobile App Update Control
              </h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Control update requirements, minimum build versions, and store URLs for Android (Google Play) and iOS (App Store) mobile apps.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={fetchConfig} disabled={isLoading || isSaving}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button onClick={handleSave} disabled={isSaving} className="font-semibold shadow-md">
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Tab Selection */}
        <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as "customer" | "provider")} className="w-full">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <TabsList className="grid w-full sm:w-[420px] grid-cols-2 h-12 p-1 bg-muted/60 rounded-xl">
              <TabsTrigger
                value="customer"
                className="flex items-center gap-2 rounded-lg font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all"
              >
                <Smartphone className="w-4 h-4" />
                <span>Customer App</span>
                {(customerConfig.enabled || customerConfig.iosEnabled) && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse" />
                )}
              </TabsTrigger>
              <TabsTrigger
                value="provider"
                className="flex items-center gap-2 rounded-lg font-bold data-[state=active]:bg-emerald-600 data-[state=active]:text-white transition-all"
              >
                <Smartphone className="w-4 h-4" />
                <span>Partner App</span>
                {(providerConfig.enabled || providerConfig.iosEnabled) && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse" />
                )}
              </TabsTrigger>
            </TabsList>

            {/* Platform Sub-Selector (Android vs iOS) */}
            <div className="flex items-center gap-1.5 p-1 bg-muted/70 rounded-xl border border-border/50 w-fit">
              <button
                type="button"
                onClick={() => setActivePlatform("android")}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activePlatform === "android"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                <span>Android (Google Play)</span>
                {((activeTab === "customer" && customerConfig.enabled) ||
                  (activeTab === "provider" && providerConfig.enabled)) && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setActivePlatform("ios")}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activePlatform === "ios"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Apple className="w-3.5 h-3.5 text-foreground" />
                <span>iOS (App Store)</span>
                {((activeTab === "customer" && customerConfig.iosEnabled) ||
                  (activeTab === "provider" && providerConfig.iosEnabled)) && (
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                )}
              </button>
            </div>
          </div>

          {/* Customer Tab */}
          <TabsContent value="customer" className="mt-6 space-y-6">
            <AppUpdateEditor
              appName="Fixbro Customer"
              themeColor="#2563EB"
              platform={activePlatform}
              config={customerConfig}
              onChange={setCustomerConfig}
              appId="com.fix.bro.user"
            />
          </TabsContent>

          {/* Provider Tab */}
          <TabsContent value="provider" className="mt-6 space-y-6">
            <AppUpdateEditor
              appName="Fixbro Partner"
              themeColor="#059669"
              platform={activePlatform}
              config={providerConfig}
              onChange={setProviderConfig}
              appId="com.fixbro.provider"
            />
          </TabsContent>
        </Tabs>
      </div>
    </PermissionGuard>
  );
}

/**
 * Unified Editor for either Customer or Partner app across Android and iOS
 */
function AppUpdateEditor({
  appName,
  themeColor,
  platform,
  config,
  onChange,
  appId,
}: {
  appName: string;
  themeColor: string;
  platform: "android" | "ios";
  config: AppUpdateTargetConfig;
  onChange: React.Dispatch<React.SetStateAction<AppUpdateTargetConfig>>;
  appId: string;
}) {
  const isAndroid = platform === "android";
  const isEnforced = isAndroid ? config.enabled : Boolean(config.iosEnabled);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left Column: Configuration Form */}
      <div className="lg:col-span-2 space-y-6">
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="text-lg font-bold flex items-center gap-2" style={{ color: themeColor }}>
                  {isAndroid ? <Smartphone className="w-5 h-5" /> : <Apple className="w-5 h-5 text-foreground" />}
                  {appName} &mdash; {isAndroid ? "Android (Google Play)" : "iOS (App Store)"}
                </CardTitle>
                <CardDescription>
                  {isAndroid ? (
                    <>Package: <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{appId}</code></>
                  ) : (
                    <>Bundle Identifier: <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{appId}</code></>
                  )}
                </CardDescription>
              </div>
              <Badge
                variant={isEnforced ? "default" : "secondary"}
                className={isEnforced ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}
              >
                {isEnforced ? `${isAndroid ? "Android" : "iOS"} Active` : "Check Disabled"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Toggles */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-muted/40 border border-border/50">
              <div className="flex items-center justify-between space-x-3">
                <div className="space-y-0.5">
                  <Label htmlFor={`${appId}-${platform}-enable`} className="font-bold text-sm cursor-pointer">
                    Enable {isAndroid ? "Android" : "iOS"} Update Check
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    When ON, the {isAndroid ? "Android" : "iOS"} app checks server version code on launch.
                  </p>
                </div>
                <Switch
                  id={`${appId}-${platform}-enable`}
                  checked={isAndroid ? config.enabled : Boolean(config.iosEnabled)}
                  onCheckedChange={(checked) =>
                    onChange((prev) =>
                      isAndroid ? { ...prev, enabled: checked } : { ...prev, iosEnabled: checked }
                    )
                  }
                />
              </div>

              <div className="flex items-center justify-between space-x-3 border-t md:border-t-0 md:border-l border-border/50 pt-3 md:pt-0 md:pl-4">
                <div className="space-y-0.5">
                  <Label htmlFor={`${appId}-${platform}-force`} className="font-bold text-sm cursor-pointer">
                    Force Update (Blocking)
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    If ON, user cannot dismiss the update screen. If OFF, &ldquo;Remind Me Later&rdquo; is available.
                  </p>
                </div>
                <Switch
                  id={`${appId}-${platform}-force`}
                  checked={isAndroid ? config.forceUpdate : Boolean(config.iosForceUpdate)}
                  onCheckedChange={(checked) =>
                    onChange((prev) =>
                      isAndroid ? { ...prev, forceUpdate: checked } : { ...prev, iosForceUpdate: checked }
                    )
                  }
                />
              </div>
            </div>

            {/* Version Inputs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor={`${appId}-${platform}-version-code`} className="font-semibold text-sm flex items-center gap-1.5">
                  {isAndroid ? "Minimum Version Code (Android)" : "Minimum Build Number (iOS CFBundleVersion)"}
                  <Info className="w-3.5 h-3.5 text-muted-foreground" />
                </Label>
                <Input
                  id={`${appId}-${platform}-version-code`}
                  type="number"
                  value={
                    isAndroid
                      ? config.minVersionCode || ""
                      : config.iosMinVersionCode !== undefined
                      ? config.iosMinVersionCode
                      : ""
                  }
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10) || 0;
                    onChange((prev) =>
                      isAndroid ? { ...prev, minVersionCode: val } : { ...prev, iosMinVersionCode: val }
                    );
                  }}
                  placeholder={isAndroid ? "e.g. 61" : "e.g. 1"}
                />
                <p className="text-xs text-muted-foreground">
                  {isAndroid
                    ? "From pubspec.yaml (the number after +). Installed APKs with code lower than this will prompt to update."
                    : "iOS build number (e.g. 1, 2, 61). Installed iOS builds with build number lower than this will prompt to update."}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor={`${appId}-${platform}-version-name`} className="font-semibold text-sm">
                  Latest Version Name
                </Label>
                <Input
                  id={`${appId}-${platform}-version-name`}
                  type="text"
                  value={
                    isAndroid
                      ? config.latestVersionName || ""
                      : config.iosLatestVersionName || config.latestVersionName || ""
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    onChange((prev) =>
                      isAndroid ? { ...prev, latestVersionName: val } : { ...prev, iosLatestVersionName: val }
                    );
                  }}
                  placeholder="e.g. 3.0.3"
                />
                <p className="text-xs text-muted-foreground">
                  The public marketing version string shown on the update screen (e.g. v3.0.3).
                </p>
              </div>
            </div>

            {/* Store URL */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor={`${appId}-${platform}-url`} className="font-semibold text-sm">
                  {isAndroid ? "Google Play Store URL" : "Apple App Store URL"}
                </Label>
                {isAndroid && config.playStoreUrl && (
                  <a
                    href={config.playStoreUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
                  >
                    Test Link <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {!isAndroid && config.appStoreUrl && (
                  <a
                    href={config.appStoreUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
                  >
                    Test Link <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
              <Input
                id={`${appId}-${platform}-url`}
                type="url"
                value={isAndroid ? config.playStoreUrl || "" : config.appStoreUrl || ""}
                onChange={(e) => {
                  const val = e.target.value;
                  onChange((prev) =>
                    isAndroid ? { ...prev, playStoreUrl: val } : { ...prev, appStoreUrl: val }
                  );
                }}
                placeholder={
                  isAndroid
                    ? `https://play.google.com/store/apps/details?id=${appId}`
                    : `https://apps.apple.com/app/id...`
                }
              />
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor={`${appId}-${platform}-title`} className="font-semibold text-sm">
                Update Dialog Title
              </Label>
              <Input
                id={`${appId}-${platform}-title`}
                type="text"
                value={
                  isAndroid
                    ? config.title || ""
                    : config.iosTitle || config.title || ""
                }
                onChange={(e) => {
                  const val = e.target.value;
                  onChange((prev) =>
                    isAndroid ? { ...prev, title: val } : { ...prev, iosTitle: val }
                  );
                }}
                placeholder="e.g. New Update Available"
              />
            </div>

            {/* Release Notes */}
            <div className="space-y-2">
              <Label htmlFor={`${appId}-${platform}-msg`} className="font-semibold text-sm">
                Update Message / Release Notes
              </Label>
              <Textarea
                id={`${appId}-${platform}-msg`}
                rows={3}
                value={
                  isAndroid
                    ? config.message || ""
                    : config.iosMessage || config.message || ""
                }
                onChange={(e) => {
                  const val = e.target.value;
                  onChange((prev) =>
                    isAndroid ? { ...prev, message: val } : { ...prev, iosMessage: val }
                  );
                }}
                placeholder="Explain what is new or why updating is recommended..."
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right Column: Live Mobile Preview */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" style={{ color: themeColor }} /> Live {isAndroid ? "Android" : "iOS"} Preview
          </span>
          <Badge variant="outline" className="text-[11px] font-semibold">
            {isAndroid ? "Google Play" : "Apple App Store"}
          </Badge>
        </div>
        <MobileScreenPreview
          themeColor={themeColor}
          appName={appName}
          config={config}
          platform={platform}
        />
      </div>
    </div>
  );
}

/**
 * Visual Phone Mockup displaying how the update screen renders inside the Flutter app
 */
function MobileScreenPreview({
  themeColor,
  appName,
  config,
  platform,
}: {
  themeColor: string;
  appName: string;
  config: AppUpdateTargetConfig;
  platform: "android" | "ios";
}) {
  const isAndroid = platform === "android";
  const title = isAndroid
    ? config.title || "New Update Available"
    : config.iosTitle || config.title || "New Update Available";
  const versionName = isAndroid
    ? config.latestVersionName || "3.0.3"
    : config.iosLatestVersionName || config.latestVersionName || "3.0.0";
  const message = isAndroid
    ? config.message || "A new version is available on Google Play. Please update to continue."
    : config.iosMessage || config.message || "A new version is available on the App Store. Please update to continue.";
  const isForceUpdate = isAndroid ? config.forceUpdate : Boolean(config.iosForceUpdate);

  return (
    <div className="w-full max-w-[320px] mx-auto rounded-[36px] p-3 bg-slate-900 shadow-2xl border-4 border-slate-800">
      {/* Mobile Screen Shell */}
      <div className="w-full rounded-[28px] overflow-hidden bg-white text-slate-800 flex flex-col justify-between p-5 min-h-[480px] relative">
        {/* Top Speaker / Dynamic Island Notch */}
        {isAndroid ? (
          <div className="w-24 h-4 bg-slate-900 rounded-b-xl mx-auto absolute top-0 left-1/2 -translate-x-1/2 flex items-center justify-center">
            <div className="w-2.5 h-2.5 rounded-full bg-slate-800" />
          </div>
        ) : (
          <div className="w-24 h-5 bg-slate-900 rounded-full mx-auto absolute top-2 left-1/2 -translate-x-1/2 flex items-center justify-end px-2">
            <div className="w-2 h-2 rounded-full bg-slate-800" />
          </div>
        )}

        {/* Content Area */}
        <div className="pt-6 flex flex-col items-center text-center space-y-4">
          {/* Icon Circle */}
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg transition-colors mt-2"
            style={{ backgroundColor: `${themeColor}15`, color: themeColor }}
          >
            {isAndroid ? <Smartphone className="w-8 h-8" /> : <Apple className="w-8 h-8 text-foreground" />}
          </div>

          <div className="space-y-1">
            <span
              className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full inline-block"
              style={{ backgroundColor: `${themeColor}20`, color: themeColor }}
            >
              {appName}
            </span>
            <h3 className="text-base font-extrabold text-slate-900 leading-snug">
              {title}
            </h3>
          </div>

          {/* Version Comparison Badges */}
          <div className="flex items-center justify-center gap-2 text-xs bg-slate-50 border border-slate-100 rounded-xl p-2 w-full">
            <div className="flex flex-col items-center">
              <span className="text-[10px] text-slate-400 font-semibold uppercase">Current</span>
              <span className="font-bold text-slate-600">v3.0.0</span>
            </div>
            <ArrowUpRight className="w-4 h-4 text-emerald-500 font-bold" />
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-semibold uppercase" style={{ color: themeColor }}>
                Latest
              </span>
              <span className="font-extrabold" style={{ color: themeColor }}>
                v{versionName}
              </span>
            </div>
          </div>

          {/* Description */}
          <p className="text-xs text-slate-500 line-clamp-4 px-1 leading-relaxed">
            {message}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 pt-4">
          <button
            type="button"
            className="w-full py-2.5 rounded-xl text-white font-bold text-xs shadow-md flex items-center justify-center gap-1.5 transition-transform active:scale-95"
            style={{ backgroundColor: themeColor }}
          >
            {isAndroid ? (
              <>
                Update on Google Play
                <ExternalLink className="w-3 h-3" />
              </>
            ) : (
              <>
                <Apple className="w-3.5 h-3.5" />
                Update on App Store
                <ExternalLink className="w-3 h-3" />
              </>
            )}
          </button>

          {!isForceUpdate && (
            <button
              type="button"
              className="w-full py-2 rounded-xl text-slate-400 font-semibold text-xs hover:text-slate-600"
            >
              Remind Me Later
            </button>
          )}

          {isForceUpdate && (
            <p className="text-[10px] text-rose-500 font-semibold text-center flex items-center justify-center gap-1">
              <ShieldAlert className="w-3 h-3" /> Update is mandatory
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
