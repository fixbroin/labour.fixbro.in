"use client";

import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Search, Loader2, XCircle, UserCheck, Layers, Star, ArrowRight, Sparkles } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, addDoc, serverTimestamp } from '@/lib/mysqlDb';
import type { FirestoreCategory } from '@/types/firestore';
import Link from 'next/link';
import NextImage from 'next/image';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useLoading } from '@/contexts/LoadingContext';
import { useAuth } from '@/hooks/useAuth';
import { getGuestId } from '@/lib/guestIdManager';
import { logUserActivity } from '@/lib/activityLogger';
import { formatCurrency } from '@/lib/utils';
import { useApplicationConfig } from '@/hooks/useApplicationConfig';

export interface SearchProviderItem {
  id: string;
  fullName: string;
  slug: string;
  workCategoryName: string;
  seniorityLevel?: string;
  dailyWage?: number;
  profilePhotoUrl?: string;
  rating?: number;
  reviewCount?: number;
  status?: string;
  skills?: string[];
  location?: string;
}

interface SearchPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

const POPULAR_SUGGESTIONS = [
  "Carpentry",
  "Electrician",
  "Plumber",
  "Painting",
  "Aluminium Fabrication",
  "Daily Labour",
];

export default function SearchPopup({ isOpen, onClose }: SearchPopupProps) {
  const { config: appConfig } = useApplicationConfig();
  const symbol = appConfig?.currencySymbol || '₹';
  const decimals = appConfig?.currencyDecimalPoints !== undefined ? appConfig.currencyDecimalPoints : 0;
  const code = appConfig?.currencyCode || 'INR';

  const [searchTerm, setSearchTerm] = useState('');
  const [allCategories, setAllCategories] = useState<FirestoreCategory[]>([]);
  const [allProviders, setAllProviders] = useState<SearchProviderItem[]>([]);
  const [filteredCategories, setFilteredCategories] = useState<FirestoreCategory[]>([]);
  const [filteredProviders, setFilteredProviders] = useState<SearchProviderItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const { showLoading } = useLoading();
  const { user } = useAuth();

  const fetchSearchData = useCallback(async () => {
    if (!isOpen || hasFetched) return;

    setIsLoading(true);
    try {
      const catsRef = collection(db, "adminCategories");
      const provsRef = collection(db, "providerApplications");

      const [catsSnap, provsSnap] = await Promise.all([
        getDocs(query(catsRef, orderBy("name", "asc"))),
        getDocs(provsRef)
      ]);

      const catsData = catsSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as FirestoreCategory))
        .filter(c => c.isActive !== false);

      const provsData: SearchProviderItem[] = provsSnap.docs
        .map(doc => {
          const d = doc.data() as any;
          return {
            id: doc.id,
            fullName: d.fullName || '',
            slug: d.slug || (d.fullName ? d.fullName.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') : `provider-${doc.id.slice(0, 5)}`),
            workCategoryName: d.workCategoryName || d.categoryName || '',
            seniorityLevel: d.seniorityLevel || '',
            dailyWage: Number(d.dailyWage || d.desiredDailyRate || d.price || 0),
            profilePhotoUrl: d.profilePhotoUrl || d.photoUrl || '',
            rating: typeof d.rating === 'number' ? d.rating : 5,
            reviewCount: typeof d.reviewCount === 'number' ? d.reviewCount : 0,
            status: d.status || 'approved',
            skills: Array.isArray(d.skills) ? d.skills : [],
            location: d.currentCity || d.city || 'Bangalore',
          };
        })
        .filter(p => p.status === 'approved' && Boolean(p.fullName));

      setAllCategories(catsData);
      setAllProviders(provsData);
      setHasFetched(true);
    } catch (error) {
      console.error("Error fetching search data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [isOpen, hasFetched]);

  useEffect(() => {
    if (isOpen && !hasFetched) {
      fetchSearchData();
    }
    if (!isOpen) {
      setSearchTerm("");
      setFilteredCategories([]);
      setFilteredProviders([]);
    }
  }, [isOpen, hasFetched, fetchSearchData]);

  useEffect(() => {
    const handler = setTimeout(() => {
      const trimmed = searchTerm.trim().toLowerCase();
      if (!trimmed) {
        setFilteredCategories([]);
        setFilteredProviders([]);
        return;
      }

      if (trimmed.length > 2) {
        // Log search activity
        logUserActivity(
          'search',
          { searchQuery: trimmed },
          user?.uid,
          !user ? getGuestId() : null
        );

        // Persistent analytics logging
        try {
          addDoc(collection(db, "searchAnalytics"), {
            term: trimmed,
            createdAt: serverTimestamp(),
            userId: user?.uid || null,
            guestId: !user ? getGuestId() : null
          });
        } catch (e) {
          console.error("Error logging search analytics:", e);
        }
      }

      // Filter Categories
      const matchedCats = allCategories.filter(cat => {
        const name = (cat.name || '').toLowerCase();
        const slug = (cat.slug || '').toLowerCase();
        const desc = ((cat as any).description || cat.seo_description || '').toLowerCase();
        return name.includes(trimmed) || slug.includes(trimmed) || desc.includes(trimmed);
      });

      // Filter Providers
      const matchedProvs = allProviders.filter(prov => {
        const name = (prov.fullName || '').toLowerCase();
        const cat = (prov.workCategoryName || '').toLowerCase();
        const seniority = (prov.seniorityLevel || '').toLowerCase();
        const loc = (prov.location || '').toLowerCase();
        const skillsMatch = (prov.skills || []).some(s => s.toLowerCase().includes(trimmed));

        return (
          name.includes(trimmed) ||
          cat.includes(trimmed) ||
          seniority.includes(trimmed) ||
          loc.includes(trimmed) ||
          skillsMatch
        );
      });

      setFilteredCategories(matchedCats);
      setFilteredProviders(matchedProvs);
    }, 250);

    return () => clearTimeout(handler);
  }, [searchTerm, allCategories, allProviders, user]);

  const handleResultClick = () => {
    showLoading();
    onClose();
    setSearchTerm('');
  };

  const totalResults = filteredCategories.length + filteredProviders.length;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="w-[92%] sm:max-w-lg md:max-w-xl lg:max-w-2xl h-[88vh] max-h-[700px] flex flex-col p-0 rounded-2xl overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-4 sm:p-5 pb-3 border-b bg-card">
          <DialogTitle className="font-headline flex items-center text-lg font-bold">
            <Search className="mr-2 h-5 w-5 text-primary" /> Search Providers & Categories
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Find verified daily labour providers and trade categories quickly.
          </DialogDescription>
        </DialogHeader>

        {/* Input Bar */}
        <div className="p-3 sm:p-4 border-b bg-muted/20">
          <div className="relative">
            <Input
              id="search-popup-input"
              placeholder="e.g., Carpenter, Electrician, Plumber, Painter..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pr-10 h-11 text-sm sm:text-base rounded-xl bg-background"
              aria-label="Search providers or categories"
              autoFocus
            />
            {searchTerm ? (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 rounded-lg"
                onClick={() => setSearchTerm('')}
              >
                <XCircle className="h-5 w-5 text-muted-foreground hover:text-foreground" />
              </Button>
            ) : (
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            )}
          </div>

          {/* Popular Suggestions Chips (when no text is entered) */}
          {!searchTerm && (
            <div className="mt-3 flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1 mr-1">
                <Sparkles className="h-3 w-3 text-primary" /> Popular:
              </span>
              {POPULAR_SUGGESTIONS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setSearchTerm(tag)}
                  className="text-xs px-2.5 py-1 rounded-full bg-background border border-border/70 hover:bg-primary/10 hover:border-primary/40 hover:text-primary transition-colors font-medium"
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Results Area */}
        <div className="flex-grow overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-4 sm:p-5 space-y-5">
              {isLoading ? (
                <div className="flex flex-col justify-center items-center py-16 space-y-2">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-xs text-muted-foreground">Searching daily labour providers & categories...</p>
                </div>
              ) : searchTerm && totalResults === 0 ? (
                <div className="text-center py-16">
                  <XCircle className="mx-auto h-12 w-12 text-muted-foreground/60 mb-3" />
                  <p className="text-sm font-semibold text-foreground">No providers or categories found</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Try searching for &quot;Carpenter&quot;, &quot;Electrician&quot;, &quot;Plumber&quot;, or &quot;Painting&quot;.
                  </p>
                </div>
              ) : !searchTerm ? (
                <div className="text-center py-14 space-y-2">
                  <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-2">
                    <Search className="h-6 w-6" />
                  </div>
                  <p className="text-sm font-medium text-foreground">Type above to search for providers or categories</p>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    Search by provider name, trade specialty (Carpentry, Painting, Electrical), or specific skillset.
                  </p>
                </div>
              ) : (
                <>
                  {/* Matching Categories */}
                  {filteredCategories.length > 0 && (
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                          <Layers className="h-3.5 w-3.5 text-primary" /> Trade Categories ({filteredCategories.length})
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {filteredCategories.map((cat) => (
                          <Link
                            key={cat.id}
                            href={`/category/${cat.slug}`}
                            onClick={handleResultClick}
                            className="flex items-center gap-3 p-2.5 rounded-xl border border-border/60 hover:border-primary/40 hover:bg-accent/40 transition-all group"
                          >
                            <div className="relative w-11 h-11 rounded-lg overflow-hidden bg-primary/5 flex-shrink-0 border flex items-center justify-center">
                              {cat.imageUrl ? (
                                <NextImage
                                  src={cat.imageUrl}
                                  alt={cat.name}
                                  fill
                                  sizes="44px"
                                  className="object-cover"
                                />
                              ) : (
                                <Layers className="h-5 w-5 text-primary/70" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors truncate">
                                {cat.name}
                              </h4>
                              <p className="text-[11px] text-muted-foreground truncate">
                                View available daily workers
                              </p>
                            </div>
                            <ArrowRight className="h-4 w-4 text-muted-foreground/60 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Matching Providers */}
                  {filteredProviders.length > 0 && (
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                          <UserCheck className="h-3.5 w-3.5 text-emerald-600" /> Daily Labour Providers ({filteredProviders.length})
                        </span>
                      </div>
                      <div className="space-y-2">
                        {filteredProviders.map((prov) => (
                          <Link
                            key={prov.id}
                            href={`/provider/${prov.slug || prov.id}`}
                            onClick={handleResultClick}
                            className="flex items-center gap-3.5 p-3 rounded-xl border border-border/70 hover:border-primary/40 hover:bg-accent/40 transition-all group"
                          >
                            <Avatar className="h-12 w-12 rounded-xl border-2 border-primary/20 shrink-0">
                              <AvatarImage src={prov.profilePhotoUrl} alt={prov.fullName} className="object-cover" />
                              <AvatarFallback className="text-xs bg-primary/10 text-primary font-bold">
                                {prov.fullName.slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors truncate">
                                  {prov.fullName}
                                </h4>
                                {prov.workCategoryName && (
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-semibold bg-primary/5 text-primary border-primary/20">
                                    {prov.workCategoryName}
                                  </Badge>
                                )}
                                {prov.seniorityLevel && (
                                  <span className="text-[10px] text-muted-foreground capitalize font-medium">
                                    • {prov.seniorityLevel}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1 font-semibold text-amber-500">
                                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                                  {(prov.rating || 5).toFixed(1)}
                                </span>
                                {prov.location && (
                                  <span className="text-[11px] text-muted-foreground/80">
                                    • {prov.location}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              {prov.dailyWage && prov.dailyWage > 0 ? (
                                <div>
                                  <p className="font-bold text-primary text-sm">
                                    {formatCurrency(prov.dailyWage, symbol, decimals, code)}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground font-medium">/ full day</p>
                                </div>
                              ) : (
                                <Badge variant="secondary" className="text-[10px]">
                                  View Profile
                                </Badge>
                              )}
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
