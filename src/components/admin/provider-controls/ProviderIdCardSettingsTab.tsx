"use client";

import { useState, useEffect, useCallback } from 'react';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
import { Loader2, Save, Contact2, ShieldCheck, IndianRupee, Clock, HelpCircle } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { useApplicationConfig } from "@/hooks/useApplicationConfig";
import { 
  getProviderIdCardSettingsAction, 
  saveProviderIdCardSettingsAction, 
} from '@/app/actions/providerIdCardActions';
import { type ProviderIdCardSettings, DEFAULT_ID_CARD_SETTINGS } from '@/types/providerAreaAndId';

const idCardSettingsSchema = z.object({
  isIdCardEnabled: z.boolean().default(true),
  downloadFee: z.coerce.number().min(0, "Download fee must be 0 or more."),
  validityYears: z.coerce.number().min(0, "Years cannot be negative.").max(10, "Maximum validity is 10 years.").default(2),
  validityMonths: z.coerce.number().min(0, "Months cannot be negative.").max(11, "Months must be between 0 and 11.").default(0),
  signatoryName: z.string().min(2, "Signatory name is required."),
  helplineNumber: z.string().min(5, "Helpline number is required."),
  idNumberPrefix: z.string().optional().default(""),
  idNumberStartingSeq: z.coerce.number().min(1, "Starting sequence must be at least 1.").default(361707601001),
  disclaimerText: z.string().min(10, "Disclaimer text is required."),
}).refine(data => data.validityYears > 0 || data.validityMonths > 0, {
  message: "Validity period must be at least 1 month or 1 year.",
  path: ["validityMonths"],
});

type IdCardSettingsFormData = z.infer<typeof idCardSettingsSchema>;

export default function ProviderIdCardSettingsTab() {
  const { toast } = useToast();
  const { config: appConfig } = useApplicationConfig();
  const symbol = appConfig?.currencySymbol || "₹";
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<IdCardSettingsFormData>({
    resolver: zodResolver(idCardSettingsSchema),
    defaultValues: DEFAULT_ID_CARD_SETTINGS,
  });

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getProviderIdCardSettingsAction();
      form.reset(data);
    } catch (error) {
      toast({ title: "Error", description: "Could not load ID card settings.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast, form]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const onSubmit = async (data: IdCardSettingsFormData) => {
    setIsSaving(true);
    try {
      const result = await saveProviderIdCardSettingsAction(data);
      if (result.success) {
        toast({ title: "Success", description: result.message });
        await loadSettings();
      } else {
        toast({ title: "Error", description: result.message, variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Could not save ID card settings.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Provider ID Card Settings</CardTitle>
          <CardDescription>Loading configuration...</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl flex items-center gap-2">
          <Contact2 className="h-5 w-5 text-primary" />
          Provider ID Card Configuration
        </CardTitle>
        <CardDescription>
          Configure official PVC printable ID card generation for verified service providers, pricing, and validity.
        </CardDescription>
      </CardHeader>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <CardContent className="space-y-6 pt-4">
            {/* Enable/Disable ID Card Generation */}
            <FormField
              control={form.control}
              name="isIdCardEnabled"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-xl border p-4 shadow-sm bg-muted/20">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base font-semibold flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-emerald-600" />
                      Enable ID Card Generation
                    </FormLabel>
                    <FormDescription>
                      When enabled, approved service providers will see the "Generate ID Card" menu and can generate official PVC printable cards.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={isSaving}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="grid gap-6 sm:grid-cols-2">
              {/* Download Fee */}
              <FormField
                control={form.control}
                name="downloadFee"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1.5">
                      <IndianRupee className="h-4 w-4 text-primary" />
                      Download Fee ({symbol})
                    </FormLabel>
                    <FormControl>
                      <Input type="number" min={0} step={1} {...field} disabled={isSaving} />
                    </FormControl>
                    <FormDescription>
                      Set amount providers must pay to unlock and download their high-res ID card. Set to <strong>0</strong> for free downloads.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Validity Period: Years & Months */}
              <div className="space-y-2">
                <FormLabel className="flex items-center gap-1.5 font-medium">
                  <Clock className="h-4 w-4 text-primary" />
                  Card Validity Period (Years & Months)
                </FormLabel>
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="validityYears"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center gap-2">
                          <FormControl>
                            <Input type="number" min={0} max={10} step={1} {...field} disabled={isSaving} />
                          </FormControl>
                          <span className="text-xs text-muted-foreground whitespace-nowrap font-medium">Years</span>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="validityMonths"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center gap-2">
                          <FormControl>
                            <Input type="number" min={0} max={11} step={1} {...field} disabled={isSaving} />
                          </FormControl>
                          <span className="text-xs text-muted-foreground whitespace-nowrap font-medium">Months</span>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormDescription>
                  Set expiry in months only (e.g., 0 Years, 6 Months), years only (e.g., 2 Years, 0 Months), or both (e.g., 1 Year, 6 Months).
                </FormDescription>
              </div>

              {/* Authorized Signatory */}
              <FormField
                control={form.control}
                name="signatoryName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Authorized Signatory Title</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Authorized Signatory - FixBro" disabled={isSaving} />
                    </FormControl>
                    <FormDescription>
                      Name or title printed under the digital authorization signature on the ID card.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Support Helpline */}
              <FormField
                control={form.control}
                name="helplineNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1.5">
                      <HelpCircle className="h-4 w-4 text-primary" />
                      Support & Helpline Phone
                    </FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="+91 8000 123 456" disabled={isSaving} />
                    </FormControl>
                    <FormDescription>
                      Helpline and verification number printed on the back of the ID card for customer inquiries.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* ID Number Starting Sequence */}
              <FormField
                control={form.control}
                name="idNumberStartingSeq"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1.5">
                      <Contact2 className="h-4 w-4 text-primary" />
                      ID Card Starting Sequence (12-Digit Base)
                    </FormLabel>
                    <FormControl>
                      <Input type="number" {...field} placeholder="361707601001" disabled={isSaving} />
                    </FormControl>
                    <FormDescription>
                      Starting base number for generating unique Aadhaar-style 12-digit partner numbers (e.g. 3617 0760 1001).
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* ID Prefix */}
              <FormField
                control={form.control}
                name="idNumberPrefix"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ID Number Prefix (Optional)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g. FXB or leave blank for pure numbers" disabled={isSaving} />
                    </FormControl>
                    <FormDescription>
                      Optional prefix added before the 12-digit number (leave blank for Aadhaar-style 12 digits).
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Private Entity Disclaimer */}
              <FormField
                control={form.control}
                name="disclaimerText"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel className="flex items-center gap-1.5">
                      <ShieldCheck className="h-4 w-4 text-primary" />
                      Legal / Private Identification Disclaimer
                    </FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="This ID is not issued by Government." disabled={isSaving} />
                    </FormControl>
                    <FormDescription>
                      Printed in the verification box on the front and back of the card stating it is private, not government issued.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>

          <CardFooter className="flex justify-end border-t pt-4">
            <Button type="submit" disabled={isSaving} className="flex items-center gap-2">
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save ID Card Settings
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
