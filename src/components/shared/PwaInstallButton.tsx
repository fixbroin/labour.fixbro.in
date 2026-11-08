"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, X, Share, PlusSquare, Smartphone, Menu, ChevronDown, Compass, Chrome, Apple, Monitor, Laptop } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { usePathname } from 'next/navigation';
import AppImage from '@/components/ui/AppImage';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import type { AppDownloadSettings } from '@/types/firestore';
import { isWebView } from '@/lib/webview-bridge';

// Extend Event type to include PWA-specific properties
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: Array<string>;
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

const PwaInstallButton = () => {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isAppInstalled, setIsAppInstalled] = useState(false);
  const [showIosGuide, setShowIosInstruction] = useState(false);
  const [showDesktopStoreDialog, setShowDesktopStoreDialog] = useState(false);
  const [showDesktopPwaGuide, setShowDesktopPwaGuide] = useState(false);
  const [activeDesktopTab, setActiveDesktopTab] = useState<'windows' | 'mac'>('windows');
  const [isIos, setIsIos] = useState(false);
  const [isIosChrome, setIsIosChrome] = useState(false);
  const [activeIosTab, setActiveIosTab] = useState<'safari' | 'chrome'>('safari');
  const [isMinimized, setIsMinimized] = useState(true);
  const [downloadSettings, setDownloadSettings] = useState<AppDownloadSettings | null>(null);
  const [isInNativeApp, setIsInNativeApp] = useState(false);
  
  const isMobile = useIsMobile();
  const pathname = usePathname();
  const DISMISS_KEY = 'pwa_install_prompt_dismissed_v2';

  const isAdmin = pathname.startsWith('/admin');
  const isProvider = pathname.startsWith('/provider');

  // Determine which app we are installing
  const appInfo = {
    name: "Fixbro App",
    desc: "Faster booking & real-time updates"
  };

  if (isAdmin) {
    appInfo.name = "Fixbro Admin";
    appInfo.desc = "Manage orders & providers";
  } else if (isProvider) {
    appInfo.name = "Fixbro Provider";
    appInfo.desc = "Manage your jobs & earnings";
  }

  const targetAndroidUrl = isProvider 
    ? downloadSettings?.androidProviderUrl 
    : downloadSettings?.androidUserUrl;
  const targetIosUrl = isProvider 
    ? downloadSettings?.iosProviderUrl 
    : downloadSettings?.iosUserUrl;
  const hasAndroidApp = Boolean(targetAndroidUrl && targetAndroidUrl.trim() !== '');
  const hasIosApp = Boolean(targetIosUrl && targetIosUrl.trim() !== '');

  // 1. Fetch dynamic app download settings
  useEffect(() => {
    fetch('/api/app-download-settings', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.settings) {
          setDownloadSettings(data.settings);
        }
      })
      .catch((err) => console.error("Error fetching download settings:", err));
  }, []);

  // 2. Core initialization and event listener
  useEffect(() => {
    setIsMounted(true);
    
    // Check if dismissed before
    if (localStorage.getItem(DISMISS_KEY) === 'true') {
      setIsDismissed(true);
    }
    
    // Check standalone mode
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                        (window.navigator as any).standalone === true;
    if (isStandalone) setIsAppInstalled(true);

    // Check iOS / iPadOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isApple = /iphone|ipad|ipod/.test(userAgent) || (typeof navigator !== 'undefined' && navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIsIos(isApple);

    // Detect Chrome on iOS (CriOS)
    const isChromeOnIos = isApple && /crios/i.test(userAgent);
    setIsIosChrome(isChromeOnIos);
    setActiveIosTab(isChromeOnIos ? 'chrome' : 'safari');

    const isMacPlatform = /macintosh|mac os x/i.test(userAgent) && !isApple;
    if (isMacPlatform) {
      setActiveDesktopTab('mac');
    }

    // Pick up globally captured prompt if it already fired before this component mounted
    if (typeof window !== 'undefined' && (window as any).__deferredInstallPrompt) {
      setInstallPrompt((window as any).__deferredInstallPrompt);
    }

    const handlePromptAvailable = () => {
      if ((window as any).__deferredInstallPrompt) {
        setInstallPrompt((window as any).__deferredInstallPrompt);
      }
    };

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      (window as any).__deferredInstallPrompt = e;
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };

    // Check if running inside Flutter Native WebView
    if (isWebView()) {
      setIsInNativeApp(true);
    }
    const handleNativeReady = () => {
      setIsInNativeApp(true);
    };
    window.addEventListener('flutterNativeReady', handleNativeReady);

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('pwa-prompt-available', handlePromptAvailable);
    return () => {
      window.removeEventListener('flutterNativeReady', handleNativeReady);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('pwa-prompt-available', handlePromptAvailable);
    };
  }, []);

  // 3. Timer and Page visibility logic for the PWA prompt
  useEffect(() => {
    if (!isMounted || isAppInstalled || isDismissed) return;

    if (pathname === '/') {
      // Check if the home page banner was already shown in this session
      const bannerShownSession = sessionStorage.getItem('pwa_banner_shown_home');
      if (!bannerShownSession && (installPrompt || isIos || downloadSettings?.mode === 'native_stores')) {
        setIsMinimized(false);
        // Show for 3 to 4 seconds (3500ms), then minimize to floating button
        const timer = setTimeout(() => {
          setIsMinimized(true);
          sessionStorage.setItem('pwa_banner_shown_home', 'true');
        }, 3500);
        return () => clearTimeout(timer);
      } else {
        setIsMinimized(true);
      }
    } else {
      // On all other pages, directly keep it minimized (floating button)
      setIsMinimized(true);
    }
  }, [pathname, isMounted, isAppInstalled, isDismissed, installPrompt, isIos, downloadSettings?.mode]);

  const isDownloadsDisabled = !isAdmin && downloadSettings?.mode === 'disabled';
  const isNativeStoresMode = !isAdmin && downloadSettings?.mode === 'native_stores';

  const handleInstallClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // 1. If in Native Stores Mode (Customer or Provider)
    if (isNativeStoresMode && downloadSettings) {
      const userAgent = window.navigator.userAgent.toLowerCase();
      const isAndroid = /android/i.test(userAgent);
      const isApple = isIos;

      if (isAndroid && hasAndroidApp && targetAndroidUrl) {
        window.open(targetAndroidUrl, '_blank');
        return;
      }

      if (isApple) {
        if (hasIosApp && targetIosUrl) {
          window.open(targetIosUrl, '_blank');
          return;
        } else {
          // Smart Fallback: iOS app is not on the App Store yet.
          // Directly open the iOS PWA "Add to Home Screen" instructions!
          setShowIosInstruction(true);
          return;
        }
      }

      // If on desktop or specific mobile link missing, show desktop store dialog
      setShowDesktopStoreDialog(true);
      return;
    }

    // 2. Otherwise: PWA Mode (or Admin Panel)
    if (isIos && !isAppInstalled) {
        setShowIosInstruction(true);
        return;
    }

    if (!installPrompt) return;

    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsAppInstalled(true);
    }
    setInstallPrompt(null);
  };

  const handleDesktopPwaInstall = async () => {
    setShowDesktopStoreDialog(false);

    // Retrieve active prompt from state OR from global window
    const promptEvent = installPrompt || (typeof window !== 'undefined' ? (window as any).__deferredInstallPrompt : null);

    if (promptEvent) {
      try {
        await promptEvent.prompt();
        const { outcome } = await promptEvent.userChoice;
        if (outcome === 'accepted') {
          setIsAppInstalled(true);
        }
        setInstallPrompt(null);
        if (typeof window !== 'undefined') {
          (window as any).__deferredInstallPrompt = null;
        }
        return;
      } catch (err) {
        console.error("Desktop install prompt error:", err);
      }
    }

    // Only fallback to guidance if browser cannot directly trigger prompt (e.g. Safari on Mac)
    setShowDesktopPwaGuide(true);
  };
  
  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDismissed(true);
    localStorage.setItem(DISMISS_KEY, 'true');
  };

  if (!isMounted || isAppInstalled || isDismissed || isDownloadsDisabled || isInNativeApp || isWebView()) {
    return null;
  }

  // Only show if we have a prompt (Android/Chrome) OR if it's iOS OR if in Native Stores mode
  if (!isNativeStoresMode && !installPrompt && !isIos) {
      return null;
  }

  return (
    <>
      {isMobile ? (
        <>
            {/* LARGE BANNER (Initial State) */}
            <div 
                className={`fixed bottom-20 left-4 right-4 z-[100] transition-all duration-700 ease-in-out transform ${
                    isMinimized 
                    ? 'opacity-0 translate-y-20 pointer-events-none scale-50' 
                    : 'opacity-100 translate-y-0 scale-100'
                }`}
            >
                <div className="bg-card border-2 border-primary/20 shadow-2xl rounded-2xl p-4 flex items-center gap-4 relative">
                    <button 
                        onClick={handleDismiss}
                        className="absolute -top-2 -right-2 bg-muted text-muted-foreground rounded-full p-1 hover:bg-destructive hover:text-destructive-foreground transition-colors border"
                    >
                        <X size={14} />
                    </button>

                    <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 border">
                        <AppImage src="/pwa-192x192.png" alt="App Icon" width={40} height={40} className="rounded-lg shadow-sm" />
                    </div>

                    <div className="flex-grow min-w-0">
                        <h4 className="text-sm font-bold text-foreground">
                          {isNativeStoresMode && (!isIos || hasIosApp) ? `Download ${appInfo.name}` : `Install ${appInfo.name}`}
                        </h4>
                        <p className="text-[10px] text-muted-foreground line-clamp-1">{appInfo.desc}</p>
                    </div>

                    <Button size="sm" onClick={handleInstallClick} className="rounded-full px-5 font-bold shadow-lg shadow-primary/20">
                        {isNativeStoresMode && (!isIos || hasIosApp) ? "Download" : "Install"}
                    </Button>
                </div>
            </div>

            {/* MINIMIZED SIDE BADGE (Floating Button) */}
            <div 
                onClick={handleInstallClick}
                className={`fixed top-[40%] right-0 z-[100] transition-all duration-700 ease-in-out transform flex items-center bg-primary text-white shadow-2xl rounded-l-xl p-2 cursor-pointer ${
                    isMinimized 
                    ? 'opacity-100 translate-x-0' 
                    : 'opacity-0 translate-x-20 pointer-events-none'
                }`}
            >
                <div className="flex flex-col items-center gap-1">
                    <Download size={18} className="animate-bounce" />
                    <span className="text-[10px] font-bold uppercase tracking-tighter [writing-mode:vertical-lr] rotate-180">
                      {isNativeStoresMode && (!isIos || hasIosApp) ? "Get App" : "Install"}
                    </span>
                </div>
                
                <button 
                    onClick={(e) => {
                        e.stopPropagation();
                        handleDismiss(e);
                    }}
                    className="absolute -top-2 -left-2 bg-destructive text-white rounded-full p-0.5 border-2 border-white shadow-md"
                >
                    <X size={10} />
                </button>
            </div>
        </>
      ) : (
        /* DESKTOP FLOATING TAB UI */
        <div
          className="group fixed top-1/2 right-0 -translate-y-1/2 z-50 flex items-center bg-card border-y border-l border-primary/20 shadow-2xl rounded-l-2xl cursor-pointer transition-all duration-500 ease-out w-12 hover:w-48 h-16 overflow-hidden animate-pulse hover:animate-none"
          onClick={handleInstallClick}
        >
          <div className="flex items-center w-full h-full p-2.5">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center shrink-0 shadow-lg shadow-primary/30 group-hover:rotate-12 transition-transform">
                <Download className="h-5 w-5 text-white animate-bounce group-hover:animate-none" />
            </div>
            
            <div className="ml-3 transition-all duration-500 opacity-0 group-hover:opacity-100 whitespace-nowrap">
              <p className="text-[10px] font-bold uppercase tracking-widest text-primary">
                {isNativeStoresMode ? "Mobile Apps" : "Desktop App"}
              </p>
              <p className="text-xs font-bold text-foreground">
                {isNativeStoresMode ? `Get ${appInfo.name}` : `Install ${appInfo.name}`}
              </p>
            </div>
          </div>

          <button
              onClick={handleDismiss}
              className="absolute top-1 right-1 h-4 w-4 rounded-full bg-muted text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive hover:text-white flex items-center justify-center"
            >
              <X size={10} />
          </button>
        </div>
      )}

            {/* iOS Smart Installation Guide (Auto-adapts to Chrome vs Safari in PWA mode) */}
            <Dialog open={showIosGuide} onOpenChange={setShowIosInstruction}>
                <DialogContent className="max-w-[92vw] sm:max-w-md rounded-2xl p-5 sm:p-6">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
                            <Smartphone className="h-5 w-5 text-primary" />
                            Install {appInfo.name} on iPhone
                        </DialogTitle>
                        <DialogDescription className="text-left pt-1 text-xs sm:text-sm">
                            Follow the simple steps below for your current browser:
                        </DialogDescription>
                    </DialogHeader>

                    {!hasIosApp && isNativeStoresMode && (
                        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-2.5 text-xs text-amber-900 dark:text-amber-200 text-left mt-1 flex items-start gap-2">
                            <Apple className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                            <span><strong>Apple App Store app coming soon!</strong> In the meantime, you can add Fixbro to your iPhone home screen for the full app experience.</span>
                        </div>
                    )}

                    {/* Browser Switcher Pills */}
                    <div className="flex items-center bg-muted/70 p-1 rounded-xl gap-1 mt-2">
                        <button
                            type="button"
                            onClick={() => setActiveIosTab('safari')}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
                                activeIosTab === 'safari' 
                                ? 'bg-background text-primary shadow-sm' 
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            <Compass className="h-3.5 w-3.5" />
                            Apple Safari {!isIosChrome && <span className="text-[10px] opacity-75 font-normal">(Detected)</span>}
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveIosTab('chrome')}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
                                activeIosTab === 'chrome' 
                                ? 'bg-background text-primary shadow-sm' 
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            <Chrome className="h-3.5 w-3.5" />
                            Google Chrome {isIosChrome && <span className="text-[10px] opacity-75 font-normal">(Detected)</span>}
                        </button>
                    </div>
                    
                    {/* Safari Instructions */}
                    {activeIosTab === 'safari' && (
                        <div className="space-y-3 py-3">
                            <div className="flex items-start gap-3">
                                <div className="bg-primary/10 p-2 rounded-lg text-primary font-bold text-xs shrink-0 mt-0.5">1</div>
                                <p className="text-xs sm:text-sm text-left">
                                    Tap the <span className="font-bold inline-flex items-center bg-muted px-1.5 py-0.5 rounded gap-1"><Menu size={12} /> Menu</span> (three lines) inside the bottom address bar pill, then tap <span className="font-bold inline-flex items-center bg-muted px-1.5 py-0.5 rounded gap-1"><Share size={12} /> Share</span>.
                                    <span className="block text-[11px] text-muted-foreground mt-0.5">(Or tap the direct Share button if using classic toolbar)</span>
                                </p>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="bg-primary/10 p-2 rounded-lg text-primary font-bold text-xs shrink-0 mt-0.5">2</div>
                                <p className="text-xs sm:text-sm text-left">
                                    In the share sheet, tap <span className="font-bold inline-flex items-center bg-muted px-1.5 py-0.5 rounded gap-1"><ChevronDown size={12} /> View More</span>.
                                </p>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="bg-primary/10 p-2 rounded-lg text-primary font-bold text-xs shrink-0 mt-0.5">3</div>
                                <p className="text-xs sm:text-sm text-left">
                                    Scroll down and tap <span className="font-bold inline-flex items-center bg-muted px-1.5 py-0.5 rounded gap-1"><PlusSquare size={12} /> Add to Home Screen</span>.
                                </p>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="bg-primary/10 p-2 rounded-lg text-primary font-bold text-xs shrink-0 mt-0.5">4</div>
                                <p className="text-xs sm:text-sm text-left">
                                    Confirm title <span className="font-semibold text-primary">"{appInfo.name}"</span> and tap <span className="text-primary font-bold">Add</span> in the top right corner.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Chrome Instructions */}
                    {activeIosTab === 'chrome' && (
                        <div className="space-y-3 py-3">
                            <div className="flex items-start gap-3">
                                <div className="bg-primary/10 p-2 rounded-lg text-primary font-bold text-xs shrink-0 mt-0.5">1</div>
                                <p className="text-xs sm:text-sm text-left">
                                    Tap the <span className="font-bold inline-flex items-center bg-muted px-1.5 py-0.5 rounded gap-1"><Share size={12} /> Share</span> button in the top address bar (next to the website URL).
                                </p>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="bg-primary/10 p-2 rounded-lg text-primary font-bold text-xs shrink-0 mt-0.5">2</div>
                                <p className="text-xs sm:text-sm text-left">
                                    In the quick actions sheet, tap <span className="font-bold inline-flex items-center bg-muted px-1.5 py-0.5 rounded gap-1"><ChevronDown size={12} /> View More</span>.
                                </p>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="bg-primary/10 p-2 rounded-lg text-primary font-bold text-xs shrink-0 mt-0.5">3</div>
                                <p className="text-xs sm:text-sm text-left">
                                    Scroll down and tap <span className="font-bold inline-flex items-center bg-muted px-1.5 py-0.5 rounded gap-1"><PlusSquare size={12} /> Add to Home Screen</span>.
                                </p>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="bg-primary/10 p-2 rounded-lg text-primary font-bold text-xs shrink-0 mt-0.5">4</div>
                                <p className="text-xs sm:text-sm text-left">
                                    Ensure <span className="font-semibold">"Open as Web App"</span> is ON, confirm title <span className="font-semibold text-primary">"{appInfo.name}"</span>, and tap <span className="text-primary font-bold">Add</span> in the top right corner.
                                </p>
                            </div>
                        </div>
                    )}

                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 text-xs text-muted-foreground text-left mb-1">
                        🚀 <strong>Dedicated App:</strong> This saves a separate app icon on your home screen that opens directly into {pathname.startsWith('/admin') ? 'the Admin Panel' : pathname.startsWith('/provider') ? 'the Provider Dashboard' : 'Fixbro'}.
                    </div>

                    <DialogFooter>
                        <Button onClick={() => setShowIosInstruction(false)} className="w-full rounded-xl font-bold">Got it!</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Desktop / Multi-Store Selection Dialog (In Native Stores Mode) */}
            <Dialog open={showDesktopStoreDialog} onOpenChange={setShowDesktopStoreDialog}>
                <DialogContent className="max-w-[90vw] sm:max-w-sm rounded-2xl p-5 sm:p-6 text-center">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-black text-center text-foreground">
                            Download {appInfo.name}
                        </DialogTitle>
                        <DialogDescription className="text-center text-xs text-muted-foreground mt-1">
                            Available on Google Play and Apple App Store
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3 py-4">
                        {hasAndroidApp && (
                            <Button
                                onClick={() => {
                                    if (targetAndroidUrl) window.open(targetAndroidUrl, '_blank');
                                }}
                                variant="outline"
                                className="w-full flex items-center justify-center gap-3 h-12 rounded-xl border-2 hover:border-green-600 hover:bg-green-50/50 dark:hover:bg-green-950/20 shadow-xs"
                            >
                                <Smartphone className="h-5 w-5 text-green-600" />
                                <div className="text-left">
                                    <p className="text-[10px] text-muted-foreground font-semibold leading-none">GET IT ON</p>
                                    <p className="text-sm font-bold text-foreground leading-tight">Google Play</p>
                                </div>
                            </Button>
                        )}

                        {hasIosApp ? (
                            <Button
                                onClick={() => {
                                    if (targetIosUrl) window.open(targetIosUrl, '_blank');
                                }}
                                variant="outline"
                                className="w-full flex items-center justify-center gap-3 h-12 rounded-xl border-2 hover:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-900 shadow-xs"
                            >
                                <Apple className="h-5 w-5 text-foreground" />
                                <div className="text-left">
                                    <p className="text-[10px] text-muted-foreground font-semibold leading-none">Download on the</p>
                                    <p className="text-sm font-bold text-foreground leading-tight">App Store</p>
                                </div>
                            </Button>
                        ) : (
                            <div className="flex items-center justify-between p-3 rounded-xl border bg-muted/30 text-left">
                                <div className="flex items-center gap-2.5">
                                    <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                                      <Apple className="h-5 w-5 text-muted-foreground" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-1.5">
                                          <p className="text-xs font-bold text-foreground">Apple App Store</p>
                                          <span className="text-[9px] bg-primary/10 text-primary font-bold px-1.5 py-0.5 rounded">Coming Soon</span>
                                        </div>
                                        <p className="text-[10px] text-muted-foreground">iOS version in development</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 3rd Option: Desktop Web App (PWA) for PC / Mac */}
                        <div className="pt-3 border-t border-border/70 space-y-2">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-left px-0.5">
                                Or use on this computer
                            </p>
                            <Button
                                onClick={handleDesktopPwaInstall}
                                className="w-full flex items-center justify-between h-12 rounded-xl bg-gradient-to-r from-primary to-primary/90 text-primary-foreground font-bold shadow-md hover:opacity-95 px-3.5 transition-all"
                            >
                                <div className="flex items-center gap-2.5">
                                    <Monitor className="h-5 w-5 shrink-0" />
                                    <div className="text-left">
                                        <p className="text-[9px] uppercase font-bold opacity-80 leading-none">Windows PC & Mac</p>
                                        <p className="text-xs sm:text-sm font-bold leading-tight">Install Desktop App</p>
                                    </div>
                                </div>
                                <Download className="h-4 w-4 shrink-0 opacity-90" />
                            </Button>
                        </div>

                        {!hasAndroidApp && !hasIosApp && (
                            <p className="text-xs text-muted-foreground py-2">
                                Store download links are currently being configured. Please check back soon!
                            </p>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setShowDesktopStoreDialog(false)} className="w-full rounded-xl font-bold">
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
      </Dialog>

      {/* Desktop PWA Installation Guide (Windows / Mac) */}
      <Dialog open={showDesktopPwaGuide} onOpenChange={setShowDesktopPwaGuide}>
        <DialogContent className="max-w-[92vw] sm:max-w-md rounded-2xl p-5 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Monitor className="h-5 w-5 text-primary" />
              Install {appInfo.name} on Computer
            </DialogTitle>
            <DialogDescription className="text-left pt-1 text-xs sm:text-sm">
              Follow the quick steps below for your operating system:
            </DialogDescription>
          </DialogHeader>

          {/* OS Switcher Pills */}
          <div className="flex items-center bg-muted/70 p-1 rounded-xl gap-1 mt-2">
            <button
              type="button"
              onClick={() => setActiveDesktopTab('windows')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
                activeDesktopTab === 'windows' 
                ? 'bg-background text-primary shadow-sm' 
                : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Laptop className="h-3.5 w-3.5" />
              Windows (Chrome / Edge)
            </button>
            <button
              type="button"
              onClick={() => setActiveDesktopTab('mac')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
                activeDesktopTab === 'mac' 
                ? 'bg-background text-primary shadow-sm' 
                : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Apple className="h-3.5 w-3.5" />
              Mac (Safari / Chrome)
            </button>
          </div>

          {/* Windows / Chrome / Edge Instructions */}
          {activeDesktopTab === 'windows' && (
            <div className="space-y-3 py-3">
              <div className="flex items-start gap-3">
                <div className="bg-primary/10 p-2 rounded-lg text-primary font-bold text-xs shrink-0 mt-0.5">1</div>
                <p className="text-xs sm:text-sm text-left">
                  Look at the right side of your browser's top address bar.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="bg-primary/10 p-2 rounded-lg text-primary font-bold text-xs shrink-0 mt-0.5">2</div>
                <p className="text-xs sm:text-sm text-left">
                  Click the <span className="font-bold inline-flex items-center bg-muted px-1.5 py-0.5 rounded gap-1"><Download size={12} /> Install App</span> or <span className="font-bold inline-flex items-center bg-muted px-1.5 py-0.5 rounded gap-1"><Monitor size={12} /> Desktop</span> icon.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="bg-primary/10 p-2 rounded-lg text-primary font-bold text-xs shrink-0 mt-0.5">3</div>
                <p className="text-xs sm:text-sm text-left">
                  Click <span className="text-primary font-bold">Install</span>. Fixbro will launch in its own desktop window with a desktop shortcut icon!
                </p>
              </div>
            </div>
          )}

          {/* Mac Instructions */}
          {activeDesktopTab === 'mac' && (
            <div className="space-y-3 py-3">
              <div className="flex items-start gap-3">
                <div className="bg-primary/10 p-2 rounded-lg text-primary font-bold text-xs shrink-0 mt-0.5">1</div>
                <p className="text-xs sm:text-sm text-left">
                  In <strong>Apple Safari</strong>: Click <span className="font-bold bg-muted px-1.5 py-0.5 rounded">File</span> in the top menu bar, then click <span className="font-bold text-primary bg-muted px-1.5 py-0.5 rounded">Add to Dock</span>.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="bg-primary/10 p-2 rounded-lg text-primary font-bold text-xs shrink-0 mt-0.5">2</div>
                <p className="text-xs sm:text-sm text-left">
                  In <strong>Google Chrome</strong>: Click the install icon in the top address bar or open the 3 dots menu <span className="font-bold bg-muted px-1.5 py-0.5 rounded">⋮</span> &gt; <span className="font-bold bg-muted px-1.5 py-0.5 rounded">Save and Share</span> &gt; <span className="font-bold text-primary bg-muted px-1.5 py-0.5 rounded">Install Fixbro</span>.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="bg-primary/10 p-2 rounded-lg text-primary font-bold text-xs shrink-0 mt-0.5">3</div>
                <p className="text-xs sm:text-sm text-left">
                  Fixbro is now added to your Mac Dock and Launchpad as a dedicated app!
                </p>
              </div>
            </div>
          )}

          <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 text-xs text-muted-foreground text-left mb-1">
            💻 <strong>Desktop App:</strong> Runs cleanly with instant startup, full screen, and desktop notifications.
          </div>

          <DialogFooter>
            <Button onClick={() => setShowDesktopPwaGuide(false)} className="w-full rounded-xl font-bold">
              Got it!
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PwaInstallButton;
