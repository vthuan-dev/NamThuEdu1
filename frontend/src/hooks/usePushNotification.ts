import { useEffect, useState } from 'react';
import { getApiUrl } from '../utils/apiConfig';
import { getAuthToken } from '../utils/authStorage';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function subscribeToPush(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;

  try {
    const keyResponse = await fetch(getApiUrl('push/vapid-public-key'));
    const { public_key } = await keyResponse.json();
    if (!public_key) return false;

    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(public_key).buffer as ArrayBuffer,
      });
    }

    const token = getAuthToken();
    if (!token) {
      console.warn('[Push] No auth token — bỏ qua đăng ký subscription.');
      return false;
    }

    const subJson = subscription.toJSON();
    const res = await fetch(getApiUrl('push/subscribe'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        endpoint: subJson.endpoint,
        p256dh_key: subJson.keys?.p256dh,
        auth_key: subJson.keys?.auth,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error(`[Push] Subscribe failed: HTTP ${res.status} — ${text}`);
      return false;
    }

    console.log('[Push] Subscription registered successfully.');
    return true;
  } catch (err) {
    console.warn('[Push] Registration failed:', err);
    return false;
  }
}

export type PushPermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

export interface UsePushNotificationReturn {
  permissionState: PushPermissionState;
  requestPermission: () => Promise<void>;
}

/**
 * Hook for push notifications.
 * - If already granted: auto-subscribes on mount.
 * - If default (not decided): exposes requestPermission() to call on user click.
 * - If denied: returns 'denied', nothing to do.
 */
export function usePushNotification(): UsePushNotificationReturn {
  const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

  const [permissionState, setPermissionState] = useState<PushPermissionState>(
    !supported ? 'unsupported' : (Notification.permission as PushPermissionState)
  );

  // Auto-subscribe if already granted (e.g. returning user)
  useEffect(() => {
    if (permissionState === 'granted') {
      subscribeToPush();
    }
  }, [permissionState]);

  const requestPermission = async (): Promise<void> => {
    if (!supported || permissionState !== 'default') return;
    const result = await Notification.requestPermission();
    setPermissionState(result as PushPermissionState);
    if (result === 'granted') {
      await subscribeToPush();
    }
  };

  return { permissionState, requestPermission };
}
