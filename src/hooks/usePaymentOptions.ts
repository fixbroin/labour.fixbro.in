"use client";

import { useMemo, useState, useEffect } from 'react';
import { CreditCard, HandCoins } from 'lucide-react';
import { useApplicationConfig } from '@/hooks/useApplicationConfig';
import { getActiveCheckoutEntries } from '@/lib/cartManager';
import { db } from '@/lib/firebase';
import { doc, getDoc } from '@/lib/mysqlDb';
import type { FirestoreService } from '@/types/firestore';

export interface PaymentOptionItem {
  value: string;
  label: string;
  description: string;
  icon: any;
  available: boolean;
}

export function usePaymentOptions() {
  const { config: appConfig, isLoading: isLoadingAppSettings } = useApplicationConfig();
  const [serviceDetailsMap, setServiceDetailsMap] = useState<Record<string, FirestoreService>>({});
  const [isLoadingServices, setIsLoadingServices] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchServiceDetails = async () => {
      const cartEntries = getActiveCheckoutEntries();
      if (cartEntries.length === 0) {
        if (isMounted) setIsLoadingServices(false);
        return;
      }
      try {
        const detailsPromises = cartEntries.map(async (entry) => {
          const serviceSnap = await getDoc(doc(db, "adminServices", entry.serviceId));
          return serviceSnap.exists() ? ({ ...serviceSnap.data(), id: serviceSnap.id } as FirestoreService) : null;
        });
        const resolved = (await Promise.all(detailsPromises)).filter(Boolean) as FirestoreService[];
        const map = resolved.reduce((acc, s) => ({ ...acc, [s.id]: s }), {});
        if (isMounted) setServiceDetailsMap(map);
      } catch (e) {
        console.error("Error fetching service details for payment options", e);
      } finally {
        if (isMounted) setIsLoadingServices(false);
      }
    };

    fetchServiceDetails();
    return () => {
      isMounted = false;
    };
  }, []);

  const canOfferPayLater = useMemo(() => {
    if (!appConfig?.enableCOD) return false;
    const cartEntries = getActiveCheckoutEntries();
    if (cartEntries.length === 0) return false;
    return cartEntries.every((entry) => {
      const serviceDetail = serviceDetailsMap[entry.serviceId];
      return serviceDetail?.allowPayLater !== false;
    });
  }, [appConfig?.enableCOD, serviceDetailsMap]);

  const onlinePaymentEnabled = useMemo(() => appConfig?.enableOnlinePayment !== false, [appConfig?.enableOnlinePayment]);

  const paymentOptions = useMemo<PaymentOptionItem[]>(() => {
    const list: PaymentOptionItem[] = [];

    if (onlinePaymentEnabled) {
      list.push({
        value: 'online',
        label: 'Pay Online (UPI, Card, or More)',
        description: 'Instant secure payment via UPI, Cards, Netbanking',
        icon: CreditCard,
        available: true,
      });
    }

    if (canOfferPayLater) {
      list.push({
        value: 'Pay After Service',
        label: 'Pay After Service',
        description: 'Pay with cash or UPI after service completion',
        icon: HandCoins,
        available: true,
      });
    }

    return list;
  }, [onlinePaymentEnabled, canOfferPayLater]);

  return {
    paymentOptions,
    isLoading: isLoadingServices || isLoadingAppSettings,
    onlinePaymentEnabled,
    canOfferPayLater,
  };
}
