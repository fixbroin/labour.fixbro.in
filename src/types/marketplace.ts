export interface MarketplaceLocation {
  latitude: number;
  longitude: number;
  address: string;
  area: string;
  city?: string;
  pincode?: string;
  updatedAt?: any;
}

export type FurnitureCondition = 'brand_new' | 'used';

export type FurnitureCategory = 
  | 'beds'
  | 'wardrobes'
  | 'sofas'
  | 'tables'
  | 'chairs'
  | 'cupboards'
  | 'tv_units'
  | 'shelves'
  | 'dining_tables'
  | 'study_tables'
  | 'shoe_racks'
  | 'other';

export const FURNITURE_CATEGORIES: { id: FurnitureCategory; label: string; iconName?: string }[] = [
  { id: 'beds', label: 'Beds & Mattresses' },
  { id: 'wardrobes', label: 'Wardrobes & Closets' },
  { id: 'sofas', label: 'Sofas & Recliners' },
  { id: 'tables', label: 'Tables & Desks' },
  { id: 'chairs', label: 'Chairs & Stools' },
  { id: 'cupboards', label: 'Cupboards & Cabinets' },
  { id: 'tv_units', label: 'TV Units & Consoles' },
  { id: 'shelves', label: 'Shelves & Bookcases' },
  { id: 'dining_tables', label: 'Dining Tables & Sets' },
  { id: 'study_tables', label: 'Study & Office Desks' },
  { id: 'shoe_racks', label: 'Shoe Racks' },
  { id: 'other', label: 'Other Furniture' },
];

export type MarketplaceListingStatus = 'active' | 'expired' | 'sold' | 'rented' | 'removed';

export interface FurnitureListing {
  id: string;
  userId: string;
  userName: string;
  userPhone: string;
  userEmail?: string;
  listingType: FurnitureCondition;
  category: FurnitureCategory | string;
  title: string;
  description: string;
  photos: string[];
  hasDamage: boolean;
  damageDetails: string[];
  hasWarranty: boolean;
  warrantyDetails?: string;
  price: number;
  isNegotiable: boolean;
  address: string;
  area: string;
  latitude: number;
  longitude: number;
  status: MarketplaceListingStatus;
  createdAt: any;
  updatedAt?: any;
  expiresAt: any;
  viewCount?: number;
  callCount?: number;
  distanceKm?: number;
}

export type RentalPropertyType = 
  | '1rk'
  | '1bhk'
  | '2bhk'
  | '3bhk'
  | '4plus_bhk'
  | 'studio'
  | 'single_room'
  | 'shared_room'
  | 'independent_house'
  | 'villa';

export const RENTAL_PROPERTY_TYPES: { id: RentalPropertyType; label: string }[] = [
  { id: '1rk', label: '1 RK' },
  { id: '1bhk', label: '1 BHK' },
  { id: '2bhk', label: '2 BHK' },
  { id: '3bhk', label: '3 BHK' },
  { id: '4plus_bhk', label: '4+ BHK' },
  { id: 'studio', label: 'Studio Apartment' },
  { id: 'single_room', label: 'Single Room for Rent' },
  { id: 'shared_room', label: 'Shared Room' },
  { id: 'independent_house', label: 'Independent House' },
  { id: 'villa', label: 'Villa' },
];

export type FurnishingStatus = 'unfurnished' | 'semi_furnished' | 'fully_furnished';

export const FURNISHING_OPTIONS: { id: FurnishingStatus; label: string }[] = [
  { id: 'unfurnished', label: 'Unfurnished' },
  { id: 'semi_furnished', label: 'Semi-Furnished' },
  { id: 'fully_furnished', label: 'Fully Furnished' },
];

export type TenantPreference = 'family' | 'bachelors' | 'girls_only' | 'boys_only' | 'any';

export const TENANT_PREFERENCES: { id: TenantPreference; label: string }[] = [
  { id: 'any', label: 'Anyone (Family or Bachelors)' },
  { id: 'family', label: 'Family Only' },
  { id: 'bachelors', label: 'Bachelors Only' },
  { id: 'girls_only', label: 'Girls / Working Women Only' },
  { id: 'boys_only', label: 'Boys / Working Men Only' },
];

export type GasFacility = 'piped_gas' | 'cylinder' | 'none';

export const RENTAL_AMENITIES = [
  { id: 'carParking', label: 'Car Parking' },
  { id: 'bikeParking', label: 'Bike Parking' },
  { id: 'waterSupply', label: '24/7 Water Supply' },
  { id: 'powerBackup', label: 'Power Backup' },
  { id: 'lift', label: 'Elevator / Lift' },
  { id: 'gatedSecurity', label: 'Gated Security & Guard' },
  { id: 'cctv', label: 'CCTV Surveillance' },
  { id: 'wifi', label: 'High Speed WiFi' },
  { id: 'geyser', label: 'Geyser / Water Heater' },
  { id: 'ac', label: 'Air Conditioning (AC)' },
  { id: 'balcony', label: 'Balcony / Terrace' },
];

export const BILLS_INCLUDED_OPTIONS = [
  { id: 'electricity', label: 'Electricity Bill Included' },
  { id: 'water', label: 'Water Bill Included' },
  { id: 'maintenance', label: 'Maintenance Included' },
];

export interface RentalListing {
  id: string;
  userId: string;
  userName: string;
  userPhone: string;
  userEmail?: string;
  propertyType: RentalPropertyType;
  title: string;
  description: string;
  photos: string[];
  monthlyRent: number;
  deposit: number;
  bedrooms: number;
  bathrooms: number;
  furnishing: FurnishingStatus;
  amenities: string[];
  billsIncluded: string[];
  gasFacility: GasFacility;
  floor: string | number;
  totalFloors: string | number;
  availableFrom: string;
  tenantPreference: TenantPreference;
  address: string;
  area: string;
  latitude: number;
  longitude: number;
  status: MarketplaceListingStatus;
  createdAt: any;
  updatedAt?: any;
  expiresAt: any;
  viewCount?: number;
  callCount?: number;
  distanceKm?: number;
}

export interface MarketplaceSettings {
  expirationDays: number;
  safetyWarningTitle: string;
  safetyWarningText: string;
  safetyWarningPoints: string[];
  furnitureSeoTitle: string;
  furnitureSeoDescription: string;
  furnitureSeoKeywords?: string;
  furnitureCanonicalUrl?: string;
  furnitureOgImage?: string;
  rentalsSeoTitle: string;
  rentalsSeoDescription: string;
  rentalsSeoKeywords?: string;
  rentalsCanonicalUrl?: string;
  rentalsOgImage?: string;
  isFurnitureEnabled: boolean;
  isRentalsEnabled: boolean;
  showMarketplaceOnHomeServices?: boolean;
}

export const DEFAULT_MARKETPLACE_SETTINGS: MarketplaceSettings = {
  expirationDays: 30,
  safetyWarningTitle: 'Safety Warning – Avoid Advance Payment Scams',
  safetyWarningText: 'This is free public advertising. Anyone can post listings on this platform. Protect yourself from online frauds.',
  safetyWarningPoints: [
    'NEVER pay any advance money, booking fee, or token amount via UPI, QR code, or online before visiting.',
    'Always visit the location in person and physically inspect the furniture or property first.',
    'Verify identity and paperwork before making any payment.',
    'FixBro is a 100% free platform to connect buyers and sellers directly and is not responsible for any financial loss or transactions.'
  ],
  furnitureSeoTitle: 'Buy & Sell Used & New Furniture Online - Direct Phone Call ',
  furnitureSeoDescription: 'Browse brand new & second-hand furniture near you. Sofas, beds, wardrobes, dining tables & more. Direct call with owner. 100% free ad posting.',
  furnitureSeoKeywords: 'buy furniture near me, second hand furniture, used furniture for sale, sofa sets, beds, dining table, office chair, wardrobe, FixBro furniture',
  furnitureCanonicalUrl: 'https://fixbro.in/furniture',
  furnitureOgImage: '/default-image.png',
  rentalsSeoTitle: 'Rent a Home, Flats, Rooms & Apartments Near You ',
  rentalsSeoDescription: 'Find 1RK, 1BHK, 2BHK, 3BHK, single rooms, and houses for rent near your location. Zero brokerage, direct phone call with owner.',
  rentalsSeoKeywords: 'house for rent near me, flats for rent, 1bhk rent, 2bhk rent, room for rent, bachelor rooms, family apartment for rent, zero brokerage, FixBro rentals',
  rentalsCanonicalUrl: 'https://fixbro.in/rent-home',
  rentalsOgImage: '/default-image.png',
  isFurnitureEnabled: true,
  isRentalsEnabled: true,
  showMarketplaceOnHomeServices: true,
};

export interface MarketplaceCallLog {
  id?: string;
  listingType: 'furniture' | 'rental';
  listingId: string;
  listingTitle: string;
  sellerUserId: string;
  sellerName?: string;
  sellerPhone?: string;
  callerUserId: string;
  callerName: string;
  callerPhone: string;
  callerEmail?: string;
  callCount?: number;
  lastCalledAt?: string;
  createdAt: string;
}

