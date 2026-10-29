"use client";

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Home, Layers, Briefcase, UserCircle as UserIcon, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useLoading } from '@/contexts/LoadingContext';
import { useMarketplaceSettings } from '@/hooks/useMarketplaceSettings';
import type { ElementType } from 'react';

interface NavItem {
  href: string;
  label: string;
  icon: ElementType;
  isProtected: boolean;
}

const BottomNavigationBar = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { user, triggerAuthRedirect } = useAuth();
  const { showLoading } = useLoading();
  const { settings } = useMarketplaceSettings();

  const showSellButton = settings.showMarketplaceOnHomeServices !== false;

  const handleNav = (e: React.MouseEvent<HTMLAnchorElement>, item: NavItem) => {
    e.preventDefault();
    if (pathname !== item.href) {
      showLoading();
    }
    if (item.isProtected && !user) {
      triggerAuthRedirect(item.href);
    } else {
      router.push(item.href);
    }
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 md:hidden bg-background/95 backdrop-blur-lg border-t border-border/50 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-40 pb-safe">
      <div className="container mx-auto flex justify-around items-center h-16 px-2">
        {/* 1. Home */}
        <Link
          href="/"
          onClick={(e) => handleNav(e, { href: '/', label: 'Home', icon: Home, isProtected: false })}
          className={cn(
            "flex flex-col items-center justify-center min-w-[56px] h-14 rounded-2xl transition-all duration-300",
            pathname === '/' 
              ? "bg-primary/10 text-primary" 
              : "text-muted-foreground active:bg-muted active:scale-95"
          )}
        >
          <div className={cn("p-1.5 rounded-xl transition-transform duration-300", pathname === '/' ? "scale-110" : "")}>
            <Home className="h-5 w-5" strokeWidth={pathname === '/' ? 2.5 : 2} />
          </div>
          <span className={cn(
            "text-[10px] font-bold uppercase tracking-tighter mt-0.5",
            pathname === '/' ? "opacity-100" : "opacity-80"
          )}>
            Home
          </span>
        </Link>

        {/* 2. Categories */}
        <Link
          href="/categories"
          onClick={(e) => handleNav(e, { href: '/categories', label: 'Categories', icon: Layers, isProtected: true })}
          className={cn(
            "flex flex-col items-center justify-center min-w-[56px] h-14 rounded-2xl transition-all duration-300",
            pathname === '/categories' 
              ? "bg-primary/10 text-primary" 
              : "text-muted-foreground active:bg-muted active:scale-95"
          )}
        >
          <div className={cn("p-1.5 rounded-xl transition-transform duration-300", pathname === '/categories' ? "scale-110" : "")}>
            <Layers className="h-5 w-5" strokeWidth={pathname === '/categories' ? 2.5 : 2} />
          </div>
          <span className={cn(
            "text-[10px] font-bold uppercase tracking-tighter mt-0.5",
            pathname === '/categories' ? "opacity-100" : "opacity-80"
          )}>
            Categories
          </span>
        </Link>

        {/* 3. Central Elevated SELL Button (Replaces Referral, Navigates to Buy & Sell Page) */}
        {showSellButton && (
          <Link
            href="/furniture"
            onClick={() => {
              if (pathname !== '/furniture') showLoading();
            }}
            className="flex flex-col items-center justify-center min-w-[56px] -mt-5 transition-all group"
          >
            <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-primary to-blue-600 text-white shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center border-4 border-background focus:outline-none">
              <Plus className="h-6 w-6 stroke-[3]" />
            </div>
            <span className="text-[10px] font-bold text-primary mt-0.5 tracking-tight uppercase">
              Sell
            </span>
          </Link>
        )}

        {/* 4. Bookings */}
        <Link
          href="/my-bookings"
          onClick={(e) => handleNav(e, { href: '/my-bookings', label: 'Bookings', icon: Briefcase, isProtected: true })}
          className={cn(
            "flex flex-col items-center justify-center min-w-[56px] h-14 rounded-2xl transition-all duration-300",
            pathname === '/my-bookings' 
              ? "bg-primary/10 text-primary" 
              : "text-muted-foreground active:bg-muted active:scale-95"
          )}
        >
          <div className={cn("p-1.5 rounded-xl transition-transform duration-300", pathname === '/my-bookings' ? "scale-110" : "")}>
            <Briefcase className="h-5 w-5" strokeWidth={pathname === '/my-bookings' ? 2.5 : 2} />
          </div>
          <span className={cn(
            "text-[10px] font-bold uppercase tracking-tighter mt-0.5",
            pathname === '/my-bookings' ? "opacity-100" : "opacity-80"
          )}>
            Bookings
          </span>
        </Link>

        {/* 5. Profile */}
        <Link
          href="/account"
          onClick={(e) => handleNav(e, { href: '/account', label: 'Profile', icon: UserIcon, isProtected: true })}
          className={cn(
            "flex flex-col items-center justify-center min-w-[56px] h-14 rounded-2xl transition-all duration-300",
            pathname === '/account' 
              ? "bg-primary/10 text-primary" 
              : "text-muted-foreground active:bg-muted active:scale-95"
          )}
        >
          <div className={cn("p-1.5 rounded-xl transition-transform duration-300", pathname === '/account' ? "scale-110" : "")}>
            <UserIcon className="h-5 w-5" strokeWidth={pathname === '/account' ? 2.5 : 2} />
          </div>
          <span className={cn(
            "text-[10px] font-bold uppercase tracking-tighter mt-0.5",
            pathname === '/account' ? "opacity-100" : "opacity-80"
          )}>
            Profile
          </span>
        </Link>
      </div>
    </nav>
  );
};

export default BottomNavigationBar;
