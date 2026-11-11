"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import type { 
  FirestoreCategory, 
  FirestoreSubCategory, 
  FirestoreService, 
  FirestoreCity, 
  FirestoreArea, 
  CityCategorySeoSetting, 
  AreaCategorySeoSetting, 
  FirestoreReview, 
  FirestoreSEOSettings,
  FaqItem
} from '@/types/firestore';
import ServiceCard from '@/components/service/ServiceCard';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Home as HomeIconLucide, PackageSearch, Loader2, Construction, ChevronLeft, ChevronRight, UserPlus, SlidersHorizontal, MapPin, Check } from 'lucide-react';
import Link from 'next/link';
import { getOverriddenCategoryName } from '@/lib/adminDataOverrides';
import { Skeleton } from '@/components/ui/skeleton';
import AppImage from '@/components/ui/AppImage';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy, limit, doc, getDoc, onSnapshot } from '@/lib/mysqlDb';
import { useToast } from '@/hooks/use-toast';
import StickyCartContinueButton from '@/components/category/StickyCartContinueButton';
import { useAuth } from '@/hooks/useAuth';
import Breadcrumbs from '@/components/shared/Breadcrumbs';
import type { BreadcrumbItem } from '@/types/ui';
import { replacePlaceholders, defaultSeoValues } from '@/lib/seoUtils';
import { getSpinnedLocalContent } from '@/lib/seoGenerator';
import { useLoading } from '@/contexts/LoadingContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { getHaversineDistance } from '@/lib/locationUtils';
import { Badge } from '@/components/ui/badge';
import { getCache, setCache, getRemoteCacheVersions } from '@/lib/client-cache';
import { cn } from '@/lib/utils';
import { useFeaturesConfig } from '@/hooks/useFeaturesConfig';
import SubCategoryCard from '@/components/category/SubCategoryCard';
import SubCategoryFloatingButton from '@/components/category/SubCategoryFloatingButton';
import type { FullCategoryData } from '@/lib/homepageUtils';
import { LazySection } from '@/components/shared/LazySection';
import { getCategorySearchTerm } from '@/lib/seoAdvancedUtils';
import JsonLdScript from '@/components/shared/JsonLdScript';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import LocalitiesInterlinking from '@/components/category/LocalitiesInterlinking';
import CitiesInterlinking from '@/components/category/CitiesInterlinking';

interface EnrichedSubCategory extends FirestoreSubCategory {
  services: FirestoreService[];
  isLoadingServices: boolean;
  hasStartedLoading?: boolean;
}

interface CategoryPageCache {
  category: FirestoreCategory | null;
  subCategories: EnrichedSubCategory[];
  h1: string | null;
  displayH1: string | null;
  breadcrumbs: BreadcrumbItem[];
  reviews?: FirestoreReview[];
}


interface CategoryPageClientProps {
  categorySlug: string;
  citySlug?: string;
  areaSlug?: string;
  cityName?: string;
  areaName?: string;
  breadcrumbItems?: BreadcrumbItem[];
  initialData?: FullCategoryData;
  initialH1Title?: string;
}

export default function CategoryPageClient({ 
  categorySlug, 
  citySlug, 
  areaSlug, 
  cityName: propCityName,
  areaName: propAreaName,
  breadcrumbItems: initialBreadcrumbItems, 
  initialData,
  initialH1Title
}: CategoryPageClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { user, firestoreUser, triggerAuthRedirect } = useAuth();
  const { showLoading } = useLoading();
  const currentPathname = usePathname();
  const { featuresConfig } = useFeaturesConfig();

  const cacheKey = `category-data-${categorySlug}-${citySlug || 'none'}-${areaSlug || 'none'}`;

  const [category, setCategory] = useState<FirestoreCategory | null>(() => initialData?.category || getCache<CategoryPageCache>(cacheKey, true)?.category || null);
  const [subCategoriesWithServices, setSubCategoriesWithServices] = useState<EnrichedSubCategory[]>(() => {
    if (initialData) {
        return initialData.subCategories.map(sc => ({ ...sc, isLoadingServices: false, hasStartedLoading: true }));
    }
    return getCache<CategoryPageCache>(cacheKey, true)?.subCategories || [];
  });
  const [activeSubCategorySlug, setActiveSubCategorySlug] = useState<string | null>(() => initialData?.subCategories[0]?.slug || getCache<CategoryPageCache>(cacheKey, true)?.subCategories[0]?.slug || null);
  const [breadcrumbItems, setBreadcrumbItems] = useState<BreadcrumbItem[]>(initialBreadcrumbItems || getCache<CategoryPageCache>(cacheKey, true)?.breadcrumbs || []);
  
  const [isLoading, setIsLoading] = useState(() => !initialData && !getCache(cacheKey, true));
  const [error, setError] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [manuallyAwakenedSubCats, setManuallyAwakenedSubCats] = useState<Set<string>>(new Set());
  const pendingScrollRef = useRef<string | null>(null);

  const [seoPageH1, setSeoPageH1] = useState<string | null>(() => initialH1Title || initialData?.category.h1_title || getCache<CategoryPageCache>(cacheKey, true)?.h1 || null);
  const [displayPageH1, setDisplayPageH1] = useState<string | null>(() => initialH1Title || initialData?.category.h1_title || getCache<CategoryPageCache>(cacheKey, true)?.displayH1 || null);
  
  const [seoContent, setSeoContent] = useState<string | null>(() => {
    let raw: string | null = null;
    
    if (areaSlug) {
      if (initialData?.areaCategorySeo?.seo_content) {
        raw = initialData.areaCategorySeo.seo_content;
      } else {
        const currentAreaObj = initialData?.availableAreas?.find(a => a.slug === areaSlug);
        let fallbackNearby: Array<{ id: string; name: string; slug: string }> = [];
        if (initialData?.areaData?.nearbyAreas && initialData.areaData.nearbyAreas.length > 0) {
          fallbackNearby = [...initialData.areaData.nearbyAreas];
        }
        if (initialData?.availableAreas) {
          const currentAreaId = currentAreaObj?.id || "";
          const cityAreas = initialData.availableAreas.filter(a => a.id !== currentAreaId);
          for (const a of cityAreas) {
            if (fallbackNearby.length >= 10) break;
            if (!fallbackNearby.some(existing => existing.id === a.id)) {
              fallbackNearby.push({ id: a.id, name: a.name, slug: a.slug });
            }
          }
        }

        return getSpinnedLocalContent({
          cityName: propCityName || initialData?.availableCities?.find(c => c.slug === citySlug)?.name || citySlug?.replace(/-/g, ' ') || "Bangalore",
          areaName: propAreaName || currentAreaObj?.name || areaSlug?.replace(/-/g, ' ') || "",
          categoryName: initialData?.category.name || "Services",
          nearbyAreas: fallbackNearby
        });
      }
    } else if (citySlug) {
      if (initialData?.cityCategorySeo?.seo_content) {
        raw = initialData.cityCategorySeo.seo_content;
      } else {
        const fallbackNearby = initialData?.availableAreas ? initialData.availableAreas.slice(0, 10).map(a => ({
          id: a.id,
          name: a.name,
          slug: a.slug
        })) : [];

        return getSpinnedLocalContent({
          cityName: propCityName || initialData?.availableCities?.find(c => c.slug === citySlug)?.name || citySlug?.replace(/-/g, ' ') || "Bangalore",
          categoryName: initialData?.category.name || "Services",
          nearbyAreas: fallbackNearby
        });
      }
    } else {
        raw = initialData?.category.seo_content || null;
    }
    
    if (raw && initialData) {
        return replacePlaceholders(raw, {
            cityName: propCityName || initialData.availableCities?.find(c => c.slug === citySlug)?.name || citySlug?.replace(/-/g, ' ') || "Bangalore",
            areaName: propAreaName || initialData.availableAreas?.find(a => a.slug === areaSlug)?.name || areaSlug?.replace(/-/g, ' ') || "",
            categoryName: initialData.category.name
        });
    }
    return raw;
  });

  const [faqs, setFaqs] = useState<FaqItem[]>(() => {
    const areaFaqsTemplate = initialData?.seoSettings?.areaCategoryFaqsTemplate || defaultSeoValues.areaCategoryFaqsTemplate;
    const cityFaqsTemplate = initialData?.seoSettings?.cityCategoryFaqsTemplate || defaultSeoValues.cityCategoryFaqsTemplate;
    
    let rawFaqs: FaqItem[] = [];
    
    if (areaSlug) {
        rawFaqs = initialData?.areaCategorySeo?.faqs || 
                  (areaFaqsTemplate && areaFaqsTemplate.length > 0 ? areaFaqsTemplate : []) ||
                  initialData?.cityCategorySeo?.faqs || 
                  (cityFaqsTemplate && cityFaqsTemplate.length > 0 ? cityFaqsTemplate : []) ||
                  initialData?.category.faqs || [];
    } else if (citySlug) {
        rawFaqs = initialData?.cityCategorySeo?.faqs || 
                  (cityFaqsTemplate && cityFaqsTemplate.length > 0 ? cityFaqsTemplate : []) ||
                  initialData?.category.faqs || [];
    } else {
        rawFaqs = initialData?.category.faqs || [];
    }
    
    if (rawFaqs.length > 0 && initialData) {
        const pData = {
            cityName: propCityName || initialData.availableCities?.find(c => c.slug === citySlug)?.name || citySlug?.replace(/-/g, ' ') || "Bangalore",
            areaName: propAreaName || initialData.availableAreas?.find(a => a.slug === areaSlug)?.name || areaSlug?.replace(/-/g, ' ') || "",
            categoryName: initialData.category.name
        };
        return rawFaqs.map(f => ({
            question: replacePlaceholders(f.question, pData),
            answer: replacePlaceholders(f.answer, pData)
        }));
    }
    return rawFaqs;
  });

  const subCategoryRefs = useRef<Record<string, HTMLElement | null>>({});
  const stickyNavRef = useRef<HTMLDivElement | null>(null);
  const [loadingSubCats, setLoadingSubCats] = useState<Set<string>>(new Set());

  const [carouselApi, setCarouselApi] = useState<any>();

  // User location and provider filter/sort state
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number; area?: string; city?: string } | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('fixbroUserLocation');
        return stored ? JSON.parse(stored) : null;
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  const [selectedSkillLevel, setSelectedSkillLevel] = useState<string>('all');
  const [selectedSort, setSelectedSort] = useState<string>('nearest');
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState<boolean>(false);

  useEffect(() => {
    const handleLocationUpdate = () => {
      try {
        const stored = localStorage.getItem('fixbroUserLocation');
        if (stored) setUserLocation(JSON.parse(stored));
      } catch (e) {}
    };
    window.addEventListener('fixbroUserLocationChanged', handleLocationUpdate);
    return () => window.removeEventListener('fixbroUserLocationChanged', handleLocationUpdate);
  }, []);

  // Sync user profile coordinates from firestoreUser on login
  useEffect(() => {
    if (firestoreUser) {
      let lat = Number((firestoreUser as any)?.coordinates?.latitude ?? (firestoreUser as any)?.coordinates?.lat);
      let lng = Number((firestoreUser as any)?.coordinates?.longitude ?? (firestoreUser as any)?.coordinates?.lng);
      let area = (firestoreUser as any)?.area;
      let city = (firestoreUser as any)?.city;

      if (isNaN(lat) || isNaN(lng) || lat === 0) {
        const defaultAddr = firestoreUser.addresses?.find((a: any) => a.isDefault) || firestoreUser.addresses?.[0];
        if (defaultAddr?.latitude && defaultAddr?.longitude) {
          lat = Number(defaultAddr.latitude);
          lng = Number(defaultAddr.longitude);
          area = (defaultAddr as any)?.area || defaultAddr.addressLine2 || area;
          city = defaultAddr.city || city;
        }
      }

      if (!isNaN(lat) && !isNaN(lng) && lat !== 0) {
        const newLoc = { latitude: lat, longitude: lng, area, city };
        setUserLocation(prev => {
          if (!prev || prev.latitude !== lat || prev.longitude !== lng) {
            try {
              localStorage.setItem('fixbroUserLocation', JSON.stringify(newLoc));
            } catch (e) {}
            return newLoc;
          }
          return prev;
        });
      }
    }
  }, [firestoreUser]);

  const allCategoryProviders = useMemo(() => {
    const allServices = subCategoriesWithServices.flatMap(sc => sc.services);

    let processed = allServices.map(service => {
      let distanceKm: number | undefined = undefined;
      const userLat = Number(userLocation?.latitude ?? (userLocation as any)?.lat);
      const userLng = Number(userLocation?.longitude ?? (userLocation as any)?.lng);
      const center = (service as any).workAreaCenter || (service as any).providerData?.workAreaCenter;
      const centerLat = Number(center?.latitude ?? center?.lat);
      const centerLng = Number(center?.longitude ?? center?.lng);

      if (!isNaN(userLat) && !isNaN(userLng) && !isNaN(centerLat) && !isNaN(centerLng) && userLat !== 0 && centerLat !== 0) {
        distanceKm = getHaversineDistance(userLat, userLng, centerLat, centerLng);
      }
      return {
        ...service,
        distanceKm,
      };
    });

    if (userLocation?.latitude && userLocation?.longitude) {
      const withinRadius = processed.filter(service => {
        if (service.distanceKm !== undefined) {
          const radius = Number((service as any).workAreaRadiusKm) || 25;
          return service.distanceKm <= radius;
        }
        return true;
      });
      if (withinRadius.length > 0) {
        processed = withinRadius;
      }
    }

    if (selectedSkillLevel !== 'all') {
      processed = processed.filter(service => {
        const level = (service.seniorityLevel || '').toLowerCase();
        return level.includes(selectedSkillLevel.toLowerCase());
      });
    }

    processed.sort((a, b) => {
      if (selectedSort === 'nearest') {
        if (a.distanceKm !== undefined && b.distanceKm !== undefined) {
          return a.distanceKm - b.distanceKm;
        }
        if (a.distanceKm !== undefined) return -1;
        if (b.distanceKm !== undefined) return 1;
        return (b.rating || 0) - (a.rating || 0);
      }
      if (selectedSort === 'reviews') {
        return (b.reviewCount || 0) - (a.reviewCount || 0) || (b.rating || 0) - (a.rating || 0);
      }
      if (selectedSort === 'price_asc') {
        return (a.price || 0) - (b.price || 0);
      }
      if (selectedSort === 'price_desc') {
        return (b.price || 0) - (a.price || 0);
      }
      return 0;
    });

    return processed;
  }, [subCategoriesWithServices, userLocation, selectedSkillLevel, selectedSort]);

  // State for scroll-responsive header sync
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const isHeaderVisibleRef = useRef(true);
  const lastScrollY = useRef(0);
  const [headerHeight, setHeaderHeight] = useState(64);

  const loadSubCategoryServices = useCallback(async (subCategoryId: string) => {
    if (loadingSubCats.has(subCategoryId)) return;
    
    // Check if already has data
    const currentSubCat = subCategoriesWithServices.find(sc => sc.id === subCategoryId);
    if (currentSubCat && currentSubCat.services && currentSubCat.services.length > 0) return;

    setLoadingSubCats(prev => new Set(prev).add(subCategoryId));
    
    try {
        const provsRef = collection(db, "providerApplications");
        const snapshot = await getDocs(provsRef);
        
        let adminMarkupFee = 200;
        try {
            const settingsDoc = await getDoc(doc(db, "webSettings", "providerDefaultSettings"));
            if (settingsDoc.exists() && typeof settingsDoc.data()?.adminMarkupFee === 'number') {
                adminMarkupFee = settingsDoc.data().adminMarkupFee;
            }
        } catch (e) {}

        const categoryProviders = snapshot.docs
            .map(d => ({ id: d.id, ...d.data() } as any))
            .filter(p => 
                p.status === 'approved' &&
                p.isActive !== false &&
                (
                    p.workCategoryId === category?.id ||
                    (p.workCategoryName && category?.name && p.workCategoryName.toLowerCase().trim() === category.name.toLowerCase().trim()) ||
                    (category?.name?.toLowerCase().includes('carpent') && (p.workCategoryName || '').toLowerCase().includes('carpent')) ||
                    (category?.name?.toLowerCase().includes('electr') && (p.workCategoryName || '').toLowerCase().includes('electr')) ||
                    (category?.name?.toLowerCase().includes('plumb') && (p.workCategoryName || '').toLowerCase().includes('plumb')) ||
                    (category?.name?.toLowerCase().includes('paint') && (p.workCategoryName || '').toLowerCase().includes('paint'))
                )
            );

        const services: FirestoreService[] = categoryProviders.map((p, idx) => {
            const baseDailyRate = Number(p.dailyRate) || Number(p.dailyWage) || Number(p.desiredDailyRate) || Number(p.price) || 1200;
            const finalPrice = baseDailyRate + adminMarkupFee;
            return {
                id: p.id,
                subCategoryId: `providers-${category?.id || 'general'}`,
                parentCategoryId: category?.id || 'general',
                parentCategoryName: category?.name || p.workCategoryName || 'Daily Labour',
                parentCategorySlug: category?.slug || 'daily-labour',
                name: p.fullName || 'Labour Provider',
                slug: p.slug || (p.fullName ? p.fullName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') : `provider-${p.id.slice(0, 5)}`),
                description: p.bio || `Skilled ${p.seniorityLevel || p.skillLevelLabel || 'Professional'} provider in ${category?.name || 'trade work'}.`,
                imageUrl: p.profilePhotoUrl || '/default-image.png',
                price: finalPrice,
                discountedPrice: finalPrice,
                order: idx,
                isActive: true,
                rating: Number(p.overallRating || p.rating) || 5,
                reviewCount: Number(p.reviewCount) || 0,
                isProvider: true,
                seniorityLevel: p.seniorityLevel || p.skillLevelLabel || 'Senior',
                age: p.age || 28,
                experienceYears: p.experienceYears || 5,
                experienceLevelLabel: p.experienceLevelLabel || `${p.experienceYears || 5} Years Exp`,
                workAreaAddress: p.workAreaAddress || '',
                workAreaRadiusKm: Number(p.workAreaRadiusKm) || 25,
                workAreaCenter: p.workAreaCenter || null,
                workingHours: p.workingHours || { start: "09:30 AM", end: "05:30 PM" },
                lunchBreak: p.lunchBreak || { start: "01:00 PM", end: "02:00 PM" },
                providerData: p,
            } as FirestoreService;
        });
        
        setSubCategoriesWithServices(prevSubCats => {
            const updated = prevSubCats.map(subCat => 
                subCat.id === subCategoryId 
                    ? { ...subCat, services, isLoadingServices: false, hasStartedLoading: true }
                    : subCat
            );
            
            const currentCache = getCache<CategoryPageCache>(cacheKey, true);
            if (currentCache) {
                setCache(cacheKey, { ...currentCache, subCategories: updated }, true);
            }
            return updated;
        });
    } catch (error) {
        console.error(`Error loading providers for ${subCategoryId}:`, error);
    } finally {
        setLoadingSubCats(prev => {
            const next = new Set(prev);
            next.delete(subCategoryId);
            return next;
        });
    }
  }, [cacheKey, category, subCategoriesWithServices, loadingSubCats]);

  useEffect(() => {
    setIsMounted(true);
    
    // Measure actual header height if possible
    const headerElement = document.querySelector('[data-site-header]');
    if (headerElement) {
        setHeaderHeight(headerElement.clientHeight);
    }

    if (initialData) {
      setCache(cacheKey, {
        category: initialData.category,
        subCategories: initialData.subCategories.map(sc => ({ ...sc, isLoadingServices: false, hasStartedLoading: true })),
        h1: initialH1Title || initialData.category.h1_title || null,
        displayH1: initialH1Title || initialData.category.h1_title || null,
        breadcrumbs: initialBreadcrumbItems || []
      }, true);
    }
  }, [initialData, cacheKey, initialBreadcrumbItems, initialH1Title]);
  
  // Effect for scroll-responsive header and sub-nav bar
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let ticking = false;
    let cachedHeaderElement: HTMLElement | null = null;

    const controlHeader = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;
          const delta = Math.abs(currentScrollY - lastScrollY.current);

          if (currentScrollY < 100) {
            if (!cachedHeaderElement) {
              cachedHeaderElement = document.querySelector('[data-site-header]');
            }
            if (cachedHeaderElement && cachedHeaderElement.clientHeight > 0) {
              setHeaderHeight(cachedHeaderElement.clientHeight);
            }
          }

          if (delta > 6 || currentScrollY < 80) {
            const shouldBeVisible = currentScrollY < lastScrollY.current || currentScrollY < 80;
            if (shouldBeVisible !== isHeaderVisibleRef.current) {
              isHeaderVisibleRef.current = shouldBeVisible;
              setIsHeaderVisible(shouldBeVisible);
            }
            lastScrollY.current = currentScrollY;
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', controlHeader, { passive: true });
    return () => {
      window.removeEventListener('scroll', controlHeader);
    };
  }, []);


  useEffect(() => {
    const fetchCategoryAndSubcategories = async () => {
      if (!categorySlug || !isMounted) {
        return;
      }

      if (initialData) {
          setIsLoading(false);
          // Pre-load first subcategory services if not already there
          if (initialData.subCategories.length > 0) loadSubCategoryServices(initialData.subCategories[0].id);
          return;
      }

      // --- SmartSync: Version Checking (deduplicated client-side read) ---
      let remoteVersion = 0;
      try {
        const remoteVersions = await getRemoteCacheVersions();
        remoteVersion = remoteVersions.services || 0;
      } catch (e) { console.warn("Failed to fetch cache versions:", e); }

      const localVersionKey = `category-version-${categorySlug}`;
      const localVersion = parseInt(localStorage.getItem(localVersionKey) || "0");
      const cachedData = getCache<CategoryPageCache>(cacheKey, true);

      if (cachedData && remoteVersion <= localVersion) {
        setCategory(cachedData.category);
        setSubCategoriesWithServices(cachedData.subCategories);
        setSeoPageH1(cachedData.h1);
        setDisplayPageH1(cachedData.displayH1);
        setBreadcrumbItems(cachedData.breadcrumbs);
        setIsLoading(false);
        if (cachedData.subCategories.length > 0 && !activeSubCategorySlug) {
            setActiveSubCategorySlug(cachedData.subCategories[0].slug);
        }
        // Force-load visible ones from cache instantly
        cachedData.subCategories.forEach(sc => {
            if (sc.hasStartedLoading) loadSubCategoryServices(sc.id);
        });
        return;
      }

      setIsLoading(true);
      setError(null);


      try {
        const categoriesRef = collection(db, "adminCategories");
        const qCategory = query(categoriesRef, where("slug", "==", categorySlug), where("isActive", "==", true), limit(1));
        const categorySnapshot = await getDocs(qCategory);

        if (categorySnapshot.empty) {
          setError(`Category "${categorySlug}" not found or is not active.`);
          toast({ title: "Not Found", description: `The category "${categorySlug}" could not be found or is inactive.`, variant: "destructive"});
          setIsLoading(false);
          return;
        }

        const foundCategory = { id: categorySnapshot.docs[0].id, ...categorySnapshot.docs[0].data() } as FirestoreCategory;
        setCategory(foundCategory);
        
        const subCategoriesRef = collection(db, "adminSubCategories");
        const qSubCategories = query(subCategoriesRef, where("parentId", "==", foundCategory.id), orderBy("order", "asc"));
        const subCategoriesSnapshot = await getDocs(qSubCategories);
        
        let initialSubCats: EnrichedSubCategory[] = subCategoriesSnapshot.docs
          .map(d => ({ ...(d.data() as FirestoreSubCategory), id: d.id, services: [], isLoadingServices: true, hasStartedLoading: false }))
          .filter(subCat => subCat.isActive !== false);

        if (initialSubCats.length === 0) {
          initialSubCats = [
            {
              id: `providers-${foundCategory.id}`,
              name: `Available ${foundCategory.name} Providers`,
              slug: 'providers',
              parentId: foundCategory.id,
              imageUrl: foundCategory.imageUrl,
              order: 0,
              isActive: true,
              services: [],
              isLoadingServices: true,
              hasStartedLoading: false,
            } as any
          ];
        }

        setSubCategoriesWithServices(initialSubCats);
        if (initialSubCats.length > 0) {
          setActiveSubCategorySlug(initialSubCats[0].slug);
        }

        let globalSeoSettings: FirestoreSEOSettings | undefined = undefined;
        const settingsDocRef = doc(db, 'seoSettings', 'global');
        const docSnap = await getDoc(settingsDocRef);
        if (docSnap.exists()) {
            globalSeoSettings = docSnap.data() as FirestoreSEOSettings;
        }

        if (!globalSeoSettings) {
            globalSeoSettings = {} as FirestoreSEOSettings; 
        }

        let baseH1 = foundCategory.h1_title || getOverriddenCategoryName(foundCategory.id, foundCategory.name);
        let finalDisplayH1 = baseH1;
        let fetchedCityData: FirestoreCity | null = null;
        let fetchedAreaData: FirestoreArea | null = null;

         if (citySlug) {
            const cityQuery = query(collection(db, "cities"), where("slug", "==", citySlug), where('isActive', '==', true), limit(1));
            const citySnap = await getDocs(cityQuery);
            if (!citySnap.empty) fetchedCityData = {id: citySnap.docs[0].id, ...citySnap.docs[0].data()} as FirestoreCity;
        }
        if (citySlug && areaSlug && fetchedCityData) {
             const areaQuery = query(collection(db, "areas"), where("slug", "==", areaSlug), where("cityId", "==", fetchedCityData.id), where('isActive', '==', true), limit(1));
             const areaSnap = await getDocs(areaQuery);
             if (!areaSnap.empty) fetchedAreaData = {id: areaSnap.docs[0].id, ...areaSnap.docs[0].data()} as FirestoreArea;
        }

        const dynamicBreadcrumbs = initialBreadcrumbItems || (() => {
            const crumbs: BreadcrumbItem[] = [{ label: "Home", href: "/" }];
            if (fetchedCityData) crumbs.push({ label: fetchedCityData.name, href: `/${citySlug}` });
            if (fetchedAreaData) crumbs.push({ label: fetchedAreaData.name, href: `/${citySlug}/${areaSlug}`});
            crumbs.push({ label: getOverriddenCategoryName(foundCategory.id, foundCategory.name) });
            return crumbs;
        })();
        setBreadcrumbItems(dynamicBreadcrumbs);
       
        if (fetchedAreaData && fetchedCityData) { 
            const areaOverrideSnap = await getDocs(query(collection(db, "areaCategorySeoSettings"), where("areaId", "==", fetchedAreaData.id), where("categoryId", "==", foundCategory.id), where("isActive", "==", true), limit(1)));
            if (!areaOverrideSnap.empty) baseH1 = (areaOverrideSnap.docs[0].data() as AreaCategorySeoSetting).h1_title || baseH1;
            else if (globalSeoSettings.areaCategoryPageH1Pattern) baseH1 = replacePlaceholders(globalSeoSettings.areaCategoryPageH1Pattern, { areaName: fetchedAreaData.name, cityName: fetchedCityData.name, categoryName: foundCategory.name }) || baseH1;
            finalDisplayH1 = `${baseH1}`;
        } else if (fetchedCityData) { 
            const cityOverrideSnap = await getDocs(query(collection(db, "cityCategorySeoSettings"), where("cityId", "==", fetchedCityData.id), where("categoryId", "==", foundCategory.id), where("isActive", "==", true), limit(1)));
            if (!cityOverrideSnap.empty) baseH1 = (cityOverrideSnap.docs[0].data() as CityCategorySeoSetting).h1_title || baseH1;
            else if (globalSeoSettings.cityCategoryPageH1Pattern) baseH1 = replacePlaceholders(globalSeoSettings.cityCategoryPageH1Pattern, { cityName: fetchedCityData.name, categoryName: foundCategory.name }) || baseH1;
            finalDisplayH1 = `${baseH1}`;
        } else { 
            if (globalSeoSettings.categoryPageH1Pattern) baseH1 = replacePlaceholders(globalSeoSettings.categoryPageH1Pattern, { categoryName: foundCategory.name }) || baseH1;
            finalDisplayH1 = baseH1;
        }

        setSeoPageH1(baseH1); 
        setDisplayPageH1(finalDisplayH1);
        setIsLoading(false); 
        
        setCache(cacheKey, {
            category: foundCategory,
            subCategories: initialSubCats,
            h1: baseH1,
            displayH1: finalDisplayH1,
            breadcrumbs: dynamicBreadcrumbs,
        }, true);
        localStorage.setItem(localVersionKey, remoteVersion.toString());

        // Fetch services for the first subcategory immediately
        if (initialSubCats.length > 0) {
            loadSubCategoryServices(initialSubCats[0].id);
        }
        
      } catch (err: unknown) {
        console.error("Error fetching category data:", err);
        const errorMessage = err instanceof Error ? err.message : "Failed to load category details.";
        setError(errorMessage);
        setIsLoading(false);
      }
    };
    
    fetchCategoryAndSubcategories();
  }, [categorySlug, citySlug, areaSlug, isMounted, toast, initialBreadcrumbItems, cacheKey, initialData, loadSubCategoryServices]);

  const handleSubCategoryClick = useCallback((slug: string) => {
    setActiveSubCategorySlug(slug);
    
    // Pre-emptively awaken the subcategory if it's not loaded
    const subCat = subCategoriesWithServices.find(sc => sc.slug === slug);
    if (subCat && !subCat.hasStartedLoading) {
        setManuallyAwakenedSubCats(prev => new Set(prev).add(subCat.id));
        loadSubCategoryServices(subCat.id);
    }

    // Set pending scroll to be handled in useEffect after state update
    pendingScrollRef.current = slug;

    const subCatIndex = subCategoriesWithServices.findIndex(sc => sc.slug === slug);
    if (carouselApi && subCatIndex > -1) {
      carouselApi.scrollTo(subCatIndex, false);
    }
  }, [carouselApi, subCategoriesWithServices, loadSubCategoryServices]);

  // Effect to handle pending scrolls after content is forced visible and services are loaded
  useEffect(() => {
    if (pendingScrollRef.current) {
        const slug = pendingScrollRef.current;
        const subCat = subCategoriesWithServices.find(sc => sc.slug === slug);
        
        // Wait until it's ready: found, started loading (LazySection active), and services fetched
        if (subCat && subCat.hasStartedLoading && !subCat.isLoadingServices) {
            const element = subCategoryRefs.current[slug];
            
            if (element) {
                const timer = setTimeout(() => {
                    const actualHeaderOffset = isHeaderVisible ? headerHeight : 0;
                    const subNavHeight = stickyNavRef.current?.clientHeight || 80;
                    
                    // Re-measure element position in case previous sections loaded/expanded
                    const elementPosition = element.getBoundingClientRect().top;
                    const offsetPosition = elementPosition + window.pageYOffset - actualHeaderOffset - subNavHeight + 12;
                    
                    window.scrollTo({ 
                        top: offsetPosition, 
                        behavior: 'smooth' 
                    });
                    
                    // Clear pending scroll after successful execution
                    pendingScrollRef.current = null;
                }, 150); // Slightly longer delay to allow DOM to stabilize after services render
                return () => clearTimeout(timer);
            }
        }
    }
  }, [activeSubCategorySlug, subCategoriesWithServices, headerHeight, isHeaderVisible]);
  
  const handleAuthRequiredNav = (e: React.MouseEvent<HTMLElement>, intendedHref?: string, action?: () => void) => {
    e.preventDefault();
    const redirectPath = intendedHref || currentPathname;
    if (intendedHref && intendedHref !== currentPathname && !intendedHref.startsWith('#')) showLoading();

    if (!user) {
      triggerAuthRedirect(redirectPath);
    } else {
      if (action) action();
      if (intendedHref && intendedHref !== currentPathname) router.push(intendedHref);
    }
  };

  const handleSimpleNav = (e: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>, intendedHref: string) => {
    e.preventDefault();
    if (intendedHref !== currentPathname && !intendedHref.startsWith('#')) showLoading();
    router.push(intendedHref);
  };


  if (!isMounted && !initialData) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Skeleton className="h-5 w-1/2 mb-6" />
        <div className="mb-6 flex items-center justify-between"><Skeleton className="h-10 w-24" /><Skeleton className="h-10 w-24" /></div>
        <Skeleton className="h-10 w-3/4 mb-2" /><Skeleton className="h-6 w-1/2 mb-8" />
        <Skeleton className="h-12 w-full mb-6" /> 
        <div className="pt-6"><Skeleton className="h-8 w-1/3 mb-6" />
          <div className="grid grid-cols-1 gap-4">
            {[...Array(4)].map((_, i) => (<Skeleton key={i} className="h-36 w-full" />))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8 text-center min-h-[60vh] flex flex-col justify-center items-center">
        <PackageSearch className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-semibold mb-2">Error Loading Category</h2>
        <p className="text-destructive mb-6">{error}</p>
        <Button variant="outline" onClick={(e) => handleSimpleNav(e, '/categories')}>View All Categories</Button>
      </div>
    );
  }
  
  if (isLoading || !category || !displayPageH1) {
     return ( 
      <div className="container mx-auto px-4 py-8 text-center min-h-[60vh] flex flex-col justify-center items-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  const hasAnyServices = subCategoriesWithServices.some(sc => sc.services.length > 0 || sc.isLoadingServices);

  return (
    <div className="container mx-auto px-4 py-4 pb-24">
      {breadcrumbItems.length > 0 && <Breadcrumbs items={breadcrumbItems} />}
      <nav className="mb-1 hidden md:flex items-center justify-between">
        <Button variant="outline" onClick={() => { showLoading(); router.back(); }}>
          <ArrowLeft className="mr-1 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" /> Back
        </Button>
        <Button variant="outline" onClick={(e) => handleSimpleNav(e, '/')} className="flex items-center">
          <HomeIconLucide className="mr-1 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" /> Home
        </Button>
      </nav>
      
      <h1 className="text-2xl md:text-4xl font-headline font-semibold mb-2 text-foreground">
        {displayPageH1}
      </h1>
      <p className="text-muted-foreground mb-3">
        Verified daily labour {category ? category.name : 'providers'} in {areaSlug && citySlug ? `${areaSlug.replace(/-/g, ' ')}, ${citySlug.replace(/-/g, ' ')}` : citySlug ? citySlug.replace(/-/g, ' ') : "Bangalore"}. 
        Reliable daily wage tradesmen for your trade work requirements.
      </p>

      {/* FILTER & SORT BAR */}
      <div className="flex items-center justify-between gap-3 py-3 px-1 border-b border-border/50 mb-4 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsFilterDialogOpen(true)}
            className="flex items-center gap-2 rounded-full border-primary/30 hover:bg-primary/5 text-xs sm:text-sm font-semibold h-9"
          >
            <SlidersHorizontal className="h-4 w-4 text-primary" />
            <span>Filter & Sort</span>
            {(selectedSkillLevel !== 'all' || selectedSort !== 'nearest') && (
              <span className="h-2 w-2 rounded-full bg-primary" />
            )}
          </Button>

          {selectedSkillLevel !== 'all' && (
            <Badge variant="secondary" className="text-xs px-2 py-0.5 capitalize bg-primary/10 text-primary border-primary/20">
              Skill: {selectedSkillLevel}
            </Badge>
          )}

          {userLocation?.city && (
            <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 text-primary" />
              <span>Near {userLocation.area ? `${userLocation.area}, ` : ''}{userLocation.city}</span>
            </div>
          )}
        </div>

        <span className="text-xs sm:text-sm text-muted-foreground font-medium">
          {allCategoryProviders.length} provider{allCategoryProviders.length === 1 ? '' : 's'} available
        </span>
      </div>

      {/* FILTER & SORT DIALOG */}
      <Dialog open={isFilterDialogOpen} onOpenChange={setIsFilterDialogOpen}>
        <DialogContent className="max-w-[92vw] sm:max-w-md bg-background rounded-2xl p-5">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <SlidersHorizontal className="h-5 w-5 text-primary" />
              Filter & Sort Providers
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Sort Options */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Sort By</h4>
              <RadioGroup value={selectedSort} onValueChange={setSelectedSort} className="space-y-1.5">
                <div className="flex items-center space-x-2 p-2 rounded-lg hover:bg-muted/30 cursor-pointer">
                  <RadioGroupItem value="nearest" id="sort-nearest" />
                  <Label htmlFor="sort-nearest" className="cursor-pointer text-sm font-medium flex items-center justify-between w-full">
                    <span>📍 Nearest First (Proximity)</span>
                    {selectedSort === 'nearest' && <Check className="h-4 w-4 text-primary" />}
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-2 rounded-lg hover:bg-muted/30 cursor-pointer">
                  <RadioGroupItem value="reviews" id="sort-reviews" />
                  <Label htmlFor="sort-reviews" className="cursor-pointer text-sm font-medium flex items-center justify-between w-full">
                    <span>⭐ Most Reviews / Highest Rating</span>
                    {selectedSort === 'reviews' && <Check className="h-4 w-4 text-primary" />}
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-2 rounded-lg hover:bg-muted/30 cursor-pointer">
                  <RadioGroupItem value="price_asc" id="sort-price-asc" />
                  <Label htmlFor="sort-price-asc" className="cursor-pointer text-sm font-medium flex items-center justify-between w-full">
                    <span>💰 Price: Low to High</span>
                    {selectedSort === 'price_asc' && <Check className="h-4 w-4 text-primary" />}
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-2 rounded-lg hover:bg-muted/30 cursor-pointer">
                  <RadioGroupItem value="price_desc" id="sort-price-desc" />
                  <Label htmlFor="sort-price-desc" className="cursor-pointer text-sm font-medium flex items-center justify-between w-full">
                    <span>💰 Price: High to Low</span>
                    {selectedSort === 'price_desc' && <Check className="h-4 w-4 text-primary" />}
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Skill Level Filter */}
            <div className="space-y-2 pt-2 border-t">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Skill Level</h4>
              <RadioGroup value={selectedSkillLevel} onValueChange={setSelectedSkillLevel} className="space-y-1.5">
                <div className="flex items-center space-x-2 p-2 rounded-lg hover:bg-muted/30 cursor-pointer">
                  <RadioGroupItem value="all" id="skill-all" />
                  <Label htmlFor="skill-all" className="cursor-pointer text-sm font-medium flex items-center justify-between w-full">
                    <span>All Skill Levels</span>
                    {selectedSkillLevel === 'all' && <Check className="h-4 w-4 text-primary" />}
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-2 rounded-lg hover:bg-muted/30 cursor-pointer">
                  <RadioGroupItem value="beginner" id="skill-beginner" />
                  <Label htmlFor="skill-beginner" className="cursor-pointer text-sm font-medium flex items-center justify-between w-full">
                    <span>Beginner / Fresher</span>
                    {selectedSkillLevel === 'beginner' && <Check className="h-4 w-4 text-primary" />}
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-2 rounded-lg hover:bg-muted/30 cursor-pointer">
                  <RadioGroupItem value="intermediate" id="skill-intermediate" />
                  <Label htmlFor="skill-intermediate" className="cursor-pointer text-sm font-medium flex items-center justify-between w-full">
                    <span>Intermediate</span>
                    {selectedSkillLevel === 'intermediate' && <Check className="h-4 w-4 text-primary" />}
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-2 rounded-lg hover:bg-muted/30 cursor-pointer">
                  <RadioGroupItem value="expert" id="skill-expert" />
                  <Label htmlFor="skill-expert" className="cursor-pointer text-sm font-medium flex items-center justify-between w-full">
                    <span>Expert / Senior</span>
                    {selectedSkillLevel === 'expert' && <Check className="h-4 w-4 text-primary" />}
                  </Label>
                </div>
              </RadioGroup>
            </div>
          </div>

          <DialogFooter className="flex sm:flex-row gap-2 pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedSkillLevel('all');
                setSelectedSort('nearest');
              }}
              className="w-full sm:w-auto"
            >
              Reset
            </Button>
            <Button
              size="sm"
              onClick={() => setIsFilterDialogOpen(false)}
              className="w-full sm:w-auto"
            >
              Apply Filters
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PROVIDERS LIST */}
      {hasAnyServices ? (
        <>
          <div className="space-y-4">
            {allCategoryProviders.length > 0 ? (
              <div className="grid grid-cols-1 gap-4">
                {allCategoryProviders.map((service: FirestoreService, serviceIndex: number) => (
                  <ServiceCard key={service.id} service={service} priority={serviceIndex < 4} />
                ))}
              </div>
            ) : (
              <div className="border border-border rounded-2xl p-8 text-center bg-card shadow-sm my-6">
                <p className="text-muted-foreground text-base">
                  {userLocation 
                    ? `No providers currently available within your location radius (${userLocation.area ? `${userLocation.area}, ` : ''}${userLocation.city || 'Bangalore'}).` 
                    : "No providers found matching your current filter. Try resetting filters to see more providers."}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedSkillLevel('all');
                    setSelectedSort('nearest');
                  }}
                  className="mt-4"
                >
                  Reset Filters
                </Button>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="border border-border rounded-2xl p-8 sm:p-12 flex flex-col items-center justify-center text-center min-h-[400px] bg-card shadow-sm">
            <div className="bg-primary/10 p-4 rounded-full mb-6">
                <Construction className="h-12 w-12 text-primary" />
            </div>
            <h3 className="text-3xl font-headline font-bold text-foreground mb-4">Coming Soon!</h3>
            <p className="text-muted-foreground max-w-md mx-auto mb-8 text-lg">
                We&apos;re working hard to bring trusted professionals for this category to your area. Please check back soon.
            </p>
            
            <div className="space-y-4">
                <p className="text-sm font-medium text-foreground">Are you a professional in this field?</p>
                <Link href="/provider-registration" passHref>
                    <Button size="lg" className="h-12 px-8 rounded-lg shadow-md">
                        <UserPlus className="mr-2 h-5 w-5" /> Join as a Provider
                    </Button>
                </Link>
            </div>
        </div>
      )}

      <StickyCartContinueButton />

      {seoContent && (
        <LazySection>
          <div className="mt-16 pt-8 border-t border-border">
            <h2 className="text-xl md:text-2xl font-headline font-semibold mb-6 text-foreground">
              About our {category ? getCategorySearchTerm(category.name) : 'Services'} in {areaSlug ? areaSlug.replace(/-/g, ' ') : citySlug ? citySlug.replace(/-/g, ' ') : "Bangalore"}
            </h2>
            <div 
              className="prose prose-sm md:prose-base max-w-none text-muted-foreground"
              dangerouslySetInnerHTML={{ __html: seoContent }}
            />
          </div>
        </LazySection>
      )}

      {faqs && faqs.length > 0 && (
        <LazySection>
          <div className="mt-12 pt-8 border-t border-border">
            <h2 className="text-xl md:text-2xl font-headline font-semibold mb-6 text-foreground">
                Frequently Asked Questions
            </h2>
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((faq, index) => (
                <AccordionItem key={index} value={`faq-${index}`}>
                  <AccordionTrigger className="text-left font-medium">{faq.question}</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
            
            <JsonLdScript 
              idSuffix={`faqs-${categorySlug}`}
              data={{
                "@context": "https://schema.org",
                "@type": "FAQPage",
                "mainEntity": faqs.map(faq => ({
                  "@type": "Question",
                  "name": faq.question,
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": faq.answer
                  }
                }))
              }}
            />
          </div>
        </LazySection>
      )}

      {initialData?.availableAreas && initialData.availableAreas.length > 0 && (
          <LocalitiesInterlinking 
            categoryName={category?.name || "Services"}
            categorySlug={categorySlug}
            citySlug={citySlug || "bangalore"}
            cityName={citySlug ? citySlug.charAt(0).toUpperCase() + citySlug.slice(1).replace(/-/g, ' ') : "Bangalore"}
            areas={initialData.availableAreas}
            currentAreaSlug={areaSlug}
          />
      )}

      {initialData?.availableCities && initialData.availableCities.length > 0 && (
          <CitiesInterlinking 
            categoryName={category?.name || "Services"}
            categorySlug={categorySlug}
            cities={initialData.availableCities}
          />
      )}
      
    </div>
  );
}
