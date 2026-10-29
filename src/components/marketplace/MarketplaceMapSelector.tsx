"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Loader2, Search, MapPin, CheckCircle, Navigation } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { MarketplaceLocation } from '@/types/marketplace';
import { useToast } from "@/hooks/use-toast";

interface MarketplaceMapSelectorProps {
  apiKey: string;
  onLocationSelect: (location: MarketplaceLocation) => void;
  onClose: () => void;
  initialCenter?: { lat: number; lng: number } | null;
  title?: string;
}

const DEFAULT_CENTER = { lat: 12.9716, lng: 77.5946 }; // Bangalore default
const DETAILED_ZOOM = 16;
const GOOGLE_MAPS_SCRIPT_ID = "fixbro-marketplace-google-maps-script";
const GOOGLE_MAPS_CALLBACK_NAME = `initMarketplaceMapCallback_${Math.random().toString(36).substring(2, 12)}`;

const MarketplaceMapSelector: React.FC<MarketplaceMapSelectorProps> = ({
  apiKey,
  onLocationSelect,
  onClose,
  initialCenter,
  title = "Select Your Location",
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const autocompleteInputRef = useRef<HTMLInputElement>(null);

  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLocating, setIsLocating] = useState(false);
  const [showPermissionDeniedDialog, setShowPermissionDeniedDialog] = useState(false);

  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const autocompleteInstanceRef = useRef<google.maps.places.Autocomplete | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);

  const placeChangedListenerRef = useRef<google.maps.MapsEventListener | null>(null);
  const mapClickListenerRef = useRef<google.maps.MapsEventListener | null>(null);
  const markerDragEndListenerRef = useRef<google.maps.MapsEventListener | null>(null);

  const [selectedLocation, setSelectedLocation] = useState<MarketplaceLocation | null>(null);
  const { toast } = useToast();

  const loadGoogleMapsScript = useCallback(() => {
    if (window.google?.maps?.places && window.google?.maps?.Geocoder) {
      setIsScriptLoaded(true);
      setIsLoading(false);
      return;
    }

    if (document.getElementById(GOOGLE_MAPS_SCRIPT_ID)) {
      if (!(window as any)[GOOGLE_MAPS_CALLBACK_NAME]) {
        (window as any)[GOOGLE_MAPS_CALLBACK_NAME] = () => {
          setIsScriptLoaded(true);
          setIsLoading(false);
        };
      }
      if (window.google?.maps?.places && window.google?.maps?.Geocoder) {
        setIsScriptLoaded(true);
        setIsLoading(false);
      }
      return;
    }

    setIsLoading(true);

    (window as any)[GOOGLE_MAPS_CALLBACK_NAME] = () => {
      setIsScriptLoaded(true);
      setIsLoading(false);
    };

    const script = document.createElement('script');
    script.id = GOOGLE_MAPS_SCRIPT_ID;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geocoding&callback=${GOOGLE_MAPS_CALLBACK_NAME}`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      console.error("MarketplaceMapSelector: Google Maps script failed to load.");
      setIsLoading(false);
    };

    document.head.appendChild(script);
  }, [apiKey]);

  useEffect(() => {
    if (apiKey) {
      loadGoogleMapsScript();
    } else {
      setIsLoading(false);
    }

    return () => {
      if (placeChangedListenerRef.current && autocompleteInstanceRef.current) {
        window.google?.maps?.event?.removeListener(placeChangedListenerRef.current);
      }
      if (mapClickListenerRef.current && mapInstanceRef.current) {
        window.google?.maps?.event?.removeListener(mapClickListenerRef.current);
      }
      if (markerDragEndListenerRef.current && markerRef.current) {
        window.google?.maps?.event?.removeListener(markerDragEndListenerRef.current);
      }
    };
  }, [apiKey, loadGoogleMapsScript]);

  const processAddressResult = useCallback((
    result: google.maps.places.PlaceResult | google.maps.GeocoderResult,
    latLng?: google.maps.LatLng | null,
    updateInput = true
  ) => {
    const components = result.address_components || [];
    let sublocality1 = '';
    let sublocality2 = '';
    let locality = '';
    let adminArea = '';
    let postalCode = '';
    let route = '';
    let streetNumber = '';

    for (const c of components) {
      if (c.types.includes('sublocality_level_1')) sublocality1 = c.long_name;
      if (c.types.includes('sublocality_level_2')) sublocality2 = c.long_name;
      if (c.types.includes('locality')) locality = c.long_name;
      if (c.types.includes('administrative_area_level_1')) adminArea = c.long_name;
      if (c.types.includes('postal_code')) postalCode = c.long_name;
      if (c.types.includes('route')) route = c.long_name;
      if (c.types.includes('street_number')) streetNumber = c.long_name;
    }

    const currentLatLng = latLng || result.geometry?.location;
    const finalArea = sublocality1 || sublocality2 || locality || adminArea || 'Nearby Area';
    const finalAddress = result.formatted_address || [streetNumber, route, sublocality1, locality].filter(Boolean).join(', ');

    const locationData: MarketplaceLocation = {
      latitude: currentLatLng ? currentLatLng.lat() : DEFAULT_CENTER.lat,
      longitude: currentLatLng ? currentLatLng.lng() : DEFAULT_CENTER.lng,
      address: finalAddress || 'Selected Location',
      area: finalArea,
      city: locality || adminArea || '',
      pincode: postalCode || '',
    };

    setSelectedLocation(locationData);

    if (updateInput && autocompleteInputRef.current && result.formatted_address) {
      autocompleteInputRef.current.value = result.formatted_address;
    }
  }, []);

  const updateMarker = useCallback((
    position: google.maps.LatLng | google.maps.LatLngLiteral,
    map: google.maps.Map,
    shouldGeocode = true,
    updateInput = true
  ) => {
    if (!markerRef.current) {
      markerRef.current = new window.google.maps.Marker({
        position,
        map,
        draggable: true,
        title: "Selected Location",
        animation: window.google.maps.Animation.DROP,
      });

      markerDragEndListenerRef.current = markerRef.current.addListener('dragend', (e: google.maps.MapMouseEvent) => {
        if (e.latLng && mapInstanceRef.current) {
          updateMarker(e.latLng, mapInstanceRef.current, true, true);
        }
      });
    } else {
      markerRef.current.setPosition(position);
    }

    if (shouldGeocode && geocoderRef.current) {
      geocoderRef.current.geocode({ location: position }, (results, status) => {
        if (status === 'OK' && results && results[0]) {
          const latLngObj = position instanceof window.google.maps.LatLng
            ? position
            : new window.google.maps.LatLng(position.lat, position.lng);
          processAddressResult(results[0], latLngObj, updateInput);
        }
      });
    }
  }, [processAddressResult]);

  const handleLocateMe = useCallback(() => {
    if (!navigator.geolocation) {
      toast({
        title: "Geolocation Not Supported",
        description: "Your browser does not support automatic location detection.",
        variant: "destructive",
      });
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const userPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setCenter(userPos);
          mapInstanceRef.current.setZoom(DETAILED_ZOOM);
          updateMarker(userPos, mapInstanceRef.current, true, true);
        }
        setIsLocating(false);
      },
      (err) => {
        setIsLocating(false);
        if (err.code === err.PERMISSION_DENIED) {
          setShowPermissionDeniedDialog(true);
        } else {
          toast({
            title: "Location Detection Failed",
            description: "Could not fetch current coordinates. Please search manually.",
            variant: "destructive",
          });
        }
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  }, [updateMarker, toast]);

  const initMap = useCallback(() => {
    if (!isScriptLoaded || !mapRef.current || !window.google?.maps) return;

    const centerPosition = initialCenter && typeof initialCenter.lat === 'number'
      ? initialCenter
      : DEFAULT_CENTER;

    const map = new window.google.maps.Map(mapRef.current, {
      center: centerPosition,
      zoom: initialCenter ? DETAILED_ZOOM : 12,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControlOptions: { position: window.google.maps.ControlPosition.RIGHT_BOTTOM },
      zoomControlOptions: { position: window.google.maps.ControlPosition.RIGHT_BOTTOM },
    });
    mapInstanceRef.current = map;
    geocoderRef.current = new window.google.maps.Geocoder();

    mapClickListenerRef.current = map.addListener('click', (e: google.maps.MapMouseEvent) => {
      if (e.latLng && mapInstanceRef.current) {
        updateMarker(e.latLng, mapInstanceRef.current, true, true);
      }
    });

    if (autocompleteInputRef.current) {
      const ac = new window.google.maps.places.Autocomplete(autocompleteInputRef.current, {
        componentRestrictions: { country: 'in' },
        fields: ["address_components", "geometry", "name", "formatted_address"],
      });
      autocompleteInstanceRef.current = ac;

      placeChangedListenerRef.current = ac.addListener('place_changed', () => {
        const place = ac.getPlace();
        if (place.geometry?.location && mapInstanceRef.current) {
          mapInstanceRef.current.setCenter(place.geometry.location);
          mapInstanceRef.current.setZoom(DETAILED_ZOOM);
          updateMarker(place.geometry.location, mapInstanceRef.current);
          processAddressResult(place, place.geometry.location, true);
        }
      });
    }

    // Floating Locate Me Button
    const locateMeBtn = document.createElement('button');
    locateMeBtn.type = 'button';
    locateMeBtn.title = "Locate Me";
    locateMeBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="2" x2="5" y1="12" y2="12"/><line x1="19" x2="22" y1="12" y2="12"/><line x1="12" x2="12" y1="2" y2="5"/><line x1="12" x2="12" y1="19" y2="22"/><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="3"/></svg>`;
    Object.assign(locateMeBtn.style, {
      backgroundColor: '#ffffff',
      border: '1px solid rgba(0,0,0,0.15)',
      borderRadius: '8px',
      boxShadow: '0 2px 8px rgba(0,0,0,.2)',
      cursor: 'pointer',
      padding: '8px',
      marginRight: '12px',
      marginBottom: '24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '40px',
      width: '40px',
    });
    locateMeBtn.onclick = handleLocateMe;
    map.controls[window.google.maps.ControlPosition.RIGHT_BOTTOM].push(locateMeBtn);

    updateMarker(centerPosition, map, true, false);
  }, [isScriptLoaded, initialCenter, handleLocateMe, updateMarker, processAddressResult]);

  useEffect(() => {
    initMap();
  }, [initMap]);

  const handleConfirm = () => {
    if (!selectedLocation) {
      toast({
        title: "Location Not Chosen",
        description: "Please search an area or click on the map to set your location pin.",
        variant: "destructive",
      });
      return;
    }
    onLocationSelect(selectedLocation);
    onClose();
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[350px]">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="mt-2 text-sm text-muted-foreground">Loading map...</p>
      </div>
    );
  }

  return (
    <>
      <div className="w-full h-full flex flex-col overflow-hidden bg-background">
        {/* Search header */}
        <div className="flex-shrink-0 p-3 sm:p-4 border-b bg-background z-10 space-y-2">
          <div className="relative">
            <Input
              id="marketplace-location-search"
              ref={autocompleteInputRef}
              type="text"
              placeholder="Search city, area, street, or landmark in India..."
              className="shadow-sm h-10 pr-10 rounded-xl"
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.preventDefault();
              }}
            />
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          </div>
        </div>

        {/* Interactive Map */}
        <div className="relative w-full flex-1 min-h-[180px]">
          <div ref={mapRef} className="w-full h-full" />
        </div>

        {/* Selected Area card & Actions */}
        <div className="flex-shrink-0 p-3 sm:p-4 border-t bg-background space-y-2.5 z-10">
          {selectedLocation ? (
            <div className="flex items-start gap-2.5 bg-blue-50/70 dark:bg-blue-950/30 p-2.5 rounded-xl border border-blue-200 dark:border-blue-900 text-xs sm:text-sm">
              <MapPin className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 dark:text-white truncate">
                  {selectedLocation.area || 'Selected Area'}
                </p>
                <p className="text-gray-500 dark:text-gray-400 text-xs truncate">
                  {selectedLocation.address}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center">
              Click or drag the pin on the map to set your location
            </p>
          )}

          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="w-1/3">
              Cancel
            </Button>
            <Button onClick={handleConfirm} className="w-2/3 bg-primary font-semibold flex items-center justify-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Confirm Location
            </Button>
          </div>
        </div>
      </div>

      <AlertDialog open={showPermissionDeniedDialog} onOpenChange={setShowPermissionDeniedDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Location Access Denied</AlertDialogTitle>
            <AlertDialogDescription className="text-sm py-2">
              Please search for your city or area manually in the search bar or click/drag the pin on the map.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogAction onClick={() => setShowPermissionDeniedDialog(false)}>
            Got it
          </AlertDialogAction>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default MarketplaceMapSelector;
