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
import { Loader2, Sparkles, Search, Check, ChevronsUpDown, UserCheck, Bot, Zap } from 'lucide-react';
import type { FirestoreReview } from '@/types/firestore';
import type { ReviewTargetProvider } from '@/components/admin/ReviewForm';
import { useToast } from '@/hooks/use-toast';
import { generateCuratedReviews } from '@/lib/reviewTemplates';
import { generateBulkReviews } from '@/ai/flows/generateBulkReviewsFlow';
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
  const [generationMode, setGenerationMode] = useState<'manual' | 'ai'>('manual');
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
      title: generationMode === 'ai' ? "AI Generating Reviews..." : "Generating Reviews...", 
      description: generationMode === 'ai' 
        ? "Gemini AI is crafting realistic customer reviews for this provider..." 
        : "Selecting authentic trade-matched customer reviews from curated pool..." 
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

      let reviewsToInsert: { userName: string; rating: number; comment: string; daysAgo: number }[] = [];

      if (generationMode === 'ai') {
        // AI GENERATION VIA GEMINI
        const aiResult = await generateBulkReviews({
          serviceId: selectedProvider.id,
          serviceName: selectedProvider.fullName,
          providerId: selectedProvider.id,
          providerName: selectedProvider.fullName,
          seniorityLevel: selectedProvider.seniorityLevel,
          categoryName: selectedProvider.workCategoryName || 'Daily Labour',
          subCategoryName: selectedProvider.workCategoryName || 'Daily Labour',
          numberOfReviews: data.numberOfReviews,
        });

        if (!aiResult.reviews || aiResult.reviews.length === 0) {
          throw new Error("AI did not return any reviews.");
        }

        reviewsToInsert = aiResult.reviews.map((rev, idx) => ({
          userName: rev.userName,
          rating: rev.rating,
          comment: rev.comment,
          daysAgo: Math.floor(Math.random() * 40) + 2 + idx,
        }));
      } else {
        // MANUAL CURATED TEMPLATES POOL
        reviewsToInsert = generateCuratedReviews(
          selectedProvider.workCategoryName || 'general',
          data.numberOfReviews,
          usedNames,
          usedComments
        );
      }

      if (!reviewsToInsert || reviewsToInsert.length === 0) {
        throw new Error("Could not produce reviews.");
      }

      // 2. Batch write reviews to adminReviews
      const batch = writeBatch(db);
      const reviewsCollectionRef = collection(db, "adminReviews");

      reviewsToInsert.forEach((rev) => {
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

      // 3. Recalculate provider aggregate rating and reviewCount in providerApplications
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
        description: `${reviewsToInsert.length} authentic reviews generated (${generationMode === 'ai' ? 'AI' : 'Curated Template'}) for ${selectedProvider.fullName}.`,
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
            Generate verified customer reviews for Daily Labour providers using curated templates or Gemini AI.
          </DialogDescription>
        </DialogHeader>

        {/* Generation Mode Switcher */}
        <div className="space-y-1.5 pt-1">
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Generation Mode
          </label>
          <div className="grid grid-cols-2 gap-2 p-1 bg-muted/60 rounded-xl">
            <Button
              type="button"
              size="sm"
              variant={generationMode === 'manual' ? 'default' : 'ghost'}
              className="rounded-lg text-xs font-semibold gap-1.5 h-9"
              onClick={() => setGenerationMode('manual')}
              disabled={isGenerating}
            >
              <Zap className="h-3.5 w-3.5 text-amber-500" />
              Curated Pool (Fast)
            </Button>
            <Button
              type="button"
              size="sm"
              variant={generationMode === 'ai' ? 'default' : 'ghost'}
              className="rounded-lg text-xs font-semibold gap-1.5 h-9"
              onClick={() => setGenerationMode('ai')}
              disabled={isGenerating}
            >
              <Bot className="h-3.5 w-3.5 text-primary" />
              AI Generate (Gemini)
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground px-1">
            {generationMode === 'manual'
              ? "⚡ Instant selection from 100+ authentic Indian names & category reviews with zero duplicate guarantee."
              : "🤖 Dynamically writes unique, realistic trade reviews powered by Gemini AI matching provider details."}
          </p>
        </div>

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
                          Select the worker whose profile and ratings will be updated with customer reviews.
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
                    Reviews are strictly matched to the provider&apos;s trade (e.g. Carpentry, Electrician, Plumber, Painting) with unique Indian reviewer names and natural past dates.
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
                {isGenerating ? "Generating..." : `Generate ${form.watch('numberOfReviews') || 5} Reviews`}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
