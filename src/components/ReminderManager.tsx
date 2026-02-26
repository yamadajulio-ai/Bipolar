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

export function ReminderManager() {
  const settingsRef = useRef<ReminderSettings | null>(null);
  const notifiedRef = useRef<Set<string>>(new Set());

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

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;

    if (Notification.permission === "default") {
      Notification.requestPermission();
    }

    const interval = setInterval(() => {
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
          new Notification("Empresa Bipolar", {
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
