"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, orderBy } from '@/lib/mysqlDb';
import type { FirestoreCity, FirestoreArea, FirestoreCategory } from '@/types/firestore';
import { Loader2, Tag, MapPin, ArrowRight, ChevronDown, ChevronUp, Search, X } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import Link from 'next/link';
import { useLoading } from '@/contexts/LoadingContext';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface CityWithAreas extends FirestoreCity {
  areas: FirestoreArea[];
}

interface ExploreByLocationProps {
  initialData?: CityWithAreas[];
  categories?: FirestoreCategory[];
}

const INITIAL_VISIBLE_COUNT = 8; // Shows clean 2-row layout in 4-column grid (or 4 rows on mobile)

export default function ExploreByLocation({ initialData, categories = [] }: ExploreByLocationProps) {
  const [citiesWithAreas, setCitiesWithAreas] = useState<CityWithAreas[]>(initialData || []);
  const [allCategories, setAllCategories] = useState<FirestoreCategory[]>(categories);
  const [isLoading, setIsLoading] = useState(!initialData || categories.length === 0);
  const [areaLimits, setAreaLimits] = useState<Record<string, number>>({});
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [openCityAccordion, setOpenCityAccordion] = useState<string | undefined>(undefined);

  const sectionRef = useRef<HTMLElement>(null);
  const { showLoading } = useLoading();
  const router = useRouter();

  useEffect(() => {
    if (initialData && categories.length > 0) return;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const promises: Promise<any>[] = [];
        
        if (!initialData) {
            promises.push(
                getDocs(query(collection(db, "cities"), where("isActive", "==", true), orderBy("name")))
                .then(async (citiesSnapshot) => {
                    const citiesData = citiesSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as FirestoreCity));
                    const enrichedCitiesPromises = citiesData.map(async (city) => {
                        const areasSnapshot = await getDocs(query(collection(db, "areas"), where("cityId", "==", city.id), where("isActive", "==", true), orderBy("name")));
                        const areasData = areasSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as FirestoreArea));
                        return { ...city, areas: areasData };
                    });
                    return await Promise.all(enrichedCitiesPromises);
                })
            );
        } else {
            promises.push(Promise.resolve(initialData));
        }

        if (categories.length === 0) {
            promises.push(
                getDocs(query(collection(db, "adminCategories"), where("isActive", "==", true), orderBy("order", "asc")))
                .then(snap => snap.docs.map(d => ({ ...d.data(), id: d.id } as FirestoreCategory)))
            );
        } else {
            promises.push(Promise.resolve(categories));
        }

        const [resolvedCitiesData, resolvedCategories] = await Promise.all(promises);
        setCitiesWithAreas(resolvedCitiesData);
        setAllCategories(resolvedCategories);

      } catch (error) {
        console.error("Error fetching locations/categories for SEO section:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [initialData, categories]);

  const handleNav = (e: React.MouseEvent, href: string) => {
    e.preventDefault();
    showLoading();
    router.push(href);
  };

  // Filter cities by search term if provided
  const filteredCities = useMemo(() => {
    if (!searchQuery.trim()) return citiesWithAreas;
    const q = searchQuery.toLowerCase().trim();
    return citiesWithAreas.filter(c => 
      c.name.toLowerCase().includes(q) || 
      c.slug.toLowerCase().includes(q)
    );
  }, [citiesWithAreas, searchQuery]);

  // Paginate visible cities based on expanded state or active search
  const visibleCities = useMemo(() => {
    if (isExpanded || searchQuery.trim()) {
      return filteredCities;
    }
    return filteredCities.slice(0, INITIAL_VISIBLE_COUNT);
  }, [filteredCities, isExpanded, searchQuery]);

  const toggleExpand = () => {
    if (isExpanded) {
      setIsExpanded(false);
      if (sectionRef.current) {
        sectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } else {
      setIsExpanded(true);
    }
  };
  
  if (isLoading) {
    return (
      <section className="py-8 md:py-10">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-headline font-semibold text-center mb-8 text-foreground">Explore Services Near You</h2>
          <div className="flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        </div>
      </section>
    );
  }

  if (citiesWithAreas.length === 0 || allCategories.length === 0) {
    return null; 
  }

  return (
    <section ref={sectionRef} className="py-12 md:py-16 bg-muted/30 overflow-x-hidden border-t scroll-mt-16">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-headline font-semibold text-foreground mb-3">
                Explore Services Near You
            </h2>
            <p className="text-muted-foreground text-sm md:text-base">Find verified professionals for every home need in your locality.</p>
        </div>

        {/* Quick Search Filter (shown when there are more than 8 cities) */}
        {citiesWithAreas.length > INITIAL_VISIBLE_COUNT && (
          <div className="max-w-md mx-auto mb-8">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search city (e.g. Abohar, Bengaluru, Mumbai)..."
                className="pl-10 pr-9 h-11 rounded-xl bg-card border-border/80 shadow-xs focus-visible:ring-primary/20 text-sm"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 transition-colors"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Side-by-Side Responsive Grid of Cities */}
        <div className="w-full max-w-6xl mx-auto">
          <Accordion 
            type="single" 
            collapsible 
            value={openCityAccordion} 
            onValueChange={setOpenCityAccordion}
            className="w-full"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-3.5 items-start">
              {visibleCities.map((city) => (
                <AccordionItem 
                  value={city.id} 
                  key={city.id} 
                  className="border border-border/70 bg-card hover:border-primary/40 rounded-xl px-3.5 md:px-4 overflow-hidden shadow-xs hover:shadow-md transition-all duration-200"
                >
                  <AccordionTrigger className="text-sm md:text-base font-semibold hover:no-underline py-3 text-foreground group">
                    <div className="flex items-center gap-2 min-w-0 pr-1.5 text-left">
                      <MapPin className="h-4 w-4 text-primary shrink-0 transition-transform group-hover:scale-110" />
                      <span className="truncate">In {city.name}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-4 pt-1">
                    
                    {/* 1. Direct Link to City Home Page */}
                    <div className="mb-3.5 pt-0.5">
                      <Link
                        href={`/${city.slug}`}
                        onClick={(e) => handleNav(e, `/${city.slug}`)}
                        className="w-full inline-flex items-center justify-between text-xs font-semibold text-primary hover:text-primary-foreground bg-primary/10 hover:bg-primary border border-primary/20 rounded-lg px-3 py-2 transition-all duration-200 group/link shadow-2xs"
                      >
                        <span className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5" />
                          Explore {city.name} City Page
                        </span>
                        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover/link:translate-x-1" />
                      </Link>
                    </div>

                    {/* 2. Category Tags for City */}
                    <div className="mb-4">
                      <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Tag className="h-3 w-3" /> Popular in {city.name}
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {allCategories.map(cat => (
                          <Link 
                            key={`${city.id}-${cat.id}`} 
                            href={`/${city.slug}/category/${cat.slug}`}
                            onClick={(e) => handleNav(e, `/${city.slug}/category/${cat.slug}`)}
                          >
                            <Badge 
                              variant="secondary" 
                              className="px-2.5 py-1 text-xs font-medium hover:bg-primary hover:text-white transition-all cursor-pointer"
                            >
                              {cat.name} in {city.name}
                            </Badge>
                          </Link>
                        ))}
                      </div>
                    </div>

                    {/* 3. Area Tags & Localities */}
                    {city.areas.length > 0 && (
                      <div>
                        <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                          Localities in {city.name} ({city.areas.length})
                        </h4>
                        <Accordion type="single" collapsible className="w-full">
                          {city.areas.slice(0, areaLimits[city.id] || 20).map(area => (
                            <AccordionItem key={area.id} value={area.id} className="border-none">
                              <AccordionTrigger className="text-xs font-medium py-1.5 hover:text-primary transition-colors text-muted-foreground hover:no-underline">
                                {area.name}
                              </AccordionTrigger>
                              <AccordionContent className="pt-1 pb-3">
                                <div className="flex flex-wrap gap-1">
                                  {allCategories
                                    .filter(cat => {
                                      const isPriority = ['carpentry', 'carpenter', 'tv-installation', 'tv installation', 'interior', 'interiors'].includes(cat.slug?.toLowerCase() || '') || 
                                                       ['carpentry', 'carpenter', 'tv installation', 'interior', 'interiors'].includes(cat.name?.toLowerCase() || '');
                                      return isPriority || allCategories.indexOf(cat) < 8;
                                    })
                                    .slice(0, 10)
                                    .map(cat => (
                                      <Link 
                                        key={`${area.id}-${cat.id}`} 
                                        href={`/${city.slug}/${area.slug}/${cat.slug}`}
                                        onClick={(e) => handleNav(e, `/${city.slug}/${area.slug}/${cat.slug}`)}
                                      >
                                        <Badge 
                                          variant="outline" 
                                          className="px-1.5 py-0.5 text-[10px] hover:border-primary hover:text-primary transition-all cursor-pointer"
                                        >
                                          {cat.name} in {area.name}
                                        </Badge>
                                      </Link>
                                    ))}
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          ))}
                        </Accordion>

                        {city.areas.length > (areaLimits[city.id] || 20) && (
                          <div className="mt-2 pt-2 border-t flex justify-center">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-7 text-xs text-primary hover:bg-primary/10"
                              onClick={() => setAreaLimits(prev => ({ ...prev, [city.id]: (prev[city.id] || 20) + 30 }))}
                            >
                              Load More Localities (+30)
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </div>
          </Accordion>

          {/* Empty Search State */}
          {visibleCities.length === 0 && (
            <div className="text-center py-8 bg-card/60 rounded-xl border border-dashed border-border p-6 max-w-md mx-auto">
              <MapPin className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-sm font-semibold text-foreground">No cities found matching &quot;{searchQuery}&quot;</p>
              <p className="text-xs text-muted-foreground mt-1">Try another city name or clear search.</p>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setSearchQuery('')}
                className="mt-3 text-xs h-8"
              >
                Clear Search
              </Button>
            </div>
          )}

          {/* Show More / Show Less Button */}
          {!searchQuery && filteredCities.length > INITIAL_VISIBLE_COUNT && (
            <div className="mt-8 flex justify-center">
              <Button
                variant="outline"
                onClick={toggleExpand}
                className="h-11 px-6 rounded-xl border-2 border-primary/20 hover:border-primary hover:bg-primary/5 text-foreground font-bold text-xs md:text-sm shadow-xs transition-all duration-300 flex items-center gap-2 group"
              >
                {isExpanded ? (
                  <>
                    <span>Show Less Cities</span>
                    <ChevronUp className="h-4 w-4 text-primary transition-transform group-hover:-translate-y-0.5" />
                  </>
                ) : (
                  <>
                    <span>Show More Cities ({filteredCities.length - INITIAL_VISIBLE_COUNT} More)</span>
                    <ChevronDown className="h-4 w-4 text-primary transition-transform group-hover:translate-y-0.5" />
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
