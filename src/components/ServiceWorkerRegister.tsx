"use client";

import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";

export function ServiceWorkerRegister() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    // Skip SW in native Capacitor — the native container handles caching/offline
    if (Capacitor.isNativePlatform()) return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            if (
              newWorker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              setUpdateAvailable(true);
            }
          });
        });
      })
      .catch(() => {
        // SW registration failed silently
      });
  }, []);

  if (!updateAvailable) return null;

  return (
    <div
      className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-sm rounded-lg bg-surface border border-border p-3 shadow-lg flex items-center justify-between gap-3"
      role="status"
    >
      <p className="text-sm text-foreground">Nova versão disponível</p>
      <button
        onClick={() => window.location.reload()}
        className="shrink-0 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-dark"
      >
        Atualizar
      </button>
    </div>
  );
}
