'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  X,
  Armchair,
  Home,
} from 'lucide-react';

interface MarketplaceImageCarouselProps {
  photos: string[];
  alt: string;
  type?: 'furniture' | 'rental';
  aspectRatio?: string; // e.g. "aspect-[4/3]"
  className?: string;
  badge?: React.ReactNode;
  topRightBadge?: React.ReactNode;
  showFullscreenButton?: boolean;
  onImageClick?: (index: number) => void;
  onIndexChange?: (index: number) => void;
  clickOpensFullscreen?: boolean;
  initialIndex?: number;
}

export default function MarketplaceImageCarousel({
  photos = [],
  alt,
  type = 'furniture',
  aspectRatio = 'aspect-[4/3]',
  className = '',
  badge,
  topRightBadge,
  showFullscreenButton = true,
  onImageClick,
  onIndexChange,
  clickOpensFullscreen = false,
  initialIndex = 0,
}: MarketplaceImageCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // In-page carousel drag states
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // Fullscreen carousel drag states
  const [fsDragOffset, setFsDragOffset] = useState(0);
  const [fsIsDragging, setFsIsDragging] = useState(false);

  // Tracking refs for in-page carousel
  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartYRef = useRef(0);
  const dragOffsetRef = useRef(0);
  const wasDraggedRef = useRef(false);

  // Tracking refs for fullscreen carousel
  const fsIsDraggingRef = useRef(false);
  const fsDragStartXRef = useRef(0);
  const fsDragStartYRef = useRef(0);
  const fsDragOffsetRef = useRef(0);
  const fsWasDraggedRef = useRef(false);

  // Sync if initialIndex changes from parent
  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  const updateIndex = useCallback((newIndex: number) => {
    setCurrentIndex(newIndex);
    if (onIndexChange) {
      onIndexChange(newIndex);
    }
  }, [onIndexChange]);

  const validPhotos = Array.isArray(photos) ? photos.filter((p) => Boolean(p && typeof p === 'string')) : [];
  const total = validPhotos.length;
  const currentPhoto = total > 0 ? validPhotos[currentIndex] || validPhotos[0] : null;

  // Navigation handlers
  const goToPrev = useCallback((e?: React.MouseEvent | React.TouchEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (currentIndex > 0) {
      updateIndex(currentIndex - 1);
    }
  }, [currentIndex, updateIndex]);

  const goToNext = useCallback((e?: React.MouseEvent | React.TouchEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (currentIndex < total - 1) {
      updateIndex(currentIndex + 1);
    }
  }, [currentIndex, total, updateIndex]);

  // ==========================================
  // IN-PAGE CAROUSEL: TOUCH & MOUSE DRAG LOGIC
  // ==========================================

  // Desktop Mouse Drag
  const handleMouseDown = (e: React.MouseEvent) => {
    if (total <= 1 || e.button !== 0) return;
    isDraggingRef.current = true;
    wasDraggedRef.current = false;
    dragStartXRef.current = e.clientX;
    dragOffsetRef.current = 0;
    setIsDragging(true);
    setDragOffset(0);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const diff = e.clientX - dragStartXRef.current;
      if (Math.abs(diff) > 4) {
        wasDraggedRef.current = true;
      }
      // Damping at start / end boundaries
      let dampedDiff = diff;
      if ((currentIndex === 0 && diff > 0) || (currentIndex === total - 1 && diff < 0)) {
        dampedDiff = diff * 0.25;
      }
      dragOffsetRef.current = dampedDiff;
      setDragOffset(dampedDiff);
    };

    const handleMouseUp = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      setIsDragging(false);

      const offset = dragOffsetRef.current;
      const threshold = 35;

      if (offset < -threshold && currentIndex < total - 1) {
        updateIndex(currentIndex + 1);
      } else if (offset > threshold && currentIndex > 0) {
        updateIndex(currentIndex - 1);
      }
      setDragOffset(0);
      dragOffsetRef.current = 0;
      setTimeout(() => {
        wasDraggedRef.current = false;
      }, 50);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [currentIndex, total, updateIndex]);

  // Mobile Touch Slide
  const handleTouchStart = (e: React.TouchEvent) => {
    if (total <= 1) return;
    isDraggingRef.current = true;
    wasDraggedRef.current = false;
    dragStartXRef.current = e.touches[0].clientX;
    dragStartYRef.current = e.touches[0].clientY;
    dragOffsetRef.current = 0;
    setIsDragging(true);
    setDragOffset(0);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingRef.current) return;
    const diffX = e.touches[0].clientX - dragStartXRef.current;
    const diffY = e.touches[0].clientY - dragStartYRef.current;

    // If vertical scroll gesture dominates early, don't hijack
    if (Math.abs(diffY) > Math.abs(diffX) && Math.abs(diffX) < 10) {
      return;
    }

    if (Math.abs(diffX) > 4) {
      wasDraggedRef.current = true;
    }

    let dampedDiff = diffX;
    if ((currentIndex === 0 && diffX > 0) || (currentIndex === total - 1 && diffX < 0)) {
      dampedDiff = diffX * 0.25;
    }
    dragOffsetRef.current = dampedDiff;
    setDragOffset(dampedDiff);
  };

  const handleTouchEnd = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsDragging(false);

    const offset = dragOffsetRef.current;
    const threshold = 35;

    if (offset < -threshold && currentIndex < total - 1) {
      updateIndex(currentIndex + 1);
    } else if (offset > threshold && currentIndex > 0) {
      updateIndex(currentIndex - 1);
    }
    setDragOffset(0);
    dragOffsetRef.current = 0;
    setTimeout(() => {
      wasDraggedRef.current = false;
    }, 50);
  };

  const handleContainerClick = (e: React.MouseEvent) => {
    if (wasDraggedRef.current) {
      wasDraggedRef.current = false;
      return;
    }
    if (onImageClick) {
      onImageClick(currentIndex);
    } else if (clickOpensFullscreen && currentPhoto) {
      setIsFullscreen(true);
    }
  };

  const openFullscreen = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsFullscreen(true);
  };

  // ==========================================
  // FULLSCREEN LIGHTBOX: TOUCH & MOUSE DRAG
  // ==========================================

  const handleFsMouseDown = (e: React.MouseEvent) => {
    if (total <= 1 || e.button !== 0) return;
    fsIsDraggingRef.current = true;
    fsWasDraggedRef.current = false;
    fsDragStartXRef.current = e.clientX;
    fsDragOffsetRef.current = 0;
    setFsIsDragging(true);
    setFsDragOffset(0);
  };

  useEffect(() => {
    if (!isFullscreen) return;

    const handleFsMouseMove = (e: MouseEvent) => {
      if (!fsIsDraggingRef.current) return;
      const diff = e.clientX - fsDragStartXRef.current;
      if (Math.abs(diff) > 4) {
        fsWasDraggedRef.current = true;
      }
      let dampedDiff = diff;
      if ((currentIndex === 0 && diff > 0) || (currentIndex === total - 1 && diff < 0)) {
        dampedDiff = diff * 0.25;
      }
      fsDragOffsetRef.current = dampedDiff;
      setFsDragOffset(dampedDiff);
    };

    const handleFsMouseUp = () => {
      if (!fsIsDraggingRef.current) return;
      fsIsDraggingRef.current = false;
      setFsIsDragging(false);

      const offset = fsDragOffsetRef.current;
      const threshold = 40;

      if (offset < -threshold && currentIndex < total - 1) {
        updateIndex(currentIndex + 1);
      } else if (offset > threshold && currentIndex > 0) {
        updateIndex(currentIndex - 1);
      }
      setFsDragOffset(0);
      fsDragOffsetRef.current = 0;
      setTimeout(() => {
        fsWasDraggedRef.current = false;
      }, 50);
    };

    window.addEventListener('mousemove', handleFsMouseMove);
    window.addEventListener('mouseup', handleFsMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleFsMouseMove);
      window.removeEventListener('mouseup', handleFsMouseUp);
    };
  }, [isFullscreen, currentIndex, total, updateIndex]);

  const handleFsTouchStart = (e: React.TouchEvent) => {
    if (total <= 1) return;
    fsIsDraggingRef.current = true;
    fsWasDraggedRef.current = false;
    fsDragStartXRef.current = e.touches[0].clientX;
    fsDragStartYRef.current = e.touches[0].clientY;
    fsDragOffsetRef.current = 0;
    setFsIsDragging(true);
    setFsDragOffset(0);
  };

  const handleFsTouchMove = (e: React.TouchEvent) => {
    if (!fsIsDraggingRef.current) return;
    const diffX = e.touches[0].clientX - fsDragStartXRef.current;
    const diffY = e.touches[0].clientY - fsDragStartYRef.current;

    if (Math.abs(diffY) > Math.abs(diffX) && Math.abs(diffX) < 10) {
      return;
    }

    if (Math.abs(diffX) > 4) {
      fsWasDraggedRef.current = true;
    }

    let dampedDiff = diffX;
    if ((currentIndex === 0 && diffX > 0) || (currentIndex === total - 1 && diffX < 0)) {
      dampedDiff = diffX * 0.25;
    }
    fsDragOffsetRef.current = dampedDiff;
    setFsDragOffset(dampedDiff);
  };

  const handleFsTouchEnd = () => {
    if (!fsIsDraggingRef.current) return;
    fsIsDraggingRef.current = false;
    setFsIsDragging(false);

    const offset = fsDragOffsetRef.current;
    const threshold = 40;

    if (offset < -threshold && currentIndex < total - 1) {
      updateIndex(currentIndex + 1);
    } else if (offset > threshold && currentIndex > 0) {
      updateIndex(currentIndex - 1);
    }
    setFsDragOffset(0);
    fsDragOffsetRef.current = 0;
    setTimeout(() => {
      fsWasDraggedRef.current = false;
    }, 50);
  };

  // Keyboard navigation for fullscreen lightbox
  useEffect(() => {
    if (!isFullscreen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' && currentIndex < total - 1) {
        updateIndex(currentIndex + 1);
      } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
        updateIndex(currentIndex - 1);
      } else if (e.key === 'Escape') {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isFullscreen, currentIndex, total, updateIndex]);

  return (
    <>
      <div
        className={`relative overflow-hidden bg-gray-100 dark:bg-muted select-none group ${aspectRatio} ${className} ${
          total > 1 ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : ''
        }`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onClick={handleContainerClick}
        style={{ touchAction: total > 1 ? 'pan-y' : 'auto' }}
      >
        {/* Continuous Horizontal Sliding Track */}
        {total > 0 ? (
          <div
            className="flex w-full h-full will-change-transform"
            style={{
              transform: `translateX(calc(-${currentIndex * 100}% + ${dragOffset}px))`,
              transition: isDragging ? 'none' : 'transform 320ms cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            {validPhotos.map((photo, idx) => (
              <div key={idx} className="w-full h-full shrink-0 relative flex items-center justify-center">
                <img
                  src={photo}
                  alt={`${alt} - photo ${idx + 1}`}
                  draggable={false}
                  className="w-full h-full object-cover select-none pointer-events-none"
                  loading={idx === 0 ? 'eager' : 'lazy'}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
            {type === 'furniture' ? (
              <Armchair className="h-12 w-12 stroke-1" />
            ) : (
              <Home className="h-12 w-12 stroke-1" />
            )}
            <span className="text-[11px] mt-1 text-muted-foreground">No Photos</span>
          </div>
        )}

        {/* Badges Overlay */}
        {badge && <div className="absolute top-2.5 left-2.5 z-10 pointer-events-auto">{badge}</div>}
        {topRightBadge && <div className="absolute top-2.5 right-2.5 z-10 pointer-events-auto">{topRightBadge}</div>}

        {/* Directional Arrows:
            - Left arrow visible ONLY if images exist on left (currentIndex > 0)
            - Right arrow visible ONLY if images exist on right (currentIndex < total - 1)
        */}
        {total > 1 && currentIndex > 0 && (
          <button
            type="button"
            aria-label="Previous image"
            onClick={goToPrev}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-black/60 hover:bg-black/85 text-white flex items-center justify-center backdrop-blur-sm shadow-md transition-all active:scale-95 cursor-pointer pointer-events-auto"
          >
            <ChevronLeft className="h-5 w-5 stroke-[2.5]" />
          </button>
        )}

        {total > 1 && currentIndex < total - 1 && (
          <button
            type="button"
            aria-label="Next image"
            onClick={goToNext}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-black/60 hover:bg-black/85 text-white flex items-center justify-center backdrop-blur-sm shadow-md transition-all active:scale-95 cursor-pointer pointer-events-auto"
          >
            <ChevronRight className="h-5 w-5 stroke-[2.5]" />
          </button>
        )}

        {/* Controls Bar at Bottom */}
        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between z-20 pointer-events-none">
          {/* Photos Counter / Dots */}
          {total > 1 ? (
            <div className="flex items-center gap-1.5 bg-black/65 text-white text-[11px] font-semibold px-2.5 py-0.5 rounded-full backdrop-blur-sm pointer-events-auto shadow-sm">
              <span>{currentIndex + 1}</span>
              <span className="opacity-60">/</span>
              <span>{total}</span>
            </div>
          ) : (
            <div />
          )}

          {/* Full Screen Button at Bottom Right */}
          {showFullscreenButton && currentPhoto && (
            <button
              type="button"
              aria-label="View Full Screen Image"
              title="Full screen view"
              onClick={openFullscreen}
              className="p-1.5 rounded-lg bg-black/65 hover:bg-black/90 text-white backdrop-blur-sm shadow-md transition-all active:scale-90 pointer-events-auto flex items-center justify-center cursor-pointer"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Full Screen Lightbox Modal */}
      {isFullscreen && currentPhoto && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[100] bg-black/95 flex flex-col justify-between p-3 sm:p-6 backdrop-blur-md animate-in fade-in duration-200 select-none"
          onClick={() => setIsFullscreen(false)}
        >
          {/* Top Bar with Title, Counter and Close Button */}
          <div
            className="flex items-center justify-between text-white z-10 py-1"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <span className="text-sm sm:text-base font-bold truncate max-w-[200px] sm:max-w-md">
                {alt}
              </span>
              {total > 1 && (
                <span className="bg-white/20 text-xs px-2.5 py-0.5 rounded-full font-semibold">
                  {currentIndex + 1} / {total}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsFullscreen(false)}
              className="p-2 rounded-full bg-white/10 hover:bg-white/25 text-white transition-all cursor-pointer"
              title="Close Full Screen (Esc)"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Center Image Container with Sliding Track & Directional Arrows */}
          <div
            className="relative flex-1 flex items-center justify-center min-h-0 my-3 overflow-hidden w-full select-none"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={handleFsTouchStart}
            onTouchMove={handleFsTouchMove}
            onTouchEnd={handleFsTouchEnd}
            onMouseDown={handleFsMouseDown}
            style={{ touchAction: total > 1 ? 'pan-y' : 'auto' }}
          >
            {/* Left arrow if previous image is available */}
            {total > 1 && currentIndex > 0 && (
              <button
                type="button"
                onClick={goToPrev}
                aria-label="Previous photo"
                className="absolute left-2 sm:left-4 z-30 w-11 h-11 rounded-full bg-black/70 hover:bg-white/30 text-white flex items-center justify-center border border-white/20 transition-all cursor-pointer shadow-lg"
              >
                <ChevronLeft className="h-6 w-6 stroke-[3]" />
              </button>
            )}

            {/* Sliding Track in Fullscreen */}
            <div
              className={`flex h-full w-full items-center will-change-transform ${
                total > 1 ? (fsIsDragging ? 'cursor-grabbing' : 'cursor-grab') : ''
              }`}
              style={{
                transform: `translateX(calc(-${currentIndex * 100}% + ${fsDragOffset}px))`,
                transition: fsIsDragging ? 'none' : 'transform 320ms cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              {validPhotos.map((photo, idx) => (
                <div key={idx} className="w-full h-full shrink-0 flex items-center justify-center p-2">
                  <img
                    src={photo}
                    alt={`${alt} - Fullscreen ${idx + 1}`}
                    draggable={false}
                    className="max-h-full max-w-full object-contain rounded-xl shadow-2xl select-none pointer-events-none"
                  />
                </div>
              ))}
            </div>

            {/* Right arrow if next image is available */}
            {total > 1 && currentIndex < total - 1 && (
              <button
                type="button"
                onClick={goToNext}
                aria-label="Next photo"
                className="absolute right-2 sm:right-4 z-30 w-11 h-11 rounded-full bg-black/70 hover:bg-white/30 text-white flex items-center justify-center border border-white/20 transition-all cursor-pointer shadow-lg"
              >
                <ChevronRight className="h-6 w-6 stroke-[3]" />
              </button>
            )}
          </div>

          {/* Bottom Thumbnails Strip */}
          {total > 1 && (
            <div
              className="flex items-center justify-center gap-2 overflow-x-auto py-2 z-10"
              onClick={(e) => e.stopPropagation()}
            >
              {validPhotos.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => updateIndex(idx)}
                  className={`w-14 h-10 sm:w-16 sm:h-12 rounded-lg overflow-hidden border-2 shrink-0 transition-all cursor-pointer ${
                    currentIndex === idx
                      ? 'border-primary ring-2 ring-primary/50 opacity-100 scale-105'
                      : 'border-transparent opacity-60 hover:opacity-100'
                  }`}
                >
                  <img src={p} alt={`Thumb ${idx + 1}`} className="w-full h-full object-cover select-none pointer-events-none" draggable={false} />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
