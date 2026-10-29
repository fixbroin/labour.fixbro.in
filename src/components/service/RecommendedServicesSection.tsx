"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import AppImage from '@/components/ui/AppImage';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Star, ShoppingCart, Clock, Users, ChevronLeft, ChevronRight, Sparkles, Percent, Ban } from 'lucide-react';
import type { FirestoreService } from '@/types/firestore';
import QuantitySelector from '@/components/shared/QuantitySelector';
import { getCartEntries, saveCartEntries, syncCartToFirestore } from '@/lib/cartManager';
import { useToast } from '@/hooks/use-toast';
import { logUserActivity } from '@/lib/activityLogger';
import { useAuth } from '@/hooks/useAuth';
import { getGuestId } from '@/lib/guestIdManager';
import { useLoading } from '@/contexts/LoadingContext';
import { useApplicationConfig } from '@/hooks/useApplicationConfig';
import { formatCurrency } from '@/lib/utils';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, limit } from '@/lib/mysqlDb';
import { Skeleton } from '@/components/ui/skeleton';
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext, type CarouselApi } from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";

interface RecommendedServiceCardProps {
  service: FirestoreService;
  symbol: string;
  decimals: number;
  code: string;
}

const RecommendedServiceCard: React.FC<RecommendedServiceCardProps> = ({
  service,
  symbol,
  decimals,
  code
}) => {
  const [quantity, setQuantity] = useState(0);
  const { toast } = useToast();
  const { user, triggerAuthRedirect } = useAuth();
  const currentPathname = usePathname();
  const { showLoading } = useLoading();

  useEffect(() => {
    const syncQuantity = () => {
      const cartEntries = getCartEntries();
      const existingEntry = cartEntries.find(entry => entry.serviceId === service.id);
      setQuantity(existingEntry ? existingEntry.quantity : 0);
    };

    syncQuantity();

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'fixbroUserCart' || e.key === null) syncQuantity();
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [service.id]);

  const updateCartAndShowToast = (newQuantity: number, action: 'added' | 'updated' | 'removed') => {
    if (!service) return;
    const cartEntries = getCartEntries();
    const existingEntryIndex = cartEntries.findIndex(entry => entry.serviceId === service.id);
    const oldQuantity = existingEntryIndex > -1 ? cartEntries[existingEntryIndex].quantity : 0;
    const quantityChange = Math.abs(newQuantity - oldQuantity);

    if (newQuantity > 0) {
      if (existingEntryIndex > -1) {
        cartEntries[existingEntryIndex].quantity = newQuantity;
      } else {
        cartEntries.push({ serviceId: service.id, quantity: newQuantity });
      }
    } else {
      if (existingEntryIndex > -1) {
        cartEntries.splice(existingEntryIndex, 1);
      }
    }

    saveCartEntries(cartEntries);
    if (user?.uid) {
      syncCartToFirestore(user.uid, cartEntries);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new StorageEvent('storage', { key: 'fixbroUserCart' }));
    }

    if (action === 'added' || (action === 'updated' && newQuantity > oldQuantity)) {
      toast({ title: "Cart Updated", description: `${service.name} (x${newQuantity}) added to cart.` });
      logUserActivity(
        'addToCart',
        { serviceId: service.id, serviceName: service.name, quantity: quantityChange, price: service.price },
        user?.uid,
        !user ? getGuestId() : null
      );
    } else if (action === 'removed' || (action === 'updated' && newQuantity < oldQuantity)) {
      if (newQuantity === 0) {
        toast({ title: "Item Removed", description: `${service.name} removed from cart.` });
      }
      logUserActivity(
        'removeFromCart',
        { serviceId: service.id, serviceName: service.name, quantity: quantityChange },
        user?.uid,
        !user ? getGuestId() : null
      );
    }
  };

  const handleInitialAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      triggerAuthRedirect(currentPathname);
      return;
    }
    const newQuantity = service.hasMinQuantity && service.minQuantity ? service.minQuantity : 1;
    setQuantity(newQuantity);
    updateCartAndShowToast(newQuantity, 'added');
  };

  const handleQuantityChange = (newQuantity: number) => {
    const oldQuantity = quantity;
    if (newQuantity > 0 && oldQuantity === 0 && !user) {
      triggerAuthRedirect(currentPathname);
      return;
    }
    setQuantity(newQuantity);

    if (newQuantity === 0 && oldQuantity > 0) {
      updateCartAndShowToast(newQuantity, 'removed');
    } else if (newQuantity > 0 && oldQuantity === 0) {
      updateCartAndShowToast(newQuantity, 'added');
    } else if (newQuantity > 0) {
      updateCartAndShowToast(newQuantity, 'updated');
    }
  };

  const taskTimeDisplay = service.taskTimeValue && service.taskTimeUnit ? `${service.taskTimeValue}${service.taskTimeUnit.charAt(0)}` : null;
  const displayImageUrl = service.imageUrl && service.imageUrl.trim() !== '' ? service.imageUrl : "/default-image.png";

  const isAvailable = service.maxQuantity === undefined || service.maxQuantity === null || service.maxQuantity > 0;
  const effectivePrice = service.discountedPrice ?? service.price;
  const hasDiscount = service.discountedPrice && service.discountedPrice < service.price;
  const savingAmount = hasDiscount ? service.price - service.discountedPrice! : 0;

  return (
    <div className="w-full h-full flex flex-col group">
      <Link
        href={`/service/${service.slug}`}
        onClick={(e: React.MouseEvent) => {
          if (currentPathname === `/service/${service.slug}`) {
            e.preventDefault();
          } else {
            showLoading();
          }
        }}
        className="flex flex-col h-full bg-card rounded-2xl border border-border/80 shadow-sm hover:shadow-md hover:border-primary/40 transition-all duration-300 overflow-hidden cursor-pointer"
      >
        {/* Thumbnail Image Container */}
        <div className="relative w-full aspect-[4/3] bg-muted overflow-hidden">
          <AppImage
            src={displayImageUrl}
            alt={service.name}
            fill
            sizes="(max-width: 640px) 210px, (max-width: 768px) 230px, 250px"
            className="object-cover group-hover:scale-105 transition-transform duration-500"
          />
          {hasDiscount && (
            <Badge className="absolute top-2 left-2 bg-emerald-600 hover:bg-emerald-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm flex items-center gap-0.5">
              <Percent className="w-2.5 h-2.5" /> Save {formatCurrency(savingAmount, symbol, decimals, code)}
            </Badge>
          )}
          {service.rating > 0 && (
            <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm text-white text-[11px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 shadow-sm">
              <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
              <span>{service.rating.toFixed(1)}</span>
            </div>
          )}
        </div>

        {/* Card Body */}
        <div className="p-3 sm:p-4 flex flex-col flex-grow justify-between gap-2.5">
          <div>
            <h4 className="font-bold text-sm sm:text-base leading-snug text-foreground group-hover:text-primary transition-colors line-clamp-2 min-h-[2.5rem]">
              {service.name}
            </h4>

            {/* Micro Details (Time & Members) */}
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground mt-1.5">
              {service.membersRequired && service.membersRequired > 1 && (
                <div className="flex items-center gap-1">
                  <Users className="h-3 w-3 text-primary" />
                  <span>{service.membersRequired} pros</span>
                </div>
              )}
              {taskTimeDisplay && (
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3 text-primary" />
                  <span>{taskTimeDisplay}</span>
                </div>
              )}
              {service.reviewCount !== undefined && service.reviewCount > 0 && (
                <span className="text-[11px] text-muted-foreground">({service.reviewCount} reviews)</span>
              )}
            </div>
          </div>

          {/* Pricing & Add to Cart Footer */}
          <div className="pt-2 border-t border-border/50 flex items-center justify-between gap-2">
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-base sm:text-lg font-extrabold text-foreground">
                  {formatCurrency(effectivePrice, symbol, decimals, code)}
                </span>
                {hasDiscount && (
                  <span className="text-xs text-muted-foreground line-through">
                    {formatCurrency(service.price, symbol, decimals, code)}
                  </span>
                )}
              </div>
            </div>

            {/* Action Button */}
            <div onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
              {!isAvailable ? (
                <Button size="sm" variant="ghost" className="h-8 px-2 text-xs text-muted-foreground" disabled>
                  <Ban className="h-3.5 w-3.5 mr-1" /> Full
                </Button>
              ) : quantity === 0 ? (
                <Button
                  size="sm"
                  className="h-8 px-3 text-xs font-bold rounded-lg shadow-sm"
                  onClick={handleInitialAddToCart}
                >
                  <ShoppingCart className="h-3.5 w-3.5 mr-1" /> Add
                </Button>
              ) : (
                <QuantitySelector
                  initialQuantity={quantity}
                  onQuantityChange={handleQuantityChange}
                  minQuantity={0}
                  enforcedMinQuantity={service.hasMinQuantity ? service.minQuantity : 0}
                  maxQuantity={service.maxQuantity}
                />
              )}
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
};

export interface RecommendedServicesSectionProps {
  currentServiceId: string;
  subCategoryId?: string;
  parentCategoryId?: string;
  parentCategoryName?: string;
  parentCategorySlug?: string;
  initialServices?: FirestoreService[];
  title?: string;
  subtitle?: string;
}

export default function RecommendedServicesSection({
  currentServiceId,
  subCategoryId,
  parentCategoryId,
  parentCategoryName,
  parentCategorySlug,
  initialServices,
  title,
  subtitle
}: RecommendedServicesSectionProps) {
  const { config: appConfig } = useApplicationConfig();
  const symbol = appConfig?.currencySymbol || '₹';
  const decimals = appConfig?.currencyDecimalPoints !== undefined ? appConfig.currencyDecimalPoints : 2;
  const code = appConfig?.currencyCode || 'INR';

  const [services, setServices] = useState<FirestoreService[]>(() => {
    if (initialServices && initialServices.length > 0) {
      return initialServices.filter(s => s.id !== currentServiceId);
    }
    return [];
  });
  const [isLoading, setIsLoading] = useState(!initialServices || initialServices.length === 0);
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const autoplayPlugin = useRef(
    Autoplay({
      delay: 3000,
      stopOnInteraction: false,
      stopOnMouseEnter: false,
      stopOnLastSnap: false,
    })
  );

  // Client-side fallback fetch if initialServices wasn't passed via SSR
  useEffect(() => {
    if (initialServices && initialServices.length > 0) {
      setServices(initialServices.filter(s => s.id !== currentServiceId));
      setIsLoading(false);
      return;
    }

    if (!subCategoryId && !parentCategoryId) {
      setIsLoading(false);
      return;
    }

    const fetchRecommended = async () => {
      setIsLoading(true);
      try {
        let results: FirestoreService[] = [];

        // 1. Fetch other services from the same subcategory
        if (subCategoryId) {
          const qSub = query(
            collection(db, "adminServices"),
            where("subCategoryId", "==", subCategoryId),
            where("isActive", "==", true),
            limit(12)
          );
          const snapSub = await getDocs(qSub);
          snapSub.docs.forEach(docSnap => {
            if (docSnap.id !== currentServiceId) {
              results.push({ id: docSnap.id, ...docSnap.data() } as FirestoreService);
            }
          });
        }

        // 2. If fewer than 6, also fetch from other subcategories in the same parent category
        if (results.length < 6 && parentCategoryId) {
          const qOtherSubCats = query(
            collection(db, "adminSubCategories"),
            where("parentId", "==", parentCategoryId),
            where("isActive", "==", true),
            limit(8)
          );
          const snapOtherSubCats = await getDocs(qOtherSubCats);
          const otherSubCatIds = snapOtherSubCats.docs
            .map(d => d.id)
            .filter(id => id !== subCategoryId);

          if (otherSubCatIds.length > 0) {
            const qCatServices = query(
              collection(db, "adminServices"),
              where("subCategoryId", "in", otherSubCatIds.slice(0, 10)),
              where("isActive", "==", true),
              limit(12)
            );
            const snapCatServices = await getDocs(qCatServices);
            snapCatServices.docs.forEach(docSnap => {
              if (docSnap.id !== currentServiceId && !results.some(r => r.id === docSnap.id)) {
                results.push({ id: docSnap.id, ...docSnap.data() } as FirestoreService);
              }
            });
          }
        }

        setServices(results.sort((a, b) => (a.order || 0) - (b.order || 0) || (b.rating || 0) - (a.rating || 0)).slice(0, 12));
      } catch (err) {
        console.error("Error fetching recommended services client-side:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecommended();
  }, [currentServiceId, subCategoryId, parentCategoryId, initialServices]);

  const scrollLeft = useCallback(() => {
    carouselApi?.scrollPrev();
  }, [carouselApi]);

  const scrollRight = useCallback(() => {
    carouselApi?.scrollNext();
  }, [carouselApi]);

  if (!isLoading && services.length === 0) {
    return null;
  }

  const heading = title || (parentCategoryName ? `More in ${parentCategoryName}` : `Recommended Services`);
  const subHeading = subtitle || `Popular related services you can easily add to your booking`;

  return (
    <section className="mt-8 sm:mt-12">
      <Card className="shadow-lg border border-border/80 bg-card overflow-hidden rounded-2xl">
        {/* Header with Title and Scroll Controls */}
        <CardHeader className="p-4 sm:p-5 bg-primary/5 border-b border-border/50 flex flex-row items-center justify-between">
          <div className="flex-1 pr-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 text-primary shrink-0" />
              <CardTitle className="text-xl sm:text-2xl font-headline font-bold text-foreground">
                {heading}
              </CardTitle>
            </div>
            <CardDescription className="text-xs sm:text-sm text-muted-foreground mt-1">
              {subHeading}
            </CardDescription>
          </div>

          {/* Navigation Controls (Desktop Buttons & View All Link) */}
          <div className="flex items-center gap-2 shrink-0">
            {parentCategorySlug && (
              <Link
                href={`/category/${parentCategorySlug}`}
                className="text-xs sm:text-sm font-bold text-primary hover:underline flex items-center mr-1"
              >
                <span>View All</span>
                <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
              </Link>
            )}
            <div className="hidden sm:flex items-center gap-1.5">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-full border-border/80 shadow-sm hover:bg-muted"
                onClick={scrollLeft}
                aria-label="Scroll left"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-full border-border/80 shadow-sm hover:bg-muted"
                onClick={scrollRight}
                aria-label="Scroll right"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        {/* Horizontal Scrollable Carousel Container */}
        <CardContent className="p-4 sm:p-5">
          {isLoading ? (
            <div className="flex gap-4 overflow-x-auto pb-3 pt-1 scrollbar-none">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="w-[210px] sm:w-[230px] md:w-[250px] shrink-0 border rounded-2xl p-3 space-y-3 animate-pulse bg-muted/20">
                  <Skeleton className="h-32 w-full rounded-xl" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                  <div className="flex justify-between items-center pt-2">
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-8 w-16 rounded-lg" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Carousel
              setApi={setCarouselApi}
              opts={{
                align: "start",
                loop: true,
              }}
              plugins={[autoplayPlugin.current]}
              className="w-full relative px-1 sm:px-2"
            >
              <CarouselContent className="-ml-3 sm:-ml-4">
                {services.map((service) => (
                  <CarouselItem
                    key={service.id}
                    className="pl-3 sm:pl-4 basis-[72%] sm:basis-1/2 md:basis-1/3 lg:basis-1/4 xl:basis-1/5"
                  >
                    <div className="h-full">
                      <RecommendedServiceCard
                        service={service}
                        symbol={symbol}
                        decimals={decimals}
                        code={code}
                      />
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious className="hidden sm:flex -left-3 shadow-md" />
              <CarouselNext className="hidden sm:flex -right-3 shadow-md" />
            </Carousel>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
