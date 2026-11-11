"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Loader2, Sparkles, Wand2, Search, Check, ChevronsUpDown, UserCheck, Briefcase } from 'lucide-react';
import type { FirestoreService, FirestoreSubCategory, FirestoreCategory, FirestoreReview } from '@/types/firestore';
import type { ReviewTargetProvider } from '@/components/admin/ReviewForm';
import { useToast } from '@/hooks/use-toast';
import { generateBulkReviews } from '@/ai/flows/generateBulkReviewsFlow';
import { db } from '@/lib/firebase';
import { collection, writeBatch, Timestamp, doc, query, where, getDocs, updateDoc } from '@/lib/mysqlDb';

const formSchema = z.object({
  serviceId: z.string({ required_error: "Please select a provider or service." }),
  numberOfReviews: z.coerce.number().int().min(1, "Must generate at least 1 review.").max(30, "Cannot generate more than 30 reviews at once."),
});

type BulkReviewFormData = z.infer<typeof formSchema>;

interface BulkReviewGeneratorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerationComplete: () => void;
  providers?: ReviewTargetProvider[];
  services?: Pick<FirestoreService, 'id' | 'name' | 'subCategoryId'>[];
  subCategories?: Pick<FirestoreSubCategory, 'id' | 'name' | 'parentId'>[];
  parentCategories?: Pick<FirestoreCategory, 'id' | 'name'>[];
}

export default function BulkReviewGeneratorDialog({
  isOpen,
  onClose,
  onGenerationComplete,
  providers = [],
  services = [],
  subCategories = [],
  parentCategories = [],
}: BulkReviewGeneratorDialogProps) {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [targetType, setTargetType] = useState<'provider' | 'service'>('provider');
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTargetName, setSelectedTargetName] = useState<string>("");

  const form = useForm<BulkReviewFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { serviceId: "", numberOfReviews: 5 },
  });

  const watchedId = form.watch("serviceId");

  useEffect(() => {
    if (watchedId) {
      const prov = providers.find((p) => p.id === watchedId);
      if (prov) {
        setSelectedTargetName(prov.fullName);
        return;
      }
      const srv = services.find((s) => s.id === watchedId);
      if (srv) {
        setSelectedTargetName(srv.name);
        return;
      }
    }
    setSelectedTargetName("");
  }, [watchedId, providers, services]);

  const filteredProviders = providers.filter((p) =>
    p.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.workCategoryName && p.workCategoryName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredServices = services.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    if (!isPickerOpen) {
      setSearchQuery("");
    }
  }, [isPickerOpen]);

  const onSubmit = async (data: BulkReviewFormData) => {
    setIsGenerating(true);
    toast({ title: "Starting Review Generation...", description: "The AI is crafting authentic daily labour reviews. This may take a moment." });

    const selectedProvider = providers.find((p) => p.id === data.serviceId);
    const selectedService = services.find((s) => s.id === data.serviceId);

    if (!selectedProvider && !selectedService) {
      toast({ title: "Error", description: "Selected provider or service not found.", variant: "destructive" });
      setIsGenerating(false);
      return;
    }

    const subCategory = selectedService ? subCategories.find((sc) => sc.id === selectedService.subCategoryId) : undefined;
    const parentCategory = subCategory ? parentCategories.find((pc) => pc.id === subCategory.parentId) : undefined;

    try {
      const aiResult = await generateBulkReviews({
        serviceId: selectedProvider ? selectedProvider.id : selectedService!.id,
        serviceName: selectedProvider ? selectedProvider.fullName : selectedService!.name,
        providerId: selectedProvider ? selectedProvider.id : undefined,
        providerName: selectedProvider ? selectedProvider.fullName : undefined,
        seniorityLevel: selectedProvider?.seniorityLevel,
        subCategoryName: !selectedProvider && subCategory ? subCategory.name : '',
        categoryName: selectedProvider
          ? (selectedProvider.workCategoryName || 'Daily Labour')
          : (parentCategory?.name || ''),
        numberOfReviews: data.numberOfReviews,
      });

      if (!aiResult.reviews || aiResult.reviews.length === 0) {
        throw new Error("AI did not return any reviews.");
      }
      
      toast({ title: "AI Generation Complete", description: `Saving ${aiResult.reviews.length} new reviews to the database.` });

      // Save to adminReviews
      const batch = writeBatch(db);
      const reviewsCollectionRef = collection(db, "adminReviews");

      aiResult.reviews.forEach((review) => {
        const newReviewRef = doc(reviewsCollectionRef);
        const reviewData: Omit<FirestoreReview, 'id'> = {
          serviceId: selectedProvider ? selectedProvider.id : selectedService!.id,
          serviceName: selectedProvider ? selectedProvider.fullName : selectedService!.name,
          providerId: selectedProvider ? selectedProvider.id : undefined,
          providerName: selectedProvider ? selectedProvider.fullName : undefined,
          userName: review.userName,
          rating: review.rating,
          comment: review.comment,
          status: "Approved",
          adminCreated: true,
          createdAt: Timestamp.now(),
        };
        batch.set(newReviewRef, reviewData);
      });

      await batch.commit();

      // Recalculate provider aggregate rating and reviewCount in providerApplications
      if (selectedProvider) {
        try {
          const qProv = query(
            collection(db, "adminReviews"),
            where("providerId", "==", selectedProvider.id),
            where("status", "==", "Approved")
          );
          const snap = await getDocs(qProv);
          let totalRating = 0;
          let count = 0;
          snap.forEach((d) => {
            const r = d.data();
            if (typeof r.rating === 'number') {
              totalRating += r.rating;
              count++;
            }
          });
          if (count > 0) {
            const avg = Number((totalRating / count).toFixed(1));
            await updateDoc(doc(db, "providerApplications", selectedProvider.id), {
              rating: avg,
              reviewCount: count,
            });
          }
        } catch (aggErr) {
          console.error("Could not update provider rating aggregate:", aggErr);
        }
      }

      toast({
        title: "Success!",
        description: `${aiResult.reviews.length} authentic reviews generated and published.`,
        className: "bg-green-100 text-green-700 border-green-300"
      });
      onGenerationComplete();
      onClose();

    } catch (error) {
      console.error("Error generating bulk reviews:", error);
      toast({ title: "Error", description: (error as Error).message || "An unexpected error occurred.", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!isGenerating) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center text-lg font-bold">
            <Wand2 className="mr-2 h-5 w-5 text-primary" />
            AI Bulk Review Generator
          </DialogTitle>
          <DialogDescription>
            Select a verified daily labour provider to generate authentic customer reviews with realistic work feedback and ratings.
          </DialogDescription>
        </DialogHeader>

        {/* Target Switcher: Provider vs Service */}
        <div className="flex items-center gap-2 p-1 bg-muted/60 rounded-lg">
          <Button
            type="button"
            size="sm"
            variant={targetType === 'provider' ? 'default' : 'ghost'}
            className="flex-1 text-xs font-semibold gap-1.5"
            onClick={() => {
              setTargetType('provider');
              form.setValue('serviceId', '');
              setSelectedTargetName('');
            }}
          >
            <UserCheck className="h-3.5 w-3.5" />
            Daily Labour Provider ({providers.length})
          </Button>
          <Button
            type="button"
            size="sm"
            variant={targetType === 'service' ? 'default' : 'ghost'}
            className="flex-1 text-xs font-semibold gap-1.5"
            onClick={() => {
              setTargetType('service');
              form.setValue('serviceId', '');
              setSelectedTargetName('');
            }}
          >
            <Briefcase className="h-3.5 w-3.5" />
            Service ({services.length})
          </Button>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-1">
            <FormField
              control={form.control}
              name="serviceId"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel className="text-xs font-semibold">
                    {targetType === 'provider' ? 'Select Daily Labour Provider' : 'Select Service'}
                  </FormLabel>
                  <Dialog open={isPickerOpen} onOpenChange={setIsPickerOpen}>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className={cn(
                          "w-full justify-between text-left font-normal h-11",
                          !field.value && "text-muted-foreground"
                        )}
                        disabled={isGenerating}
                        type="button"
                      >
                        <span className="truncate">
                          {selectedTargetName || (targetType === 'provider' ? "Choose a Daily Labour Provider..." : "Choose a service...")}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="w-[calc(100%-6px)] sm:max-w-[450px]">
                      <DialogHeader>
                        <DialogTitle>
                          {targetType === 'provider' ? 'Choose Daily Labour Provider' : 'Select Service'}
                        </DialogTitle>
                        <DialogDescription>
                          {targetType === 'provider'
                            ? 'Select the worker whose profile and ratings will be updated with generated reviews.'
                            : 'Search and select a service to generate reviews for.'}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="relative my-2">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder={targetType === 'provider' ? "Search provider name or trade..." : "Search services..."}
                          className="pl-9 h-10"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                        />
                      </div>
                      <div className="py-2">
                        <ScrollArea className="h-[280px] rounded-md border p-2">
                          <div className="space-y-1.5">
                            {targetType === 'provider' ? (
                              filteredProviders.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-6">
                                  No approved providers found matching your search.
                                </p>
                              ) : (
                                filteredProviders.map((provider) => (
                                  <Button
                                    key={provider.id}
                                    variant={field.value === provider.id ? "secondary" : "ghost"}
                                    className="w-full justify-start text-left h-auto py-2 px-3 relative"
                                    onClick={() => {
                                      field.onChange(provider.id);
                                      setSelectedTargetName(provider.fullName);
                                      setIsPickerOpen(false);
                                    }}
                                    type="button"
                                  >
                                    <div className="flex items-center gap-3 w-full pr-6">
                                      <Avatar className="h-9 w-9 shrink-0">
                                        <AvatarImage src={provider.profilePhotoUrl} alt={provider.fullName} />
                                        <AvatarFallback className="text-xs bg-primary/10 text-primary font-bold">
                                          {provider.fullName.slice(0, 2).toUpperCase()}
                                        </AvatarFallback>
                                      </Avatar>
                                      <div className="flex flex-col min-w-0 flex-1">
                                        <span className="text-sm font-semibold truncate text-foreground">{provider.fullName}</span>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                          {provider.workCategoryName && (
                                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                              {provider.workCategoryName}
                                            </Badge>
                                          )}
                                          {provider.seniorityLevel && (
                                            <span className="text-[10px] text-muted-foreground capitalize">
                                              {provider.seniorityLevel}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                    {field.value === provider.id && (
                                      <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                                    )}
                                  </Button>
                                ))
                              )
                            ) : (
                              filteredServices.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-6">No services found.</p>
                              ) : (
                                filteredServices.map((service) => (
                                  <Button
                                    key={service.id}
                                    variant={field.value === service.id ? "secondary" : "ghost"}
                                    className="w-full justify-start text-left h-auto py-2.5 px-3 relative"
                                    onClick={() => {
                                      field.onChange(service.id);
                                      setSelectedTargetName(service.name);
                                      setIsPickerOpen(false);
                                    }}
                                    type="button"
                                  >
                                    <span className="text-sm font-medium">{service.name}</span>
                                    {field.value === service.id && (
                                      <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                                    )}
                                  </Button>
                                ))
                              )
                            )}
                          </div>
                        </ScrollArea>
                      </div>
                    </DialogContent>
                  </Dialog>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="numberOfReviews"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold">Number of Reviews to Generate</FormLabel>
                  <FormControl>
                    <Input type="number" min="1" max="30" placeholder="e.g., 5" {...field} disabled={isGenerating} />
                  </FormControl>
                  <FormDescription className="text-xs">
                    Each generated review includes authentic customer feedback about arrival punctuality (09:30 AM), full-day labour, verified skill, and OTP verification.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-2">
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={isGenerating}>Cancel</Button>
              </DialogClose>
              <Button type="submit" disabled={isGenerating}>
                {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Generate Reviews
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
