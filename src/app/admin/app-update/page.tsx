"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import PermissionGuard from "@/components/admin/PermissionGuard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
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
  CheckCircle2,
  RefreshCw,
  Sparkles,
  ArrowUpRight,
  Info,
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
};

export default function AppUpdatePage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [customerConfig, setCustomerConfig] = useState<AppUpdateTargetConfig>(DEFAULT_CUSTOMER_CONFIG);
  const [providerConfig, setProviderConfig] = useState<AppUpdateTargetConfig>(DEFAULT_PROVIDER_CONFIG);
  const [activeTab, setActiveTab] = useState<"customer" | "provider">("customer");

  const fetchConfig = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/app-update-config", { cache: "no-store" });
      const data = await res.json();
      if (data.success) {
        if (data.customer) setCustomerConfig(data.customer);
        if (data.provider) setProviderConfig(data.provider);
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
        description: "App update configuration updated successfully across mobile apps.",
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

  const currentActiveConfig = activeTab === "customer" ? customerConfig : providerConfig;

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
              Control update requirements, minimum build versions, and Play Store URLs for Customer and Partner mobile apps.
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
          <TabsList className="grid w-full grid-cols-2 max-w-md h-12 p-1 bg-muted/60 rounded-xl">
            <TabsTrigger
              value="customer"
              className="flex items-center gap-2 rounded-lg font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all"
            >
              <Smartphone className="w-4 h-4" />
              <span>Customer App</span>
              {customerConfig.enabled && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse" />
              )}
            </TabsTrigger>
            <TabsTrigger
              value="provider"
              className="flex items-center gap-2 rounded-lg font-bold data-[state=active]:bg-emerald-600 data-[state=active]:text-white transition-all"
            >
              <Smartphone className="w-4 h-4" />
              <span>Provider (Partner) App</span>
              {providerConfig.enabled && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse" />
              )}
            </TabsTrigger>
          </TabsList>

          {/* Customer Tab */}
          <TabsContent value="customer" className="mt-6 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Configuration Form */}
              <div className="lg:col-span-2 space-y-6">
                <Card className="border-border/60 shadow-sm">
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-lg font-bold flex items-center gap-2 text-primary">
                          <Smartphone className="w-5 h-5" />
                          Fixbro Customer App Settings
                        </CardTitle>
                        <CardDescription>
                          App ID: <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">com.fix.bro.user</code>
                        </CardDescription>
                      </div>
                      <Badge
                        variant={customerConfig.enabled ? "default" : "secondary"}
                        className={customerConfig.enabled ? "bg-emerald-600 hover:bg-emerald-700" : ""}
                      >
                        {customerConfig.enabled ? "Enforcement Active" : "Disabled"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Toggles */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-muted/40 border border-border/50">
                      <div className="flex items-center justify-between space-x-3">
                        <div className="space-y-0.5">
                          <Label htmlFor="cust-enable" className="font-bold text-sm cursor-pointer">
                            Enable Update Check
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            When ON, the app will verify its version against the server on launch.
                          </p>
                        </div>
                        <Switch
                          id="cust-enable"
                          checked={customerConfig.enabled}
                          onCheckedChange={(checked) =>
                            setCustomerConfig((prev) => ({ ...prev, enabled: checked }))
                          }
                        />
                      </div>

                      <div className="flex items-center justify-between space-x-3 border-t md:border-t-0 md:border-l border-border/50 pt-3 md:pt-0 md:pl-4">
                        <div className="space-y-0.5">
                          <Label htmlFor="cust-force" className="font-bold text-sm cursor-pointer">
                            Force Update (Blocking)
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            If ON, user cannot skip the update screen. If OFF, user can tap &ldquo;Later&rdquo;.
                          </p>
                        </div>
                        <Switch
                          id="cust-force"
                          checked={customerConfig.forceUpdate}
                          onCheckedChange={(checked) =>
                            setCustomerConfig((prev) => ({ ...prev, forceUpdate: checked }))
                          }
                        />
                      </div>
                    </div>

                    {/* Version Inputs */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="cust-version-code" className="font-semibold text-sm flex items-center gap-1.5">
                          Minimum Version Code (Build Number)
                          <Info className="w-3.5 h-3.5 text-muted-foreground" />
                        </Label>
                        <Input
                          id="cust-version-code"
                          type="number"
                          value={customerConfig.minVersionCode || ""}
                          onChange={(e) =>
                            setCustomerConfig((prev) => ({
                              ...prev,
                              minVersionCode: parseInt(e.target.value, 10) || 0,
                            }))
                          }
                          placeholder="e.g. 61"
                        />
                        <p className="text-xs text-muted-foreground">
                          From <code className="font-mono">pubspec.yaml</code> (the number after <code className="font-mono">+</code>). Installed apps with code lower than this will be prompted to update.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="cust-version-name" className="font-semibold text-sm">
                          Latest Version Name
                        </Label>
                        <Input
                          id="cust-version-name"
                          type="text"
                          value={customerConfig.latestVersionName || ""}
                          onChange={(e) =>
                            setCustomerConfig((prev) => ({
                              ...prev,
                              latestVersionName: e.target.value,
                            }))
                          }
                          placeholder="e.g. 3.0.3"
                        />
                        <p className="text-xs text-muted-foreground">
                          The public version string displayed on the update screen (e.g. v3.0.3).
                        </p>
                      </div>
                    </div>

                    {/* Play Store URL */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="cust-url" className="font-semibold text-sm">
                          Google Play Store URL
                        </Label>
                        {customerConfig.playStoreUrl && (
                          <a
                            href={customerConfig.playStoreUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
                          >
                            Test Link <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                      <Input
                        id="cust-url"
                        type="url"
                        value={customerConfig.playStoreUrl || ""}
                        onChange={(e) =>
                          setCustomerConfig((prev) => ({
                            ...prev,
                            playStoreUrl: e.target.value,
                          }))
                        }
                        placeholder="https://play.google.com/store/apps/details?id=com.fix.bro.user"
                      />
                    </div>

                    {/* Title */}
                    <div className="space-y-2">
                      <Label htmlFor="cust-title" className="font-semibold text-sm">
                        Update Dialog Title
                      </Label>
                      <Input
                        id="cust-title"
                        type="text"
                        value={customerConfig.title || ""}
                        onChange={(e) =>
                          setCustomerConfig((prev) => ({
                            ...prev,
                            title: e.target.value,
                          }))
                        }
                        placeholder="e.g. New Update Available"
                      />
                    </div>

                    {/* Release Notes */}
                    <div className="space-y-2">
                      <Label htmlFor="cust-msg" className="font-semibold text-sm">
                        Update Message / Release Notes
                      </Label>
                      <Textarea
                        id="cust-msg"
                        rows={3}
                        value={customerConfig.message || ""}
                        onChange={(e) =>
                          setCustomerConfig((prev) => ({
                            ...prev,
                            message: e.target.value,
                          }))
                        }
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
                    <Sparkles className="w-3.5 h-3.5 text-primary" /> Live Mobile Screen Preview
                  </span>
                  <Badge variant="outline" className="text-[11px]">
                    Customer Theme
                  </Badge>
                </div>
                <MobileScreenPreview
                  themeColor="#2563EB"
                  appName="Fixbro"
                  config={customerConfig}
                />
              </div>
            </div>
          </TabsContent>

          {/* Provider Tab */}
          <TabsContent value="provider" className="mt-6 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Configuration Form */}
              <div className="lg:col-span-2 space-y-6">
                <Card className="border-border/60 shadow-sm">
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-lg font-bold flex items-center gap-2 text-emerald-600">
                          <Smartphone className="w-5 h-5" />
                          Fixbro Partner (Provider) App Settings
                        </CardTitle>
                        <CardDescription>
                          App ID: <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">com.fixbro.provider</code>
                        </CardDescription>
                      </div>
                      <Badge
                        variant={providerConfig.enabled ? "default" : "secondary"}
                        className={providerConfig.enabled ? "bg-emerald-600 hover:bg-emerald-700" : ""}
                      >
                        {providerConfig.enabled ? "Enforcement Active" : "Disabled"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Toggles */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-muted/40 border border-border/50">
                      <div className="flex items-center justify-between space-x-3">
                        <div className="space-y-0.5">
                          <Label htmlFor="prov-enable" className="font-bold text-sm cursor-pointer">
                            Enable Update Check
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            When ON, the Partner app checks for updates when opened by service providers.
                          </p>
                        </div>
                        <Switch
                          id="prov-enable"
                          checked={providerConfig.enabled}
                          onCheckedChange={(checked) =>
                            setProviderConfig((prev) => ({ ...prev, enabled: checked }))
                          }
                        />
                      </div>

                      <div className="flex items-center justify-between space-x-3 border-t md:border-t-0 md:border-l border-border/50 pt-3 md:pt-0 md:pl-4">
                        <div className="space-y-0.5">
                          <Label htmlFor="prov-force" className="font-bold text-sm cursor-pointer">
                            Force Update (Blocking)
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            Recommended for Partner app to ensure all providers have the newest job dispatch features.
                          </p>
                        </div>
                        <Switch
                          id="prov-force"
                          checked={providerConfig.forceUpdate}
                          onCheckedChange={(checked) =>
                            setProviderConfig((prev) => ({ ...prev, forceUpdate: checked }))
                          }
                        />
                      </div>
                    </div>

                    {/* Version Inputs */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="prov-version-code" className="font-semibold text-sm flex items-center gap-1.5">
                          Minimum Version Code (Build Number)
                          <Info className="w-3.5 h-3.5 text-muted-foreground" />
                        </Label>
                        <Input
                          id="prov-version-code"
                          type="number"
                          value={providerConfig.minVersionCode || ""}
                          onChange={(e) =>
                            setProviderConfig((prev) => ({
                              ...prev,
                              minVersionCode: parseInt(e.target.value, 10) || 0,
                            }))
                          }
                          placeholder="e.g. 26"
                        />
                        <p className="text-xs text-muted-foreground">
                          From <code className="font-mono">pubspec.yaml</code> (the number after <code className="font-mono">+</code>). Installed apps with code lower than this will be prompted to update.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="prov-version-name" className="font-semibold text-sm">
                          Latest Version Name
                        </Label>
                        <Input
                          id="prov-version-name"
                          type="text"
                          value={providerConfig.latestVersionName || ""}
                          onChange={(e) =>
                            setProviderConfig((prev) => ({
                              ...prev,
                              latestVersionName: e.target.value,
                            }))
                          }
                          placeholder="e.g. 3.0.1"
                        />
                        <p className="text-xs text-muted-foreground">
                          The public version string displayed on the update screen (e.g. v3.0.1).
                        </p>
                      </div>
                    </div>

                    {/* Play Store URL */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="prov-url" className="font-semibold text-sm">
                          Google Play Store URL
                        </Label>
                        {providerConfig.playStoreUrl && (
                          <a
                            href={providerConfig.playStoreUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-emerald-600 hover:underline flex items-center gap-1 font-medium"
                          >
                            Test Link <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                      <Input
                        id="prov-url"
                        type="url"
                        value={providerConfig.playStoreUrl || ""}
                        onChange={(e) =>
                          setProviderConfig((prev) => ({
                            ...prev,
                            playStoreUrl: e.target.value,
                          }))
                        }
                        placeholder="https://play.google.com/store/apps/details?id=com.fixbro.provider"
                      />
                    </div>

                    {/* Title */}
                    <div className="space-y-2">
                      <Label htmlFor="prov-title" className="font-semibold text-sm">
                        Update Dialog Title
                      </Label>
                      <Input
                        id="prov-title"
                        type="text"
                        value={providerConfig.title || ""}
                        onChange={(e) =>
                          setProviderConfig((prev) => ({
                            ...prev,
                            title: e.target.value,
                          }))
                        }
                        placeholder="e.g. Fixbro Partner Update Available"
                      />
                    </div>

                    {/* Release Notes */}
                    <div className="space-y-2">
                      <Label htmlFor="prov-msg" className="font-semibold text-sm">
                        Update Message / Release Notes
                      </Label>
                      <Textarea
                        id="prov-msg"
                        rows={3}
                        value={providerConfig.message || ""}
                        onChange={(e) =>
                          setProviderConfig((prev) => ({
                            ...prev,
                            message: e.target.value,
                          }))
                        }
                        placeholder="Explain what is new or why updating is required for partners..."
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right Column: Live Mobile Preview */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" /> Live Mobile Screen Preview
                  </span>
                  <Badge variant="outline" className="text-[11px] border-emerald-500/40 text-emerald-600">
                    Partner Theme
                  </Badge>
                </div>
                <MobileScreenPreview
                  themeColor="#059669"
                  appName="Fixbro Partner"
                  config={providerConfig}
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </PermissionGuard>
  );
}

/**
 * Visual Phone Mockup displaying how the update screen renders inside the Flutter app
 */
function MobileScreenPreview({
  themeColor,
  appName,
  config,
}: {
  themeColor: string;
  appName: string;
  config: AppUpdateTargetConfig;
}) {
  return (
    <div className="w-full max-w-[320px] mx-auto rounded-[36px] p-3 bg-slate-900 shadow-2xl border-4 border-slate-800">
      {/* Mobile Screen Shell */}
      <div className="w-full rounded-[28px] overflow-hidden bg-white text-slate-800 flex flex-col justify-between p-5 min-h-[480px] relative">
        {/* Top Speaker / Camera Notch */}
        <div className="w-24 h-4 bg-slate-900 rounded-b-xl mx-auto absolute top-0 left-1/2 -translate-x-1/2 flex items-center justify-center">
          <div className="w-2.5 h-2.5 rounded-full bg-slate-800" />
        </div>

        {/* Content Area */}
        <div className="pt-6 flex flex-col items-center text-center space-y-4">
          {/* Animated Icon Circle */}
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg transition-colors mt-2"
            style={{ backgroundColor: `${themeColor}15`, color: themeColor }}
          >
            <Smartphone className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <span
              className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full inline-block"
              style={{ backgroundColor: `${themeColor}20`, color: themeColor }}
            >
              {appName}
            </span>
            <h3 className="text-base font-extrabold text-slate-900 leading-snug">
              {config.title || "New Update Available"}
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
                v{config.latestVersionName || "3.0.3"}
              </span>
            </div>
          </div>

          {/* Description */}
          <p className="text-xs text-slate-500 line-clamp-4 px-1 leading-relaxed">
            {config.message || "A new update is available. Please update to continue."}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 pt-4">
          <button
            type="button"
            className="w-full py-2.5 rounded-xl text-white font-bold text-xs shadow-md flex items-center justify-center gap-1.5 transition-transform active:scale-95"
            style={{ backgroundColor: themeColor }}
          >
            Update on Google Play
            <ExternalLink className="w-3 h-3" />
          </button>

          {!config.forceUpdate && (
            <button
              type="button"
              className="w-full py-2 rounded-xl text-slate-400 font-semibold text-xs hover:text-slate-600"
            >
              Remind Me Later
            </button>
          )}

          {config.forceUpdate && (
            <p className="text-[10px] text-rose-500 font-semibold text-center flex items-center justify-center gap-1">
              <ShieldAlert className="w-3 h-3" /> Update is mandatory
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
