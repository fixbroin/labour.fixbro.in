"use client";

import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Image as ImageIcon,
  Search,
  Upload,
  RefreshCw,
  Loader2,
  Sparkles,
  FolderTree,
  Layers,
  Wrench,
  Tv,
  Settings2,
  Eye,
  CheckCircle2,
  ChevronRight,
  FileText,
  Megaphone,
  Bell,
  Copy,
  Check,
  Trash2,
  ExternalLink,
  Share2,
  Plus,
  Users,
  UserCheck,
  ShieldCheck,
  FileCheck,
  FileSignature,
  Landmark,
  HardDrive,
  Filter,
  X,
  FileImage,
  FolderOpen,
  Mail,
  Phone,
} from "lucide-react";
import Image from 'next/image';
import { useToast } from "@/hooks/use-toast";
import PermissionGuard from '@/components/admin/PermissionGuard';
import { cn } from "@/lib/utils";
import { db, auth } from '@/lib/firebase';
import { collection, getDocs, doc, getDoc, updateDoc, setDoc, addDoc, deleteDoc, query, orderBy, Timestamp } from '@/lib/mysqlDb';
import { triggerRefresh } from '@/lib/revalidateUtils';
import { compressImage } from '@/lib/imageCompressor';
import { deleteObject } from '@/lib/mysqlStorage';
import type { HomepageAd } from '@/types/firestore';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  listAllServerImagesAction,
  deleteServerImageAction,
  updateProviderImageFieldAction,
  type ServerImageFile,
} from "@/app/actions/serverMediaActions";

export interface ProviderGalleryImageItem {
  key: string;
  providerId: string;
  providerName: string;
  providerEmail?: string;
  providerMobile?: string;
  providerStatus?: string;
  imageType: 'profile' | 'aadhaar_front' | 'aadhaar_back' | 'pan_front' | 'pan_back' | 'additional_doc' | 'signature' | 'cancelled_cheque';
  title: string;
  fieldPath: string;
  imageUrl: string;
  uploadFolder: string;
}

export interface ProviderGalleryGroup {
  providerId: string;
  providerName: string;
  providerEmail?: string;
  providerMobile?: string;
  primaryCategory?: string;
  status: string;
  avatarUrl?: string;
  images: ProviderGalleryImageItem[];
}

export interface CustomGalleryImage {
  id: string;
  name: string;
  imageUrl: string;
  uploadFolder: string;
  fileSize?: number;
  createdAt?: any;
}

export interface GalleryItem {
  id: string; // Unique gallery item key
  docId: string; // MySQL document ID
  collectionName: 'adminCategories' | 'adminSubCategories' | 'adminServices' | 'adminSlideshows' | 'adminPopups' | 'blogPosts' | 'webSettings';
  title: string;
  categoryType: 'category' | 'subcategory' | 'service' | 'slideshow' | 'ad' | 'popup' | 'branding' | 'blog';
  categoryId?: string;
  subCategoryId?: string;
  categoryName?: string; // Parent Category Name
  subCategoryName?: string; // Sub-Category Name
  order?: number;
  imageField: string; // Property name e.g. 'image', 'icon', 'coverImageUrl', 'logoUrl'
  arrayIndex?: number; // Index if array property like galleryImages
  adId?: string; // If item belongs to featuresConfiguration.ads array
  imageUrl: string;
  uploadFolder: string;
}

export interface ParentCategoryGroup {
  id: string;
  name: string;
  order: number;
  subCategories: {
    id: string;
    name: string;
    order: number;
    items: GalleryItem[];
  }[];
  unassignedItems: GalleryItem[];
  totalImages: number;
}

export default function AdminImageGalleryPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [parentCatsList, setParentCatsList] = useState<{ id: string; name: string; order: number }[]>([]);
  const [subCatsList, setSubCatsList] = useState<{ id: string; name: string; parentId: string; order: number }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Tab Persistence with sessionStorage
  const [activeTab, setActiveTab] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('gallery-active-tab') || 'all';
    }
    return 'all';
  });

  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('gallery-active-tab', newTab);
    }
  };

  // Scroll Position Persistence
  useEffect(() => {
    const handleScroll = () => {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('gallery-scroll-pos', window.scrollY.toString());
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const restoreScrollPosition = () => {
    if (typeof window !== 'undefined') {
      const savedScrollY = sessionStorage.getItem('gallery-scroll-pos');
      if (savedScrollY) {
        setTimeout(() => {
          window.scrollTo({ top: parseInt(savedScrollY, 10), behavior: 'instant' });
        }, 100);
      }
    }
  };

  // Modal State for Image Replacement
  const [selectedItem, setSelectedItem] = useState<GalleryItem | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Custom Marketing Images State
  const [customImages, setCustomImages] = useState<CustomGalleryImage[]>([]);
  const [isLoadingCustom, setIsLoadingCustom] = useState(false);
  const [isUploadingCustom, setIsUploadingCustom] = useState(false);
  const [customUploadProgress, setCustomUploadProgress] = useState(0);
  const [copiedUrlId, setCopiedUrlId] = useState<string | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<CustomGalleryImage | null>(null);
  const [isDeletingCustom, setIsDeletingCustom] = useState(false);

  // Provider Images State
  const [providerGroups, setProviderGroups] = useState<ProviderGalleryGroup[]>([]);
  const [isLoadingProviders, setIsLoadingProviders] = useState(false);
  const [providerFilterStatus, setProviderFilterStatus] = useState<string>('all');
  const [replaceProviderModalItem, setReplaceProviderModalItem] = useState<ProviderGalleryImageItem | null>(null);
  const [providerPreviewFile, setProviderPreviewFile] = useState<File | null>(null);
  const [providerPreviewUrl, setProviderPreviewUrl] = useState<string | null>(null);
  const [isReplacingProviderImage, setIsReplacingProviderImage] = useState(false);
  const [providerReplaceProgress, setProviderReplaceProgress] = useState(0);
  const [deleteProviderCandidate, setDeleteProviderCandidate] = useState<ProviderGalleryImageItem | null>(null);
  const [isDeletingProviderImage, setIsDeletingProviderImage] = useState(false);

  // Other Server Files State
  const [serverImages, setServerImages] = useState<ServerImageFile[]>([]);
  const [serverFolders, setServerFolders] = useState<string[]>([]);
  const [isLoadingServerImages, setIsLoadingServerImages] = useState(false);
  const [serverFolderFilter, setServerFolderFilter] = useState<string>('all');
  const [serverTotalSize, setServerTotalSize] = useState(0);
  const [deleteServerImageCandidate, setDeleteServerImageCandidate] = useState<ServerImageFile | null>(null);
  const [isDeletingServerImage, setIsDeletingServerImage] = useState(false);
  const [isUploadServerModalOpen, setIsUploadServerModalOpen] = useState(false);
  const [isUploadingOther, setIsUploadingOther] = useState(false);
  const [otherUploadProgress, setOtherUploadProgress] = useState(0);
  const [otherUploadFolder, setOtherUploadFolder] = useState<string>('general');

  // Modal State for Full Screen Image Preview
  const [viewingImage, setViewingImage] = useState<{
    id?: string;
    title: string;
    imageUrl: string;
    categoryType: string;
    uploadFolder: string;
    originalItem?: GalleryItem;
  } | null>(null);

  const fetchAllWebsiteImages = async () => {
    setIsLoading(true);
    const galleryList: GalleryItem[] = [];
    const categoryMap = new Map<string, { name: string; order: number }>();
    const subCatMap = new Map<string, { name: string; parentId: string; order: number }>();

    try {
      // 1. Fetch Categories
      const categoriesSnap = await getDocs(collection(db, "adminCategories"));
      const pCats: { id: string; name: string; order: number }[] = [];

      categoriesSnap.docs.forEach(docSnap => {
        const data = docSnap.data() as any;
        const catName = data.name || 'Uncategorized';
        const catOrder = Number(data.order || 0);

        categoryMap.set(docSnap.id, { name: catName, order: catOrder });
        pCats.push({ id: docSnap.id, name: catName, order: catOrder });

        const img = data.imageUrl || data.image || data.bannerUrl;
        const icon = data.iconUrl || data.icon;

        if (img) {
          galleryList.push({
            id: `cat-img-${docSnap.id}`,
            docId: docSnap.id,
            collectionName: 'adminCategories',
            title: catName,
            categoryType: 'category',
            categoryId: docSnap.id,
            categoryName: catName,
            order: catOrder,
            imageField: data.imageUrl ? 'imageUrl' : (data.image ? 'image' : 'bannerUrl'),
            imageUrl: img,
            uploadFolder: 'categories',
          });
        }
        if (icon && icon !== img) {
          galleryList.push({
            id: `cat-icon-${docSnap.id}`,
            docId: docSnap.id,
            collectionName: 'adminCategories',
            title: `${catName} (Icon)`,
            categoryType: 'category',
            categoryId: docSnap.id,
            categoryName: catName,
            order: catOrder,
            imageField: data.iconUrl ? 'iconUrl' : 'icon',
            imageUrl: icon,
            uploadFolder: 'categories/icons',
          });
        }
      });
      setParentCatsList(pCats.sort((a, b) => a.order - b.order));

      // 2. Fetch Sub-Categories
      const subCatSnap = await getDocs(collection(db, "adminSubCategories"));
      const sCats: { id: string; name: string; parentId: string; order: number }[] = [];

      subCatSnap.docs.forEach(docSnap => {
        const data = docSnap.data() as any;
        const subCatName = data.name || 'Sub-Category';
        const parentId = data.parentId || '';
        const subCatOrder = Number(data.order || 0);
        const parentCatName = categoryMap.get(parentId)?.name || 'General Category';

        subCatMap.set(docSnap.id, { name: subCatName, parentId, order: subCatOrder });
        sCats.push({ id: docSnap.id, name: subCatName, parentId, order: subCatOrder });

        const img = data.imageUrl || data.image || data.bannerUrl;
        const icon = data.iconUrl || data.icon;

        if (img) {
          galleryList.push({
            id: `subcat-img-${docSnap.id}`,
            docId: docSnap.id,
            collectionName: 'adminSubCategories',
            title: subCatName,
            categoryType: 'subcategory',
            categoryId: parentId,
            subCategoryId: docSnap.id,
            categoryName: parentCatName,
            subCategoryName: subCatName,
            order: subCatOrder,
            imageField: data.imageUrl ? 'imageUrl' : (data.image ? 'image' : 'bannerUrl'),
            imageUrl: img,
            uploadFolder: 'subcategories',
          });
        }
        if (icon && icon !== img) {
          galleryList.push({
            id: `subcat-icon-${docSnap.id}`,
            docId: docSnap.id,
            collectionName: 'adminSubCategories',
            title: `${subCatName} (Icon)`,
            categoryType: 'subcategory',
            categoryId: parentId,
            subCategoryId: docSnap.id,
            categoryName: parentCatName,
            subCategoryName: subCatName,
            order: subCatOrder,
            imageField: data.iconUrl ? 'iconUrl' : 'icon',
            imageUrl: icon,
            uploadFolder: 'subcategories/icons',
          });
        }
      });
      setSubCatsList(sCats.sort((a, b) => a.order - b.order));

      // 3. Fetch Services
      const servicesSnap = await getDocs(collection(db, "adminServices"));
      servicesSnap.docs.forEach(docSnap => {
        const data = docSnap.data() as any;
        const srvName = data.name || 'Service Main Image';
        
        const subCatObj = subCatMap.get(data.subCategoryId);
        const subCatName = subCatObj?.name || '';
        const parentId = data.categoryId || subCatObj?.parentId || '';
        const parentCatName = categoryMap.get(parentId)?.name || 'General Services';

        const img = data.imageUrl || data.image || data.coverImage;
        const icon = data.iconUrl || data.icon;

        if (img) {
          galleryList.push({
            id: `srv-main-${docSnap.id}`,
            docId: docSnap.id,
            collectionName: 'adminServices',
            title: srvName,
            categoryType: 'service',
            categoryId: parentId,
            subCategoryId: data.subCategoryId,
            categoryName: parentCatName,
            subCategoryName: subCatName,
            imageField: data.imageUrl ? 'imageUrl' : (data.image ? 'image' : 'coverImage'),
            imageUrl: img,
            uploadFolder: 'services',
          });
        }
        if (icon && icon !== img) {
          galleryList.push({
            id: `srv-icon-${docSnap.id}`,
            docId: docSnap.id,
            collectionName: 'adminServices',
            title: `${srvName} (Icon)`,
            categoryType: 'service',
            categoryId: parentId,
            subCategoryId: data.subCategoryId,
            categoryName: parentCatName,
            subCategoryName: subCatName,
            imageField: data.iconUrl ? 'iconUrl' : 'icon',
            imageUrl: icon,
            uploadFolder: 'services/icons',
          });
        }
        const gal = data.galleryImages || data.images;
        if (Array.isArray(gal)) {
          gal.forEach((imgUrl: string, idx: number) => {
            if (imgUrl && typeof imgUrl === 'string') {
              galleryList.push({
                id: `srv-gal-${docSnap.id}-${idx}`,
                docId: docSnap.id,
                collectionName: 'adminServices',
                title: `${srvName} (Gallery #${idx + 1})`,
                categoryType: 'service',
                categoryId: parentId,
                subCategoryId: data.subCategoryId,
                categoryName: parentCatName,
                subCategoryName: subCatName,
                imageField: data.galleryImages ? 'galleryImages' : 'images',
                arrayIndex: idx,
                imageUrl: imgUrl,
                uploadFolder: 'services/gallery',
              });
            }
          });
        }
      });

      // 4. Fetch Slideshow Banners (Separate Tab)
      const slidesSnap = await getDocs(collection(db, "adminSlideshows"));
      slidesSnap.docs.forEach(docSnap => {
        const data = docSnap.data() as any;
        const img = data.imageUrl || data.image;
        if (img) {
          galleryList.push({
            id: `slide-${docSnap.id}`,
            docId: docSnap.id,
            collectionName: 'adminSlideshows',
            title: data.title || 'Slideshow Banner',
            categoryType: 'slideshow',
            imageField: data.imageUrl ? 'imageUrl' : 'image',
            imageUrl: img,
            uploadFolder: 'slideshows',
          });
        }
      });

      // 5. Fetch Newsletter Popups (Separate Tab)
      try {
        const popupsSnap = await getDocs(collection(db, "adminPopups"));
        popupsSnap.docs.forEach(docSnap => {
          const data = docSnap.data() as any;
          const img = data.imageUrl || data.image || data.bannerUrl;
          if (img) {
            galleryList.push({
              id: `popup-${docSnap.id}`,
              docId: docSnap.id,
              collectionName: 'adminPopups',
              title: data.title || data.name || 'Newsletter Popup Image',
              categoryType: 'popup',
              imageField: data.imageUrl ? 'imageUrl' : (data.image ? 'image' : 'bannerUrl'),
              imageUrl: img,
              uploadFolder: 'popups',
            });
          }
        });
      } catch (e) {
        console.warn("Popups fetch error:", e);
      }

      // 6. Fetch Blog Posts (Cover Image & CoverImageUrl)
      try {
        const blogsSnap = await getDocs(collection(db, "blogPosts"));
        blogsSnap.docs.forEach(docSnap => {
          const data = docSnap.data() as any;
          const img = data.coverImageUrl || data.imageUrl || data.image || data.coverImage || data.bannerUrl || data.thumbnailUrl;
          if (img && typeof img === 'string' && img.trim() !== '') {
            const fieldName = data.coverImageUrl ? 'coverImageUrl' : (data.imageUrl ? 'imageUrl' : (data.image ? 'image' : (data.coverImage ? 'coverImage' : 'bannerUrl')));
            galleryList.push({
              id: `blog-${docSnap.id}`,
              docId: docSnap.id,
              collectionName: 'blogPosts',
              title: data.title || data.h1_title || 'Blog Post Cover',
              categoryType: 'blog',
              imageField: fieldName,
              imageUrl: img,
              uploadFolder: 'blog',
            });
          }
        });
      } catch (e) {
        console.warn("Blog posts fetch error:", e);
      }

      // 7. Fetch Promotional Ad Banners explicitly from webSettings/featuresConfiguration
      try {
        const featDocSnap = await getDoc(doc(db, "webSettings", "featuresConfiguration"));
        if (featDocSnap.exists()) {
          const featData = featDocSnap.data() as any;
          if (Array.isArray(featData?.ads)) {
            featData.ads.forEach((ad: HomepageAd, idx: number) => {
              const adImg = ad.imageUrl || (ad as any).image;
              if (adImg && typeof adImg === 'string' && adImg.trim() !== '') {
                galleryList.push({
                  id: `ad-banner-${ad.id || idx}`,
                  docId: 'featuresConfiguration',
                  collectionName: 'webSettings',
                  title: ad.name || `Ad Banner #${idx + 1}`,
                  categoryType: 'ad',
                  adId: ad.id,
                  imageField: 'ads',
                  arrayIndex: idx,
                  imageUrl: adImg,
                  uploadFolder: 'ads',
                });
              }
            });
          }
        }
      } catch (e) {
        console.warn("Features config ads fetch error:", e);
      }

      // 8. Fetch Global Web Settings (Branding & Logos)
      try {
        const globalDocSnap = await getDoc(doc(db, "webSettings", "global"));
        if (globalDocSnap.exists()) {
          const data = globalDocSnap.data() as any;
          if (data.logoUrl) {
            galleryList.push({
              id: 'brand-logo',
              docId: 'global',
              collectionName: 'webSettings',
              title: 'Website Main Logo',
              categoryType: 'branding',
              imageField: 'logoUrl',
              imageUrl: data.logoUrl,
              uploadFolder: 'branding',
            });
          }
          if (data.faviconUrl) {
            galleryList.push({
              id: 'brand-favicon',
              docId: 'global',
              collectionName: 'webSettings',
              title: 'Website Favicon Icon',
              categoryType: 'branding',
              imageField: 'faviconUrl',
              imageUrl: data.faviconUrl,
              uploadFolder: 'branding',
            });
          }
          if (data.metaOgImageUrl) {
            galleryList.push({
              id: 'brand-og',
              docId: 'global',
              collectionName: 'webSettings',
              title: 'SEO Social Preview Image',
              categoryType: 'branding',
              imageField: 'metaOgImageUrl',
              imageUrl: data.metaOgImageUrl,
              uploadFolder: 'branding',
            });
          }
          if (data.headerBannerUrl) {
            galleryList.push({
              id: 'brand-header-banner',
              docId: 'global',
              collectionName: 'webSettings',
              title: 'Header Top Announcement Banner',
              categoryType: 'branding',
              imageField: 'headerBannerUrl',
              imageUrl: data.headerBannerUrl,
              uploadFolder: 'branding',
            });
          }
        }
      } catch (e) {
        console.warn("Global webSettings fetch error:", e);
      }

      setItems(galleryList);
      restoreScrollPosition();
    } catch (err) {
      console.error("Error building Image Gallery:", err);
      toast({ title: "Fetch Error", description: "Failed to load all images.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCustomImages = async () => {
    setIsLoadingCustom(true);
    try {
      const snap = await getDocs(query(collection(db, "adminCustomImages"), orderBy("createdAt", "desc")));
      const list: CustomGalleryImage[] = snap.docs.map(docSnap => {
        const data = docSnap.data() as any;
        return {
          id: docSnap.id,
          name: data.name || 'Custom Image',
          imageUrl: data.imageUrl || data.url || '',
          uploadFolder: data.uploadFolder || 'custom',
          fileSize: data.fileSize || data.size,
          createdAt: data.createdAt
        };
      }).filter(img => Boolean(img.imageUrl));
      setCustomImages(list);
    } catch (err) {
      console.warn("Error fetching custom images:", err);
    } finally {
      setIsLoadingCustom(false);
    }
  };

  const fetchProviderImages = async () => {
    setIsLoadingProviders(true);
    try {
      const snap = await getDocs(query(collection(db, "providerApplications"), orderBy("createdAt", "desc")));
      const groups: ProviderGalleryGroup[] = [];

      snap.docs.forEach((docSnap) => {
        const data = docSnap.data() as any;
        const providerId = docSnap.id;
        const providerName = data.fullName || data.personalInfo?.fullName || data.displayName || 'Unnamed Provider';
        const providerEmail = data.email || data.personalInfo?.email || '';
        const providerMobile = data.mobileNumber || data.personalInfo?.mobileNumber || '';
        const primaryCategory = data.primaryCategory || data.categoryName || '';
        const status = data.status || 'pending_review';
        const avatarUrl = data.profilePhotoUrl || data.photoURL || '';

        const images: ProviderGalleryImageItem[] = [];

        // 1. Profile Photo
        if (data.profilePhotoUrl || data.photoURL) {
          images.push({
            key: `${providerId}-profilePhotoUrl`,
            providerId,
            providerName,
            providerEmail,
            providerMobile,
            providerStatus: status,
            imageType: 'profile',
            title: 'Profile Photo',
            fieldPath: 'profilePhotoUrl',
            imageUrl: data.profilePhotoUrl || data.photoURL,
            uploadFolder: 'providers/profile',
          });
        }

        // 2. Aadhaar Front & Back
        if (data.aadhaar?.frontImageUrl) {
          images.push({
            key: `${providerId}-aadhaar-front`,
            providerId,
            providerName,
            providerEmail,
            providerMobile,
            providerStatus: status,
            imageType: 'aadhaar_front',
            title: `Aadhaar Front ${data.aadhaar?.aadhaarNumber ? `(..${String(data.aadhaar.aadhaarNumber).slice(-4)})` : ''}`,
            fieldPath: 'aadhaar.frontImageUrl',
            imageUrl: data.aadhaar.frontImageUrl,
            uploadFolder: 'providers/documents',
          });
        }
        if (data.aadhaar?.backImageUrl) {
          images.push({
            key: `${providerId}-aadhaar-back`,
            providerId,
            providerName,
            providerEmail,
            providerMobile,
            providerStatus: status,
            imageType: 'aadhaar_back',
            title: 'Aadhaar Back',
            fieldPath: 'aadhaar.backImageUrl',
            imageUrl: data.aadhaar.backImageUrl,
            uploadFolder: 'providers/documents',
          });
        }

        // 3. PAN Front & Back
        if (data.pan?.frontImageUrl) {
          images.push({
            key: `${providerId}-pan-front`,
            providerId,
            providerName,
            providerEmail,
            providerMobile,
            providerStatus: status,
            imageType: 'pan_front',
            title: `PAN Front ${data.pan?.panNumber ? `(${data.pan.panNumber})` : ''}`,
            fieldPath: 'pan.frontImageUrl',
            imageUrl: data.pan.frontImageUrl,
            uploadFolder: 'providers/documents',
          });
        }
        if (data.pan?.backImageUrl) {
          images.push({
            key: `${providerId}-pan-back`,
            providerId,
            providerName,
            providerEmail,
            providerMobile,
            providerStatus: status,
            imageType: 'pan_back',
            title: 'PAN Back',
            fieldPath: 'pan.backImageUrl',
            imageUrl: data.pan.backImageUrl,
            uploadFolder: 'providers/documents',
          });
        }

        // 4. Additional Documents (Array)
        if (Array.isArray(data.additionalDocuments)) {
          data.additionalDocuments.forEach((docItem: any, idx: number) => {
            const docLabel = docItem.docLabel || docItem.docType || `Additional Doc #${idx + 1}`;
            if (docItem.frontImageUrl) {
              images.push({
                key: `${providerId}-addDoc-${idx}-front`,
                providerId,
                providerName,
                providerEmail,
                providerMobile,
                providerStatus: status,
                imageType: 'additional_doc',
                title: `${docLabel} (Front)`,
                fieldPath: `additionalDocuments.${idx}.frontImageUrl`,
                imageUrl: docItem.frontImageUrl,
                uploadFolder: 'providers/documents',
              });
            }
            if (docItem.backImageUrl) {
              images.push({
                key: `${providerId}-addDoc-${idx}-back`,
                providerId,
                providerName,
                providerEmail,
                providerMobile,
                providerStatus: status,
                imageType: 'additional_doc',
                title: `${docLabel} (Back)`,
                fieldPath: `additionalDocuments.${idx}.backImageUrl`,
                imageUrl: docItem.backImageUrl,
                uploadFolder: 'providers/documents',
              });
            }
          });
        }

        // 5. Signature
        if (data.signatureUrl) {
          images.push({
            key: `${providerId}-signatureUrl`,
            providerId,
            providerName,
            providerEmail,
            providerMobile,
            providerStatus: status,
            imageType: 'signature',
            title: 'Digital Signature',
            fieldPath: 'signatureUrl',
            imageUrl: data.signatureUrl,
            uploadFolder: 'providers/signatures',
          });
        }

        // 6. Cancelled Cheque / Chequebook
        if (data.bankDetails?.cancelledChequeUrl) {
          images.push({
            key: `${providerId}-bankDetails-cancelledChequeUrl`,
            providerId,
            providerName,
            providerEmail,
            providerMobile,
            providerStatus: status,
            imageType: 'cancelled_cheque',
            title: `Bank Cancelled Cheque ${data.bankDetails?.bankName ? `(${data.bankDetails.bankName})` : ''}`,
            fieldPath: 'bankDetails.cancelledChequeUrl',
            imageUrl: data.bankDetails.cancelledChequeUrl,
            uploadFolder: 'providers/cheques',
          });
        }

        if (images.length > 0) {
          groups.push({
            providerId,
            providerName,
            providerEmail,
            providerMobile,
            primaryCategory,
            status,
            avatarUrl,
            images,
          });
        }
      });

      setProviderGroups(groups);
    } catch (err) {
      console.warn("Error fetching provider images:", err);
    } finally {
      setIsLoadingProviders(false);
    }
  };

  const fetchServerImages = async () => {
    setIsLoadingServerImages(true);
    try {
      const res = await listAllServerImagesAction();
      if (res.success) {
        setServerImages(res.images);
        setServerFolders(res.folders);
        setServerTotalSize(res.totalSize);
      } else {
        toast({ title: "Failed to list server images", description: res.message, variant: "destructive" });
      }
    } catch (err: any) {
      console.warn("Error listing server images:", err);
    } finally {
      setIsLoadingServerImages(false);
    }
  };

  useEffect(() => {
    fetchAllWebsiteImages();
    fetchCustomImages();
    fetchProviderImages();
    fetchServerImages();
  }, []);

  const handleCustomUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingCustom(true);
    setCustomUploadProgress(10);

    try {
      const token = await auth.currentUser?.getIdToken();
      let completedCount = 0;
      const totalFiles = files.length;
      const newItems: CustomGalleryImage[] = [];

      for (let i = 0; i < totalFiles; i++) {
        const rawFile = files[i];
        let fileToUpload = rawFile;
        try {
          fileToUpload = await compressImage(rawFile);
        } catch (cErr) {
          console.warn("Compression fallback:", cErr);
        }

        const formData = new FormData();
        formData.append('file', fileToUpload);
        formData.append('uploadPath', 'custom');

        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });

        const uploadData = await uploadRes.json();
        if (!uploadRes.ok || !uploadData.success) {
          throw new Error(uploadData.error || `Failed to upload ${rawFile.name}`);
        }

        const uploadedUrl = uploadData.url;
        const newRecord = {
          name: rawFile.name,
          imageUrl: uploadedUrl,
          uploadFolder: 'custom',
          fileSize: fileToUpload.size || rawFile.size,
          createdAt: Timestamp.now()
        };

        const docRef = await addDoc(collection(db, "adminCustomImages"), newRecord);
        newItems.push({
          id: docRef.id,
          ...newRecord
        });

        completedCount++;
        setCustomUploadProgress(Math.round((completedCount / totalFiles) * 100));
      }

      setCustomImages(prev => [...newItems, ...prev]);

      toast({
        title: "Custom Image Uploaded!",
        description: totalFiles === 1 
          ? `Image uploaded successfully. You can now copy the link.` 
          : `${totalFiles} images uploaded successfully.`,
      });
    } catch (err: any) {
      console.error("Custom upload error:", err);
      toast({
        title: "Upload Failed",
        description: err.message || "Failed to upload image.",
        variant: "destructive"
      });
    } finally {
      setIsUploadingCustom(false);
      setCustomUploadProgress(0);
      e.target.value = '';
    }
  };

  const handleCopyCustomUrl = async (img: CustomGalleryImage) => {
    try {
      const fullUrl = img.imageUrl.startsWith('http')
        ? img.imageUrl
        : `${window.location.origin}${img.imageUrl.startsWith('/') ? '' : '/'}${img.imageUrl}`;

      await navigator.clipboard.writeText(fullUrl);
      setCopiedUrlId(img.id);
      setTimeout(() => setCopiedUrlId(null), 2500);

      toast({
        title: "URL Copied to Clipboard! 📋",
        description: fullUrl,
      });
    } catch (err) {
      try {
        const textarea = document.createElement('textarea');
        const fullUrl = img.imageUrl.startsWith('http')
          ? img.imageUrl
          : `${window.location.origin}${img.imageUrl.startsWith('/') ? '' : '/'}${img.imageUrl}`;
        textarea.value = fullUrl;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        setCopiedUrlId(img.id);
        setTimeout(() => setCopiedUrlId(null), 2500);
        toast({
          title: "URL Copied to Clipboard! 📋",
          description: fullUrl,
        });
      } catch (e) {
        toast({
          title: "Copy Failed",
          description: "Please manually copy the URL.",
          variant: "destructive"
        });
      }
    }
  };

  const handleExecuteDeleteCustomImage = async () => {
    if (!deleteCandidate) return;

    setIsDeletingCustom(true);
    try {
      if (deleteCandidate.imageUrl) {
        try {
          await deleteObject(deleteCandidate.imageUrl);
        } catch (dErr) {
          console.warn("Storage deletion notice:", dErr);
        }
      }

      await deleteDoc(doc(db, "adminCustomImages", deleteCandidate.id));
      setCustomImages(prev => prev.filter(item => item.id !== deleteCandidate.id));

      toast({
        title: "Custom Image Deleted",
        description: `"${deleteCandidate.name}" was permanently removed.`,
      });
      setDeleteCandidate(null);
    } catch (err: any) {
      console.error("Error deleting custom image:", err);
      toast({
        title: "Delete Error",
        description: err.message || "Failed to delete custom image.",
        variant: "destructive"
      });
    } finally {
      setIsDeletingCustom(false);
    }
  };

  const filteredCustomImages = useMemo(() => {
    if (!searchTerm.trim()) return customImages;
    const lower = searchTerm.toLowerCase().trim();
    return customImages.filter(img => 
      img.name.toLowerCase().includes(lower) || 
      img.imageUrl.toLowerCase().includes(lower)
    );
  }, [customImages, searchTerm]);

  const handleExecuteReplaceProviderImage = async () => {
    if (!replaceProviderModalItem || !providerPreviewFile) return;

    setIsReplacingProviderImage(true);
    setProviderReplaceProgress(15);

    try {
      // 1. Compress image
      let uploadPayload: Blob = providerPreviewFile;
      try {
        uploadPayload = await compressImage(providerPreviewFile);
      } catch (cErr) {
        uploadPayload = providerPreviewFile;
      }
      setProviderReplaceProgress(40);

      // 2. Upload file via /api/upload
      const formData = new FormData();
      formData.append('file', uploadPayload, providerPreviewFile.name);
      formData.append('uploadPath', replaceProviderModalItem.uploadFolder || 'providers');

      const token = await auth.currentUser?.getIdToken();
      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      const uploadData = await uploadRes.json();

      if (!uploadRes.ok || !uploadData.success) {
        throw new Error(uploadData.error || 'Failed to upload replacement image.');
      }

      setProviderReplaceProgress(75);
      const newImageUrl = uploadData.url;

      // 3. Update database & delete old file via server action
      const updateRes = await updateProviderImageFieldAction({
        providerId: replaceProviderModalItem.providerId,
        fieldPath: replaceProviderModalItem.fieldPath,
        newUrl: newImageUrl,
        oldUrl: replaceProviderModalItem.imageUrl,
      });

      if (!updateRes.success) {
        throw new Error(updateRes.message);
      }

      setProviderReplaceProgress(100);

      // 4. Update local state
      setProviderGroups((prev) =>
        prev.map((group) => {
          if (group.providerId !== replaceProviderModalItem.providerId) return group;
          return {
            ...group,
            images: group.images.map((img) =>
              img.key === replaceProviderModalItem.key
                ? { ...img, imageUrl: newImageUrl }
                : img
            ),
            avatarUrl:
              replaceProviderModalItem.fieldPath === 'profilePhotoUrl'
                ? newImageUrl
                : group.avatarUrl,
          };
        })
      );

      toast({
        title: "Image Replaced Successfully! ✅",
        description: `${replaceProviderModalItem.title} for ${replaceProviderModalItem.providerName} updated.`,
      });

      setReplaceProviderModalItem(null);
      setProviderPreviewFile(null);
      setProviderPreviewUrl(null);
    } catch (error: any) {
      console.error('Error replacing provider image:', error);
      toast({
        title: "Replacement Failed",
        description: error.message || "Could not replace provider image.",
        variant: "destructive",
      });
    } finally {
      setIsReplacingProviderImage(false);
      setProviderReplaceProgress(0);
    }
  };

  const handleExecuteDeleteProviderImage = async () => {
    if (!deleteProviderCandidate) return;

    setIsDeletingProviderImage(true);
    try {
      const res = await updateProviderImageFieldAction({
        providerId: deleteProviderCandidate.providerId,
        fieldPath: deleteProviderCandidate.fieldPath,
        newUrl: null,
        oldUrl: deleteProviderCandidate.imageUrl,
      });

      if (!res.success) {
        throw new Error(res.message);
      }

      // Update local state
      setProviderGroups((prev) =>
        prev
          .map((group) => {
            if (group.providerId !== deleteProviderCandidate.providerId) return group;
            const nextImages = group.images.filter((img) => img.key !== deleteProviderCandidate.key);
            return {
              ...group,
              images: nextImages,
              avatarUrl:
                deleteProviderCandidate.fieldPath === 'profilePhotoUrl'
                  ? undefined
                  : group.avatarUrl,
            };
          })
          .filter((group) => group.images.length > 0)
      );

      toast({
        title: "Image Deleted Successfully! 🗑️",
        description: `${deleteProviderCandidate.title} removed from ${deleteProviderCandidate.providerName}'s profile.`,
      });

      setDeleteProviderCandidate(null);
    } catch (error: any) {
      console.error('Error deleting provider image:', error);
      toast({
        title: "Deletion Failed",
        description: error.message || "Could not delete provider image.",
        variant: "destructive",
      });
    } finally {
      setIsDeletingProviderImage(false);
    }
  };

  const handleExecuteDeleteServerImage = async () => {
    if (!deleteServerImageCandidate) return;

    setIsDeletingServerImage(true);
    try {
      const res = await deleteServerImageAction(deleteServerImageCandidate.url);
      if (!res.success) {
        throw new Error(res.message);
      }

      setServerImages((prev) => prev.filter((img) => img.url !== deleteServerImageCandidate.url));
      setServerTotalSize((prev) => Math.max(0, prev - deleteServerImageCandidate.fileSize));

      toast({
        title: "Image Deleted Permanently! 🗑️",
        description: `${deleteServerImageCandidate.fileName} was removed from the server.`,
      });

      setDeleteServerImageCandidate(null);
    } catch (error: any) {
      console.error('Error deleting server image:', error);
      toast({
        title: "Deletion Failed",
        description: error.message || "Could not delete image from server.",
        variant: "destructive",
      });
    } finally {
      setIsDeletingServerImage(false);
    }
  };

  const handleOtherUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingOther(true);
    setOtherUploadProgress(10);

    try {
      const totalFiles = files.length;
      let completed = 0;

      for (let i = 0; i < totalFiles; i++) {
        const file = files[i];
        let uploadPayload: Blob = file;
        if (file.type.startsWith('image/') && !file.type.includes('svg')) {
          try {
            uploadPayload = await compressImage(file);
          } catch {
            uploadPayload = file;
          }
        }

        const formData = new FormData();
        formData.append('file', uploadPayload, file.name);
        formData.append('uploadPath', otherUploadFolder || 'general');

        const token = await auth.currentUser?.getIdToken();
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData,
        });

        const resData = await res.json();
        if (!res.ok || !resData.success) {
          throw new Error(resData.error || `Failed to upload ${file.name}`);
        }

        completed++;
        setOtherUploadProgress(Math.round((completed / totalFiles) * 100));
      }

      toast({
        title: "Upload Successful! 🎉",
        description: `${totalFiles} image(s) uploaded to folder "${otherUploadFolder}".`,
      });

      setIsUploadServerModalOpen(false);
      await fetchServerImages();
    } catch (error: any) {
      console.error('Error uploading to server:', error);
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload file(s).",
        variant: "destructive",
      });
    } finally {
      setIsUploadingOther(false);
      setOtherUploadProgress(0);
      e.target.value = '';
    }
  };

  const totalProviderImages = useMemo(() => {
    return providerGroups.reduce((acc, g) => acc + g.images.length, 0);
  }, [providerGroups]);

  const filteredProviderGroups = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return providerGroups
      .map((group) => {
        if (providerFilterStatus !== 'all' && group.status !== providerFilterStatus) {
          return null;
        }
        if (!term) return group;

        const matchesGroupInfo =
          group.providerName.toLowerCase().includes(term) ||
          (group.providerEmail && group.providerEmail.toLowerCase().includes(term)) ||
          (group.providerMobile && group.providerMobile.includes(term)) ||
          (group.primaryCategory && group.primaryCategory.toLowerCase().includes(term));

        if (matchesGroupInfo) return group;

        const matchingImages = group.images.filter((img) =>
          img.title.toLowerCase().includes(term)
        );
        if (matchingImages.length > 0) {
          return {
            ...group,
            images: matchingImages,
          };
        }

        return null;
      })
      .filter((g): g is ProviderGalleryGroup => g !== null);
  }, [providerGroups, searchTerm, providerFilterStatus]);

  const filteredServerImages = useMemo(() => {
    let list = serverImages;
    if (serverFolderFilter !== 'all') {
      list = list.filter((img) => img.folder === serverFolderFilter);
    }
    const term = searchTerm.toLowerCase().trim();
    if (term) {
      list = list.filter(
        (img) =>
          img.fileName.toLowerCase().includes(term) ||
          img.folder.toLowerCase().includes(term) ||
          img.url.toLowerCase().includes(term)
      );
    }
    return list;
  }, [serverImages, serverFolderFilter, searchTerm]);

  const formatFileSize = (bytes?: number): string => {
    if (!bytes || isNaN(bytes)) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (ts: any): string => {
    if (!ts) return '';
    try {
      if (ts.toDate && typeof ts.toDate === 'function') {
        return ts.toDate().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      }
      if (ts.seconds) {
        return new Date(ts.seconds * 1000).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      }
      const d = new Date(ts);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      }
    } catch (e) {
      return '';
    }
    return '';
  };

  const filteredItems = useMemo(() => {
    let result = items;
    if (activeTab !== 'all') {
      result = result.filter(item => item.categoryType === activeTab);
    }
    if (searchTerm.trim()) {
      const lower = searchTerm.toLowerCase().trim();
      result = result.filter(item => 
        item.title.toLowerCase().includes(lower) || 
        item.uploadFolder.toLowerCase().includes(lower) ||
        (item.categoryName || '').toLowerCase().includes(lower) ||
        (item.subCategoryName || '').toLowerCase().includes(lower)
      );
    }
    return result;
  }, [items, activeTab, searchTerm]);

  // Order-wise Categories for Categories Tab (matching /admin/categories)
  const orderedCategories = useMemo(() => {
    const catItems = filteredItems.filter(item => item.categoryType === 'category');
    return [...catItems].sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [filteredItems]);

  // Sub-Categories Grouped Category-Wise (matching /admin/sub-categories)
  const groupedSubCategoryHierarchy = useMemo(() => {
    const subCatItems = filteredItems.filter(item => item.categoryType === 'subcategory');
    const result: ParentCategoryGroup[] = [];

    parentCatsList.forEach(pCat => {
      const itemsForParent = subCatItems.filter(item => item.categoryId === pCat.id);
      if (itemsForParent.length > 0) {
        result.push({
          id: pCat.id,
          name: pCat.name,
          order: pCat.order,
          subCategories: [{
            id: pCat.id,
            name: pCat.name,
            order: pCat.order,
            items: itemsForParent.sort((a, b) => (a.order || 0) - (b.order || 0))
          }],
          unassignedItems: [],
          totalImages: itemsForParent.length
        });
      }
    });

    const handledIds = new Set<string>();
    result.forEach(p => p.subCategories.forEach(s => s.items.forEach(i => handledIds.add(i.id))));
    const orphanItems = subCatItems.filter(i => !handledIds.has(i.id));

    if (orphanItems.length > 0) {
      result.push({
        id: 'other-subcategories',
        name: 'General & Other Sub-Categories',
        order: 9999,
        subCategories: [{
          id: 'general-subcat-group',
          name: 'General Sub-Categories',
          order: 1,
          items: orphanItems
        }],
        unassignedItems: [],
        totalImages: orphanItems.length
      });
    }

    return result;
  }, [filteredItems, parentCatsList]);

  // Build Nested Grouped Service Hierarchy matching /admin/daily-providers
  const groupedServicesHierarchy = useMemo(() => {
    const serviceItems = filteredItems.filter(item => item.categoryType === 'service');
    const result: ParentCategoryGroup[] = [];

    parentCatsList.forEach(pCat => {
      const relevantSubCats = subCatsList.filter(s => s.parentId === pCat.id);
      
      const subCatGroups = relevantSubCats.map(subCat => {
        const subCatItems = serviceItems.filter(item => item.subCategoryId === subCat.id);
        return {
          id: subCat.id,
          name: subCat.name,
          order: subCat.order,
          items: subCatItems
        };
      }).filter(subCat => subCat.items.length > 0);

      const unassigned = serviceItems.filter(item => 
        item.categoryId === pCat.id && 
        !relevantSubCats.some(s => s.id === item.subCategoryId)
      );

      const totalImagesInParent = subCatGroups.reduce((sum, s) => sum + s.items.length, 0) + unassigned.length;

      if (totalImagesInParent > 0) {
        result.push({
          id: pCat.id,
          name: pCat.name,
          order: pCat.order,
          subCategories: subCatGroups,
          unassignedItems: unassigned,
          totalImages: totalImagesInParent
        });
      }
    });

    const handledIds = new Set<string>();
    result.forEach(p => {
      p.subCategories.forEach(s => s.items.forEach(i => handledIds.add(i.id)));
      p.unassignedItems.forEach(i => handledIds.add(i.id));
    });

    const orphanItems = serviceItems.filter(i => !handledIds.has(i.id));
    if (orphanItems.length > 0) {
      result.push({
        id: 'other-services',
        name: 'General & Other Services',
        order: 9999,
        subCategories: [{
          id: 'general-subcat',
          name: 'General Services',
          order: 1,
          items: orphanItems
        }],
        unassignedItems: [],
        totalImages: orphanItems.length
      });
    }

    return result;
  }, [filteredItems, parentCatsList, subCatsList]);

  const handleOpenUploadModal = (item: GalleryItem) => {
    setSelectedItem(item);
    setPreviewFile(null);
    setPreviewUrl(null);
    setUploadProgress(0);
    setIsUploadModalOpen(true);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    let fileToSet = file;
    try {
      fileToSet = await compressImage(file);
    } catch (err) {
      console.error("Image compression failed, using original file:", err);
    }
    setPreviewFile(fileToSet);
    setPreviewUrl(URL.createObjectURL(fileToSet));
  };

  const handleExecuteImageChange = async () => {
    if (!selectedItem || !previewFile) return;

    setIsUploading(true);
    setUploadProgress(20);

    try {
      const formData = new FormData();
      formData.append('file', previewFile);
      formData.append('uploadPath', selectedItem.uploadFolder);

      setUploadProgress(50);
      const token = await auth.currentUser?.getIdToken();
      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      const uploadData = await uploadRes.json();

      if (!uploadRes.ok || !uploadData.success) {
        throw new Error(uploadData.error || 'Failed to upload image.');
      }

      setUploadProgress(80);
      const newImageUrl = uploadData.url;

      // Delete old image file from storage
      if (selectedItem.imageUrl && selectedItem.imageUrl !== newImageUrl) {
        try {
          await deleteObject(selectedItem.imageUrl);
        } catch (dErr) {
          console.warn("Could not delete old image from storage:", dErr);
        }
      }

      // Update MySQL Document
      if (selectedItem.collectionName === 'webSettings' && selectedItem.docId === 'featuresConfiguration' && selectedItem.adId) {
        // Handle Homepage Ad Banner update in featuresConfiguration.ads array
        const configDocRef = doc(db, 'webSettings', 'featuresConfiguration');
        const configSnap = await getDoc(configDocRef);
        if (configSnap.exists()) {
          const configData = configSnap.data() as any;
          const currentAds = Array.isArray(configData.ads) ? [...configData.ads] : [];
          const targetAdIndex = currentAds.findIndex((a: HomepageAd) => a.id === selectedItem.adId);
          if (targetAdIndex !== -1) {
            currentAds[targetAdIndex] = { ...currentAds[targetAdIndex], imageUrl: newImageUrl };
            await setDoc(configDocRef, { ads: currentAds }, { merge: true });
          }
        }
      } else if (selectedItem.collectionName === 'adminServices' && selectedItem.imageField === 'galleryImages' && selectedItem.arrayIndex !== undefined) {
        const serviceDocSnap = await getDocs(collection(db, "adminServices"));
        const targetDoc = serviceDocSnap.docs.find(d => d.id === selectedItem.docId);
        if (targetDoc) {
          const serviceData = targetDoc.data() as any;
          const currentGallery = [...(serviceData.galleryImages || [])];
          currentGallery[selectedItem.arrayIndex] = newImageUrl;
          await updateDoc(doc(db, "adminServices", selectedItem.docId), { galleryImages: currentGallery });
        }
      } else {
        await setDoc(doc(db, selectedItem.collectionName, selectedItem.docId), {
          [selectedItem.imageField]: newImageUrl
        }, { merge: true });
      }

      setUploadProgress(100);

      // Revalidate cache in background (non-blocking for instant speed)
      triggerRefresh('global-cache').catch(() => {});

      // Update local state list instantly
      setItems(prev => prev.map(item => item.id === selectedItem.id ? { ...item, imageUrl: newImageUrl } : item));

      toast({
        title: "Image Updated Successfully!",
        description: `Updated image for "${selectedItem.title}".`
      });

      setIsUploadModalOpen(false);
      restoreScrollPosition();
    } catch (err: any) {
      console.error("Error replacing image:", err);
      toast({ title: "Upload Error", description: err.message || "Could not replace image.", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const renderImageCard = (item: GalleryItem) => (
    <Card key={item.id} className="overflow-hidden group hover:shadow-xl transition-all duration-300 border border-border/60 flex flex-col justify-between">
      <div>
        {/* Image Container */}
        <div className="relative aspect-video w-full bg-slate-900/5 dark:bg-slate-800/50 overflow-hidden flex items-center justify-center border-b">
          <img 
            src={item.imageUrl} 
            alt={item.title} 
            className="object-contain max-h-full max-w-full p-2 group-hover:scale-105 transition-transform duration-300"
          />
          
          <div className="absolute top-2 left-2 flex flex-wrap gap-1">
            <Badge className="capitalize text-[10px] shadow-sm bg-background/90 text-foreground backdrop-blur-md border border-border/50">
              {item.categoryType}
            </Badge>
            {item.subCategoryName && (
              <Badge variant="outline" className="text-[10px] shadow-sm bg-primary/10 text-primary border-primary/20 backdrop-blur-md">
                {item.subCategoryName}
              </Badge>
            )}
          </div>

          {/* Hover Quick Actions */}
          <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-2 p-4 backdrop-blur-[2px]">
            <Button size="sm" variant="secondary" onClick={() => setViewingImage({ id: item.id, title: item.title, imageUrl: item.imageUrl, categoryType: item.categoryType, uploadFolder: item.uploadFolder, originalItem: item })} className="bg-white/90 text-slate-900 hover:bg-white text-xs">
              <Eye className="h-3.5 w-3.5 mr-1" /> View Full
            </Button>
            <Button size="sm" onClick={() => handleOpenUploadModal(item)} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs shadow-md">
              <Upload className="h-3.5 w-3.5 mr-1" /> Change Image
            </Button>
          </div>
        </div>

        {/* Details Container */}
        <div className="p-4">
          <h4 className="font-bold text-sm text-foreground line-clamp-1" title={item.title}>
            {item.title}
          </h4>
          <p className="text-[11px] text-muted-foreground font-mono truncate mt-1" title={item.imageUrl}>
            {item.imageUrl}
          </p>
        </div>
      </div>

      <div className="p-4 pt-0">
        <Button 
          onClick={() => handleOpenUploadModal(item)} 
          variant="outline" 
          size="sm" 
          className="w-full text-xs font-semibold hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 dark:hover:bg-emerald-950/50 transition-colors"
        >
          <Upload className="h-3.5 w-3.5 mr-1.5 text-emerald-600" />
          Change Image Directly
        </Button>
      </div>
    </Card>
  );

  const renderCustomImageCard = (item: CustomGalleryImage) => {
    const isCopied = copiedUrlId === item.id;
    const formattedSize = formatFileSize(item.fileSize);
    const formattedDate = formatDate(item.createdAt);

    return (
      <Card key={item.id} className="overflow-hidden group hover:shadow-xl transition-all duration-300 border border-border/60 flex flex-col justify-between bg-card">
        <div>
          {/* Image Thumbnail Container */}
          <div className="relative aspect-video w-full bg-slate-900/5 dark:bg-slate-800/50 overflow-hidden flex items-center justify-center border-b">
            <img 
              src={item.imageUrl} 
              alt={item.name} 
              className="object-contain max-h-full max-w-full p-2 group-hover:scale-105 transition-transform duration-300"
            />
            
            <div className="absolute top-2 left-2 flex flex-wrap gap-1">
              <Badge className="text-[10px] shadow-sm bg-purple-600 text-white backdrop-blur-md border-none font-semibold">
                Custom / Marketing
              </Badge>
              {formattedSize && (
                <Badge variant="outline" className="text-[10px] shadow-sm bg-background/90 text-foreground border-border/50 backdrop-blur-md">
                  {formattedSize}
                </Badge>
              )}
            </div>

            {/* Hover Quick Actions */}
            <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-2 p-4 backdrop-blur-[2px]">
              <Button 
                size="sm" 
                variant="secondary" 
                onClick={() => setViewingImage({ id: item.id, title: item.name, imageUrl: item.imageUrl, categoryType: 'Custom Marketing', uploadFolder: item.uploadFolder })} 
                className="bg-white/90 text-slate-900 hover:bg-white text-xs"
              >
                <Eye className="h-3.5 w-3.5 mr-1" /> View Full
              </Button>
              <Button 
                size="sm" 
                variant="secondary" 
                onClick={() => window.open(item.imageUrl, '_blank')} 
                className="bg-white/90 text-slate-900 hover:bg-white text-xs"
              >
                <ExternalLink className="h-3.5 w-3.5 mr-1" /> Open
              </Button>
            </div>
          </div>

          {/* Details Container */}
          <div className="p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <h4 className="font-bold text-sm text-foreground line-clamp-1 flex-1" title={item.name}>
                {item.name}
              </h4>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDeleteCandidate(item)}
                className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                title="Delete Image"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>

            {formattedDate && (
              <p className="text-[11px] text-muted-foreground">
                Uploaded: {formattedDate}
              </p>
            )}

            {/* Clickable URL box */}
            <div 
              onClick={() => handleCopyCustomUrl(item)}
              className="p-2 rounded-lg bg-muted/60 hover:bg-muted text-[11px] font-mono text-muted-foreground truncate cursor-pointer border border-border/50 flex items-center justify-between gap-2 transition-colors"
              title="Click to copy URL"
            >
              <span className="truncate">{item.imageUrl}</span>
              {isCopied ? (
                <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              ) : (
                <Copy className="h-3.5 w-3.5 text-muted-foreground/70 shrink-0" />
              )}
            </div>
          </div>
        </div>

        {/* Action Button: Copy URL */}
        <div className="p-4 pt-0">
          <Button 
            onClick={() => handleCopyCustomUrl(item)} 
            className="w-full text-xs font-bold transition-all shadow-sm bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {isCopied ? (
              <>
                <Check className="h-4 w-4 mr-1.5" />
                URL Copied to Clipboard!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-1.5" />
                Copy Image URL
              </>
            )}
          </Button>
        </div>
      </Card>
    );
  };

  const renderProviderImageCard = (img: ProviderGalleryImageItem) => {
    const isCopied = copiedUrlId === img.key;

    return (
      <Card key={img.key} className="overflow-hidden group hover:shadow-lg transition-all duration-300 border border-border/60 flex flex-col justify-between bg-card">
        <div>
          <div className="relative aspect-video w-full bg-slate-900/5 dark:bg-slate-800/50 overflow-hidden flex items-center justify-center border-b">
            <img 
              src={img.imageUrl} 
              alt={img.title} 
              className="object-contain max-h-full max-w-full p-2 group-hover:scale-105 transition-transform duration-300"
            />

            <div className="absolute top-2 left-2 flex flex-wrap gap-1 max-w-[90%]">
              <Badge className={cn(
                "text-[10px] shadow-sm backdrop-blur-md border-none font-semibold truncate",
                img.imageType === 'profile' ? "bg-blue-600 text-white" :
                img.imageType.startsWith('aadhaar') ? "bg-amber-600 text-white" :
                img.imageType.startsWith('pan') ? "bg-indigo-600 text-white" :
                img.imageType === 'signature' ? "bg-purple-600 text-white" :
                img.imageType === 'cancelled_cheque' ? "bg-emerald-600 text-white" :
                "bg-slate-700 text-white"
              )}>
                {img.title}
              </Badge>
            </div>

            {/* Quick Hover Overlay */}
            <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-1.5 p-2 backdrop-blur-[2px]">
              <Button 
                size="sm" 
                variant="secondary" 
                onClick={() => setViewingImage({ id: img.key, title: `${img.title} - ${img.providerName}`, imageUrl: img.imageUrl, categoryType: 'provider', uploadFolder: img.uploadFolder })} 
                className="bg-white/95 text-slate-900 hover:bg-white text-xs h-8 px-2.5 font-medium"
              >
                <Eye className="h-3.5 w-3.5 mr-1" /> View Full
              </Button>
              <Button 
                size="sm" 
                onClick={() => {
                  setReplaceProviderModalItem(img);
                  setProviderPreviewFile(null);
                  setProviderPreviewUrl(null);
                }} 
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8 px-2.5 font-medium shadow-md"
              >
                <Upload className="h-3.5 w-3.5 mr-1" /> Replace
              </Button>
            </div>
          </div>

          <div className="p-3">
            <div className="flex items-center justify-between gap-1">
              <h5 className="font-bold text-xs text-foreground line-clamp-1" title={img.title}>
                {img.title}
              </h5>
              <span className="text-[10px] text-muted-foreground uppercase font-mono shrink-0">
                {img.imageUrl.split('.').pop()?.toUpperCase() || 'IMG'}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground font-mono truncate mt-1" title={img.imageUrl}>
              {img.imageUrl}
            </p>
          </div>
        </div>

        <div className="p-3 pt-0 flex items-center gap-1.5">
          <Button 
            type="button"
            onClick={() => {
              const fullUrl = img.imageUrl.startsWith('http') ? img.imageUrl : `${window.location.origin}${img.imageUrl.startsWith('/') ? '' : '/'}${img.imageUrl}`;
              navigator.clipboard.writeText(fullUrl);
              setCopiedUrlId(img.key);
              setTimeout(() => setCopiedUrlId(null), 2500);
              toast({ title: "URL Copied! 📋", description: fullUrl });
            }} 
            variant="outline" 
            size="sm" 
            className="flex-1 text-[11px] h-8 px-2 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 dark:hover:bg-blue-950/40"
          >
            {isCopied ? <Check className="h-3.5 w-3.5 mr-1 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 mr-1 text-muted-foreground" />}
            {isCopied ? 'Copied' : 'Copy URL'}
          </Button>
          <Button 
            type="button"
            onClick={() => {
              setReplaceProviderModalItem(img);
              setProviderPreviewFile(null);
              setProviderPreviewUrl(null);
            }} 
            variant="outline" 
            size="sm" 
            className="text-[11px] h-8 px-2 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 dark:hover:bg-blue-950/40 text-blue-600"
            title="Replace Image"
          >
            <Upload className="h-3.5 w-3.5" />
          </Button>
          <Button 
            type="button"
            onClick={() => setDeleteProviderCandidate(img)} 
            variant="outline" 
            size="sm" 
            className="text-[11px] h-8 px-2 hover:bg-red-50 hover:text-red-700 hover:border-red-300 dark:hover:bg-red-950/40 text-destructive"
            title="Delete Image"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </Card>
    );
  };

  const renderServerImageCard = (file: ServerImageFile) => {
    const isCopied = copiedUrlId === file.url;
    const formattedSize = formatFileSize(file.fileSize);
    const formattedDate = new Date(file.modifiedAt).toLocaleDateString();

    return (
      <Card key={file.url} className="overflow-hidden group hover:shadow-lg transition-all duration-300 border border-border/60 flex flex-col justify-between bg-card">
        <div>
          <div className="relative aspect-video w-full bg-slate-900/5 dark:bg-slate-800/50 overflow-hidden flex items-center justify-center border-b">
            <img 
              src={file.url} 
              alt={file.fileName} 
              className="object-contain max-h-full max-w-full p-2 group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />

            <div className="absolute top-2 left-2 flex flex-wrap gap-1">
              <Badge className="text-[10px] shadow-sm bg-amber-600 text-white backdrop-blur-md border-none font-semibold">
                {file.folder}
              </Badge>
              {formattedSize && (
                <Badge variant="outline" className="text-[10px] shadow-sm bg-background/90 text-foreground border-border/50 backdrop-blur-md">
                  {formattedSize}
                </Badge>
              )}
            </div>

            {/* Quick Hover Overlay */}
            <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-1.5 p-2 backdrop-blur-[2px]">
              <Button 
                size="sm" 
                variant="secondary" 
                onClick={() => setViewingImage({ id: file.url, title: file.fileName, imageUrl: file.url, categoryType: 'server', uploadFolder: file.folder })} 
                className="bg-white/95 text-slate-900 hover:bg-white text-xs h-8 px-2.5 font-medium"
              >
                <Eye className="h-3.5 w-3.5 mr-1" /> View Full
              </Button>
              <Button 
                size="sm" 
                variant="secondary"
                onClick={() => window.open(file.url, '_blank')} 
                className="bg-slate-800 text-white hover:bg-slate-700 text-xs h-8 px-2.5 font-medium"
              >
                <ExternalLink className="h-3.5 w-3.5 mr-1" /> Open
              </Button>
            </div>
          </div>

          <div className="p-3">
            <h5 className="font-bold text-xs text-foreground line-clamp-1" title={file.fileName}>
              {file.fileName}
            </h5>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1">
              <span className="font-mono truncate max-w-[130px]">{file.url}</span>
              <span>{formattedDate}</span>
            </div>
          </div>
        </div>

        <div className="p-3 pt-0 flex items-center gap-1.5">
          <Button 
            type="button"
            onClick={() => {
              const fullUrl = file.url.startsWith('http') ? file.url : `${window.location.origin}${file.url.startsWith('/') ? '' : '/'}${file.url}`;
              navigator.clipboard.writeText(fullUrl);
              setCopiedUrlId(file.url);
              setTimeout(() => setCopiedUrlId(null), 2500);
              toast({ title: "URL Copied! 📋", description: fullUrl });
            }} 
            variant="outline" 
            size="sm" 
            className="flex-1 text-[11px] h-8 px-2 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-300 dark:hover:bg-amber-950/40"
          >
            {isCopied ? <Check className="h-3.5 w-3.5 mr-1 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 mr-1 text-muted-foreground" />}
            {isCopied ? 'Copied' : 'Copy URL'}
          </Button>
          <Button 
            type="button"
            onClick={() => setDeleteServerImageCandidate(file)} 
            variant="outline" 
            size="sm" 
            className="text-[11px] h-8 px-2 hover:bg-red-50 hover:text-red-700 hover:border-red-300 dark:hover:bg-red-950/40 text-destructive"
            title="Delete Permanently"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </Card>
    );
  };

  return (
    <PermissionGuard moduleId="image_gallery" action="read">
      <div className="space-y-6">
        {/* Header Card */}
        <Card className="border-none shadow-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 text-white overflow-hidden relative">
          <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 opacity-10 pointer-events-none">
            <ImageIcon size={300} />
          </div>
          <CardHeader className="relative z-10 p-6 md:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <Badge className="bg-white/20 text-white hover:bg-white/30 backdrop-blur-md mb-2 border-none">
                  <Sparkles className="h-3.5 w-3.5 mr-1" /> Media Asset Manager
                </Badge>
                <CardTitle className="text-3xl md:text-4xl font-extrabold tracking-tight">Website Image Gallery</CardTitle>
                <CardDescription className="text-emerald-100 text-sm md:text-base mt-1 max-w-2xl">
                  Manage, preview, and directly change any image across Categories, Sub-Categories, Services, Slideshows, Ad Banners, Popups, Blogs, and Site Logos.
                </CardDescription>
              </div>
              <Button 
                onClick={() => { fetchAllWebsiteImages(); fetchCustomImages(); fetchProviderImages(); fetchServerImages(); }} 
                disabled={isLoading || isLoadingCustom || isLoadingProviders || isLoadingServerImages}
                className="bg-white text-emerald-800 hover:bg-emerald-50 font-bold shadow-lg shrink-0 rounded-xl"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading || isLoadingCustom || isLoadingProviders || isLoadingServerImages ? 'animate-spin' : ''}`} />
                Refresh Gallery
              </Button>
            </div>
          </CardHeader>
        </Card>

        {/* Stats Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
          <Card className="p-3.5 shadow-sm border border-border/50">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-emerald-500/10 text-emerald-600 rounded-xl">
                <ImageIcon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground font-medium truncate">Total Website</p>
                <p className="text-xl font-black">{items.length}</p>
              </div>
            </div>
          </Card>
          <Card className="p-3.5 shadow-sm border border-border/50">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-blue-500/10 text-blue-600 rounded-xl">
                <FolderTree className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground font-medium truncate">Categories</p>
                <p className="text-xl font-black">{items.filter(i => i.categoryType === 'category' || i.categoryType === 'subcategory').length}</p>
              </div>
            </div>
          </Card>
          <Card className="p-3.5 shadow-sm border border-border/50">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-indigo-500/10 text-indigo-600 rounded-xl">
                <Wrench className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground font-medium truncate">Services</p>
                <p className="text-xl font-black">{items.filter(i => i.categoryType === 'service').length}</p>
              </div>
            </div>
          </Card>
          <Card className="p-3.5 shadow-sm border border-border/50">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-rose-500/10 text-rose-600 rounded-xl">
                <Tv className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground font-medium truncate">Banners/Ads</p>
                <p className="text-xl font-black">{items.filter(i => i.categoryType === 'slideshow' || i.categoryType === 'ad' || i.categoryType === 'popup' || i.categoryType === 'blog' || i.categoryType === 'branding').length}</p>
              </div>
            </div>
          </Card>
          <Card className="p-3.5 shadow-sm border border-border/50 bg-purple-50/40 dark:bg-purple-950/20">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-purple-500/10 text-purple-600 rounded-xl">
                <Share2 className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground font-medium truncate">Marketing</p>
                <p className="text-xl font-black text-purple-700 dark:text-purple-300">{customImages.length}</p>
              </div>
            </div>
          </Card>
          <Card className="p-3.5 shadow-sm border border-border/50 bg-sky-50/40 dark:bg-sky-950/20">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-blue-500/10 text-blue-600 rounded-xl">
                <Users className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground font-medium truncate">Providers</p>
                <p className="text-xl font-black text-blue-700 dark:text-blue-300">{totalProviderImages}</p>
              </div>
            </div>
          </Card>
          <Card className="p-3.5 shadow-sm border border-border/50 bg-amber-50/40 dark:bg-amber-950/20">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-amber-500/10 text-amber-600 rounded-xl">
                <HardDrive className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground font-medium truncate">Server Files</p>
                <p className="text-xl font-black text-amber-700 dark:text-amber-300">{serverImages.length}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Filter Controls */}
        <Card className="p-4 shadow-sm">
          <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={
                  activeTab === 'custom' ? "Search custom images by name..." :
                  activeTab === 'providers' ? "Search provider name, phone, email, document..." :
                  activeTab === 'other' ? "Search file name, folder, or URL..." :
                  "Search images by title or category..."
                }
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            
            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full md:w-auto">
              <TabsList className="flex flex-wrap gap-1 w-full md:w-auto h-auto p-1.5 bg-muted/70 rounded-xl">
                <TabsTrigger value="all" className="text-xs py-1.5 px-3">All ({items.length})</TabsTrigger>
                <TabsTrigger value="category" className="text-xs py-1.5 px-3">Categories ({items.filter(i => i.categoryType === 'category').length})</TabsTrigger>
                <TabsTrigger value="subcategory" className="text-xs py-1.5 px-3">Sub-Categories ({items.filter(i => i.categoryType === 'subcategory').length})</TabsTrigger>
                <TabsTrigger value="service" className="text-xs py-1.5 px-3">Services ({items.filter(i => i.categoryType === 'service').length})</TabsTrigger>
                <TabsTrigger value="slideshow" className="text-xs py-1.5 px-3">Slideshows ({items.filter(i => i.categoryType === 'slideshow').length})</TabsTrigger>
                <TabsTrigger value="ad" className="text-xs py-1.5 px-3">Ad Banners ({items.filter(i => i.categoryType === 'ad').length})</TabsTrigger>
                <TabsTrigger value="popup" className="text-xs py-1.5 px-3">Popups ({items.filter(i => i.categoryType === 'popup').length})</TabsTrigger>
                <TabsTrigger value="blog" className="text-xs py-1.5 px-3">Blogs ({items.filter(i => i.categoryType === 'blog').length})</TabsTrigger>
                <TabsTrigger value="branding" className="text-xs py-1.5 px-3">Branding</TabsTrigger>
                <TabsTrigger value="custom" className="text-xs py-1.5 px-3 bg-purple-500/15 text-purple-800 dark:text-purple-300 data-[state=active]:bg-purple-600 data-[state=active]:text-white font-bold">
                  Custom ({customImages.length})
                </TabsTrigger>
                <TabsTrigger value="providers" className="text-xs py-1.5 px-3 bg-blue-500/15 text-blue-800 dark:text-blue-300 data-[state=active]:bg-blue-600 data-[state=active]:text-white font-bold">
                  <Users className="h-3.5 w-3.5 mr-1 inline-block" />
                  Provider Images ({totalProviderImages})
                </TabsTrigger>
                <TabsTrigger value="other" className="text-xs py-1.5 px-3 bg-amber-500/15 text-amber-800 dark:text-amber-300 data-[state=active]:bg-amber-600 data-[state=active]:text-white font-bold">
                  <HardDrive className="h-3.5 w-3.5 mr-1 inline-block" />
                  Other Server Images ({serverImages.length})
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </Card>

        {/* Image Display Content */}
        {activeTab === 'custom' ? (
          <div className="space-y-6">
            {/* Informational Guidance Banner */}
            <Card className="border-purple-500/30 bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-pink-500/10 p-5 shadow-sm">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-purple-500/20 text-purple-700 dark:text-purple-300 rounded-xl mt-0.5 sm:mt-0">
                    <Share2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-foreground flex items-center gap-2">
                      Marketing & Social Media Custom Images
                      <Badge className="bg-purple-600 text-white border-none text-[10px]">Private Assets</Badge>
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1 max-w-2xl leading-relaxed">
                      Upload images here to get shareable public URLs. These images are <strong>strictly standalone</strong> and will <strong>NOT be visible anywhere on your public website</strong> (not in categories, services, slideshows, or popups). Perfect for Facebook, Instagram, WhatsApp, email marketing, or external ads.
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Upload Box Card */}
            <Card className="border border-border/70 shadow-sm overflow-hidden">
              <CardHeader className="bg-muted/30 border-b pb-4">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Upload className="h-4 w-4 text-purple-600" />
                  Upload New Custom Image(s)
                </CardTitle>
                <CardDescription className="text-xs">
                  Choose one or multiple images from your computer. Files will be automatically optimized and hosted.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="border-2 border-dashed border-border/80 hover:border-purple-500/60 transition-colors rounded-2xl p-6 sm:p-8 text-center bg-muted/10 flex flex-col items-center justify-center gap-4">
                  <div className="p-4 bg-purple-500/10 text-purple-600 rounded-full">
                    <ImageIcon className="h-8 w-8" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-bold text-sm text-foreground">Drag & drop or select image files</p>
                    <p className="text-xs text-muted-foreground">Supported: JPG, PNG, WEBP, GIF, SVG (Max 5MB each)</p>
                  </div>
                  <div>
                    <input
                      id="custom-file-upload-input"
                      type="file"
                      accept="image/png, image/jpeg, image/webp, image/gif, image/svg+xml"
                      multiple
                      onChange={handleCustomUpload}
                      disabled={isUploadingCustom}
                      className="hidden"
                    />
                    <label htmlFor="custom-file-upload-input">
                      <Button
                        type="button"
                        disabled={isUploadingCustom}
                        onClick={() => document.getElementById('custom-file-upload-input')?.click()}
                        className="bg-purple-600 hover:bg-purple-700 text-white font-bold cursor-pointer"
                      >
                        {isUploadingCustom ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Uploading & Optimizing...
                          </>
                        ) : (
                          <>
                            <Plus className="h-4 w-4 mr-2" />
                            Select & Upload Images
                          </>
                        )}
                      </Button>
                    </label>
                  </div>

                  {isUploadingCustom && (
                    <div className="w-full max-w-md space-y-2 mt-2">
                      <Progress value={customUploadProgress} className="h-2" />
                      <p className="text-xs text-center text-muted-foreground">Processing and saving images... {customUploadProgress}%</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Custom Images Grid */}
            {isLoadingCustom ? (
              <div className="flex flex-col items-center justify-center min-h-[250px] gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
                <p className="text-xs text-muted-foreground">Loading custom images...</p>
              </div>
            ) : filteredCustomImages.length === 0 ? (
              <Card className="p-12 text-center shadow-sm">
                <ImageIcon className="mx-auto h-12 w-12 text-muted-foreground/30 mb-3" />
                <h3 className="text-lg font-bold">No Custom Images Found</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
                  {searchTerm.trim() 
                    ? `No custom images match "${searchTerm}".` 
                    : "You haven't uploaded any custom marketing images yet. Use the upload box above to upload your first image."}
                </p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                {filteredCustomImages.map(item => renderCustomImageCard(item))}
              </div>
            )}
          </div>
        ) : activeTab === 'providers' ? (
          <div className="space-y-6">
            {/* Guidance Banner */}
            <Card className="border-blue-500/30 bg-gradient-to-r from-blue-500/10 via-sky-500/10 to-indigo-500/10 p-5 shadow-sm">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-blue-500/20 text-blue-700 dark:text-blue-300 rounded-xl mt-0.5 sm:mt-0">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-foreground flex items-center gap-2">
                      Provider Documents & Profile Images
                      <Badge className="bg-blue-600 text-white border-none text-[10px]">KYC & Verification</Badge>
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1 max-w-3xl leading-relaxed">
                      Provider-wise gallery displaying profile photos, Aadhaar (Front/Back), PAN (Front/Back), Additional Documents, Digital Signatures, and Bank Cancelled Cheques. You can view full size, copy image URLs, replace any image directly with a new upload, or delete individual files permanently.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                  <Select value={providerFilterStatus} onValueChange={setProviderFilterStatus}>
                    <SelectTrigger className="h-9 text-xs w-full sm:w-40 bg-background/80">
                      <SelectValue placeholder="Status Filter" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="pending_review">Pending Review</SelectItem>
                      <SelectItem value="needs_update">Needs Update</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={fetchProviderImages}
                    disabled={isLoadingProviders}
                    className="h-9 px-3 text-xs bg-background/80"
                    title="Refresh Provider Images"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isLoadingProviders ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>
              </div>
            </Card>

            {/* Provider List */}
            {isLoadingProviders ? (
              <div className="flex flex-col items-center justify-center min-h-[300px] gap-3">
                <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
                <p className="text-xs text-muted-foreground font-medium">Loading provider documents and images...</p>
              </div>
            ) : filteredProviderGroups.length === 0 ? (
              <Card className="p-12 text-center shadow-sm">
                <Users className="mx-auto h-12 w-12 text-muted-foreground/30 mb-3" />
                <h3 className="text-lg font-bold">No Provider Images Found</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
                  {searchTerm.trim() 
                    ? `No provider documents match "${searchTerm}".`
                    : "No provider profiles with uploaded images found."}
                </p>
              </Card>
            ) : (
              <div className="space-y-6">
                {filteredProviderGroups.map((group) => (
                  <Card key={group.providerId} className="overflow-hidden border border-border/70 shadow-sm bg-card">
                    {/* Provider Header Bar */}
                    <div className="p-4 sm:px-6 bg-muted/40 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar className="h-10 w-10 border border-primary/20 shrink-0">
                          {group.avatarUrl ? (
                            <AvatarImage src={group.avatarUrl} alt={group.providerName} />
                          ) : null}
                          <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs uppercase">
                            {group.providerName.slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-bold text-sm text-foreground truncate">{group.providerName}</h4>
                            <Badge variant={
                              group.status === 'approved' ? 'default' :
                              group.status === 'rejected' ? 'destructive' :
                              group.status === 'needs_update' ? 'outline' : 'secondary'
                            } className="text-[10px] capitalize py-0 h-4">
                              {group.status.replace(/_/g, ' ')}
                            </Badge>
                            {group.primaryCategory && (
                              <Badge variant="outline" className="text-[10px] py-0 h-4 bg-muted/60 text-muted-foreground">
                                {group.primaryCategory}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 truncate">
                            {group.providerMobile && (
                              <span className="flex items-center gap-1">
                                <Phone className="h-3 w-3" /> {group.providerMobile}
                              </span>
                            )}
                            {group.providerEmail && (
                              <span className="flex items-center gap-1 truncate">
                                <Mail className="h-3 w-3" /> {group.providerEmail}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Badge className="bg-blue-600/15 text-blue-700 dark:text-blue-300 border border-blue-500/20 text-xs px-2.5 py-0.5 font-bold">
                          {group.images.length} {group.images.length === 1 ? 'image' : 'images'}
                        </Badge>
                      </div>
                    </div>

                    {/* Images Grid */}
                    <CardContent className="p-4 sm:p-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {group.images.map((img) => renderProviderImageCard(img))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        ) : activeTab === 'other' ? (
          <div className="space-y-6">
            {/* Other Images Guidance & Header */}
            <Card className="border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-yellow-500/10 p-5 shadow-sm">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-amber-500/20 text-amber-700 dark:text-amber-300 rounded-xl mt-0.5 sm:mt-0">
                    <HardDrive className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-foreground flex items-center gap-2">
                      All Server Media & Files (public/uploads)
                      <Badge className="bg-amber-600 text-white border-none text-[10px]">Disk Storage</Badge>
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1 max-w-3xl leading-relaxed">
                      Complete filesystem view of all image files stored on the server. You can view full size, copy direct public links, upload new files to specific upload folders, or permanently delete unused files to free up server disk space.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 flex-wrap">
                  <Button
                    size="sm"
                    onClick={() => setIsUploadServerModalOpen(true)}
                    className="h-9 text-xs bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl"
                  >
                    <Upload className="h-3.5 w-3.5 mr-1.5" />
                    Upload Image
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={fetchServerImages}
                    disabled={isLoadingServerImages}
                    className="h-9 px-3 text-xs bg-background/80"
                    title="Rescan Server Directory"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isLoadingServerImages ? 'animate-spin' : ''}`} />
                    Rescan
                  </Button>
                </div>
              </div>

              {/* Folder Filter & Summary Bar */}
              <div className="mt-4 pt-4 border-t border-amber-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-muted-foreground flex items-center gap-1">
                    <FolderOpen className="h-3.5 w-3.5" /> Folder:
                  </span>
                  <button
                    type="button"
                    onClick={() => setServerFolderFilter('all')}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-xs font-medium transition-all",
                      serverFolderFilter === 'all'
                        ? "bg-amber-600 text-white shadow-xs font-bold"
                        : "bg-background/80 text-muted-foreground hover:text-foreground border"
                    )}
                  >
                    All ({serverImages.length})
                  </button>
                  {serverFolders.map((f) => {
                    const count = serverImages.filter((img) => img.folder === f).length;
                    return (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setServerFolderFilter(f)}
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-xs font-medium transition-all capitalize",
                          serverFolderFilter === f
                            ? "bg-amber-600 text-white shadow-xs font-bold"
                            : "bg-background/80 text-muted-foreground hover:text-foreground border"
                        )}
                      >
                        {f} ({count})
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2 text-muted-foreground font-mono text-[11px] shrink-0">
                  <Badge variant="outline" className="bg-background/80 font-mono">
                    {filteredServerImages.length} files • {formatFileSize(serverTotalSize)} Total
                  </Badge>
                </div>
              </div>
            </Card>

            {/* Grid of Server Files */}
            {isLoadingServerImages ? (
              <div className="flex flex-col items-center justify-center min-h-[300px] gap-3">
                <Loader2 className="h-10 w-10 animate-spin text-amber-600" />
                <p className="text-xs text-muted-foreground font-medium">Scanning server storage directory...</p>
              </div>
            ) : filteredServerImages.length === 0 ? (
              <Card className="p-12 text-center shadow-sm">
                <HardDrive className="mx-auto h-12 w-12 text-muted-foreground/30 mb-3" />
                <h3 className="text-lg font-bold">No Server Images Found</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
                  {searchTerm.trim()
                    ? `No server files match "${searchTerm}".`
                    : serverFolderFilter !== 'all'
                    ? `No files found in folder "${serverFolderFilter}".`
                    : "No image files found on server."}
                </p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredServerImages.map((file) => renderServerImageCard(file))}
              </div>
            )}
          </div>
        ) : isLoading ? (
          <div className="flex flex-col items-center justify-center min-h-[300px] gap-3">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Gathering all website images...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <Card className="p-12 text-center shadow-sm">
            <ImageIcon className="mx-auto h-12 w-12 text-muted-foreground/40 mb-3" />
            <h3 className="text-lg font-bold">No images found</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto mt-1">
              No website images match your search or selected category filter.
            </p>
          </Card>
        ) : activeTab === 'subcategory' ? (
          /* SUB-CATEGORIES GROUPED CATEGORY-WISE MATCHING /admin/sub-categories */
          <div className="space-y-8">
            {groupedSubCategoryHierarchy.length === 0 ? (
              <Card className="p-12 text-center shadow-sm">
                <Layers className="mx-auto h-12 w-12 text-muted-foreground/40 mb-3" />
                <h3 className="text-lg font-bold">No Sub-Category Images Found</h3>
              </Card>
            ) : (
              groupedSubCategoryHierarchy.map(pCat => (
                <Card key={pCat.id} className="overflow-hidden border border-border/80 shadow-md">
                  {/* Parent Category Header */}
                  <div className="p-4 bg-slate-900/5 dark:bg-slate-800/40 border-b border-border/60 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-500/10 text-blue-600 rounded-lg">
                        <FolderTree className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-lg text-foreground flex items-center gap-2">
                          {pCat.name}
                          <Badge variant="secondary" className="text-xs bg-blue-500/15 text-blue-700 dark:text-blue-300 border-none font-bold">
                            {pCat.totalImages} {pCat.totalImages === 1 ? 'Sub-Category' : 'Sub-Categories'}
                          </Badge>
                        </h3>
                      </div>
                    </div>
                  </div>

                  <CardContent className="p-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                      {pCat.subCategories[0]?.items.map(item => renderImageCard(item))}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        ) : activeTab === 'category' ? (
          /* ORDER-WISE CATEGORIES DISPLAY MATCHING /admin/categories */
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {orderedCategories.map(item => renderImageCard(item))}
          </div>
        ) : activeTab === 'service' ? (
          /* NESTED CATEGORY & SUB-CATEGORY HIERARCHY MATCHING /admin/daily-providers */
          <div className="space-y-8">
            {groupedServicesHierarchy.length === 0 ? (
              <Card className="p-12 text-center shadow-sm">
                <Wrench className="mx-auto h-12 w-12 text-muted-foreground/40 mb-3" />
                <h3 className="text-lg font-bold">No Service Images Found</h3>
              </Card>
            ) : (
              groupedServicesHierarchy.map(pCat => (
                <Card key={pCat.id} className="overflow-hidden border border-border/80 shadow-md">
                  {/* Parent Category Header */}
                  <div className="p-4 bg-slate-900/5 dark:bg-slate-800/40 border-b border-border/60 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-emerald-500/10 text-emerald-600 rounded-lg">
                        <FolderTree className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-lg text-foreground flex items-center gap-2">
                          {pCat.name}
                          <Badge variant="secondary" className="text-xs bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-none font-bold">
                            {pCat.totalImages} {pCat.totalImages === 1 ? 'Image' : 'Images'}
                          </Badge>
                        </h3>
                      </div>
                    </div>
                  </div>

                  <CardContent className="p-6 space-y-8">
                    {/* Sub-Category Sections */}
                    {pCat.subCategories.map(subCat => (
                      <div key={subCat.id} className="space-y-4">
                        <div className="flex items-center gap-2 pb-2 border-b border-border/40">
                          <Layers className="h-4 w-4 text-emerald-500" />
                          <h4 className="font-bold text-base text-foreground flex items-center gap-2">
                            {subCat.name}
                            <span className="text-xs text-muted-foreground font-normal">({subCat.items.length} images)</span>
                          </h4>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                          {subCat.items.map(item => renderImageCard(item))}
                        </div>
                      </div>
                    ))}

                    {/* Unassigned Parent Category Items */}
                    {pCat.unassignedItems.length > 0 && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 pb-2 border-b border-border/40">
                          <ChevronRight className="h-4 w-4 text-emerald-500" />
                          <h4 className="font-bold text-base text-foreground">Direct Service Images</h4>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                          {pCat.unassignedItems.map(item => renderImageCard(item))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        ) : (
          /* STANDARD GRID DISPLAY FOR ALL OTHER TABS */
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {filteredItems.map(item => renderImageCard(item))}
          </div>
        )}

        {/* Change Image Modal */}
        <Dialog open={isUploadModalOpen} onOpenChange={setIsUploadModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-emerald-600" />
                Change Image Directly
              </DialogTitle>
              <DialogDescription>
                Select a new image file from your computer to replace the image for <span className="font-bold text-foreground">"{selectedItem?.title}"</span> across the website.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-3">
              {/* Current vs New Preview */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 text-center">
                  <Label className="text-xs text-muted-foreground">Current Image</Label>
                  <div className="h-28 rounded-lg border bg-muted/40 p-2 flex items-center justify-center overflow-hidden">
                    {selectedItem?.imageUrl && (
                      <img src={selectedItem.imageUrl} alt="Current" className="max-h-full max-w-full object-contain" />
                    )}
                  </div>
                </div>
                <div className="space-y-1.5 text-center">
                  <Label className="text-xs text-muted-foreground">New Replacement</Label>
                  <div className="h-28 rounded-lg border-2 border-dashed border-emerald-500/50 bg-emerald-50/20 dark:bg-emerald-950/20 p-2 flex items-center justify-center overflow-hidden">
                    {previewUrl ? (
                      <img src={previewUrl} alt="Preview" className="max-h-full max-w-full object-contain" />
                    ) : (
                      <span className="text-xs text-muted-foreground">No file chosen</span>
                    )}
                  </div>
                </div>
              </div>

              {/* File Input */}
              <div className="space-y-1.5">
                <Label htmlFor="image-file-input" className="text-xs font-semibold">Choose New Image File</Label>
                <Input
                  id="image-file-input"
                  type="file"
                  accept="image/png, image/jpeg, image/webp, image/svg+xml"
                  onChange={handleFileSelect}
                  disabled={isUploading}
                  className="file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-emerald-600 file:text-white hover:file:bg-emerald-700"
                />
              </div>

              {/* Upload Progress Bar */}
              {isUploading && (
                <div className="space-y-1">
                  <Progress value={uploadProgress} className="h-2" />
                  <p className="text-xs text-center text-muted-foreground">Uploading and updating database... {uploadProgress}%</p>
                </div>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="ghost" onClick={() => setIsUploadModalOpen(false)} disabled={isUploading}>
                Cancel
              </Button>
              <Button 
                onClick={handleExecuteImageChange} 
                disabled={!previewFile || isUploading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              >
                {isUploading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                Replace Image Now
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Full Image View Dialog */}
        <Dialog open={!!viewingImage} onOpenChange={() => setViewingImage(null)}>
          <DialogContent className="max-w-4xl p-0 overflow-hidden bg-slate-950 text-white border border-slate-800 shadow-2xl rounded-2xl flex flex-col justify-between">
            <div className="p-4 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between">
              <div>
                <DialogTitle className="text-base font-bold text-white">{viewingImage?.title}</DialogTitle>
                <DialogDescription className="font-mono text-xs text-slate-400 truncate max-w-md">
                  {viewingImage?.imageUrl}
                </DialogDescription>
              </div>
              <Badge className="capitalize text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {viewingImage?.categoryType}
              </Badge>
            </div>
            
            <div className="w-full min-h-[40vh] max-h-[65vh] p-6 flex items-center justify-center bg-black/60 overflow-hidden">
              {viewingImage?.imageUrl && (
                <img 
                  src={viewingImage.imageUrl} 
                  alt={viewingImage.title} 
                  className="max-h-[55vh] max-w-full object-contain rounded-lg shadow-2xl transition-transform duration-300" 
                />
              )}
            </div>
            
            <div className="p-4 bg-slate-900/80 border-t border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-400 font-mono">Folder: public/uploads/{viewingImage?.uploadFolder}</span>
              {viewingImage?.originalItem ? (
                <Button size="sm" onClick={() => { const item = viewingImage.originalItem; setViewingImage(null); if (item) handleOpenUploadModal(item); }} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
                  <Upload className="h-4 w-4 mr-1.5" /> Change This Image
                </Button>
              ) : viewingImage?.imageUrl ? (
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="secondary" onClick={() => window.open(viewingImage.imageUrl, '_blank')} className="text-xs bg-white/90 text-slate-900 hover:bg-white">
                    <ExternalLink className="h-3.5 w-3.5 mr-1" /> Open New Tab
                  </Button>
                  <Button size="sm" onClick={() => {
                    const fullUrl = viewingImage.imageUrl.startsWith('http') ? viewingImage.imageUrl : `${window.location.origin}${viewingImage.imageUrl.startsWith('/') ? '' : '/'}${viewingImage.imageUrl}`;
                    navigator.clipboard.writeText(fullUrl);
                    toast({ title: "URL Copied to Clipboard! 📋", description: fullUrl });
                  }} className="bg-purple-600 hover:bg-purple-700 text-white font-bold">
                    <Copy className="h-4 w-4 mr-1.5" /> Copy Image URL
                  </Button>
                </div>
              ) : null}
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Custom Image Confirmation Dialog */}
        <AlertDialog open={!!deleteCandidate} onOpenChange={(open) => !open && setDeleteCandidate(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                <Trash2 className="h-5 w-5" />
                Delete Custom Image
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <span>Are you sure you want to permanently delete <strong className="text-foreground">"{deleteCandidate?.name}"</strong>?</span>
                <span className="block text-xs text-muted-foreground">This will remove the image file from server storage and delete its record. Anyone with the copied link will no longer be able to access it.</span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeletingCustom}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  handleExecuteDeleteCustomImage();
                }}
                disabled={isDeletingCustom}
                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold"
              >
                {isDeletingCustom ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}
                Permanently Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Replace Provider Image Dialog */}
        <Dialog open={!!replaceProviderModalItem} onOpenChange={(open) => !open && setReplaceProviderModalItem(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-blue-600" />
                Replace Provider Image
              </DialogTitle>
              <DialogDescription>
                Upload a new image file to replace <span className="font-bold text-foreground">"{replaceProviderModalItem?.title}"</span> for provider <span className="font-bold text-foreground">{replaceProviderModalItem?.providerName}</span>.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 text-center">
                  <Label className="text-xs text-muted-foreground">Current Image</Label>
                  <div className="h-28 rounded-lg border bg-muted/40 p-2 flex items-center justify-center overflow-hidden">
                    {replaceProviderModalItem?.imageUrl && (
                      <img src={replaceProviderModalItem.imageUrl} alt="Current" className="max-h-full max-w-full object-contain" />
                    )}
                  </div>
                </div>
                <div className="space-y-1.5 text-center">
                  <Label className="text-xs text-muted-foreground">New Replacement</Label>
                  <div className="h-28 rounded-lg border-2 border-dashed border-blue-500/50 bg-blue-50/20 dark:bg-blue-950/20 p-2 flex items-center justify-center overflow-hidden">
                    {providerPreviewUrl ? (
                      <img src={providerPreviewUrl} alt="Preview" className="max-h-full max-w-full object-contain" />
                    ) : (
                      <span className="text-xs text-muted-foreground">No file chosen</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="provider-replace-file" className="text-xs font-semibold">Choose New Image File</Label>
                <Input
                  id="provider-replace-file"
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  disabled={isReplacingProviderImage}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setProviderPreviewFile(file);
                      setProviderPreviewUrl(URL.createObjectURL(file));
                    }
                  }}
                  className="file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700"
                />
              </div>

              {isReplacingProviderImage && (
                <div className="space-y-1">
                  <Progress value={providerReplaceProgress} className="h-2" />
                  <p className="text-xs text-center text-muted-foreground">Replacing and updating provider record... {providerReplaceProgress}%</p>
                </div>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="ghost" onClick={() => setReplaceProviderModalItem(null)} disabled={isReplacingProviderImage}>
                Cancel
              </Button>
              <Button
                onClick={handleExecuteReplaceProviderImage}
                disabled={!providerPreviewFile || isReplacingProviderImage}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
              >
                {isReplacingProviderImage ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                Replace Image Now
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Provider Image Alert Dialog */}
        <AlertDialog open={!!deleteProviderCandidate} onOpenChange={(open) => !open && setDeleteProviderCandidate(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                <Trash2 className="h-5 w-5" />
                Delete Provider Image
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <span>Are you sure you want to delete <strong className="text-foreground">"{deleteProviderCandidate?.title}"</strong> for provider <strong className="text-foreground">{deleteProviderCandidate?.providerName}</strong>?</span>
                <span className="block text-xs text-muted-foreground">This will remove the file from storage and clear this document from their application profile.</span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeletingProviderImage}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  handleExecuteDeleteProviderImage();
                }}
                disabled={isDeletingProviderImage}
                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold"
              >
                {isDeletingProviderImage ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}
                Delete Image
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete Server Image Alert Dialog */}
        <AlertDialog open={!!deleteServerImageCandidate} onOpenChange={(open) => !open && setDeleteServerImageCandidate(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                <Trash2 className="h-5 w-5" />
                Delete Image File From Server
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <span>Are you sure you want to permanently delete <strong className="text-foreground">"{deleteServerImageCandidate?.fileName}"</strong> from folder <strong className="text-foreground">uploads/{deleteServerImageCandidate?.folder}</strong>?</span>
                <span className="block text-xs text-destructive/80 font-semibold">⚠️ WARNING: This file will be unlinked from disk permanently. If any webpage or service still uses this URL, it will become broken.</span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeletingServerImage}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  handleExecuteDeleteServerImage();
                }}
                disabled={isDeletingServerImage}
                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold"
              >
                {isDeletingServerImage ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}
                Permanently Delete File
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Upload Directly to Server Modal */}
        <Dialog open={isUploadServerModalOpen} onOpenChange={setIsUploadServerModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-amber-600" />
                Upload Image to Server
              </DialogTitle>
              <DialogDescription>
                Choose target upload folder and select one or more images to save on the server.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Target Server Folder (public/uploads/...)</Label>
                <Select value={otherUploadFolder} onValueChange={setOtherUploadFolder}>
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="Select folder" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">general (Default)</SelectItem>
                    <SelectItem value="ads">ads</SelectItem>
                    <SelectItem value="blog">blog</SelectItem>
                    <SelectItem value="categories">categories</SelectItem>
                    <SelectItem value="services">services</SelectItem>
                    <SelectItem value="slideshows">slideshows</SelectItem>
                    <SelectItem value="subcategories">subcategories</SelectItem>
                    <SelectItem value="branding">branding</SelectItem>
                    <SelectItem value="custom">custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="server-file-input" className="text-xs font-semibold">Select Image Files</Label>
                <Input
                  id="server-file-input"
                  type="file"
                  multiple
                  accept="image/png, image/jpeg, image/webp, image/svg+xml, image/gif"
                  disabled={isUploadingOther}
                  onChange={handleOtherUpload}
                  className="file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-amber-600 file:text-white hover:file:bg-amber-700"
                />
              </div>

              {isUploadingOther && (
                <div className="space-y-1">
                  <Progress value={otherUploadProgress} className="h-2" />
                  <p className="text-xs text-center text-muted-foreground">Uploading files to server... {otherUploadProgress}%</p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setIsUploadServerModalOpen(false)} disabled={isUploadingOther}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PermissionGuard>
  );
}
