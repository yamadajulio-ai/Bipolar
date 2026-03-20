"use client";

import { useState } from "react";

export function ExportDataButton() {
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleExport() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: password || undefined }),
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const disposition = res.headers.get("Content-Disposition");
        const match = disposition?.match(/filename="(.+)"/);
        a.download = match?.[1] || `suporte-bipolar-export-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        setShowPassword(false);
        setPassword("");
      } else {
        const data = await res.json().catch(() => ({}));
        if (data.requiresPassword) {
          setShowPassword(true);
          setLoading(false);
          return;
        }
        if (data.requiresReauth) {
          setError("Faça login novamente antes de exportar seus dados.");
          setLoading(false);
          return;
        }
        setError(data.error || "Erro ao exportar dados.");
      }
    } catch {
      setError("Erro de conexão. Verifique sua internet.");
    }
    setLoading(false);
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-sm text-danger" role="alert">{error}</p>}

      {showPassword && (
        <div>
          <label htmlFor="export-password" className="mb-1 block text-sm text-muted">
            Confirme sua senha para exportar:
          </label>
          <input
            id="export-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
            placeholder="Sua senha"
          />
        </div>
      )}

      <button
        onClick={handleExport}
        disabled={loading || (showPassword && !password)}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
      >
        {loading ? "Exportando..." : "Exportar meus dados (JSON)"}
      </button>
    </div>
  );
}
