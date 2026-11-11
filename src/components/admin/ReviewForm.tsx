"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { FirestoreReview, FirestoreService } from '@/types/firestore';
import { Loader2, Star, Search, Check, ChevronsUpDown, UserCheck } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export interface ReviewTargetProvider {
  id: string;
  fullName: string;
  workCategoryName?: string;
  seniorityLevel?: string;
  profilePhotoUrl?: string;
}

const reviewStatusOptions: [string, ...string[]] = ["Pending", "Approved", "Rejected", "Flagged"];

const reviewFormSchema = z.object({
  serviceId: z.string({ required_error: "Please select a daily labour provider." }),
  userName: z.string().min(2, "Reviewer name must be at least 2 characters.").default("Admin"),
  rating: z.coerce.number().min(1, "Rating must be at least 1.").max(5, "Rating cannot exceed 5."),
  comment: z.string().min(10, "Comment must be at least 10 characters.").max(1000, "Comment too long."),
  status: z.enum(reviewStatusOptions),
});

export type ReviewFormData = z.infer<typeof reviewFormSchema>;

interface ReviewFormProps {
  onSubmit: (data: ReviewFormData & { serviceName: string; providerId?: string; providerName?: string; adminCreated: boolean; id?: string }) => Promise<void>;
  initialData?: FirestoreReview | null;
  providers?: ReviewTargetProvider[];
  services?: Pick<FirestoreService, 'id' | 'name'>[]; 
  onCancel: () => void;
  isSubmitting?: boolean;
}

export default function ReviewForm({
  onSubmit: onSubmitProp,
  initialData,
  providers = [],
  onCancel,
  isSubmitting = false
}: ReviewFormProps) {
  const [selectedTargetName, setSelectedTargetName] = useState<string>("");
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredProviders = providers.filter((p) =>
    p.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.workCategoryName && p.workCategoryName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  useEffect(() => {
    if (!isPickerOpen) {
      setSearchQuery("");
    }
  }, [isPickerOpen]);

  const form = useForm<ReviewFormData>({
    resolver: zodResolver(reviewFormSchema),
    defaultValues: {
      serviceId: initialData?.providerId || initialData?.serviceId || undefined,
      userName: initialData?.userName || "Admin",
      rating: initialData?.rating || 5,
      comment: initialData?.comment || "",
      status: initialData?.status || "Approved",
    },
  });
  
  const watchedServiceId = form.watch("serviceId");

  useEffect(() => {
    if (initialData) {
      form.reset({
        serviceId: initialData.providerId || initialData.serviceId,
        userName: initialData.userName,
        rating: initialData.rating,
        comment: initialData.comment,
        status: initialData.status,
      });
      const prov = providers.find(p => p.id === initialData.providerId || p.id === initialData.serviceId);
      if (prov) {
        setSelectedTargetName(prov.fullName);
      } else {
        setSelectedTargetName(initialData.providerName || initialData.serviceName || "Selected Provider");
      }
    } else {
      form.reset({
        serviceId: undefined,
        userName: "Admin",
        rating: 5,
        comment: "",
        status: "Approved",
      });
      setSelectedTargetName("");
    }
  }, [initialData, form, providers]);

  useEffect(() => {
    if (watchedServiceId) {
      const prov = providers.find(p => p.id === watchedServiceId);
      if (prov) {
        setSelectedTargetName(prov.fullName);
        return;
      }
    } else {
      setSelectedTargetName("");
    }
  }, [watchedServiceId, providers]);

  const handleSubmit = async (formData: ReviewFormData) => {
    const matchedProvider = providers.find(p => p.id === formData.serviceId);
    
    const finalServiceName = matchedProvider ? matchedProvider.fullName : (selectedTargetName || "Daily Labour");
    const finalProviderId = matchedProvider ? matchedProvider.id : formData.serviceId;
    const finalProviderName = matchedProvider ? matchedProvider.fullName : selectedTargetName;

    await onSubmitProp({ 
      ...formData, 
      serviceName: finalServiceName,
      providerId: finalProviderId,
      providerName: finalProviderName,
      adminCreated: true, 
      id: initialData?.id 
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col h-full"> 
        <div className="p-3 space-y-5 flex-grow">
          
          <FormField
            control={form.control}
            name="serviceId"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <UserCheck className="h-4 w-4 text-primary" />
                  Select Daily Labour Provider ({providers.length})
                </FormLabel>
                <Dialog open={isPickerOpen} onOpenChange={setIsPickerOpen}>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className={cn(
                        "w-full justify-between text-left font-normal h-11 rounded-xl",
                        !field.value && "text-muted-foreground"
                      )}
                      disabled={isSubmitting || !!initialData}
                      type="button"
                    >
                      {selectedTargetName ? selectedTargetName : "Choose a daily labour worker..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="w-[calc(100%-6px)] sm:max-w-[440px] rounded-2xl">
                    <DialogHeader>
                      <DialogTitle>Select Daily Labour Provider</DialogTitle>
                      <DialogDescription>
                        Search by provider name or category trade.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="relative my-2">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search providers (e.g. Srikanth, Carpenter)..."
                        className="pl-9 h-10 rounded-xl"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                    <div className="py-2">
                      <ScrollArea className="h-[260px] rounded-xl border p-2">
                        <div className="space-y-1">
                          {filteredProviders.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-6">No providers found.</p>
                          ) : (
                            filteredProviders.map((provider) => (
                              <Button
                                key={provider.id}
                                variant={field.value === provider.id ? "secondary" : "ghost"}
                                className="w-full justify-start text-left h-auto py-2 px-2.5 rounded-xl relative"
                                onClick={() => {
                                  field.onChange(provider.id);
                                  setSelectedTargetName(provider.fullName);
                                  setIsPickerOpen(false);
                                }}
                                type="button"
                              >
                                <div className="flex items-center gap-2.5 w-full pr-6">
                                  <Avatar className="h-8 w-8 border">
                                    <AvatarImage src={provider.profilePhotoUrl} alt={provider.fullName} />
                                    <AvatarFallback className="font-bold text-xs">{provider.fullName[0] || 'P'}</AvatarFallback>
                                  </Avatar>
                                  <div className="flex flex-col min-w-0">
                                    <span className="text-xs font-bold truncate">{provider.fullName}</span>
                                    <span className="text-[11px] text-muted-foreground truncate">
                                      {provider.workCategoryName || 'Daily Labour'} {provider.seniorityLevel && `• ${provider.seniorityLevel}`}
                                    </span>
                                  </div>
                                </div>
                                {field.value === provider.id && (
                                  <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-600" />
                                )}
                              </Button>
                            ))
                          )}
                        </div>
                      </ScrollArea>
                    </div>
                  </DialogContent>
                </Dialog>
                {initialData && <FormDescription>Target provider cannot be changed for an existing review.</FormDescription>}
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="userName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Customer / Reviewer Name</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., Rajesh Kumar or Pooja Sharma" {...field} disabled={isSubmitting} className="rounded-xl" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="rating"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Rating (1-5 stars)</FormLabel>
                <FormControl>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`h-7 w-7 cursor-pointer transition-colors ${
                          star <= field.value ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/30 hover:text-amber-300'
                        }`}
                        onClick={() => field.onChange(star)}
                      />
                    ))}
                    <span className="ml-2 font-bold text-sm text-foreground">{field.value} / 5</span>
                    <Input type="hidden" {...field} />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="comment"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Review Comment</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Enter customer feedback about work quality, trade skill, punctuality, and conduct..."
                    className="min-h-[100px] resize-y rounded-xl"
                    {...field}
                    disabled={isSubmitting}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isSubmitting}>
                  <FormControl>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="Select a status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="rounded-xl">
                    {reviewStatusOptions.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

        </div>
        <div className="p-3 border-t bg-background flex justify-end gap-2 sticky bottom-0 z-10">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting} className="rounded-xl">
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting} className="rounded-xl">
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {initialData ? 'Save Changes' : 'Add Review'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
