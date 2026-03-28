"use client";

import { useState, useEffect } from "react";
import {
  isNative,
  isBiometricAvailable,
  isBiometricEnabled,
  setBiometricEnabled,
  getBiometricName,
} from "@/lib/capacitor";
import { Card } from "@/components/Card";
export function BiometricSettings() {
  const [available, setAvailable] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [label, setLabel] = useState("Biometria");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isNative()) {
      setLoading(false);
      return;
    }

    async function init() {
      try {
        const result = await isBiometricAvailable();
        setAvailable(result.available);
        if (result.available) {
          const en = await isBiometricEnabled();
          setEnabled(en);
          setLabel(getBiometricName(result.type));
        }
      } catch {
        // Plugin not available
      } finally {
        setLoading(false);
      }
    }

    init();
  }, []);

  if (!isNative() || loading || !available) return null;

  async function handleToggle() {
    const newValue = !enabled;
    await setBiometricEnabled(newValue);
    setEnabled(newValue);
  }

  return (
    <Card className="mb-6">
      <h2 className="mb-1 font-semibold">Segurança</h2>
      <div className="flex items-center justify-between py-2">
        <div>
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="text-xs text-muted">
            Bloquear o app ao sair e ao retomar
          </p>
        </div>
        <button
          role="switch"
          aria-checked={enabled}
          aria-label={`${enabled ? "Desativar" : "Ativar"} ${label}`}
          onClick={handleToggle}
          className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
            enabled ? "bg-primary" : "bg-black/20 dark:bg-white/20"
          }`}
          style={{ minHeight: "44px", minWidth: "44px" }}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-surface shadow transition-transform ${
              enabled ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>
    </Card>
  );
}
