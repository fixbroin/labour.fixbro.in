"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { FirestoreReview, FirestoreService, ReviewStatus } from "@/types/firestore";
import { useEffect, useState } from "react";
import { Loader2, Star, Check, ChevronsUpDown, Search, UserCheck, Briefcase } from "lucide-react";

export interface ReviewTargetProvider {
  id: string;
  fullName: string;
  workCategoryName?: string;
  seniorityLevel?: string;
  profilePhotoUrl?: string;
}

const reviewStatusOptions: [string, ...string[]] = ["Pending", "Approved", "Rejected", "Flagged"];

const reviewFormSchema = z.object({
  serviceId: z.string({ required_error: "Please select a provider or service." }),
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
  services = [],
  onCancel,
  isSubmitting = false
}: ReviewFormProps) {
  const [targetType, setTargetType] = useState<'provider' | 'service'>('provider');
  const [selectedTargetName, setSelectedTargetName] = useState<string>("");
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

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

  const form = useForm<ReviewFormData>({
    resolver: zodResolver(reviewFormSchema),
    defaultValues: {
      serviceId: initialData?.serviceId || undefined,
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
        serviceId: initialData.serviceId,
        userName: initialData.userName,
        rating: initialData.rating,
        comment: initialData.comment,
        status: initialData.status,
      });
      const prov = providers.find(p => p.id === initialData.providerId || p.id === initialData.serviceId);
      if (prov) {
        setTargetType('provider');
        setSelectedTargetName(prov.fullName);
      } else {
        const srv = services.find(s => s.id === initialData.serviceId);
        setSelectedTargetName(srv?.name || initialData.serviceName || "Selected Item");
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
  }, [initialData, form, providers, services]);

  useEffect(() => {
    if (watchedServiceId) {
      const prov = providers.find(p => p.id === watchedServiceId);
      if (prov) {
        setSelectedTargetName(prov.fullName);
        return;
      }
      const service = services.find(s => s.id === watchedServiceId);
      setSelectedTargetName(service?.name || "Selected Item");
    } else {
      setSelectedTargetName("");
    }
  }, [watchedServiceId, providers, services]);

  const handleSubmit = async (formData: ReviewFormData) => {
    const matchedProvider = providers.find(p => p.id === formData.serviceId);
    const matchedService = services.find(s => s.id === formData.serviceId);
    
    const finalServiceName = matchedProvider ? matchedProvider.fullName : (matchedService?.name || selectedTargetName || "Daily Labour");
    const finalProviderId = matchedProvider ? matchedProvider.id : undefined;
    const finalProviderName = matchedProvider ? matchedProvider.fullName : undefined;

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
          
          {/* Target Type Switcher: Provider (Daily Labour) vs Service */}
          <div className="space-y-2">
            <FormLabel className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Review Target</FormLabel>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={targetType === 'provider' ? 'default' : 'outline'}
                className="flex-1 rounded-xl text-xs font-bold"
                onClick={() => {
                  setTargetType('provider');
                  form.setValue('serviceId', '');
                  setSelectedTargetName('');
                }}
                disabled={isSubmitting || !!initialData}
              >
                <UserCheck className="mr-1.5 h-3.5 w-3.5" />
                Daily Labour Provider ({providers.length})
              </Button>
              {services.length > 0 && (
                <Button
                  type="button"
                  size="sm"
                  variant={targetType === 'service' ? 'default' : 'outline'}
                  className="flex-1 rounded-xl text-xs font-bold"
                  onClick={() => {
                    setTargetType('service');
                    form.setValue('serviceId', '');
                    setSelectedTargetName('');
                  }}
                  disabled={isSubmitting || !!initialData}
                >
                  <Briefcase className="mr-1.5 h-3.5 w-3.5" />
                  Service Category ({services.length})
                </Button>
              )}
            </div>
          </div>

          <FormField
            control={form.control}
            name="serviceId"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>{targetType === 'provider' ? 'Select Provider' : 'Select Service'}</FormLabel>
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
                      {selectedTargetName ? selectedTargetName : targetType === 'provider' ? "Choose a daily labour worker..." : "Choose a service..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="w-[calc(100%-6px)] sm:max-w-[440px] rounded-2xl">
                    <DialogHeader>
                      <DialogTitle>{targetType === 'provider' ? 'Select Daily Labour Provider' : 'Select Service'}</DialogTitle>
                      <DialogDescription>
                        {targetType === 'provider' ? 'Search by provider name or category trade.' : 'Search by service name.'}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="relative my-2">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder={targetType === 'provider' ? "Search providers (e.g. Srikanth, Carpenter)..." : "Search services..."}
                        className="pl-9 h-10 rounded-xl"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                    <div className="py-2">
                      <ScrollArea className="h-[260px] rounded-xl border p-2">
                        <div className="space-y-1">
                          {targetType === 'provider' ? (
                            filteredProviders.length === 0 ? (
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
                            )
                          ) : (
                            filteredServices.length === 0 ? (
                              <p className="text-sm text-muted-foreground text-center py-6">No services found.</p>
                            ) : (
                              filteredServices.map((service) => (
                                <Button
                                  key={service.id}
                                  variant={field.value === service.id ? "secondary" : "ghost"}
                                  className="w-full justify-start text-left h-auto py-2.5 px-3 relative rounded-xl"
                                  onClick={() => {
                                    field.onChange(service.id);
                                    setSelectedTargetName(service.name);
                                    setIsPickerOpen(false);
                                  }}
                                  type="button"
                                >
                                  <span className="text-xs font-medium">{service.name}</span>
                                  {field.value === service.id && (
                                    <Check className="absolute right-3 top-3 h-4 w-4 text-emerald-600" />
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
                {initialData && <FormDescription>Target cannot be changed for an existing review.</FormDescription>}
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
                    placeholder="e.g., Arrived punctually at 09:30 AM, brought his own carpentry tools and worked diligently throughout the day. Very neat finish!"
                    className="min-h-[100px] rounded-xl text-xs"
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
                <FormLabel>Review Status</FormLabel>
                <div className="flex gap-2">
                  {reviewStatusOptions.map((status) => (
                    <Button
                      key={status}
                      type="button"
                      size="sm"
                      variant={field.value === status ? (status === 'Approved' ? 'default' : 'secondary') : 'outline'}
                      className={cn(
                        "rounded-xl text-xs font-bold",
                        field.value === status && status === 'Approved' && "bg-emerald-600 text-white hover:bg-emerald-700"
                      )}
                      onClick={() => field.onChange(status)}
                    >
                      {status}
                    </Button>
                  ))}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        <div className="p-4 border-t flex justify-end gap-2 bg-muted/20">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting} className="rounded-xl">
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting} className="rounded-xl font-bold bg-primary text-primary-foreground">
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {initialData ? "Update Review" : "Save Review"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
