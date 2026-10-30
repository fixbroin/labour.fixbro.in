// This service worker handles background push notifications from Firebase Cloud Messaging.

// Import the Firebase scripts for the service worker
importScripts('https://www.gstatic.com/firebasejs/9.22.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.1/firebase-messaging-compat.js');

// Import the dynamic config served by our API route
// This is necessary because service workers cannot access environment variables directly.
importScripts('/api/firebase-config');

// Initialize the Firebase app in the service worker with the fetched config
if (typeof firebaseConfig !== 'undefined') {
    firebase.initializeApp(firebaseConfig);

    // Retrieve an instance of Firebase Messaging so that it can handle background messages.
    const messaging = firebase.messaging();

    messaging.onBackgroundMessage((payload) => {
        console.log('[firebase-messaging-sw.js] Received background message ', payload);

        // Customize the notification that will be shown to the user
        const notificationTitle = payload.notification?.title || payload.data?.title || 'Fixbro';
        
        let targetUrl = payload.data?.url || payload.data?.targetUrl || payload.data?.href;
        if (!targetUrl && payload.data?.click_action && payload.data.click_action !== 'FLUTTER_NOTIFICATION_CLICK') {
            targetUrl = payload.data.click_action;
        }
        if (!targetUrl && payload.fcmOptions?.link) {
            targetUrl = payload.fcmOptions.link;
        }
        if (!targetUrl || targetUrl === 'FLUTTER_NOTIFICATION_CLICK') {
            targetUrl = '/';
        }

        const notificationOptions = {
            body: payload.notification?.body || payload.data?.body || '',
            icon: payload.notification?.icon || payload.data?.icon || '/android-chrome-192x192.png',
            data: {
                url: targetUrl
            }
        };

        // The self.registration.showNotification() method displays the notification
        return self.registration.showNotification(notificationTitle, notificationOptions);
    });

    // Handle notification click event
    self.addEventListener('notificationclick', (event) => {
        console.log('[firebase-messaging-sw.js] Notification clicked', event.notification.data);
        
        event.notification.close(); // Close the notification

        let rawUrl = event.notification.data?.url || '/';
        if (rawUrl === 'FLUTTER_NOTIFICATION_CLICK' || !rawUrl) {
            rawUrl = '/';
        }

        // Always resolve to full absolute URL on the current site origin
        const fullUrl = new URL(rawUrl, self.location.origin).href;

        // Open the window or focus an existing one
        event.waitUntil(
            clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
                // If there is already a window open with this exact URL, focus it
                for (let i = 0; i < windowClients.length; i++) {
                    const client = windowClients[i];
                    if (client.url === fullUrl && 'focus' in client) {
                        return client.focus();
                    }
                }
                // If any window on the same origin is open, navigate it to the destination and focus
                for (let i = 0; i < windowClients.length; i++) {
                    const client = windowClients[i];
                    if (client.url.startsWith(self.location.origin) && 'navigate' in client && 'focus' in client) {
                        return client.navigate(fullUrl).then((c) => c?.focus());
                    }
                }
                // If no window is open, open a new one
                if (clients.openWindow) {
                    return clients.openWindow(fullUrl);
                }
            })
        );
    });
} else {
    console.error("firebase-messaging-sw.js: firebaseConfig is not defined. Firebase could not be initialized. Was /api/firebase-config fetched correctly?");
}
