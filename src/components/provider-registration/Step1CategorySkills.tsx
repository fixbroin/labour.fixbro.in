
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Info, AlertCircle } from "lucide-react";
import type { ProviderApplication, ProviderControlOptions } from '@/types/firestore';
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Loader2, ChevronRight, Check } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { useApplicationConfig } from "@/hooks/useApplicationConfig";

const step1CategorySkillsSchema = z.object({
  workCategoryId: z.string({ required_error: "Please select your primary work category." }),
  experienceLevelId: z.string({ required_error: "Please select your experience level." }),
  skillLevelId: z.string({ required_error: "Please select your skill level." }),
  dailyRate: z.coerce.number().min(1, "Please enter your desired daily rate."),
  bio: z.string().max(500, "Bio cannot exceed 500 characters.").optional().or(z.literal('')),
});

type Step1FormData = z.infer<typeof step1CategorySkillsSchema>;

interface Step1CategorySkillsProps {
  onNext: (data: Partial<ProviderApplication>) => void;
  initialData: Partial<ProviderApplication>;
  controlOptions: ProviderControlOptions | null;
  isSaving: boolean;
  userUid: string;
  isEditModeByAdmin?: boolean;
}

const STORAGE_KEY = 'fixbro_reg_step1';

export default function Step1CategorySkills({
  onNext,
  initialData,
  controlOptions,
  isSaving,
  userUid,
  isEditModeByAdmin = false,
}: Step1CategorySkillsProps) {
  const { config: appConfig } = useApplicationConfig();
  const symbol = appConfig?.currencySymbol || '₹';

  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [isExperienceDialogOpen, setIsExperienceDialogOpen] = useState(false);
  const [isSkillDialogOpen, setIsSkillDialogOpen] = useState(false);

  const form = useForm<Step1FormData>({
    resolver: zodResolver(step1CategorySkillsSchema),
    defaultValues: {
      workCategoryId: initialData.workCategoryId || undefined,
      experienceLevelId: initialData.experienceLevelId || undefined,
      skillLevelId: initialData.skillLevelId || undefined,
      dailyRate: (initialData.dailyRate as any) || "",
      bio: initialData.bio || "",
    },
  });

  const lastGeneratedBioRef = useRef("");

  // Restore from localStorage on mount
  useEffect(() => {
    if (isEditModeByAdmin || !userUid) return;
    const userStorageKey = `${STORAGE_KEY}_${userUid}`;
    const saved = localStorage.getItem(userStorageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        form.reset({ ...form.getValues(), ...parsed });
        if (parsed.bio) {
          lastGeneratedBioRef.current = parsed.bio;
        }
      } catch (e) {
        console.error("Step1: Error parsing saved data", e);
      }
    }
  }, [form, userUid, isEditModeByAdmin]);

  // Reset form when initialData changes (critical for admin switching providers)
  useEffect(() => {
    form.reset({
      workCategoryId: initialData.workCategoryId || undefined,
      experienceLevelId: initialData.experienceLevelId || undefined,
      skillLevelId: initialData.skillLevelId || undefined,
      dailyRate: (initialData.dailyRate as any) || "",
      bio: initialData.bio || "",
    });
    lastGeneratedBioRef.current = initialData.bio || "";
  }, [initialData, form]);

  // Auto-generate bio when choices change
  const catId = form.watch('workCategoryId');
  const expId = form.watch('experienceLevelId');
  const skillId = form.watch('skillLevelId');

  useEffect(() => {
    if (!controlOptions) return;
    const catName = controlOptions.categories.find(c => c.id === catId)?.name;
    const expLabel = controlOptions.experienceLevels.find(e => e.id === expId)?.label;
    const skillLabel = controlOptions.skillLevels.find(s => s.id === skillId)?.label;

    const parts = [];
    if (catName) {
      parts.push(`I am a professional provider specialized in ${catName} services.`);
    }
    if (expLabel) {
      parts.push(`I have ${expLabel.toLowerCase()} of hands-on experience in this field.`);
    }
    if (skillLabel) {
      parts.push(`My expertise is at a ${skillLabel.toLowerCase()} level.`);
    }
    if (parts.length > 0) {
      parts.push("I am committed to delivering high-quality work, ensuring customer satisfaction, and maintaining clean professional standards.");
    }

    const generated = parts.join(" ");
    const currentBio = form.getValues('bio') || '';

    if (currentBio === '' || currentBio === lastGeneratedBioRef.current) {
      form.setValue('bio', generated, { shouldValidate: true });
      lastGeneratedBioRef.current = generated;
    }
  }, [catId, expId, skillId, controlOptions]);

  // Auto-save to localStorage on change
  const watchedFields = form.watch();
  useEffect(() => {
    if (isEditModeByAdmin || !userUid) return;
    const userStorageKey = `${STORAGE_KEY}_${userUid}`;
    localStorage.setItem(userStorageKey, JSON.stringify(watchedFields));
  }, [watchedFields, userUid, isEditModeByAdmin]);

  const handleSubmit = (data: Step1FormData) => {
    const category = controlOptions?.categories.find(c => c.id === data.workCategoryId);
    const experienceLevel = controlOptions?.experienceLevels.find(e => e.id === data.experienceLevelId);
    const skillLevel = controlOptions?.skillLevels.find(s => s.id === data.skillLevelId);

    const rawRates = category?.seniorityRates;
    const rates = Array.isArray(rawRates)
      ? rawRates
      : (typeof rawRates === 'string' ? JSON.parse(rawRates || '[]') : []);

    const rateRule = rates.find(
      (r: any) => r.skillLevelId === data.skillLevelId || 
           (r.skillLevelLabel && skillLevel?.label && r.skillLevelLabel.trim().toLowerCase() === skillLevel.label.trim().toLowerCase())
    );

    const min = rateRule?.minRate ?? 500;
    const max = rateRule?.maxRate ?? 2500;

    if (data.dailyRate < min) {
      form.setError('dailyRate', {
        type: 'manual',
        message: `Daily rate cannot be less than ${symbol}${min}. Please enter at least ${symbol}${min}.`
      });
      return;
    }
    if (data.dailyRate > max) {
      form.setError('dailyRate', {
        type: 'manual',
        message: `Daily rate cannot exceed ${symbol}${max}. Please enter at most ${symbol}${max}.`
      });
      return;
    }

    const applicationData: Partial<ProviderApplication> = {
      workCategoryId: data.workCategoryId,
      workCategoryName: category?.name,
      experienceLevelId: data.experienceLevelId,
      experienceLevelLabel: experienceLevel?.label,
      skillLevelId: data.skillLevelId,
      skillLevelLabel: skillLevel?.label,
      seniorityLevel: skillLevel?.label || 'Senior',
      dailyRate: Number(data.dailyRate),
      bio: data.bio && data.bio.trim() !== "" ? data.bio : undefined,
    };
    onNext(applicationData);
  };

  if (!controlOptions) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="mt-2 text-muted-foreground">Loading options...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <CardContent className="space-y-4">
          
          {/* Work Category Popup */}
          <FormField
            control={form.control}
            name="workCategoryId"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Primary Work Category *</FormLabel>
                <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
                  <DialogTrigger asChild>
                    <FormControl>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-between h-11 text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                        disabled={isSaving}
                      >
                        <span className="truncate">
                          {field.value
                            ? controlOptions.categories.find((cat) => cat.id === field.value)?.name
                            : "Select your main category"}
                        </span>
                        <ChevronRight className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </FormControl>
                  </DialogTrigger>
                  <DialogContent className="p-0 max-w-[90vw] sm:max-w-md">
                    <DialogHeader className="p-4 border-b">
                      <DialogTitle>Select Work Category</DialogTitle>
                    </DialogHeader>
                    <ScrollArea className="h-72">
                      <div className="p-2 space-y-1">
                        {controlOptions.categories.map((cat) => (
                          <Button
                            key={cat.id}
                            variant="ghost"
                            className="w-full justify-between items-center font-normal h-auto min-h-[44px] py-2.5 px-3 text-left whitespace-normal break-words hover:bg-muted/60"
                            onClick={() => {
                              field.onChange(cat.id);
                              setIsCategoryDialogOpen(false);
                            }}
                          >
                            <span className="text-sm leading-snug break-words text-left flex-1 mr-2">{cat.name}</span>
                            {field.value === cat.id && <Check className="h-4 w-4 text-primary shrink-0" />}
                          </Button>
                        ))}
                      </div>
                    </ScrollArea>
                  </DialogContent>
                </Dialog>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Experience Level Popup */}
          <FormField
            control={form.control}
            name="experienceLevelId"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Experience Level *</FormLabel>
                <Dialog open={isExperienceDialogOpen} onOpenChange={setIsExperienceDialogOpen}>
                  <DialogTrigger asChild>
                    <FormControl>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-between h-11 text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                        disabled={isSaving}
                      >
                        <span className="truncate">
                          {field.value
                            ? controlOptions.experienceLevels.find((level) => level.id === field.value)?.label
                            : "Select your experience"}
                        </span>
                        <ChevronRight className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </FormControl>
                  </DialogTrigger>
                  <DialogContent className="p-0 max-w-[90vw] sm:max-w-md">
                    <DialogHeader className="p-4 border-b">
                      <DialogTitle>Select Experience Level</DialogTitle>
                    </DialogHeader>
                    <ScrollArea className="h-72">
                      <div className="p-2 space-y-1">
                        {controlOptions.experienceLevels.map((level) => (
                          <Button
                            key={level.id}
                            variant="ghost"
                            className="w-full justify-between items-center font-normal h-auto min-h-[44px] py-2.5 px-3 text-left whitespace-normal break-words hover:bg-muted/60"
                            onClick={() => {
                              field.onChange(level.id);
                              setIsExperienceDialogOpen(false);
                            }}
                          >
                            <span className="text-sm leading-snug break-words text-left flex-1 mr-2">{level.label}</span>
                            {field.value === level.id && <Check className="h-4 w-4 text-primary shrink-0" />}
                          </Button>
                        ))}
                      </div>
                    </ScrollArea>
                  </DialogContent>
                </Dialog>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Skill Level Popup */}
          <FormField
            control={form.control}
            name="skillLevelId"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Skill Level *</FormLabel>
                <Dialog open={isSkillDialogOpen} onOpenChange={setIsSkillDialogOpen}>
                  <DialogTrigger asChild>
                    <FormControl>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-between h-11 text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                        disabled={isSaving}
                      >
                        <span className="truncate">
                          {field.value
                            ? controlOptions.skillLevels.find((level) => level.id === field.value)?.label
                            : "Select your skill level"}
                        </span>
                        <ChevronRight className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </FormControl>
                  </DialogTrigger>
                  <DialogContent className="p-0 max-w-[90vw] sm:max-w-md">
                    <DialogHeader className="p-4 border-b">
                      <DialogTitle>Select Skill Level</DialogTitle>
                    </DialogHeader>
                    <ScrollArea className="h-72">
                      <div className="p-2 space-y-1">
                        {controlOptions.skillLevels.map((level) => (
                          <Button
                            key={level.id}
                            variant="ghost"
                            className="w-full justify-between items-center font-normal h-auto min-h-[44px] py-2.5 px-3 text-left whitespace-normal break-words hover:bg-muted/60"
                            onClick={() => {
                              field.onChange(level.id);
                              setIsSkillDialogOpen(false);
                            }}
                          >
                            <span className="text-sm leading-snug break-words text-left flex-1 mr-2">{level.label}</span>
                            {field.value === level.id && <Check className="h-4 w-4 text-primary shrink-0" />}
                          </Button>
                        ))}
                      </div>
                    </ScrollArea>
                  </DialogContent>
                </Dialog>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Desired Daily Rate (₹) with Category Dynamic Limits */}
          {(() => {
            const chosenCat = controlOptions.categories.find(c => c.id === form.watch('workCategoryId'));
            const chosenSkill = controlOptions.skillLevels.find(s => s.id === form.watch('skillLevelId'));
            const rawRates = chosenCat?.seniorityRates;
            const rates = Array.isArray(rawRates)
              ? rawRates
              : (typeof rawRates === 'string' ? JSON.parse(rawRates || '[]') : []);

            const activeRateRule = rates.find(
              (r: any) => r.skillLevelId === chosenSkill?.id || 
                   (r.skillLevelLabel && chosenSkill?.label && r.skillLevelLabel.trim().toLowerCase() === chosenSkill.label.trim().toLowerCase())
            );

            const minRate = activeRateRule?.minRate ?? 500;
            const maxRate = activeRateRule?.maxRate ?? 2500;

            const watchedVal = form.watch('dailyRate');
            const numVal = watchedVal !== undefined && watchedVal !== null && String(watchedVal).trim() !== '' ? Number(watchedVal) : null;
            let realTimeError: string | null = null;
            if (numVal !== null && !isNaN(numVal)) {
              if (numVal < minRate) {
                realTimeError = `Daily rate cannot be less than ${symbol}${minRate}. Please enter at least ${symbol}${minRate}.`;
              } else if (numVal > maxRate) {
                realTimeError = `Daily rate cannot exceed ${symbol}${maxRate}. Please enter at most ${symbol}${maxRate}.`;
              }
            }

            return (
              <FormField
                control={form.control}
                name="dailyRate"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel>Desired Daily Rate ({symbol} / Day) *</FormLabel>
                      <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20 font-semibold">
                        Allowed: {symbol}{minRate} - {symbol}{maxRate}
                      </Badge>
                    </div>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder={activeRateRule ? `e.g., ${activeRateRule.minRate}` : 'e.g., 1000'}
                        {...field}
                        disabled={isSaving}
                        className={cn(
                          "h-11 text-base font-semibold",
                          realTimeError && "border-destructive focus-visible:ring-destructive"
                        )}
                        min={minRate}
                        max={maxRate}
                      />
                    </FormControl>

                    {/* Guidance / Instruction Message */}
                    <FormDescription className="text-xs flex items-center gap-1.5 text-muted-foreground">
                      <Info className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span>
                        Allowed rate is between {symbol}{minRate} and {symbol}{maxRate} for {chosenSkill?.label || 'this level'} in {chosenCat?.name || 'this category'}. Please set your desired amount within this range.
                      </span>
                    </FormDescription>

                    {/* Real-time Error Message */}
                    {realTimeError && (
                      <p className="text-xs font-semibold text-destructive flex items-center gap-1 mt-1">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                        {realTimeError}
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            );
          })()}

          <FormField
            control={form.control}
            name="bio"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Bio / About Me</FormLabel>
                <FormControl>
                  <Textarea 
                    placeholder="Briefly describe your professional background..." 
                    {...field} 
                    disabled={isSaving}
                    rows={4}
                  />
                </FormControl>
                <FormDescription>Tell us a bit about your work experience and expertise.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button type="submit" disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save & Continue
          </Button>
        </CardFooter>
      </form>
    </Form>
  );
}
