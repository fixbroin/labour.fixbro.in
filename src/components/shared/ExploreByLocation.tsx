"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, orderBy } from '@/lib/mysqlDb';
import type { FirestoreCity, FirestoreArea, FirestoreCategory } from '@/types/firestore';
import { Loader2, Tag, MapPin, ArrowRight, ChevronDown, ChevronUp, Search, X } from 'lucide-react';
import Link from 'next/link';
import { useLoading } from '@/contexts/LoadingContext';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface CityWithAreas extends FirestoreCity {
  areas: FirestoreArea[];
}

interface ExploreByLocationProps {
  initialData?: CityWithAreas[];
  categories?: FirestoreCategory[];
}

const INITIAL_VISIBLE_COUNT = 10;

export default function ExploreByLocation({ initialData, categories = [] }: ExploreByLocationProps) {
  const [citiesWithAreas, setCitiesWithAreas] = useState<CityWithAreas[]>(initialData || []);
  const [allCategories, setAllCategories] = useState<FirestoreCategory[]>(categories);
  const [isLoading, setIsLoading] = useState(!initialData || categories.length === 0);
  const [areaLimits, setAreaLimits] = useState<Record<string, number>>({});
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCityId, setActiveCityId] = useState<string | null>(null);

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

  // Filter cities by search term
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

  // Currently active selected city
  const activeCity = useMemo(() => {
    if (!activeCityId) return null;
    return citiesWithAreas.find(c => c.id === activeCityId) || null;
  }, [citiesWithAreas, activeCityId]);

  const handleCityToggle = (cityId: string) => {
    setActiveCityId(prev => (prev === cityId ? null : cityId));
  };

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
        {/* Section Header */}
        <div className="max-w-4xl mx-auto text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-headline font-semibold text-foreground mb-3">
                Explore Services Near You
            </h2>
            <p className="text-muted-foreground text-sm md:text-base">Find verified professionals for every home need in your locality.</p>
        </div>

        {/* Quick Search Filter (shown when there are more than 8 cities) */}
        {citiesWithAreas.length > 8 && (
          <div className="max-w-md mx-auto mb-8">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search city (e.g. Abohar, Bengaluru, Mysuru)..."
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

        {/* Centered Side-by-Side City Buttons */}
        <div className="w-full max-w-5xl mx-auto">
          <div className="flex flex-wrap justify-center items-center gap-2.5 sm:gap-3">
            {visibleCities.map((city) => {
              const isActive = activeCityId === city.id;
              return (
                <button
                  key={city.id}
                  type="button"
                  onClick={() => handleCityToggle(city.id)}
                  className={cn(
                    "h-11 px-4 sm:px-5 rounded-xl border text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all duration-200 cursor-pointer shadow-2xs select-none",
                    isActive
                      ? "bg-primary text-primary-foreground border-primary shadow-sm ring-2 ring-primary/20 scale-[1.02]"
                      : "bg-card text-foreground border-border/80 hover:border-primary/50 hover:bg-card/90 hover:scale-[1.01]"
                  )}
                  aria-expanded={isActive}
                >
                  <MapPin className={cn("h-4 w-4 shrink-0 transition-colors", isActive ? "text-primary-foreground" : "text-primary")} />
                  <span>In {city.name}</span>
                  <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform duration-200 opacity-70", isActive && "rotate-180 opacity-100")} />
                </button>
              );
            })}
          </div>

          {/* Empty Search State */}
          {visibleCities.length === 0 && (
            <div className="text-center py-8 bg-card/60 rounded-xl border border-dashed border-border p-6 max-w-md mx-auto mt-4">
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

          {/* Expanded City Details Showcase Panel (Opens directly below centered buttons) */}
          {activeCity && (
            <div className="w-full max-w-4xl mx-auto mt-6 bg-card border border-border/80 rounded-2xl p-5 md:p-7 shadow-md animate-in fade-in-50 slide-in-from-top-3 duration-300">
              {/* Panel Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border/60">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0 shadow-2xs">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-foreground">
                      Services in {activeCity.name}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Find verified professionals and home services across {activeCity.name}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                  {/* Direct Link to City-wise Home Page */}
                  <Link
                    href={`/${activeCity.slug}`}
                    onClick={(e) => handleNav(e, `/${activeCity.slug}`)}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:text-white bg-primary/10 hover:bg-primary border border-primary/20 rounded-xl px-3.5 py-2 transition-all duration-200 shadow-2xs group"
                  >
                    <span>Explore {activeCity.name} City Page</span>
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                  </Link>

                  {/* Close Button */}
                  <button
                    type="button"
                    onClick={() => setActiveCityId(null)}
                    className="h-8 w-8 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors"
                    aria-label="Close details"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Popular Categories in the Selected City */}
              <div className="pt-5 pb-2">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5 text-primary" /> Popular Services in {activeCity.name}
                </h4>
                <div className="flex flex-wrap gap-2 md:gap-2.5">
                  {allCategories.map(cat => (
                    <Link 
                      key={`${activeCity.id}-${cat.id}`} 
                      href={`/${activeCity.slug}/category/${cat.slug}`}
                      onClick={(e) => handleNav(e, `/${activeCity.slug}/category/${cat.slug}`)}
                    >
                      <Badge 
                        variant="secondary" 
                        className="px-3.5 py-1.5 text-xs sm:text-sm font-medium hover:bg-primary hover:text-white transition-all cursor-pointer shadow-2xs hover:scale-105 active:scale-95"
                      >
                        {cat.name} in {activeCity.name}
                      </Badge>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Localities in Selected City (if any) */}
              {activeCity.areas.length > 0 && (
                <div className="mt-5 pt-5 border-t border-border/60">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-primary" /> Localities & Areas in {activeCity.name} ({activeCity.areas.length})
                  </h4>
                  <div className="flex flex-wrap gap-1.5 sm:gap-2">
                    {activeCity.areas.slice(0, areaLimits[activeCity.id] || 30).map(area => (
                      <Link
                        key={area.id}
                        href={`/${activeCity.slug}/${area.slug}`}
                        onClick={(e) => handleNav(e, `/${activeCity.slug}/${area.slug}`)}
                      >
                        <Badge 
                          variant="outline" 
                          className="px-2.5 py-1 text-xs hover:border-primary hover:text-primary hover:bg-primary/5 transition-all cursor-pointer"
                        >
                          {area.name}
                        </Badge>
                      </Link>
                    ))}
                  </div>
                  {activeCity.areas.length > (areaLimits[activeCity.id] || 30) && (
                    <div className="mt-3 flex justify-start">
                      <button
                        type="button"
                        onClick={() => setAreaLimits(prev => ({ ...prev, [activeCity.id]: (prev[activeCity.id] || 30) + 50 }))}
                        className="text-xs text-primary font-bold hover:underline"
                      >
                        +{activeCity.areas.length - (areaLimits[activeCity.id] || 30)} more localities
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Show More / Show Less Button */}
          {!searchQuery && filteredCities.length > INITIAL_VISIBLE_COUNT && (
            <div className="mt-8 flex justify-center">
              <Button
                variant="outline"
                onClick={toggleExpand}
                className="h-11 px-6 rounded-xl border-2 border-primary/20 hover:border-primary hover:bg-primary/5 text-foreground font-bold text-xs sm:text-sm shadow-xs transition-all duration-300 flex items-center gap-2 group"
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
