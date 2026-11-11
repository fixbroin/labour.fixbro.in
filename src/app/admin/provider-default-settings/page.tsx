"use client";

import { useState, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  SlidersHorizontal,
  Coins,
  Percent,
  FileText,
  Plus,
  Trash2,
  Edit,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ShieldCheck,
  MapPin,
  Clock,
  Sparkles,
  ArrowRight,
  Info,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useApplicationConfig } from "@/hooks/useApplicationConfig";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, getDoc, query, orderBy } from "@/lib/mysqlDb";
import type { FirestoreTax } from "@/types/firestore";
import {
  type ProviderDefaultSettings,
  type SeniorityTaxConfig,
  type ServiceGuidelineRule,
  type GuidelineCategory,
  DEFAULT_PROVIDER_DEFAULT_SETTINGS,
  DEFAULT_GUIDELINE_RULES,
  DEFAULT_SENIORITY_TAXES,
} from "@/types/providerDefaultSettings";
import {
  getProviderDefaultSettingsAction,
  saveProviderDefaultSettingsAction,
} from "@/app/actions/providerDefaultSettingsActions";

export default function ProviderDefaultSettingsPage() {
  const { toast } = useToast();
  const { config: appConfig } = useApplicationConfig();
  const symbol = appConfig?.currencySymbol || '₹';

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [taxes, setTaxes] = useState<FirestoreTax[]>([]);

  // Settings State
  const [settings, setSettings] = useState<ProviderDefaultSettings>(DEFAULT_PROVIDER_DEFAULT_SETTINGS);

  // Rule Dialog State
  const [isRuleDialogOpen, setIsRuleDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<ServiceGuidelineRule | null>(null);
  const [ruleFormData, setRuleFormData] = useState<{
    title: string;
    description: string;
    category: GuidelineCategory;
    isActive: boolean;
  }>({
    title: '',
    description: '',
    category: 'scope',
    isActive: true,
  });

  // Load Settings and Taxes
  useEffect(() => {
    async function loadInitialData() {
      setIsLoading(true);
      try {
        // 1. Fetch Taxes from adminTaxes
        const taxesRef = collection(db, "adminTaxes");
        const taxSnap = await getDocs(query(taxesRef, orderBy("taxName", "asc")));
        let fetchedTaxes = taxSnap.docs.map(d => ({ ...d.data(), id: d.id } as FirestoreTax));

        // Locate zero-tax option
        let zeroTax = fetchedTaxes.find(t => t.taxPercent === 0 || t.taxName.toLowerCase().includes('no tax') || t.id === 'no-tax');
        
        if (!zeroTax) {
          zeroTax = {
            id: 'no-tax',
            taxName: 'No Tax (0%)',
            taxPercent: 0,
            isActive: true,
          } as FirestoreTax;
          fetchedTaxes.unshift(zeroTax);
        } else {
          // Normalize label for 0%
          if (!zeroTax.taxName.includes('0%')) {
            zeroTax.taxName = `${zeroTax.taxName} (0%)`;
          }
        }

        // If the zeroTax in DB has a specific ID (like 'lifovfhrWtZitbVecOP8'), ensure 'no-tax' also exists as an alias
        // so default/legacy references never fail to find a matching <SelectItem>
        if (zeroTax.id !== 'no-tax' && !fetchedTaxes.some(t => t.id === 'no-tax')) {
          fetchedTaxes.unshift({
            id: 'no-tax',
            taxName: zeroTax.taxName,
            taxPercent: zeroTax.taxPercent || 0,
            isActive: true,
          } as FirestoreTax);
        }

        const defaultZeroTaxId = zeroTax.id;
        setTaxes(fetchedTaxes);

        // 2. Fetch Dynamic Skill Levels from providerControlOptions
        let dynamicSeniorityList: SeniorityTaxConfig[] = [];
        try {
          const skillDoc = await getDoc(doc(db, "providerControlOptions", "skillLevels"));
          if (skillDoc.exists()) {
            const data = skillDoc.data();
            const levels = data.levels || [];
            if (Array.isArray(levels) && levels.length > 0) {
              dynamicSeniorityList = levels.map((lvl: any) => ({
                id: lvl.id || lvl.label.toLowerCase().replace(/\s+/g, '-'),
                label: lvl.label,
                taxType: 'inclusive',
                taxId: defaultZeroTaxId,
                taxName: zeroTax?.taxName || 'No Tax (0%)',
                taxPercent: zeroTax?.taxPercent || 0,
              }));
            }
          }
        } catch (e) {
          console.warn('Could not fetch custom skill levels, using defaults:', e);
        }

        if (dynamicSeniorityList.length === 0) {
          dynamicSeniorityList = DEFAULT_SENIORITY_TAXES.map(item => ({
            ...item,
            taxId: defaultZeroTaxId,
            taxName: zeroTax?.taxName || 'No Tax (0%)',
            taxPercent: zeroTax?.taxPercent || 0,
          }));
        }

        // 3. Fetch Provider Default Settings
        const savedSettings = await getProviderDefaultSettingsAction();
        const savedList = Array.isArray(savedSettings.seniorityTaxes) ? savedSettings.seniorityTaxes : [];

        // Match each dynamic skill level by ID or label
        const mergedSeniorityTaxes = dynamicSeniorityList.map(item => {
          const matched = savedList.find(st =>
            st.id === item.id ||
            (st.label && item.label && st.label.trim().toLowerCase() === item.label.trim().toLowerCase()) ||
            (st.id && item.label && st.id.toLowerCase() === item.label.toLowerCase().replace(/\s+/g, '-')) ||
            (st.label && item.id && st.label.toLowerCase().replace(/\s+/g, '-') === item.id.toLowerCase())
          );

          if (matched) {
            // Check if matched.taxId exists in fetchedTaxes
            const validTax = fetchedTaxes.find(t => t.id === matched.taxId);
            return {
              ...item,
              taxType: matched.taxType || 'inclusive',
              taxId: validTax ? validTax.id : defaultZeroTaxId,
              taxName: validTax ? validTax.taxName : (zeroTax?.taxName || 'No Tax (0%)'),
              taxPercent: validTax ? validTax.taxPercent : (zeroTax?.taxPercent || 0),
            };
          }

          return item;
        });

        // Also normalize markup tax
        let validMarkupTaxId = savedSettings.markupTaxId;
        const matchingMarkupTax = fetchedTaxes.find(t => t.id === validMarkupTaxId);
        if (!matchingMarkupTax) {
          validMarkupTaxId = defaultZeroTaxId;
        }
        const resolvedMarkupTax = fetchedTaxes.find(t => t.id === validMarkupTaxId) || zeroTax;

        setSettings({
          ...savedSettings,
          markupTaxId: validMarkupTaxId,
          markupTaxName: resolvedMarkupTax ? resolvedMarkupTax.taxName : 'No Tax (0%)',
          markupTaxPercent: resolvedMarkupTax ? resolvedMarkupTax.taxPercent : 0,
          seniorityTaxes: mergedSeniorityTaxes,
        });
      } catch (error) {
        console.error("Error loading provider default settings:", error);
        toast({
          title: "Error loading settings",
          description: "Could not load settings. Using system defaults.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    }

    loadInitialData();
  }, [toast]);

  // Handler for Saving Settings
  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      const res = await saveProviderDefaultSettingsAction(settings);
      if (res.success) {
        toast({
          title: "Settings Saved Successfully",
          description: "Provider default settings and booking rules have been updated.",
        });
      } else {
        toast({
          title: "Error saving settings",
          description: res.message || "Failed to update settings.",
          variant: "destructive",
        });
      }
    } catch (e: any) {
      toast({
        title: "Error",
        description: e?.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Rule Management Handlers
  const openAddRuleDialog = () => {
    setEditingRule(null);
    setRuleFormData({
      title: '',
      description: '',
      category: 'scope',
      isActive: true,
    });
    setIsRuleDialogOpen(true);
  };

  const openEditRuleDialog = (rule: ServiceGuidelineRule) => {
    setEditingRule(rule);
    setRuleFormData({
      title: rule.title,
      description: rule.description,
      category: rule.category || 'scope',
      isActive: rule.isActive,
    });
    setIsRuleDialogOpen(true);
  };

  const handleSaveRule = () => {
    if (!ruleFormData.title.trim() || !ruleFormData.description.trim()) {
      toast({
        title: "Validation Error",
        description: "Title and description are required for the rule.",
        variant: "destructive",
      });
      return;
    }

    let updatedRules = [...settings.rules];
    if (editingRule) {
      updatedRules = updatedRules.map(r =>
        r.id === editingRule.id
          ? {
              ...r,
              title: ruleFormData.title.trim(),
              description: ruleFormData.description.trim(),
              category: ruleFormData.category,
              isActive: ruleFormData.isActive,
            }
          : r
      );
    } else {
      const newRule: ServiceGuidelineRule = {
        id: `rule-${Date.now()}`,
        title: ruleFormData.title.trim(),
        description: ruleFormData.description.trim(),
        category: ruleFormData.category,
        isActive: ruleFormData.isActive,
        order: updatedRules.length + 1,
      };
      updatedRules.push(newRule);
    }

    setSettings({ ...settings, rules: updatedRules });
    setIsRuleDialogOpen(false);
    toast({
      title: editingRule ? "Rule updated" : "Rule added",
      description: "Don't forget to click 'Save All Settings' to persist your changes.",
    });
  };

  const handleDeleteRule = (id: string) => {
    const updated = settings.rules.filter(r => r.id !== id);
    setSettings({ ...settings, rules: updated });
    toast({
      title: "Rule deleted",
      description: "Rule removed. Click 'Save All Settings' to persist.",
    });
  };

  const handleToggleRuleStatus = (id: string, active: boolean) => {
    const updated = settings.rules.map(r => r.id === id ? { ...r, isActive: active } : r);
    setSettings({ ...settings, rules: updated });
  };

  const handleResetDefaultRules = () => {
    setSettings({
      ...settings,
      rules: DEFAULT_GUIDELINE_RULES,
      cartRulesTitle: DEFAULT_PROVIDER_DEFAULT_SETTINGS.cartRulesTitle,
      cartRulesSubtitle: DEFAULT_PROVIDER_DEFAULT_SETTINGS.cartRulesSubtitle,
      cartRulesAgreementText: DEFAULT_PROVIDER_DEFAULT_SETTINGS.cartRulesAgreementText,
    });
    toast({
      title: "Reset to Default Rules",
      description: "Standard daily labour rules restored. Click 'Save All Settings' to apply.",
    });
  };

  // Tax Selection for Markup
  const handleMarkupTaxChange = (taxId: string) => {
    const selected = taxes.find(t => t.id === taxId);
    setSettings({
      ...settings,
      markupTaxId: taxId,
      markupTaxName: selected ? selected.taxName : 'No Tax',
      markupTaxPercent: selected ? selected.taxPercent : 0,
    });
  };

  // Seniority Tax Update
  const updateSeniorityTax = (id: string, updates: Partial<SeniorityTaxConfig>) => {
    const updated = settings.seniorityTaxes.map(st => {
      if (st.id === id) {
        const next = { ...st, ...updates };
        if (updates.taxId) {
          const selected = taxes.find(t => t.id === updates.taxId);
          next.taxName = selected ? selected.taxName : 'No Tax';
          next.taxPercent = selected ? selected.taxPercent : 0;
        }
        return next;
      }
      return st;
    });
    setSettings({ ...settings, seniorityTaxes: updated });
  };

  // Live Simulator Calculations
  const sampleProviderRate = 1200;
  const sampleAdminFee = Number(settings.adminMarkupFee) || 0;
  const sampleCustomerRate = sampleProviderRate + sampleAdminFee;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
        <p className="text-muted-foreground text-sm font-medium">Loading provider default settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-16">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <SlidersHorizontal className="h-6 w-6 text-primary" />
            Provider Default Settings
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Configure global default markup fees, dynamic tax brackets per seniority tier, and cart booking rules pop-up.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleSaveSettings}
            disabled={isSaving}
            className="gap-2 shadow-sm font-semibold min-w-[140px]"
          >
            {isSaving ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save All Settings
              </>
            )}
          </Button>
        </div>
      </div>

      {/* SECTION 1: Admin Markup Fee & Tax Configuration */}
      <Card className="border shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2 text-primary">
            <Coins className="h-5 w-5" />
            <CardTitle className="text-lg">Admin Default Markup Fee & Taxes</CardTitle>
          </div>
          <CardDescription>
            Set the default fee added on top of the provider’s registered daily rate. The customer directly sees the combined rate without extra confusing calculations.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Markup Fee Input */}
            <div className="space-y-2">
              <Label htmlFor="adminMarkupFee" className="text-sm font-semibold flex items-center gap-1.5">
                Default Admin Markup Fee ({symbol})
                <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-muted-foreground font-semibold">{symbol}</span>
                <Input
                  id="adminMarkupFee"
                  type="number"
                  min={0}
                  step={10}
                  value={settings.adminMarkupFee}
                  onChange={(e) => setSettings({ ...settings, adminMarkupFee: Number(e.target.value) || 0 })}
                  className="pl-8 text-base font-medium"
                  placeholder="200"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Added directly to provider base rate across cards, details, and cart.
              </p>
            </div>

            {/* Markup Tax Type */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold flex items-center gap-1.5">
                Markup Tax Treatment
              </Label>
              <Select
                value={settings.markupTaxType}
                onValueChange={(val: 'inclusive' | 'exclusive') =>
                  setSettings({ ...settings, markupTaxType: val })
                }
              >
                <SelectTrigger className="text-base">
                  <SelectValue placeholder="Select tax treatment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inclusive">Tax Inclusive (Included in fee)</SelectItem>
                  <SelectItem value="exclusive">Tax Exclusive (Calculated on top)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Whether markup fee already includes tax or tax is computed separately.
              </p>
            </div>

            {/* Markup Dynamic Tax Selection */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold flex items-center gap-1.5">
                Applied Dynamic Tax
              </Label>
              <Select
                value={settings.markupTaxId || 'no-tax'}
                onValueChange={handleMarkupTaxChange}
              >
                <SelectTrigger className="text-base">
                  <SelectValue placeholder="Select tax rate" />
                </SelectTrigger>
                <SelectContent>
                  {taxes.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.taxName} ({t.taxPercent}%)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Dynamically linked to your Admin Tax Configurations.
              </p>
            </div>
          </div>

          {/* Live Simulator Preview Banner */}
          <div className="rounded-xl border bg-gradient-to-r from-emerald-50/50 via-teal-50/30 to-blue-50/30 dark:from-emerald-950/20 dark:via-teal-950/10 dark:to-blue-950/10 p-4.5 sm:p-5">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-emerald-600" />
              <h4 className="text-sm font-bold text-foreground">Live Booking Payout Breakdown (Example: {symbol}1,200 Provider Daily Rate)</h4>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-center sm:text-left">
              <div className="bg-card/80 p-3 rounded-lg border">
                <span className="text-xs text-muted-foreground block">Provider Sets</span>
                <span className="text-lg font-bold text-foreground">{symbol}{sampleProviderRate.toLocaleString()}</span>
                <span className="text-[11px] text-muted-foreground block">Base Daily Rate</span>
              </div>
              <div className="bg-card/80 p-3 rounded-lg border">
                <span className="text-xs text-muted-foreground block">Admin Markup Fee</span>
                <span className="text-lg font-bold text-primary">+ {symbol}{sampleAdminFee.toLocaleString()}</span>
                <span className="text-[11px] text-muted-foreground block">({settings.markupTaxType})</span>
              </div>
              <div className="bg-primary/10 p-3 rounded-lg border border-primary/20">
                <span className="text-xs font-semibold text-primary block">Customer Directly Sees</span>
                <span className="text-xl font-extrabold text-primary">{symbol}{sampleCustomerRate.toLocaleString()}</span>
                <span className="text-[11px] font-medium text-primary/80 block">/ full day</span>
              </div>
              <div className="bg-card/80 p-3 rounded-lg border">
                <span className="text-xs text-muted-foreground block">Platform Revenue</span>
                <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{symbol}{sampleAdminFee} + Plat. Fee</span>
                <span className="text-[11px] text-muted-foreground block">Admin Net Inflow</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SECTION 2: Seniority-Level Tax Settings */}
      <Card className="border shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2 text-primary">
            <Percent className="h-5 w-5" />
            <CardTitle className="text-lg">Seniority-Level Tax Settings</CardTitle>
          </div>
          <CardDescription>
            Define specific tax rules (Tax Inclusive vs. Exclusive and dynamic tax percent) for each worker seniority tier (e.g. Beginner, Intermediate, Expert).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="font-semibold">Seniority / Skill Level</TableHead>
                  <TableHead className="font-semibold">Tax Treatment</TableHead>
                  <TableHead className="font-semibold">Applied Tax Bracket</TableHead>
                  <TableHead className="font-semibold text-right">Tax Percent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {settings.seniorityTaxes.map((st) => (
                  <TableRow key={st.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-semibold text-xs capitalize bg-card">
                          {st.label}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={st.taxType || 'inclusive'}
                        onValueChange={(val: 'inclusive' | 'exclusive') =>
                          updateSeniorityTax(st.id, { taxType: val })
                        }
                      >
                        <SelectTrigger className="w-[180px] h-9">
                          <SelectValue placeholder="Select treatment" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="inclusive">Tax Inclusive</SelectItem>
                          <SelectItem value="exclusive">Tax Exclusive</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={st.taxId || 'no-tax'}
                        onValueChange={(val) => updateSeniorityTax(st.id, { taxId: val })}
                      >
                        <SelectTrigger className="w-[220px] h-9">
                          <SelectValue placeholder="Select tax bracket" />
                        </SelectTrigger>
                        <SelectContent>
                          {taxes.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.taxName} ({t.taxPercent}%)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      <Badge variant="secondary" className="font-mono">
                        {st.taxPercent || 0}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* SECTION 3: Job Start & Completion OTP Security */}
      <Card className="border shadow-sm">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-primary">
                <ShieldCheck className="h-5 w-5" />
                <CardTitle className="text-lg">Job Start & Completion OTP Verification</CardTitle>
              </div>
              <CardDescription className="mt-1">
                Enforce dual OTP security. Provider must ask the customer for their unique 4-digit Start OTP to begin work, and Complete OTP when finished. Admins retain direct control to start/complete without OTP.
              </CardDescription>
            </div>
            <div className="flex items-center gap-3 bg-muted/50 p-2.5 rounded-lg border">
              <Label htmlFor="requireOtpForJobStartComplete" className="text-sm font-semibold cursor-pointer">
                OTP Verification Required
              </Label>
              <Switch
                id="requireOtpForJobStartComplete"
                checked={settings.requireOtpForJobStartComplete !== false}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, requireOtpForJobStartComplete: checked })
                }
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 text-sm space-y-2">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-primary">How Dual OTP Security Works:</p>
                <ul className="list-disc list-inside text-muted-foreground mt-1 space-y-1">
                  <li><strong>Start OTP:</strong> Generated when customer books. Customer shares this OTP with the provider when they arrive on-site. Provider verifies it to mark job &quot;In Progress&quot;.</li>
                  <li><strong>Complete OTP:</strong> Generated separately on the backend. Customer shares this OTP once the full work is finished. Provider enters it to mark job &quot;Completed&quot;.</li>
                  <li><strong>Duration Tracking:</strong> FixBro automatically records exact start &amp; end timestamps and calculates total worked duration.</li>
                  <li><strong>Admin Direct Power:</strong> Admins can start or mark complete at any time directly without asking for customer OTPs.</li>
                  <li><strong>Single-Click Mode:</strong> If you toggle this OFF, providers can start and complete jobs directly without asking customers for OTPs.</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SECTION 4: Cart Booking Rules Pop-up Settings */}
      <Card className="border shadow-sm">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-primary">
                <FileText className="h-5 w-5" />
                <CardTitle className="text-lg">Cart Booking Guidelines Pop-up</CardTitle>
              </div>
              <CardDescription className="mt-1">
                When customers click &quot;Proceed to Checkout&quot; on the Cart page, this pop-up modal appears with your mandatory operational terms. Customers must accept before proceeding.
              </CardDescription>
            </div>
            <div className="flex items-center gap-3 bg-muted/50 p-2 rounded-lg border">
              <Label htmlFor="enableCartBookingRules" className="text-sm font-semibold cursor-pointer">
                Pop-up Active
              </Label>
              <Switch
                id="enableCartBookingRules"
                checked={settings.enableCartBookingRules}
                onCheckedChange={(checked) => setSettings({ ...settings, enableCartBookingRules: checked })}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Pop-up Title & Subtitle Customization */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cartRulesTitle" className="text-sm font-semibold">
                Pop-up Modal Title
              </Label>
              <Input
                id="cartRulesTitle"
                value={settings.cartRulesTitle}
                onChange={(e) => setSettings({ ...settings, cartRulesTitle: e.target.value })}
                placeholder="Daily Labour Booking Guidelines & Rules"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cartRulesAgreementText" className="text-sm font-semibold">
                Customer Checkbox Agreement Text
              </Label>
              <Input
                id="cartRulesAgreementText"
                value={settings.cartRulesAgreementText}
                onChange={(e) => setSettings({ ...settings, cartRulesAgreementText: e.target.value })}
                placeholder="I have read, understood, and agree to these daily labour guidelines & terms."
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="cartRulesSubtitle" className="text-sm font-semibold">
                Modal Subtitle / Notice
              </Label>
              <Input
                id="cartRulesSubtitle"
                value={settings.cartRulesSubtitle}
                onChange={(e) => setSettings({ ...settings, cartRulesSubtitle: e.target.value })}
                placeholder="Please review and accept our daily labour service terms before proceeding to checkout."
              />
            </div>
          </div>

          {/* Rules Action Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t">
            <div>
              <h3 className="text-base font-bold text-foreground">Operational Rules & Policies ({settings.rules.length})</h3>
              <p className="text-xs text-muted-foreground">Displayed point by point to the customer before checkout.</p>
            </div>
            <div className="flex items-center gap-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reset to Defaults
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Reset to Standard Daily Labour Rules?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will replace all current rules with the 10 standard daily labour operational guidelines (Booked trade only, Single location, Shift hours, Offline ban, No cash payments, 100% no-show refund, etc.).
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleResetDefaultRules}>
                      Confirm Reset
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <Button onClick={openAddRuleDialog} size="sm" className="gap-1.5 text-xs font-semibold">
                <Plus className="h-3.5 w-3.5" />
                Add New Rule
              </Button>
            </div>
          </div>

          {/* Rules List Cards */}
          <div className="space-y-3">
            {settings.rules.map((rule, index) => (
              <div
                key={rule.id}
                className={`p-4 rounded-xl border transition-all ${
                  rule.isActive
                    ? 'bg-card border-border hover:border-primary/40'
                    : 'bg-muted/40 border-dashed border-border opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs mt-0.5">
                      {index + 1}
                    </div>
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-bold text-sm text-foreground">{rule.title}</h4>
                        <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider px-2 py-0">
                          {rule.category || 'general'}
                        </Badge>
                        {!rule.isActive && (
                          <Badge variant="secondary" className="text-[10px] text-muted-foreground">
                            Disabled
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {rule.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Switch
                      checked={rule.isActive}
                      onCheckedChange={(checked) => handleToggleRuleStatus(rule.id, checked)}
                      aria-label="Toggle rule active status"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditRuleDialog(rule)}
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteRule(rule.id)}
                      className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
        <CardFooter className="bg-muted/20 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4">
          <p className="text-xs text-muted-foreground">
            Changes to rules are immediately reflected in the checkout modal once saved.
          </p>
          <Button
            onClick={handleSaveSettings}
            disabled={isSaving}
            className="gap-2 font-semibold min-w-[140px]"
          >
            {isSaving ? "Saving..." : "Save All Settings"}
          </Button>
        </CardFooter>
      </Card>

      {/* Add / Edit Rule Dialog */}
      <Dialog open={isRuleDialogOpen} onOpenChange={setIsRuleDialogOpen}>
        <DialogContent className="max-w-md sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingRule ? "Edit Guideline Rule" : "Add New Guideline Rule"}</DialogTitle>
            <DialogDescription>
              Configure an operational rule that customers must acknowledge before checkout.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="ruleTitle" className="text-sm font-semibold">
                Rule Title <span className="text-red-500">*</span>
              </Label>
              <Input
                id="ruleTitle"
                value={ruleFormData.title}
                onChange={(e) => setRuleFormData({ ...ruleFormData, title: e.target.value })}
                placeholder="e.g. Service Strictly Limited to Booked Trade"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ruleCategory" className="text-sm font-semibold">
                Category
              </Label>
              <Select
                value={ruleFormData.category}
                onValueChange={(val: GuidelineCategory) => setRuleFormData({ ...ruleFormData, category: val })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="scope">Scope of Work</SelectItem>
                  <SelectItem value="location">Service Location</SelectItem>
                  <SelectItem value="hours">Working Hours & Breaks</SelectItem>
                  <SelectItem value="payment">Payments & Offline Ban</SelectItem>
                  <SelectItem value="conduct">Conduct & Respect</SelectItem>
                  <SelectItem value="refund">Refunds & Guarantees</SelectItem>
                  <SelectItem value="safety">Safety & Boundaries</SelectItem>
                  <SelectItem value="general">General</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ruleDesc" className="text-sm font-semibold">
                Detailed Description <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="ruleDesc"
                rows={4}
                value={ruleFormData.description}
                onChange={(e) => setRuleFormData({ ...ruleFormData, description: e.target.value })}
                placeholder="Explain the guideline clearly so customers know what to expect and agree before booking..."
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <Label htmlFor="ruleActive" className="text-sm font-semibold cursor-pointer">
                Rule Enabled & Active
              </Label>
              <Switch
                id="ruleActive"
                checked={ruleFormData.isActive}
                onCheckedChange={(checked) => setRuleFormData({ ...ruleFormData, isActive: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRuleDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveRule} className="gap-2 font-semibold">
              <CheckCircle2 className="h-4 w-4" />
              {editingRule ? "Update Rule" : "Add Rule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
