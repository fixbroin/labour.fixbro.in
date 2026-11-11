

"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import AppImage from '@/components/ui/AppImage';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import QuantitySelector from '@/components/shared/QuantitySelector';
import { Trash2, ShoppingCart, ArrowRight, Home, Loader2, Percent, Info, CalendarDays } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { FirestoreService, UserCart, PriceVariant } from '@/types/firestore';
import { getCartEntries, saveCartEntries, syncCartToFirestore, saveActiveCheckoutEntries, type CartEntry } from '@/lib/cartManager';
import { db } from '@/lib/firebase'; 
import { doc, getDoc, onSnapshot } from '@/lib/mysqlDb';
import { useToast } from '@/hooks/use-toast';
import { useLoading } from '@/contexts/LoadingContext';
import { useRouter, usePathname } from 'next/navigation';
import { useApplicationConfig } from '@/hooks/useApplicationConfig';
import TaxBreakdownDisplay from '@/components/shared/TaxBreakdownDisplay';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import Breadcrumbs from '@/components/shared/Breadcrumbs';
import type { BreadcrumbItem } from '@/types/ui';
import { logUserActivity } from '@/lib/activityLogger';
import { formatCurrency } from '@/lib/utils'; 
import { useAuth as useAuthHook } from '@/hooks/useAuth'; 
import { getGuestId } from '@/lib/guestIdManager'; 
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { Badge } from '@/components/ui/badge';
import { useProviderDefaultSettings } from '@/hooks/useProviderDefaultSettings';
import CartBookingRulesModal from '@/components/cart/CartBookingRulesModal';
export interface CartItem extends FirestoreService {
  quantity: number;
  categoryId?: string;
  categoryName?: string;
  visitingChargeAmount?: number;
  minimumBookingAmount?: number;
  minimumBookingPolicyDescription?: string;
}

// Helper to derive base price
const getBasePrice = (displayedPrice: number, isTaxInclusive?: boolean, taxPercent?: number): number => {
  if (isTaxInclusive && taxPercent && taxPercent > 0) {
    return displayedPrice / (1 + taxPercent / 100);
  }
  return displayedPrice;
};

// --- START: CORRECTED TIERED PRICING LOGIC ---
const getPriceForNthUnit = (service: CartItem, n: number): number => {
  if (!service.hasPriceVariants || !service.priceVariants || service.priceVariants.length === 0 || n <= 0) {
    return service.discountedPrice ?? service.price;
  }

  const sortedVariants = [...service.priceVariants].sort((a, b) => a.fromQuantity - b.fromQuantity);

  const applicableTier = sortedVariants.find(tier => {
    const start = tier.fromQuantity;
    const end = tier.toQuantity ?? Infinity;
    return n >= start && n <= end;
  });

  if (applicableTier) {
    return applicableTier.price;
  }
  
  const lastApplicableTier = sortedVariants.slice().reverse().find(tier => n >= tier.fromQuantity);
  if (lastApplicableTier) {
    return lastApplicableTier.price;
  }
  
  return service.discountedPrice ?? service.price;
};

const calculateIncrementalTotalPrice = (item: CartItem): number => {
    if (!item.hasPriceVariants || !item.priceVariants || item.priceVariants.length === 0) {
        const unitPrice = item.discountedPrice ?? item.price;
        return unitPrice * item.quantity;
    }
    
    let total = 0;
    for (let i = 1; i <= item.quantity; i++) {
        total += getPriceForNthUnit(item, i);
    }
    return total;
};

const getPriceDisplayInfo = (service: CartItem, quantity: number, symbol: string = '₹', decimals: number = 2, code: string = 'INR') => {
    if (!service.hasPriceVariants || !service.priceVariants || service.priceVariants.length === 0) {
        const unitSaving = service.discountedPrice && service.discountedPrice < service.price ? service.price - service.discountedPrice : 0;
        const totalSaving = unitSaving * (quantity > 0 ? quantity : 1);
        return {
            mainPrice: formatCurrency(service.discountedPrice ?? service.price, symbol, decimals, code),
            priceSuffix: unitSaving > 0 ? formatCurrency(service.price, symbol, decimals, code) : null,
            promoText: unitSaving > 0 ? `Save ${formatCurrency(totalSaving, symbol, 0, code)}!` : null,
        };
    }

    const sortedVariants = [...service.priceVariants].sort((a, b) => a.fromQuantity - b.fromQuantity);
    const nextQuantity = quantity + 1;
    let promoText = null;

    const currentPriceForNext = getPriceForNthUnit(service, nextQuantity);
    const nextCheaperTier = sortedVariants.find(v => v.fromQuantity >= nextQuantity && v.price < currentPriceForNext);
    
    if (nextCheaperTier) {
        const needed = nextCheaperTier.fromQuantity - quantity;
        promoText = `Add ${needed} more to unlock ${formatCurrency(nextCheaperTier.price, symbol, decimals, code)} price!`;
    } else {
        const finalTier = sortedVariants[sortedVariants.length - 1];
        if (quantity >= finalTier.fromQuantity) {
            promoText = `Price continues at ${formatCurrency(finalTier.price, symbol, decimals, code)} each.`;
        }
    }
    
    const displayPrice = getPriceForNthUnit(service, nextQuantity);
    
    return {
        mainPrice: formatCurrency(displayPrice, symbol, decimals, code),
        priceSuffix: quantity > 0 ? 'per next unit' : 'onwards',
        promoText,
    };
};
// --- END: CORRECTED TIERED PRICING LOGIC ---

const renderProvidersDaysSummary = (items: CartItem[]) => {
  if (!items || items.length === 0) return <span>0 providers</span>;
  const providerCount = items.length;
  const providerLabel = `${providerCount} ${providerCount === 1 ? 'provider' : 'providers'}`;

  // Group by duration (days)
  const qtyMap = new Map<number, number>();
  for (const item of items) {
    const q = item.quantity || 1;
    qtyMap.set(q, (qtyMap.get(q) || 0) + 1);
  }

  // All providers have the exact same duration
  if (qtyMap.size === 1) {
    const [days] = qtyMap.keys();
    return (
      <span className="whitespace-nowrap font-medium text-muted-foreground text-xs sm:text-sm">
        {providerLabel} · {days} {days === 1 ? 'day' : 'days'}
      </span>
    );
  }

  // Mixed durations: e.g. 1 person 2 days, 1 person 1 day
  const parts: string[] = [];
  const sortedDays = Array.from(qtyMap.keys()).sort((a, b) => b - a);
  for (const days of sortedDays) {
    const count = qtyMap.get(days)!;
    parts.push(`${count} ${count === 1 ? 'person' : 'people'} ${days} ${days === 1 ? 'day' : 'days'}`);
  }

  return (
    <div className="flex flex-col leading-tight">
      <span className="font-semibold text-foreground text-xs sm:text-sm">
        {providerLabel}
      </span>
      <span className="text-[11px] sm:text-xs text-muted-foreground font-normal break-words">
        ({parts.join(', ')})
      </span>
    </div>
  );
};

const formatProvidersDaysSummary = (items: CartItem[]): string => {
  if (!items || items.length === 0) return '0 providers';
  const providerCount = items.length;
  const providerLabel = `${providerCount} ${providerCount === 1 ? 'provider' : 'providers'}`;

  const qtyMap = new Map<number, number>();
  for (const item of items) {
    const q = item.quantity || 1;
    qtyMap.set(q, (qtyMap.get(q) || 0) + 1);
  }

  if (qtyMap.size === 1) {
    const [days] = qtyMap.keys();
    return `${providerLabel} · ${days} ${days === 1 ? 'day' : 'days'}`;
  }

  const parts: string[] = [];
  const sortedDays = Array.from(qtyMap.keys()).sort((a, b) => b - a);
  for (const days of sortedDays) {
    const count = qtyMap.get(days)!;
    parts.push(`${count} ${count === 1 ? 'person' : 'people'} ${days} ${days === 1 ? 'day' : 'days'}`);
  }

  return `${providerLabel} (${parts.join(', ')})`;
};

function CartPageContent() {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isLoadingCart, setIsLoadingCart] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const [isCheckingOutCategory, setIsCheckingOutCategory] = useState<string | null>(null);
  const [openTaxBreakdownCategoryId, setOpenTaxBreakdownCategoryId] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuthHook(); 
  const currentPathname = usePathname();

  const { config: appConfig, isLoading: isLoadingAppSettings } = useApplicationConfig();
  const { settings: providerSettings } = useProviderDefaultSettings();
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);

  const { showLoading } = useLoading();
  const router = useRouter();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const loadCartItems = useCallback(async (isInitialLoad = false) => {
    if (isInitialLoad) setIsLoadingCart(true);
    const entries = getCartEntries();
    if (entries.length === 0) {
      setCartItems([]);
      setIsLoadingCart(false);
      if (user?.uid) await syncCartToFirestore(user.uid, []);
      return;
    }

    // Optimization: Cache category lookups to avoid redundant reads
    const subCatCache: Record<string, any> = {};
    const catCache: Record<string, any> = {};

    const markupFee = typeof providerSettings?.adminMarkupFee === 'number' ? providerSettings.adminMarkupFee : 200;

    try {
      const loadedCartItemsPromises = entries.map(async (entry) => {
        const serviceDocRef = doc(db, "adminServices", entry.serviceId);
        const serviceSnap = await getDoc(serviceDocRef);
        if (serviceSnap.exists()) {
          const serviceData = serviceSnap.data() as FirestoreService;
          let price = typeof serviceData.price === 'number' ? serviceData.price : 0;
          let discountedPrice = typeof serviceData.discountedPrice === 'number' ? serviceData.discountedPrice : undefined;
          if (serviceData.isProvider) {
            price += markupFee;
            if (discountedPrice !== undefined) discountedPrice += markupFee;
          }
          
          let categoryId = serviceData.parentCategoryId || 'unknown';
          let categoryName = 'Daily Labour';

          // 1. Resolve Category ID (from sub-category)
          if (!serviceData.parentCategoryId && serviceData.subCategoryId) {
              if (subCatCache[serviceData.subCategoryId]) {
                  categoryId = subCatCache[serviceData.subCategoryId].parentId;
              } else {
                  const subCatRef = doc(db, 'adminSubCategories', serviceData.subCategoryId);
                  const subCatSnap = await getDoc(subCatRef);
                  if (subCatSnap.exists()) {
                      const sd = subCatSnap.data();
                      subCatCache[serviceData.subCategoryId] = sd;
                      categoryId = sd.parentId;
                  }
              }
          }

          // 2. Resolve Category Name
          if (categoryId !== 'unknown') {
              if (catCache[categoryId]) {
                  categoryName = catCache[categoryId].name;
              } else {
                  const catRef = doc(db, 'adminCategories', categoryId);
                  const catSnap = await getDoc(catRef);
                  if (catSnap.exists()) {
                      const cd = catSnap.data();
                      catCache[categoryId] = cd;
                      categoryName = cd.name;
                  }
              }
          }

          let seniority = (serviceData as any).seniorityLevel || (serviceData as any).skillLevelLabel;
          if (!seniority) {
            try {
              const pRef = doc(db, "providerApplications", entry.serviceId);
              const pSnap = await getDoc(pRef);
              if (pSnap.exists()) {
                const pd = pSnap.data() as any;
                seniority = pd.seniorityLevel || pd.skillLevelLabel;
              }
            } catch (e) {}
          }

          return {
            ...serviceData,
            id: serviceSnap.id,
            quantity: entry.quantity,
            categoryId,
            categoryName,
            price,
            isTaxInclusive: serviceData.isTaxInclusive === true,
            discountedPrice,
            taxPercent: serviceData.taxPercent,
            hasPriceVariants: serviceData.hasPriceVariants === true,
            priceVariants: serviceData.priceVariants || [],
            hasMinQuantity: serviceData.hasMinQuantity === true,
            minQuantity: serviceData.minQuantity ?? 0,
            seniorityLevel: seniority || (serviceData.isProvider ? 'Senior' : undefined),
            visitingChargeAmount: categoryId !== 'unknown' ? catCache[categoryId]?.visitingChargeAmount : undefined,
            minimumBookingAmount: categoryId !== 'unknown' ? catCache[categoryId]?.minimumBookingAmount : undefined,
            minimumBookingPolicyDescription: categoryId !== 'unknown' ? catCache[categoryId]?.minimumBookingPolicyDescription : undefined,
          } as CartItem;
        }
        // Fallback: Check if item is a Daily Labour Provider
        const provDocRef = doc(db, "providerApplications", entry.serviceId);
        const provSnap = await getDoc(provDocRef);
        if (provSnap.exists()) {
          const pData = provSnap.data() as any;
          const baseDailyRate = typeof pData.dailyRate === 'number' ? pData.dailyRate : 1200;
          const dailyRate = baseDailyRate + markupFee;
          const categoryId = pData.workCategoryId || 'daily-labour';
          const categoryName = pData.workCategoryName || 'Daily Labour';
          return {
            id: provSnap.id,
            name: pData.fullName || 'Daily Labour Provider',
            description: pData.bio || 'Daily Labour Provider',
            price: dailyRate,
            discountedPrice: dailyRate,
            imageUrl: pData.profilePhotoUrl || '/default-image.png',
            quantity: entry.quantity,
            categoryId,
            categoryName,
            subCategoryId: `providers-${categoryId}`,
            rating: Number(pData.overallRating) || 0,
            isActive: true,
            isTaxInclusive: true,
            hasPriceVariants: false,
            priceVariants: [],
            hasMinQuantity: false,
            minQuantity: 1,
            isProvider: true,
            seniorityLevel: pData.seniorityLevel || pData.skillLevelLabel || 'Senior',
            slug: pData.slug || provSnap.id,
          } as CartItem;
        }

        console.warn(`Service with ID ${entry.serviceId} not found. Removing from cart.`);
        return null;
      });

      const resolvedItems = await Promise.all(loadedCartItemsPromises);
      const validItems = resolvedItems.filter((item): item is CartItem => item !== null);

      setCartItems(validItems);

      if (validItems.length !== entries.length) {
        const validEntries = validItems.map(item => ({ serviceId: item.id, quantity: item.quantity }));
        saveCartEntries(validEntries);
        if (user?.uid) await syncCartToFirestore(user.uid, validEntries);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new StorageEvent('storage', { key: 'fixbroUserCart' }));
        }
      }

    } catch (error) {
      console.error("Error loading cart items from Firestore:", error);
      toast({
        title: "Error",
        description: "Could not load cart details. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingCart(false);
    }
  }, [toast, user?.uid]);

  useEffect(() => {
    if (!isMounted) return;
    
    loadCartItems(true);
    
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'fixbroUserCart') {
        loadCartItems();
      }
    };
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
        window.removeEventListener('storage', handleStorageChange);
    };

  }, [isMounted, toast, user, loadCartItems]);

  const updateStoredCart = (updatedCartItems: CartItem[]) => {
    const entriesToSave: CartEntry[] = updatedCartItems.map(item => ({
      serviceId: item.id,
      quantity: item.quantity,
    }));
    saveCartEntries(entriesToSave);
    if (user?.uid) {
        syncCartToFirestore(user.uid, entriesToSave);
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new StorageEvent('storage', { key: 'fixbroUserCart' }));
    }
  };

  const handleQuantityChange = (itemId: string, newQuantity: number) => {
    const itemBeingChanged = cartItems.find(item => item.id === itemId);
    if (!itemBeingChanged) return;

    const oldQuantity = itemBeingChanged.quantity;

    const updatedItems = cartItems.map(item =>
        item.id === itemId ? { ...item, quantity: newQuantity } : item
      ).filter(item => item.quantity > 0);

    setCartItems(updatedItems);
    updateStoredCart(updatedItems);
    
    const quantityChange = Math.abs(newQuantity - oldQuantity);

    if (newQuantity === 0) {
      toast({ title: "Item Removed", description: `${itemBeingChanged.name} removed from cart.` });
      logUserActivity(
        'removeFromCart',
        { serviceId: itemBeingChanged.id, serviceName: itemBeingChanged.name, quantity: quantityChange },
        user?.uid,
        !user ? getGuestId() : null,
        user?.displayName
      );
    } else if (newQuantity > oldQuantity) {
      toast({ title: "Cart Updated", description: `${itemBeingChanged.name} quantity updated to ${newQuantity}.` });
       logUserActivity(
        'addToCart',
        { serviceId: itemBeingChanged.id, serviceName: itemBeingChanged.name, quantity: quantityChange, price: itemBeingChanged.price },
        user?.uid,
        !user ? getGuestId() : null,
        user?.displayName
      );
    } else {
       logUserActivity(
        'removeFromCart',
        { serviceId: itemBeingChanged.id, serviceName: itemBeingChanged.name, quantity: quantityChange },
        user?.uid,
        !user ? getGuestId() : null,
        user?.displayName
      );
    }
  };

  const handleRemoveItem = (itemId: string) => {
    const itemToRemove = cartItems.find(item => item.id === itemId);
    if (!itemToRemove) return;

    const updatedItems = cartItems.filter(item => item.id !== itemId);
    setCartItems(updatedItems);
    updateStoredCart(updatedItems);
    toast({ title: "Item Removed", description: `${itemToRemove.name} removed from your cart.` });
    logUserActivity(
        'removeFromCart',
        { serviceId: itemToRemove.id, serviceName: itemToRemove.name, quantity: itemToRemove.quantity },
        user?.uid,
        !user ? getGuestId() : null,
        user?.displayName
      );
  };

  const groupedCart = useMemo(() => {
    const groups: Record<string, { 
        categoryId: string, 
        categoryName: string, 
        items: CartItem[], 
        itemsTotal: number,
        subTotal: number,
        estimatedTax: number,
        visitingCharge: number,
        total: number,
        policyMessage: string | null,
        taxBreakdownItems: any[],
        visitingChargeBreakdown: any | null,
        effectiveTaxRateDisplay: string
    }> = {};

    cartItems.forEach(item => {
       const catId = item.categoryId || 'unknown';
       if (!groups[catId]) {
           groups[catId] = { 
               categoryId: catId, 
               categoryName: item.categoryName || 'Other', 
               items: [], 
               itemsTotal: 0,
               subTotal: 0,
               estimatedTax: 0,
               visitingCharge: 0,
               total: 0,
               policyMessage: null,
               taxBreakdownItems: [],
               visitingChargeBreakdown: null,
               effectiveTaxRateDisplay: "Est. Tax"
           };
       }
       
       const group = groups[catId];
       group.items.push(item);
       
       const displayedPriceForQuantity = calculateIncrementalTotalPrice(item);
       group.itemsTotal += displayedPriceForQuantity;

       const itemTaxRatePercent = (item.taxPercent !== undefined && item.taxPercent > 0) ? item.taxPercent : 0;
       const basePriceForQuantity = getBasePrice(displayedPriceForQuantity, item.isTaxInclusive, itemTaxRatePercent);
       group.subTotal += basePriceForQuantity;

       const itemTaxAmount = basePriceForQuantity * (itemTaxRatePercent / 100);
       group.estimatedTax += itemTaxAmount;

       group.taxBreakdownItems.push({
           name: item.name,
           quantity: item.quantity,
           pricePerUnit: displayedPriceForQuantity / item.quantity,
           itemSubtotal: basePriceForQuantity,
           taxPercent: itemTaxRatePercent,
           taxAmount: itemTaxAmount,
           isTaxInclusive: item.isTaxInclusive,
           isDefaultRate: false,
       });
    });

    // Finalize each group's calculations (visiting charges, total tax, etc.)
    Object.values(groups).forEach(group => {
        let calculatedBaseVisitingCharge = 0;
        let displayedVisitingChargeAmount = 0;
        let currentPolicyMessage: string | null = null;

        const firstItem = group.items[0];
        const vcAmount = (firstItem && typeof firstItem.visitingChargeAmount === 'number') ? firstItem.visitingChargeAmount : appConfig.visitingChargeAmount;
        const minBooking = (firstItem && typeof firstItem.minimumBookingAmount === 'number') ? firstItem.minimumBookingAmount : appConfig.minimumBookingAmount;
        const policyDesc = (firstItem && firstItem.minimumBookingPolicyDescription) ? firstItem.minimumBookingPolicyDescription : appConfig.minimumBookingPolicyDescription;

        if (appConfig.enableMinimumBookingPolicy && typeof minBooking === 'number' && typeof vcAmount === 'number') {
            if (group.itemsTotal > 0 && group.itemsTotal < minBooking) {
                displayedVisitingChargeAmount = vcAmount;
                calculatedBaseVisitingCharge = getBasePrice(displayedVisitingChargeAmount, appConfig.isVisitingChargeTaxInclusive, appConfig.visitingChargeTaxPercent);
                if (policyDesc) {
                    const symbol = appConfig.currencySymbol || "₹";
                    const escapedSymbol = (symbol || "₹").replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                    const patternVc = new RegExp(`(?:₹|\\$|${escapedSymbol})?{VISITING_CHARGE}`, 'g');
                    const patternMin = new RegExp(`(?:₹|\\$|${escapedSymbol})?{MINIMUM_BOOKING_AMOUNT}`, 'g');
                    const normalizedPolicy = policyDesc
                        .replace(patternMin, "{MINIMUM_BOOKING_AMOUNT}")
                        .replace(patternVc, "{VISITING_CHARGE}");
                    currentPolicyMessage = normalizedPolicy
                        .replace(/{MINIMUM_BOOKING_AMOUNT}/g, `${symbol}${minBooking}`)
                        .replace(/{VISITING_CHARGE}/g, `${symbol}${vcAmount}`)
                        .replace("{MINIMUM_BOOKING_AMOUNT}", `${symbol}${minBooking}`)
                        .replace("{VISITING_CHARGE}", `${symbol}${vcAmount}`);
                }
            }
        }
        group.visitingCharge = calculatedBaseVisitingCharge;
        group.policyMessage = currentPolicyMessage;

        let visitingChargeTaxAmount = 0;
        let visitingChargeTaxPercentForBreakdown = 0;
        if (appConfig.enableTaxOnVisitingCharge && calculatedBaseVisitingCharge > 0 && appConfig.visitingChargeTaxPercent > 0) {
            visitingChargeTaxAmount = calculatedBaseVisitingCharge * (appConfig.visitingChargeTaxPercent / 100);
            group.estimatedTax += visitingChargeTaxAmount;
            visitingChargeTaxPercentForBreakdown = appConfig.visitingChargeTaxPercent;
        }

        group.visitingChargeBreakdown = displayedVisitingChargeAmount > 0 ? {
            amount: displayedVisitingChargeAmount,
            baseAmount: calculatedBaseVisitingCharge,
            taxPercent: visitingChargeTaxPercentForBreakdown,
            taxAmount: visitingChargeTaxAmount,
            isTaxInclusive: appConfig.isVisitingChargeTaxInclusive || false,
        } : null;

        // Effective Tax Rate Display Logic
        let allItemsHaveSameTax = true;
        let firstTaxRate: number | undefined = group.taxBreakdownItems[0]?.taxPercent;
        group.taxBreakdownItems.forEach(t => { if(t.taxPercent !== firstTaxRate) allItemsHaveSameTax = false; });

        if (calculatedBaseVisitingCharge > 0 && appConfig.enableTaxOnVisitingCharge && appConfig.visitingChargeTaxPercent > 0) {
            if (!(allItemsHaveSameTax && appConfig.visitingChargeTaxPercent === firstTaxRate)) {
                allItemsHaveSameTax = false;
            }
        } else if (calculatedBaseVisitingCharge > 0 && (!appConfig.enableTaxOnVisitingCharge || (appConfig.visitingChargeTaxPercent || 0) <= 0)) {
            if (allItemsHaveSameTax && firstTaxRate !== 0) {
                allItemsHaveSameTax = false;
            }
        }

        if (allItemsHaveSameTax && firstTaxRate !== undefined && firstTaxRate > 0) {
            group.effectiveTaxRateDisplay = `Tax (${firstTaxRate.toFixed(1)}%)`;
        } else if (group.estimatedTax > 0) {
            group.effectiveTaxRateDisplay = "Total Tax";
        } else {
            group.effectiveTaxRateDisplay = "Tax (0%)";
        }

        group.total = group.subTotal + group.visitingCharge + group.estimatedTax;
    });

    return Object.values(groups);
  }, [cartItems, appConfig]);

  const [isCheckingOutAll, setIsCheckingOutAll] = useState(false);

  const executeProceedCheckout = () => {
    if (cartItems.length === 0) return;
    showLoading();
    setIsCheckingOutAll(true);

    // Save all items for checkout flow
    saveActiveCheckoutEntries(cartItems.map(i => ({ serviceId: i.id, quantity: i.quantity })));

    const firstCat = cartItems[0]?.categoryId || 'daily-labour';
    const firstCatName = cartItems[0]?.categoryName || 'Daily Labour';
    localStorage.setItem('fixbroActiveCheckoutCategory', firstCat);
    localStorage.setItem('fixbroActiveCheckoutCategoryName', firstCatName);

    // Clear previous checkout flow data
    localStorage.removeItem('fixbroScheduledDate');
    localStorage.removeItem('fixbroScheduledTimeSlot');
    localStorage.removeItem('fixbroEstimatedEndTime');
    localStorage.removeItem('fixbroCustomerAddress');
    localStorage.removeItem('fixbroAppliedPromoCode');
    localStorage.removeItem('fixbroBookingDiscountCode');
    localStorage.removeItem('fixbroBookingDiscountAmount');
    localStorage.removeItem('fixbroAppliedPromoCodeId');

    logUserActivity(
      'checkoutStep',
      { checkoutStepName: 'cart_proceed_to_unified_checkout', pageUrl: currentPathname, itemCount: cartItems.length },
      user?.uid,
      !user ? getGuestId() : null
    );

    router.push('/checkout');
  };

  const handleProceedToUnifiedCheckout = () => {
    if (cartItems.length === 0) return;
    if (providerSettings?.enableCartBookingRules !== false) {
      setIsRulesModalOpen(true);
      return;
    }
    executeProceedCheckout();
  };

  const overallSummary = useMemo(() => {
    let itemsTotal = 0;
    let totalTax = 0;
    let totalDays = 0;

    cartItems.forEach(item => {
      const price = calculateIncrementalTotalPrice(item);
      itemsTotal += price;
      totalDays += item.quantity;
      const taxRate = item.taxPercent || 0;
      const basePrice = getBasePrice(price, item.isTaxInclusive, taxRate);
      totalTax += basePrice * (taxRate / 100);
    });

    let platformFeeTotal = 0;
    const rawPlatformFees = appConfig?.platformFees;
    const platformFeesList: any[] = Array.isArray(rawPlatformFees)
      ? rawPlatformFees
      : (rawPlatformFees && typeof rawPlatformFees === 'object' ? Object.values(rawPlatformFees) : []);

    const isPlatformFeeEnabled = (appConfig as any)?.enablePlatformFee !== false;
    if (isPlatformFeeEnabled && platformFeesList.length > 0 && itemsTotal > 0) {
      platformFeesList.forEach(fee => {
        if (fee && fee.isActive !== false) {
          const feeAmt = fee.type === 'percentage' ? (itemsTotal * (Number(fee.value) || 0)) / 100 : (Number(fee.value) || 0);
          const feeTax = (feeAmt * (Number(fee.feeTaxRatePercent) || 0)) / 100;
          platformFeeTotal += (feeAmt + feeTax);
        }
      });
    }

    const grandTotal = itemsTotal + platformFeeTotal + totalTax;

    return {
      itemsTotal,
      totalDays,
      platformFeeTotal,
      totalTax,
      grandTotal,
    };
  }, [cartItems, appConfig]);

  const breadcrumbItems: BreadcrumbItem[] = [
    { label: "Home", href: "/" },
    { label: "Your Cart" },
  ];

  if (!isMounted || isLoadingCart || isLoadingAppSettings) {
    return (
      <div className="container mx-auto px-4 py-8 text-center flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">Loading your cart...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-2 sm:px-4 py-6 sm:py-8 max-w-4xl">
      <Breadcrumbs items={breadcrumbItems} className="mb-4 sm:mb-6" />
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 sm:mb-8 gap-2">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-headline font-semibold text-foreground">Your Cart</h1>
        <Link href="/" passHref>
          <Button variant="outline" size="sm" className="hidden md:flex">
            <Home className="mr-2 h-4 w-4" /> Back to Home
          </Button>
        </Link>
      </div>

      {groupedCart.length === 0 ? (
        <div className="text-center py-12">
          <ShoppingCart className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-xl sm:text-2xl font-semibold mb-2">Your cart is empty</h2>
          <p className="text-muted-foreground mb-6 text-sm sm:text-base">Looks like you haven't added any providers yet.</p>
          <Link href="/categories" passHref>
            <Button>Browse Categories</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedCart.map((group) => (
            <Card key={group.categoryId} className="shadow-md border-t-4 border-t-primary overflow-hidden">
              <CardHeader className="bg-secondary/20 pb-4">
                <CardTitle className="text-xl sm:text-2xl font-headline flex items-center">
                  <span className="bg-primary text-primary-foreground text-xs px-2 py-1 rounded mr-3 uppercase tracking-wider font-bold">Category</span>
                  {group.categoryName}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 sm:p-4">
                <div className="divide-y divide-border/50">
                  {group.items.map(item => {
                    const itemUnitPrice = item.price;
                    const itemTotalPrice = itemUnitPrice * item.quantity;
                    const skillBadgeText = item.seniorityLevel || 'Senior';

                    return (
                      <div key={item.id} className="p-3 sm:p-4 hover:bg-accent/5 transition-colors">
                        
                        {/* MOBILE LAYOUT */}
                        <div className="flex flex-col md:hidden w-full gap-3">
                          <div className="flex flex-row w-full gap-3">
                            <div className="flex-1 flex flex-col">
                              <Link href={`/provider/${item.slug}`} className="hover:text-primary transition-colors">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <h3 className="font-bold text-base leading-tight">{item.name}</h3>
                                  <Badge variant="outline" className="text-[10px] font-semibold bg-primary/10 text-primary border-primary/25 px-1.5 py-0.5">
                                    {skillBadgeText}
                                  </Badge>
                                  <Badge variant="secondary" className="text-[10px] font-bold bg-primary/15 text-primary border-primary/30 px-1.5 py-0.5">
                                    {item.quantity} {item.quantity === 1 ? 'Day' : 'Days'}
                                  </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{item.description}</p>
                              </Link>
                              <div className="flex flex-col gap-1 mt-2">
                                <div className="flex items-baseline gap-2">
                                  <p className="text-lg font-bold text-foreground">
                                    {formatCurrency(itemTotalPrice, appConfig.currencySymbol, appConfig.currencyDecimalPoints, appConfig.currencyCode)}
                                  </p>
                                  <span className="text-xs text-muted-foreground font-medium">
                                    ({formatCurrency(itemUnitPrice, appConfig.currencySymbol, appConfig.currencyDecimalPoints, appConfig.currencyCode)} / day)
                                  </span>
                                </div>
                                <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded w-fit">
                                  <CalendarDays className="h-3 w-3 text-primary" />
                                  Booked for {item.quantity} {item.quantity === 1 ? 'Day' : 'Days'}
                                </div>
                              </div>
                            </div>
                            <Link href={`/provider/${item.slug}`} className="flex-shrink-0 w-24 h-24 relative aspect-square">
                              <AppImage src={item.imageUrl || "/default-image.png"} alt={item.name} fill className="rounded-lg object-cover" />
                            </Link>
                          </div>
                          <div className="flex items-center justify-between w-full gap-2 pt-1 border-t border-border/40">
                            <Button variant="ghost" size="sm" className="text-destructive bg-destructive/10 hover:bg-destructive hover:text-white active:bg-destructive/90 text-xs h-8 px-2.5" onClick={() => handleRemoveItem(item.id)}>
                              <Trash2 className="mr-1 h-3.5 w-3.5" /> Remove
                            </Button>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-primary px-2.5 py-1 rounded-md bg-primary/10 border border-primary/20">
                                {item.quantity} {item.quantity === 1 ? 'Day' : 'Days'}
                              </span>
                              <QuantitySelector initialQuantity={item.quantity} onQuantityChange={(newQuantity) => handleQuantityChange(item.id, newQuantity)} minQuantity={0} enforcedMinQuantity={1} maxQuantity={item.maxQuantity} />
                            </div>
                          </div>
                        </div>

                        {/* DESKTOP LAYOUT */}
                        <div className="hidden md:flex flex-row items-center w-full gap-4">
                          <Link href={`/provider/${item.slug}`} className="relative w-24 h-24 flex-shrink-0 aspect-square">
                            <AppImage src={item.imageUrl || "/default-image.png"} alt={item.name} fill className="object-cover rounded-lg shadow-sm" />
                          </Link>
                          <div className="flex-1 flex flex-col pr-4">
                            <Link href={`/provider/${item.slug}`} className="hover:text-primary transition-colors">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-bold text-lg leading-tight text-foreground line-clamp-1">{item.name}</h3>
                                <Badge variant="outline" className="text-xs font-semibold bg-primary/10 text-primary border-primary/25 px-2 py-0.5">
                                  {skillBadgeText}
                                </Badge>
                                <Badge variant="secondary" className="text-xs font-bold bg-primary/15 text-primary border-primary/30 px-2 py-0.5">
                                  {item.quantity} {item.quantity === 1 ? 'Day' : 'Days'}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground line-clamp-1 mt-1">{item.description}</p>
                            </Link>
                            <div className="mt-2 flex flex-col gap-1">
                              <div className="flex items-baseline gap-2">
                                <p className="text-lg font-bold text-foreground">
                                  {formatCurrency(itemTotalPrice, appConfig.currencySymbol, appConfig.currencyDecimalPoints, appConfig.currencyCode)}
                                </p>
                                <span className="text-sm text-muted-foreground font-medium">
                                  ({formatCurrency(itemUnitPrice, appConfig.currencySymbol, appConfig.currencyDecimalPoints, appConfig.currencyCode)} / day)
                                </span>
                              </div>
                              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary/10 border border-primary/20 px-2.5 py-0.5 rounded w-fit">
                                <CalendarDays className="h-3.5 w-3.5 text-primary" />
                                Booked for {item.quantity} {item.quantity === 1 ? 'Day' : 'Days'}
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2.5 flex-shrink-0 w-36">
                            <span className="text-xs font-bold text-primary px-2.5 py-1 rounded-md bg-primary/10 border border-primary/20">
                              {item.quantity} {item.quantity === 1 ? 'Day' : 'Days'}
                            </span>
                            <QuantitySelector initialQuantity={item.quantity} onQuantityChange={(newQuantity) => handleQuantityChange(item.id, newQuantity)} minQuantity={0} enforcedMinQuantity={1} maxQuantity={item.maxQuantity} />
                            <Button variant="ghost" size="sm" className="text-destructive bg-destructive/10 hover:bg-destructive hover:text-white h-7 px-2.5 text-xs" onClick={() => handleRemoveItem(item.id)}>
                              <Trash2 className="mr-1 h-3.5 w-3.5" /> Remove
                            </Button>
                          </div>
                        </div>

                      </div>
                    );
                  })}
                </div>
              </CardContent>
              <CardFooter className="bg-muted/20 px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between gap-3 border-t text-sm">
                <div className="flex-1 min-w-0 pr-2">
                  {renderProvidersDaysSummary(group.items)}
                </div>
                <div className="font-bold text-foreground text-sm sm:text-base shrink-0 whitespace-nowrap text-right">
                  Category Total: {formatCurrency(group.itemsTotal, appConfig.currencySymbol, appConfig.currencyDecimalPoints, appConfig.currencyCode)}
                </div>
              </CardFooter>
            </Card>
          ))}

          {/* UNIFIED ORDER SUMMARY & CHECKOUT CARD */}
          <Card className="shadow-lg border-2 border-primary/20 bg-card overflow-hidden mt-6">
            <CardHeader className="bg-primary/5 p-4 sm:p-5 pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-4">
                <CardTitle className="text-xl font-headline font-bold text-foreground whitespace-nowrap">
                  Order Summary
                </CardTitle>
                <div className="text-xs sm:text-sm font-normal text-muted-foreground text-left sm:text-right">
                  {renderProvidersDaysSummary(cartItems)}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 space-y-3">
              <div className="flex justify-between text-base">
                <span className="text-muted-foreground">Items Total:</span>
                <span className="font-medium">{formatCurrency(overallSummary.itemsTotal, appConfig.currencySymbol, appConfig.currencyDecimalPoints, appConfig.currencyCode)}</span>
              </div>

              {overallSummary.platformFeeTotal > 0 && (
                <div className="flex justify-between text-base items-center text-foreground">
                  <span className="text-muted-foreground">Platform Fee:</span>
                  <span className="font-medium">+ {formatCurrency(overallSummary.platformFeeTotal, appConfig.currencySymbol, appConfig.currencyDecimalPoints, appConfig.currencyCode)}</span>
                </div>
              )}

              {overallSummary.totalTax > 0 && (
                <div className="flex justify-between text-base items-center text-foreground">
                  <span className="text-muted-foreground">Tax:</span>
                  <span className="font-medium">+ {formatCurrency(overallSummary.totalTax, appConfig.currencySymbol, appConfig.currencyDecimalPoints, appConfig.currencyCode)}</span>
                </div>
              )}

              {cartItems.length > 1 && (
                <div className="bg-muted/30 rounded-xl p-3 border border-border/50 text-xs space-y-1.5 my-2">
                  <p className="font-bold text-foreground flex items-center gap-1.5 mb-1 text-[11px] uppercase tracking-wider">
                    <CalendarDays className="h-3.5 w-3.5 text-primary" />
                    Provider Duration Details
                  </p>
                  {cartItems.map(item => (
                    <div key={item.id} className="flex justify-between items-center text-muted-foreground">
                      <span className="font-medium text-foreground truncate max-w-[220px]">{item.name}</span>
                      <span className="font-semibold text-primary">{item.quantity} {item.quantity === 1 ? 'Day' : 'Days'}</span>
                    </div>
                  ))}
                </div>
              )}

              <Separator className="my-2" />

              <div className="flex justify-between items-baseline pt-1">
                <div>
                  <span className="text-lg sm:text-xl font-bold text-foreground">Grand Total:</span>
                  <p className="text-xs text-muted-foreground">Full Day Labour Booking</p>
                </div>
                <span className="text-2xl sm:text-3xl font-extrabold text-primary">
                  {formatCurrency(overallSummary.grandTotal, appConfig.currencySymbol, appConfig.currencyDecimalPoints, appConfig.currencyCode)}
                </span>
              </div>
            </CardContent>
            <CardFooter className="bg-muted/10 p-4 sm:p-6 pt-0">
              <Button
                size="lg"
                className="w-full py-7 text-xl font-bold shadow-xl hover:shadow-primary/30 transition-all group relative overflow-hidden"
                onClick={handleProceedToUnifiedCheckout}
                disabled={isCheckingOutAll || cartItems.length === 0}
              >
                {isCheckingOutAll ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" /> Proceeding...
                  </span>
                ) : (
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    Proceed to Checkout <ArrowRight className="h-6 w-6 transition-transform group-hover:translate-x-1" />
                  </span>
                )}
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* Daily Labour Booking Rules & Terms Modal */}
      <CartBookingRulesModal
        isOpen={isRulesModalOpen}
        onClose={() => setIsRulesModalOpen(false)}
        onConfirm={() => {
          setIsRulesModalOpen(false);
          executeProceedCheckout();
        }}
        settings={providerSettings}
      />
    </div>
  );
}

export default function CartPage() {
  return (
    <ProtectedRoute>
      <CartPageContent />
    </ProtectedRoute>
  );
}
