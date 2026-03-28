"use client";

import { useState } from "react";

export function DeleteAccountButton() {
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [needsPassword, setNeedsPassword] = useState(false);

  async function purgeLocalCaches() {
    try { await caches.delete("rb-api-v2"); } catch { /* Cache API unavailable */ }
    if ("serviceWorker" in navigator) {
      try {
        const sw = navigator.serviceWorker.controller
          || (await navigator.serviceWorker.ready).active;
        if (sw) sw.postMessage({ type: "CLEAR_AUTH_CACHES" });
      } catch { /* SW not available */ }
    }
  }

  async function handleDelete() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/excluir-conta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: password || undefined }),
      });
      if (res.redirected) {
        await purgeLocalCaches();
        window.location.href = res.url;
      } else if (res.ok) {
        await purgeLocalCaches();
        window.location.href = "/";
      } else {
        const data = await res.json().catch(() => ({}));
        if (data.requiresPassword) {
          setNeedsPassword(true);
          setError("");
          setLoading(false);
          return;
        }
        if (data.requiresReauth) {
          setError("Faça login novamente antes de excluir a conta.");
          setLoading(false);
          setConfirming(false);
          return;
        }
        setError(data.error || "Não foi possível excluir a conta. Tente novamente.");
        setLoading(false);
      }
    } catch {
      setError("Erro de conexão. Verifique sua internet e tente novamente.");
      setLoading(false);
    }
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="rounded-lg border border-danger bg-surface px-4 py-2 text-sm font-medium text-danger hover:bg-danger/5"
      >
        Excluir minha conta
      </button>
    );
  }

  return (
    <div className="space-y-2">
      {error && (
        <p className="text-sm text-danger-fg" role="alert">{error}</p>
      )}
      <p className="text-sm font-medium text-danger-fg">
        Tem certeza? Todos os dados serão excluídos permanentemente.
      </p>

      {needsPassword && (
        <div>
          <label htmlFor="delete-password" className="mb-1 block text-sm text-muted">
            Confirme sua senha:
          </label>
          <input
            id="delete-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-control-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus-visible:border-control-border-focus focus-visible:outline-none"
            placeholder="Sua senha"
          />
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={handleDelete}
          disabled={loading || (needsPassword && !password)}
          className="rounded-lg bg-danger px-4 py-2 text-sm font-medium text-white hover:bg-danger/90 disabled:opacity-50"
        >
          {loading ? "Excluindo..." : "Sim, excluir tudo"}
        </button>
        <button
          onClick={() => { setConfirming(false); setNeedsPassword(false); setPassword(""); setError(""); }}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted hover:bg-surface-alt"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
