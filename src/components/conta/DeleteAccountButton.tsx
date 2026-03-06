"use client";

import { useState } from "react";

export function DeleteAccountButton() {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setLoading(true);
    // Purge SW API cache before account deletion to prevent data leak
    if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: "CLEAR_AUTH_CACHES" });
      await new Promise((r) => setTimeout(r, 100));
    }
    try {
      const res = await fetch("/api/auth/excluir-conta", { method: "POST" });
      if (res.redirected) {
        window.location.href = res.url;
      } else if (res.ok) {
        window.location.href = "/";
      }
    } catch {
      setLoading(false);
      setConfirming(false);
    }
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="rounded-lg border border-danger bg-white px-4 py-2 text-sm font-medium text-danger hover:bg-danger/5"
      >
        Excluir minha conta
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-danger">
        Tem certeza? Todos os dados serão excluídos permanentemente.
      </p>
      <div className="flex gap-2">
        <button
          onClick={handleDelete}
          disabled={loading}
          className="rounded-lg bg-danger px-4 py-2 text-sm font-medium text-white hover:bg-danger/90 disabled:opacity-50"
        >
          {loading ? "Excluindo..." : "Sim, excluir tudo"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted hover:bg-surface-alt"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
