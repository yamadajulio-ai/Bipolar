"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/Card";
import { GoogleCalendarSync } from "@/components/integrations/GoogleCalendarSync";

interface IntegrationKeyData {
  id: string;
  service: string;
  apiKey: string;
  enabled: boolean;
  createdAt: string;
}

export default function IntegraçõesPage() {
  const [keys, setKeys] = useState<IntegrationKeyData[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<"key" | "bearer" | false>(false);
  const [googleConnected, setGoogleConnected] = useState(false);

  const fetchKeys = useCallback(async () => {
    const res = await fetch("/api/integrations/settings");
    if (res.ok) setKeys(await res.json());
  }, []);

  useEffect(() => {
    fetchKeys();
    // Check Google Calendar connection status
    fetch("/api/google/sync")
      .then((r) => r.json())
      .then((data) => { if (data.connected) setGoogleConnected(true); })
      .catch(() => {});
    // Also check via URL param after OAuth callback
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("google") === "connected") setGoogleConnected(true);
    }
  }, [fetchKeys]);

  const healthKey = keys.find((k) => k.service === "health_auto_export");

  async function handleGenerate() {
    setLoading(true);
    const res = await fetch("/api/integrations/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ service: "health_auto_export" }),
    });
    if (res.ok) await fetchKeys();
    setLoading(false);
  }

  async function handleToggle() {
    if (!healthKey) return;
    await fetch("/api/integrations/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ service: "health_auto_export", enabled: !healthKey.enabled }),
    });
    await fetchKeys();
  }

  async function handleRevoke() {
    if (!confirm("Revogar a chave? O Health Auto Export vai parar de enviar dados.")) return;
    await fetch("/api/integrations/settings", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ service: "health_auto_export" }),
    });
    await fetchKeys();
  }

  function handleCopy(type: "key" | "bearer") {
    if (!healthKey) return;
    const text = type === "bearer" ? `Bearer ${healthKey.apiKey}` : healthKey.apiKey;
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(false), 2000);
  }

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold">Integrações</h1>
      <p className="mb-6 text-sm text-muted">
        Conecte serviços externos para sincronizar dados automaticamente.
      </p>

      {/* Health Auto Export */}
      <Card className="mb-6">
        <h2 className="mb-2 text-lg font-semibold">Health Auto Export (Sono)</h2>
        <p className="mb-4 text-sm text-muted">
          O app Health Auto Export no iPhone envia dados do Apple Health para cá automaticamente.
          Você precisa do app instalado (premium) no iPhone.
        </p>

        {healthKey ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className={`inline-block h-2 w-2 rounded-full ${healthKey.enabled ? "bg-green-400" : "bg-gray-400"}`} />
              <span className="text-sm">{healthKey.enabled ? "Ativo" : "Desativado"}</span>
            </div>

            <div>
              <label className="text-xs text-muted">URL do endpoint</label>
              <div className="mt-1 rounded bg-surface-alt px-3 py-2 text-xs font-mono break-all">
                {baseUrl}/api/integrations/health-export
              </div>
            </div>

            <div>
              <label className="text-xs text-muted">API Key (Bearer token)</label>
              <div className="mt-1 flex items-center gap-2">
                <div className="flex-1 rounded bg-surface-alt px-3 py-2 text-xs font-mono break-all">
                  {healthKey.apiKey}
                </div>
                <button
                  onClick={() => handleCopy("key")}
                  className="rounded bg-primary px-3 py-2 text-xs text-white"
                >
                  {copied === "key" ? "Copiado!" : "Copiar"}
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs text-muted">Header de autenticação (para colar no app)</label>
              <div className="mt-1 flex items-center gap-2">
                <div className="flex-1 rounded bg-surface-alt px-3 py-2 text-xs font-mono break-all">
                  Bearer {healthKey.apiKey}
                </div>
                <button
                  onClick={() => handleCopy("bearer")}
                  className="rounded bg-primary px-3 py-2 text-xs text-white"
                >
                  {copied === "bearer" ? "Copiado!" : "Copiar"}
                </button>
              </div>
            </div>

            <div className="mt-4 rounded bg-surface-alt p-3 text-xs text-muted">
              <p className="font-medium text-foreground mb-1">Como configurar no Health Auto Export:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Abra o Health Auto Export no iPhone</li>
                <li>Vá em Automations → REST API</li>
                <li>Cole a URL acima no campo de endpoint</li>
                <li>Em &quot;Adicionar Cabeçalhos&quot;:
                  <ul className="list-disc list-inside ml-4 mt-1 space-y-0.5">
                    <li><strong>Chave:</strong> Authorization</li>
                    <li><strong>Valor:</strong> Bearer [sua key] (use o botão &quot;Copiar&quot; acima)</li>
                  </ul>
                </li>
                <li>Selecione &quot;Sleep Analysis&quot; nas métricas</li>
                <li>Desative &quot;Resumir Dados&quot; (precisamos dos dados detalhados)</li>
                <li>Configure frequência (recomendado: diário)</li>
              </ol>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleToggle}
                className="rounded border border-border px-3 py-1 text-sm"
              >
                {healthKey.enabled ? "Desativar" : "Ativar"}
              </button>
              <button
                onClick={handleRevoke}
                className="rounded border border-red-300 px-3 py-1 text-sm text-red-600"
              >
                Revogar chave
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="rounded bg-primary px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {loading ? "Gerando..." : "Gerar API Key"}
          </button>
        )}
      </Card>

      {/* Google Calendar */}
      <Card className="mb-6">
        <h2 className="mb-2 text-lg font-semibold">Google Agenda</h2>
        <p className="mb-4 text-sm text-muted">
          Seus eventos do Google Calendar aparecem automaticamente no planejador.
        </p>
        <GoogleCalendarSync isConnected={googleConnected} />
      </Card>
    </div>
  );
}
