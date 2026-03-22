"use client";

import { useEffect, useRef } from "react";

interface ReminderSettings {
  wakeReminder: string | null;
  sleepReminder: string | null;
  diaryReminder: string | null;
  breathingReminder: string | null;
  enabled: boolean;
}

const reminderLabels: Record<string, string> = {
  wakeReminder: "Hora de registrar seu despertar",
  sleepReminder: "Hora de se preparar para dormir",
  diaryReminder: "Hora de registrar seu diário",
  breathingReminder: "Hora de fazer um exercício de respiração",
};

function getCurrentHHMM(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

/**
 * Subscribe to Web Push via Service Worker.
 * If successful, the server-side cron handles notifications even when the tab is closed.
 * Falls back to client-side polling if SW or Push API is unavailable.
 */
async function registerPushSubscription(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) return false;

  try {
    const registration = await navigator.serviceWorker.ready;

    // Check if already subscribed
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      // Convert VAPID key from base64 to Uint8Array
      const urlBase64ToUint8Array = (base64String: string): Uint8Array => {
        const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
        const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
        const rawData = atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
          outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
      };

      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey).buffer as ArrayBuffer,
      });
    }

    // Send subscription to server
    const res = await fetch("/api/push-subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(subscription.toJSON()),
    });

    return res.ok;
  } catch (err) {
    console.warn("Push subscription failed, using polling fallback:", err);
    return false;
  }
}

export function ReminderManager() {
  const settingsRef = useRef<ReminderSettings | null>(null);
  const notifiedRef = useRef<Set<string>>(new Set());
  const pushRegisteredRef = useRef(false);

  // Fetch reminder settings
  useEffect(() => {
    async function fetchSettings() {
      try {
        const res = await fetch("/api/lembretes");
        if (res.ok) {
          settingsRef.current = await res.json();
        }
      } catch {
        // Silently fail — reminders are not critical
      }
    }

    fetchSettings();
  }, []);

  // Try to register Web Push subscription
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;

    // If already granted, register the push subscription silently
    if (Notification.permission === "granted") {
      localStorage.setItem("sb_notification_asked", "1");
      registerPushSubscription().then((ok) => {
        pushRegisteredRef.current = ok;
      });
      return;
    }

    // If denied by the user, respect that — don't nag
    if (Notification.permission === "denied") {
      localStorage.setItem("sb_notification_asked", Date.now().toString());
      return;
    }

    // Re-ask every 7 days if permission is still "default" (dismissed, not denied)
    const lastAsked = localStorage.getItem("sb_notification_asked");
    if (lastAsked) {
      const daysSince = (Date.now() - Number(lastAsked)) / (1000 * 60 * 60 * 24);
      if (daysSince < 7) return;
    }

    // Ask for permission — re-ask after 7 days if dismissed
    const timer = setTimeout(() => {
      Notification.requestPermission().then((permission) => {
        localStorage.setItem("sb_notification_asked", Date.now().toString());
        if (permission === "granted") {
          registerPushSubscription().then((ok) => {
            pushRegisteredRef.current = ok;
          });
        }
      });
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  // Polling fallback — only fires local notifications if push is NOT registered
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;

    const interval = setInterval(() => {
      // If Web Push is active, the cron handles it — skip polling
      if (pushRegisteredRef.current) return;

      const settings = settingsRef.current;
      if (!settings || !settings.enabled) return;
      if (Notification.permission !== "granted") return;

      const currentTime = getCurrentHHMM();

      const keys = [
        "wakeReminder",
        "sleepReminder",
        "diaryReminder",
        "breathingReminder",
      ] as const;

      for (const key of keys) {
        const time = settings[key];
        if (!time) continue;

        const notifKey = `${key}-${currentTime}`;
        if (time === currentTime && !notifiedRef.current.has(notifKey)) {
          notifiedRef.current.add(notifKey);
          new Notification("Suporte Bipolar", {
            body: reminderLabels[key],
            icon: "/favicon.ico",
          });
        }
      }

      // Clean old notifications after 2 minutes
      if (notifiedRef.current.size > 20) {
        notifiedRef.current.clear();
      }
    }, 60_000);

    return () => clearInterval(interval);
  }, []);

  return null;
}
