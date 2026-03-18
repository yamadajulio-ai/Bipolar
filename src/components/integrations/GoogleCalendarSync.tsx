"use client";

import { useState } from "react";

interface Props {
  isConnected: boolean;
}

export function GoogleCalendarSync({ isConnected: initialConnected }: Props) {
  const [connected, setConnected] = useState(initialConnected);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ pulled: number; errors: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSync() {
    setSyncing(true);
    setError(null);
    setSyncResult(null);

    try {
      const res = await fetch("/api/google/sync", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Erro na sincronização");
        return;
      }
      setSyncResult(await res.json());
    } catch {
      setError("Erro de conexão");
    } finally {
      setSyncing(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm("Desconectar Google Agenda? Blocos importados do Google serão removidos.")) return;

    try {
      const res = await fetch("/api/auth/google/disconnect", { method: "DELETE" });
      if (res.ok) {
        setConnected(false);
        setSyncResult(null);
      }
    } catch {
      setError("Erro ao desconectar");
    }
  }

  if (!connected) {
    return (
      <div>
        <a
          href="/api/auth/google"
          className="inline-block rounded bg-primary px-4 py-2 text-sm text-white"
        >
          Conectar Google Agenda
        </a>
        <p className="mt-2 text-xs text-muted">
          Você será redirecionado para o Google para autorizar o acesso.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="inline-block h-2 w-2 rounded-full bg-green-400" />
        <span className="text-sm">Conectado</span>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleSync}
          disabled={syncing}
          className="rounded bg-primary px-4 py-1 text-sm text-white disabled:opacity-50"
        >
          {syncing ? "Sincronizando..." : "Sincronizar agora"}
        </button>
        <button
          onClick={handleDisconnect}
          className="rounded border border-red-300 px-3 py-1 text-sm text-red-600"
        >
          Desconectar
        </button>
      </div>

      {syncResult && (
        <p className="text-sm text-green-600">
          Sincronizado: {syncResult.pulled} eventos importados
          {syncResult.errors > 0 && `, ${syncResult.errors} erros`}
        </p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="rounded bg-surface-alt p-3 text-xs text-muted">
        <p className="font-medium text-foreground mb-1">Como funciona:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Eventos do Google Agenda aparecem automaticamente no planejador</li>
          <li>Crie e edite eventos diretamente no Google Agenda</li>
          <li>A sincronização acontece ao abrir o planejador</li>
          <li>Clique &quot;Sincronizar agora&quot; para atualizar manualmente</li>
        </ul>
      </div>
    </div>
  );
}
