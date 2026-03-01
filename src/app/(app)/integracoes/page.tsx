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

interface SleepRecord {
  date: string;
  bedtime: string;
  wakeTime: string;
  totalHours: number;
  quality: number;
  awakenings: number;
}

interface SyncStatus {
  configured: boolean;
  enabled?: boolean;
  lastPayload?: string | null;
  records: SleepRecord[];
}

function formatSleepDuration(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, "0")}`;
}

export default function IntegraçõesPage() {
  const [keys, setKeys] = useState<IntegrationKeyData[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<"key" | "bearer" | false>(false);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [clearing, setClearing] = useState(false);
  const [importJson, setImportJson] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ ok: boolean; message: string } | null>(null);

  const fetchKeys = useCallback(async () => {
    const res = await fetch("/api/integrations/settings");
    if (res.ok) setKeys(await res.json());
  }, []);

  const fetchSyncStatus = useCallback(async () => {
    const res = await fetch("/api/integrations/health-export/status");
    if (res.ok) setSyncStatus(await res.json());
  }, []);

  useEffect(() => {
    fetchKeys();
    fetchSyncStatus();
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
  }, [fetchKeys, fetchSyncStatus]);

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

  async function handleClearSleepData() {
    if (!confirm("Limpar todos os registros de sono importados? Isso permite re-sincronizar com dados corretos.")) return;
    setClearing(true);
    await fetch("/api/integrations/health-export/status", { method: "DELETE" });
    await fetchSyncStatus();
    setClearing(false);
  }

  async function handleImportJson() {
    if (!importJson.trim()) return;
    setImporting(true);
    setImportResult(null);
    try {
      const parsed = JSON.parse(importJson);
      const res = await fetch("/api/integrations/health-export/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      const data = await res.json();
      if (res.ok) {
        setImportResult({ ok: true, message: `${data.imported} noite(s) importada(s) com sucesso!` });
        setImportJson("");
        await fetchSyncStatus();
      } else {
        setImportResult({ ok: false, message: data.error || "Erro ao importar" });
      }
    } catch {
      setImportResult({ ok: false, message: "JSON inválido. Verifique o formato e tente novamente." });
    } finally {
      setImporting(false);
    }
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

      {/* Sleep Data Status */}
      {syncStatus && syncStatus.records.length > 0 && (
        <Card className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Dados de sono importados</h2>
            <button
              onClick={handleClearSleepData}
              disabled={clearing}
              className="rounded border border-red-300 px-3 py-1 text-xs text-red-600 disabled:opacity-50"
            >
              {clearing ? "Limpando..." : "Limpar dados"}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-left text-muted">
                  <th className="pb-2 pr-3">Data</th>
                  <th className="pb-2 pr-3">Dormiu</th>
                  <th className="pb-2 pr-3">Acordou</th>
                  <th className="pb-2 pr-3">Total</th>
                  <th className="pb-2 pr-3">Qualidade</th>
                  <th className="pb-2">Despertares</th>
                </tr>
              </thead>
              <tbody>
                {syncStatus.records.map((r) => (
                  <tr key={r.date} className="border-b border-border/50">
                    <td className="py-1.5 pr-3">{r.date}</td>
                    <td className="py-1.5 pr-3">{r.bedtime}</td>
                    <td className="py-1.5 pr-3">{r.wakeTime}</td>
                    <td className="py-1.5 pr-3">{formatSleepDuration(r.totalHours)}</td>
                    <td className="py-1.5 pr-3">{r.quality}%</td>
                    <td className="py-1.5">{r.awakenings}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted">
            Se os valores parecem errados, clique &quot;Limpar dados&quot; e force uma nova sincronização no app.
          </p>

          {syncStatus.lastPayload && (
            <details className="mt-3" open>
              <summary className="cursor-pointer text-sm font-medium text-foreground">
                Último payload recebido (debug)
              </summary>
              <pre className="mt-2 max-h-96 overflow-auto rounded bg-surface-alt p-3 text-xs font-mono whitespace-pre-wrap break-all">
                {syncStatus.lastPayload}
              </pre>
            </details>
          )}
        </Card>
      )}

      {/* Manual JSON Import */}
      <Card className="mb-6">
        <h2 className="mb-2 text-lg font-semibold">Importar histórico de sono</h2>
        <p className="mb-2 text-sm text-muted">
          Importe seus dados de sono <strong>anteriores</strong> ao uso da Rede Bipolar para ter insights completos desde o início.
        </p>
        <p className="mb-3 text-xs text-muted">
          Cole o JSON exportado pelo Health Auto Export. No app, vá em <strong>Export</strong> e escolha o período desejado (ex: últimos 3 meses).
          Para o dia a dia, use a sincronização automática configurada acima.
        </p>

        {importResult && (
          <div className={`mb-3 rounded px-3 py-2 text-sm ${importResult.ok ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
            {importResult.message}
          </div>
        )}

        <textarea
          value={importJson}
          onChange={(e) => setImportJson(e.target.value)}
          placeholder='Cole aqui o JSON do Health Auto Export (formato: {"data":{"metrics":[...]}})'
          rows={6}
          className="w-full rounded border border-border bg-surface px-3 py-2 text-xs font-mono placeholder:text-muted/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />

        <button
          onClick={handleImportJson}
          disabled={importing || !importJson.trim()}
          className="mt-2 rounded bg-primary px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {importing ? "Importando..." : "Importar JSON"}
        </button>
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
