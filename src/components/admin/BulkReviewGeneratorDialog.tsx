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
import { Loader2, Sparkles, Search, Check, ChevronsUpDown, UserCheck } from 'lucide-react';
import type { FirestoreReview } from '@/types/firestore';
import type { ReviewTargetProvider } from '@/components/admin/ReviewForm';
import { useToast } from '@/hooks/use-toast';
import { generateCuratedReviews } from '@/lib/reviewTemplates';
import { db } from '@/lib/firebase';
import { collection, writeBatch, Timestamp, doc, query, where, getDocs, updateDoc } from '@/lib/mysqlDb';

const formSchema = z.object({
  providerId: z.string({ required_error: "Please select a daily labour provider." }).min(1, "Please select a provider."),
  numberOfReviews: z.coerce.number().int().min(1, "Must generate at least 1 review.").max(30, "Cannot generate more than 30 reviews at once."),
});

type BulkReviewFormData = z.infer<typeof formSchema>;

interface BulkReviewGeneratorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerationComplete: () => void;
  providers?: ReviewTargetProvider[];
  services?: unknown[];
  subCategories?: unknown[];
  parentCategories?: unknown[];
}

export default function BulkReviewGeneratorDialog({
  isOpen,
  onClose,
  onGenerationComplete,
  providers = [],
}: BulkReviewGeneratorDialogProps) {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProviderName, setSelectedProviderName] = useState<string>("");

  const form = useForm<BulkReviewFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { providerId: "", numberOfReviews: 5 },
  });

  const watchedProviderId = form.watch("providerId");

  useEffect(() => {
    if (watchedProviderId) {
      const prov = providers.find((p) => p.id === watchedProviderId);
      if (prov) {
        setSelectedProviderName(prov.fullName);
        return;
      }
    }
    setSelectedProviderName("");
  }, [watchedProviderId, providers]);

  const filteredProviders = providers.filter((p) =>
    p.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.workCategoryName && p.workCategoryName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  useEffect(() => {
    if (!isPickerOpen) {
      setSearchQuery("");
    }
  }, [isPickerOpen]);

  const onSubmit = async (data: BulkReviewFormData) => {
    setIsGenerating(true);
    toast({ 
      title: "Generating Reviews...", 
      description: "Selecting authentic trade-matched customer reviews with unique Indian names." 
    });

    const selectedProvider = providers.find((p) => p.id === data.providerId);
    if (!selectedProvider) {
      toast({ title: "Error", description: "Selected provider not found.", variant: "destructive" });
      setIsGenerating(false);
      return;
    }

    try {
      // 1. Fetch all existing reviews from adminReviews across the entire system to strictly guarantee NO duplicate names or reviews
      const allReviewsSnap = await getDocs(collection(db, "adminReviews"));
      const usedNames = new Set<string>();
      const usedComments = new Set<string>();

      allReviewsSnap.forEach((d) => {
        const r = d.data();
        if (r.userName && typeof r.userName === 'string') {
          usedNames.add(r.userName.trim());
        }
        if (r.comment && typeof r.comment === 'string') {
          usedComments.add(r.comment.trim());
        }
      });

      // 2. Generate curated, category-matched reviews with authentic Indian names
      const generated = generateCuratedReviews(
        selectedProvider.workCategoryName || 'general',
        data.numberOfReviews,
        usedNames,
        usedComments
      );

      if (!generated || generated.length === 0) {
        throw new Error("Could not generate reviews from the curated pool.");
      }

      // 3. Batch write reviews to adminReviews
      const batch = writeBatch(db);
      const reviewsCollectionRef = collection(db, "adminReviews");

      generated.forEach((rev) => {
        const newReviewRef = doc(reviewsCollectionRef);
        // Staggered past timestamp spread over daysAgo
        const reviewTimestamp = Timestamp.fromMillis(Date.now() - (rev.daysAgo * 86400000) - Math.floor(Math.random() * 3600000));
        
        const reviewData: Omit<FirestoreReview, 'id'> = {
          serviceId: selectedProvider.id,
          serviceName: selectedProvider.fullName,
          providerId: selectedProvider.id,
          providerName: selectedProvider.fullName,
          userName: rev.userName,
          rating: rev.rating,
          comment: rev.comment,
          status: "Approved",
          adminCreated: true,
          createdAt: reviewTimestamp,
        };
        batch.set(newReviewRef, reviewData);
      });

      await batch.commit();

      // 4. Recalculate provider aggregate rating and reviewCount in providerApplications
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

      toast({
        title: "Success!",
        description: `${generated.length} authentic trade reviews added for ${selectedProvider.fullName}.`,
        className: "bg-green-100 text-green-700 border-green-300"
      });
      onGenerationComplete();
      onClose();

    } catch (error) {
      console.error("Error generating reviews:", error);
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
            <Sparkles className="mr-2 h-5 w-5 text-primary" />
            Bulk Review Generator
          </DialogTitle>
          <DialogDescription>
            Select a verified daily labour provider to generate authentic customer reviews matching their trade with unique Indian user names.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-1">
            <FormField
              control={form.control}
              name="providerId"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel className="text-xs font-semibold">
                    Select Daily Labour Provider ({providers.length})
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
                          {selectedProviderName || "Choose a Daily Labour Provider..."}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="w-[calc(100%-6px)] sm:max-w-[450px]">
                      <DialogHeader>
                        <DialogTitle>
                          Choose Daily Labour Provider
                        </DialogTitle>
                        <DialogDescription>
                          Select the worker whose profile and ratings will be updated with category-matched customer reviews.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="relative my-2">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search provider name or trade..."
                          className="pl-9 h-10"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                        />
                      </div>
                      <div className="py-2">
                        <ScrollArea className="h-[280px] rounded-md border p-2">
                          <div className="space-y-1.5">
                            {filteredProviders.length === 0 ? (
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
                                    setSelectedProviderName(provider.fullName);
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
                    Reviews are automatically matched to the provider&apos;s trade (e.g. Carpentry, Electrician, Plumber, Painting) using a unique pool of authentic Indian names with zero duplicates across all providers.
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
