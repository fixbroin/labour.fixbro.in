"use client";

import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";
import { app, db, auth } from "./firebase";
import { doc, setDoc, Timestamp, getDoc } from '@/lib/mysqlDb';
import type { MarketingSettings } from "@/types/firestore";
import { isWebView, sendPushNotificationData, postToFlutter } from './webview-bridge';

let marketingSettingsCache: MarketingSettings | null = null;

// Function to fetch marketing settings (includes VAPID key and client config)
const getMarketingSettings = async (): Promise<MarketingSettings | null> => {
  if (marketingSettingsCache) return marketingSettingsCache;
  try {
    const settingsDocRef = doc(db, "webSettings", "marketingConfiguration");
    const docSnap = await getDoc(settingsDocRef);
    if (docSnap.exists()) {
      marketingSettingsCache = docSnap.data() as MarketingSettings;
      return marketingSettingsCache;
    }
    console.warn("FCM Utils: Marketing settings not found in Firestore.");
    return null;
  } catch (error) {
    console.error("FCM Utils: Error fetching marketing settings:", error);
    return null;
  }
};

export const syncNativeFcmToken = async (token: string, explicitUserId?: string | null): Promise<boolean> => {
  if (typeof window === 'undefined' || !token) return false;

  // Cache token locally so it is never lost across redirects or page reloads
  (window as any).fcmDeviceToken = token;
  try {
    localStorage.setItem('fixbro_native_fcm_token', token);
  } catch (_) {}

  const targetUid = explicitUserId || auth?.currentUser?.uid || (typeof window !== 'undefined' ? localStorage.getItem('fixbro_user_uid') : null);
  if (!targetUid) {
    console.log("FCM Utils: Token cached locally, waiting for user session to sync.");
    return false;
  }

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (auth?.currentUser) {
      try {
        const idToken = await auth.currentUser.getIdToken();
        headers['Authorization'] = `Bearer ${idToken}`;
      } catch (_) {}
    }

    const appVariant = (window as any).flutterAppVariant || (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('flutter_app_variant') : null) || 'customer';

    const res = await fetch('/api/sync-fcm-token', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        token,
        userId: targetUid,
        platform: 'android',
        appVariant
      })
    });

    if (res.ok) {
      console.log("FCM Utils: Successfully synced native FCM token for user via API:", targetUid);
      return true;
    }

    // Fallback directly to client setDoc if API route returned error
    const userDocRef = doc(db, "users", targetUid);
    await setDoc(userDocRef, {
      fcmTokens: {
        [token]: Timestamp.now()
      }
    }, { merge: true });
    console.log("FCM Utils: Successfully synced native FCM token for user via DB fallback:", targetUid);
    return true;
  } catch (e) {
    console.error("FCM Utils: Error syncing native FCM token:", e);
    return false;
  }
};

if (typeof window !== 'undefined') {
  (window as any).syncNativeFcmToken = syncNativeFcmToken;
  window.addEventListener('flutterNativeReady', (e: any) => {
    const token = e.detail?.deviceToken || (window as any).fcmDeviceToken || localStorage.getItem('fixbro_native_fcm_token');
    if (token) {
      syncNativeFcmToken(token);
    }
  });

  // Automatically sync cached token whenever user logs in or auth state resolves
  if (auth && typeof auth.onAuthStateChanged === 'function') {
    auth.onAuthStateChanged((user) => {
      if (user?.uid) {
        const cached = (window as any).fcmDeviceToken || localStorage.getItem('fixbro_native_fcm_token');
        if (cached) {
          syncNativeFcmToken(cached, user.uid);
        }
      }
    });
  }
}

// Function to initialize Firebase Cloud Messaging and request permission
export const initializeFCM = async (userId?: string | null): Promise<string | null> => {
  if (typeof window === 'undefined' || !userId) {
    console.log("FCM Utils: Not in browser environment or no user ID, skipping FCM init.");
    return null;
  }

  // If in Flutter WebView, sync native FCM token provided by Flutter App
  if (isWebView()) {
    const nativeToken = (window as any).fcmDeviceToken || localStorage.getItem('fixbro_native_fcm_token');
    if (nativeToken && typeof nativeToken === 'string' && nativeToken.length > 0) {
      await syncNativeFcmToken(nativeToken, userId);
      return nativeToken;
    }
    // Proactively request token from Flutter bridge if not yet set
    postToFlutter({ action: 'syncFcmToken', userId });
  }

  const supported = await isSupported();
  if (!supported) {
    console.log("FCM Utils: Firebase Messaging is not supported in this browser.");
    return null;
  }

  const marketingSettings = await getMarketingSettings();
  if (!marketingSettings?.firebasePublicVapidKey) {
    console.warn("FCM Utils: VAPID key for FCM not found in marketing settings. Push notifications will not be enabled.");
    return null;
  }

  try {
    const messaging = getMessaging(app);

    // Request permission
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      console.log("FCM Utils: Notification permission granted.");

      // Get token
      const fcmToken = await getToken(messaging, {
        vapidKey: marketingSettings.firebasePublicVapidKey,
      });

      if (fcmToken) {
        console.log("FCM Utils: Token received:", fcmToken);
        // Save token to Firestore/MySQL via sync-fcm-token
        await syncNativeFcmToken(fcmToken, userId);
        return fcmToken;
      } else {
        console.log("FCM Utils: No registration token available. Request permission to generate one.");
        return null;
      }
    } else {
      console.log("FCM Utils: Notification permission denied.");
      return null;
    }
  } catch (error) {
    console.error("FCM Utils: Error initializing FCM or getting token:", error);
    return null;
  }
};

// Listener for foreground messages (app is active tab)
export const onForegroundMessage = async () => {
  if (typeof window === 'undefined' || isWebView()) {
    return;
  }
  try {
    const supported = await isSupported().catch(() => false);
    if (!supported) {
      return;
    }
    const messaging = getMessaging(app);
    onMessage(messaging, (payload) => {
      console.log("FCM Utils: Message received in foreground: ", payload);
      
      // Play custom sound based on notification type/data
      try {
        const soundFile = payload.data?.sound === 'order' ? '/sounds/order_sound.wav' : '/sounds/default-notification.mp3';
        const audio = new Audio(soundFile);
        audio.play().catch(e => console.warn("FCM Utils: Could not play notification sound:", e));
      } catch (soundErr) {
        console.error("FCM Utils: Sound play error:", soundErr);
      }

      // If in a WebView, send the data to the native app
      if (isWebView()) {
        sendPushNotificationData(payload);
        return; // Prevent showing the browser notification
      }

      // For regular browsers, show a standard notification
      if (payload.notification && typeof window !== 'undefined' && 'Notification' in window) {
        const notification = new Notification(payload.notification.title || "New Message", {
          body: payload.notification.body || "",
          icon: payload.notification.icon || "/android-chrome-192x192.png",
        });

        notification.onclick = (event) => {
          event.preventDefault();
          const url = payload.data?.click_action || payload.data?.url || '/';
          window.focus();
          window.location.href = url;
          notification.close();
        };
      }
    });
  } catch (e) {
    console.warn("FCM Utils: Could not attach foreground message listener:", e);
  }
};

/**
 * Triggers a push notification via the internal API.
 */
export const triggerPushNotification = async (params: {
  userId: string;
  title: string;
  body: string;
  href?: string;
  icon?: string;
  sound?: 'order' | 'default';
  type?: string;
  variables?: Record<string, string | number | undefined>;
}) => {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (auth?.currentUser) {
      try {
        const token = await auth.currentUser.getIdToken();
        headers['Authorization'] = `Bearer ${token}`;
      } catch (e) {
        // continue without token
      }
    }
    const response = await fetch('/api/send-push', {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
    });
    return await response.json();
  } catch (error) {
    console.error("FCM Utils: Error triggering push notification:", error);
    return { error: "Failed to trigger push" };
  }
};
