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
  hrv?: number | null;
  heartRate?: number | null;
}

interface HealthMetricRecord {
  date: string;
  metric: string;
  value: number;
  unit: string;
}

interface SyncStatus {
  configured: boolean;
  enabled?: boolean;
  lastPayload?: string | null;
  records: SleepRecord[];
  healthMetrics?: HealthMetricRecord[];
}

const METRIC_LABELS: Record<string, string> = {
  steps: "Passos",
  active_calories: "Calorias ativas",
  blood_oxygen: "SpO2",
};

function formatSleepDuration(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, "0")}`;
}

export default function IntegraçõesPage() {
  const [keys, setKeys] = useState<IntegrationKeyData[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<"key" | "bearer" | "url" | false>(false);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [clearing, setClearing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);
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

  async function handleFileImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    setImportProgress(null);

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const metrics = parsed?.data?.metrics ?? parsed?.metrics ?? [];

      if (!Array.isArray(metrics) || metrics.length === 0) {
        setImportResult({ ok: false, message: "Nenhuma metrica encontrada no arquivo." });
        setImporting(false);
        return;
      }

      // Split metrics into chunks of ~3 per request to stay under 4.5MB
      const MAX_METRICS_PER_CHUNK = 3;
      const chunks: unknown[][] = [];
      for (let i = 0; i < metrics.length; i += MAX_METRICS_PER_CHUNK) {
        chunks.push(metrics.slice(i, i + MAX_METRICS_PER_CHUNK));
      }

      let totalSleep = 0;
      let totalHrvHr = 0;
      let totalMetrics = 0;
      const allMetricTypes = new Set<string>();

      for (let i = 0; i < chunks.length; i++) {
        setImportProgress({ current: i + 1, total: chunks.length });

        const chunkPayload = parsed?.data
          ? { data: { metrics: chunks[i] } }
          : { metrics: chunks[i] };

        const chunkJson = JSON.stringify(chunkPayload);

        // If a single chunk is still too large, split its metrics individually
        if (chunkJson.length > 3_500_000 && chunks[i].length > 1) {
          for (const metric of chunks[i]) {
            const singlePayload = parsed?.data
              ? { data: { metrics: [metric] } }
              : { metrics: [metric] };

            const res = await fetch("/api/integrations/health-export/import", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(singlePayload),
            });
            if (res.ok) {
              const data = await res.json();
              totalSleep += data.imported ?? 0;
              totalHrvHr += data.hrvHrEnriched ?? 0;
              totalMetrics += data.metricsImported ?? 0;
              (data.metricTypes ?? []).forEach((t: string) => allMetricTypes.add(t));
            }
          }
          continue;
        }

        const res = await fetch("/api/integrations/health-export/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: chunkJson,
        });
        if (res.ok) {
          const data = await res.json();
          totalSleep += data.imported ?? 0;
          totalHrvHr += data.hrvHrEnriched ?? 0;
          totalMetrics += data.metricsImported ?? 0;
          (data.metricTypes ?? []).forEach((t: string) => allMetricTypes.add(t));
        }
      }

      const parts: string[] = [];
      if (totalSleep > 0) parts.push(`${totalSleep} noite(s) de sono`);
      if (totalHrvHr > 0) parts.push(`${totalHrvHr} enriquecimento(s) HRV/FC`);
      if (totalMetrics > 0) parts.push(`${totalMetrics} metrica(s) (${[...allMetricTypes].join(", ")})`);

      setImportResult({
        ok: parts.length > 0,
        message: parts.length > 0
          ? `Importado: ${parts.join(", ")}`
          : "Nenhum dado reconhecido no arquivo.",
      });
      await fetchSyncStatus();
    } catch {
      setImportResult({ ok: false, message: "Arquivo invalido. Verifique se e um JSON do Health Auto Export." });
    } finally {
      setImporting(false);
      setImportProgress(null);
      e.target.value = "";
    }
  }

  function handleCopy(type: "key" | "bearer") {
    if (!healthKey) return;
    const text = type === "bearer" ? `Bearer ${healthKey.apiKey}` : healthKey.apiKey;
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold">Integrações</h1>
      <p className="mb-6 text-sm text-muted">
        Conecte serviços externos para sincronizar dados automaticamente.
      </p>

      {/* Wearables Compatíveis */}
      <Card className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><rect x="6" y="2" width="12" height="20" rx="3"/><circle cx="12" cy="12" r="3"/><path d="M12 6v2"/></svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold">Wearables compatíveis</h2>
            <p className="text-xs text-muted">Smartwatches e pulseiras que enviam dados automaticamente</p>
          </div>
        </div>

        <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-2 mb-3 text-xs text-amber-800 dark:text-amber-300">
          Requer <strong>iPhone</strong> com Apple Health. Suporte a Android em breve.
        </div>

        <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 p-4 text-sm space-y-4">
          <p className="text-muted">
            Qualquer wearable cujo app no iPhone escreva dados no Apple Health funciona com o Suporte Bipolar via Health Auto Export.
            A cobertura de métricas varia por modelo.
          </p>

          {/* Device comparison table */}
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-emerald-200 dark:border-emerald-800 text-left text-muted">
                  <th className="pb-2 pr-2">Dispositivo</th>
                  <th className="pb-2 pr-2">Preço aprox.</th>
                  <th className="pb-2 pr-2">App iOS</th>
                  <th className="pb-2 pr-2">Sono</th>
                  <th className="pb-2 pr-2">FC</th>
                  <th className="pb-2 pr-2">HRV</th>
                  <th className="pb-2">SpO2</th>
                </tr>
              </thead>
              <tbody className="text-muted">
                <tr className="border-b border-emerald-100 dark:border-emerald-900/50">
                  <td className="py-1.5 pr-2 font-medium text-foreground">Xiaomi Smart Band 9 Active</td>
                  <td className="py-1.5 pr-2">R$200–300</td>
                  <td className="py-1.5 pr-2">Mi Fitness</td>
                  <td className="py-1.5 pr-2 text-green-600">&#10003;</td>
                  <td className="py-1.5 pr-2 text-green-600">&#10003;</td>
                  <td className="py-1.5 pr-2 text-gray-400">&#8212;</td>
                  <td className="py-1.5 text-green-600">&#10003;</td>
                </tr>
                <tr className="border-b border-emerald-100 dark:border-emerald-900/50">
                  <td className="py-1.5 pr-2 font-medium text-foreground">Redmi Watch 5 Active</td>
                  <td className="py-1.5 pr-2">R$200–300</td>
                  <td className="py-1.5 pr-2">Mi Fitness</td>
                  <td className="py-1.5 pr-2 text-green-600">&#10003;</td>
                  <td className="py-1.5 pr-2 text-green-600">&#10003;</td>
                  <td className="py-1.5 pr-2 text-gray-400">&#8212;</td>
                  <td className="py-1.5 text-green-600">&#10003;</td>
                </tr>
                <tr className="border-b border-emerald-100 dark:border-emerald-900/50">
                  <td className="py-1.5 pr-2 font-medium text-foreground">HUAWEI Band 9</td>
                  <td className="py-1.5 pr-2">R$300–450</td>
                  <td className="py-1.5 pr-2">Huawei Health</td>
                  <td className="py-1.5 pr-2 text-green-600">&#10003;</td>
                  <td className="py-1.5 pr-2 text-green-600">&#10003;</td>
                  <td className="py-1.5 pr-2 text-amber-500">~</td>
                  <td className="py-1.5 text-green-600">&#10003;</td>
                </tr>
                <tr className="border-b border-emerald-100 dark:border-emerald-900/50">
                  <td className="py-1.5 pr-2 font-medium text-foreground">Amazfit Bip 6</td>
                  <td className="py-1.5 pr-2">R$300–450</td>
                  <td className="py-1.5 pr-2">Zepp</td>
                  <td className="py-1.5 pr-2 text-green-600">&#10003;</td>
                  <td className="py-1.5 pr-2 text-green-600">&#10003;</td>
                  <td className="py-1.5 pr-2 text-amber-500">~</td>
                  <td className="py-1.5 text-green-600">&#10003;</td>
                </tr>
                <tr className="border-b border-emerald-100 dark:border-emerald-900/50">
                  <td className="py-1.5 pr-2 font-medium text-foreground">Amazfit Active 2</td>
                  <td className="py-1.5 pr-2">R$700–1.000</td>
                  <td className="py-1.5 pr-2">Zepp</td>
                  <td className="py-1.5 pr-2 text-green-600">&#10003;</td>
                  <td className="py-1.5 pr-2 text-green-600">&#10003;</td>
                  <td className="py-1.5 pr-2 text-amber-500">~</td>
                  <td className="py-1.5 text-green-600">&#10003;</td>
                </tr>
                <tr>
                  <td className="py-1.5 pr-2 font-medium text-foreground">Apple Watch SE 3</td>
                  <td className="py-1.5 pr-2">R$2.500–3.500</td>
                  <td className="py-1.5 pr-2">Nativo</td>
                  <td className="py-1.5 pr-2 text-green-600">&#10003;</td>
                  <td className="py-1.5 pr-2 text-green-600">&#10003;</td>
                  <td className="py-1.5 pr-2 text-green-600">&#10003;</td>
                  <td className="py-1.5 text-green-600">&#10003;</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted">
            <strong>&#10003;</strong> = confiável &nbsp; <strong className="text-amber-500">~</strong> = cobertura variável (validar antes) &nbsp; <strong className="text-gray-400">&#8212;</strong> = não disponível
          </p>
          <p className="text-xs text-muted">
            Preços de referência do varejo brasileiro (mar/2026). Podem variar por loja e promoção.
          </p>
          <p className="text-xs text-muted">
            <strong>Recomendação custo-benefício:</strong> para sono, FC e passos, a Xiaomi Smart Band 9 Active (a partir de ~R$200) é suficiente.
            HRV exige modelos a partir de ~R$300 e a cobertura via Apple Health pode variar.
          </p>

          {/* Setup guide */}
          <details className="text-sm">
            <summary className="cursor-pointer font-medium text-foreground">Como configurar seu wearable</summary>
            <ol className="list-decimal list-inside space-y-2 text-muted mt-3">
              <li>
                Instale o app do fabricante no iPhone
                <p className="ml-5 mt-1 text-xs italic">Xiaomi/Redmi: Mi Fitness &nbsp;|&nbsp; Amazfit: Zepp &nbsp;|&nbsp; Huawei: Huawei Health</p>
              </li>
              <li>Pareie o dispositivo pelo app</li>
              <li>
                Ative a sincronização com o <strong>Apple Health</strong> no app
                <p className="ml-5 mt-1 text-xs italic">Cada app tem a opção em Perfil ou Configurações. Ative todas as categorias de saúde.</p>
              </li>
              <li>
                Se o dispositivo tem FC e SpO2, ative o <strong>monitoramento contínuo</strong>
                <p className="ml-5 mt-1 text-xs italic">Sem isso, os dados podem ser esparsos ou apenas manuais.</p>
              </li>
              <li>
                {healthKey && syncStatus && syncStatus.records.length > 0 ? (
                  <span className="text-green-700 dark:text-green-400">
                    &#10003; Health Auto Export configurado e recebendo dados ({syncStatus.records.length} registro(s) de sono)
                  </span>
                ) : healthKey ? (
                  <span className="text-amber-700 dark:text-amber-400">
                    Health Auto Export configurado, mas ainda sem dados recebidos. Verifique as permissões no Apple Health e aguarde a primeira sincronização.
                  </span>
                ) : (
                  <span>Configure o <strong>Health Auto Export</strong> abaixo para enviar os dados do Apple Health para cá</span>
                )}
              </li>
            </ol>
          </details>

          <div className="rounded bg-white/60 dark:bg-white/5 p-3 text-xs text-muted">
            <p className="font-medium text-foreground mb-1">Fluxo de dados:</p>
            <p className="font-mono text-center py-1">
              Wearable → App do fabricante → Apple Health → HAE → Suporte Bipolar
            </p>
          </div>

          <details className="text-xs text-muted">
            <summary className="cursor-pointer font-medium text-foreground">Cobertura de métricas e limitações</summary>
            <div className="mt-2 space-y-1.5 pl-1">
              <p><strong>Confiáveis:</strong> sono (estágios podem variar por modelo), FC de repouso, passos, calorias ativas</p>
              <p><strong>Cobertura variável:</strong> HRV (baseline estável após ~7 dias; fabricantes podem usar RMSSD enquanto Apple Health usa SDNN) e SpO2 (requer monitoramento contínuo ativado no app)</p>
              <p><strong>Latência:</strong> dados dependem do app do fabricante sincronizar com o Apple Health, e do HAE exportar. Pode levar minutos a horas.</p>
              <p><strong>Sem HRV?</strong> Sem problema — sono, horários e FC de repouso já entregam os insights mais importantes para estabilidade bipolar.</p>
            </div>
          </details>

          <details className="text-xs text-muted">
            <summary className="cursor-pointer font-medium text-foreground">Não está funcionando?</summary>
            <div className="mt-2 space-y-1.5 pl-1">
              <p>1. Verifique em <strong>Apple Health → Perfil → Apps</strong> se o app do wearable e o Health Auto Export têm permissão de leitura/escrita</p>
              <p>2. Abra o app do wearable e aguarde a sincronização</p>
              <p>3. Desative o <strong>Modo Economia de Energia</strong> do iPhone</p>
              <p>4. Ative <strong>Atualização em 2º Plano</strong> para o app do wearable e Health Auto Export (Ajustes → Geral)</p>
              <p>5. Com o iPhone bloqueado, o HAE pode atrasar. Abra os apps periodicamente para garantir o envio</p>
            </div>
          </details>
        </div>
      </Card>

      {/* Health Auto Export */}
      <Card className="mb-6">
        <h2 className="mb-2 text-lg font-semibold">Health Auto Export</h2>
        <p className="mb-4 text-sm text-muted">
          O app Health Auto Export no iPhone envia dados do Apple Health para cá automaticamente.
          Compatível com <strong>Apple Watch, Amazfit</strong> e outros wearables cujo app no iPhone escreva métricas no Apple Health.
          A cobertura de dados varia por fabricante e modelo.
        </p>

        {healthKey ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className={`inline-block h-2 w-2 rounded-full ${healthKey.enabled ? "bg-green-400" : "bg-gray-400"}`} />
              <span className="text-sm">{healthKey.enabled ? "Ativo" : "Desativado"}</span>
            </div>

            <div>
              <label className="text-xs text-muted">URL do endpoint</label>
              <div className="mt-1 flex items-center gap-2">
                <div className="flex-1 rounded bg-surface-alt px-3 py-2 text-xs font-mono break-all">
                  https://hae-proxy.suporte-bipolar.workers.dev
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText("https://hae-proxy.suporte-bipolar.workers.dev");
                    setCopied("url"); setTimeout(() => setCopied(false), 2000);
                  }}
                  className="rounded bg-primary px-3 py-2 text-xs text-white whitespace-nowrap"
                >
                  {copied === "url" ? "Copiado!" : "Copiar"}
                </button>
              </div>
              <p className="mt-1 text-xs text-muted">
                (Proxy inteligente — divide payloads grandes automaticamente)
              </p>
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
              <ol className="list-decimal list-inside space-y-1.5">
                <li>Abra o Health Auto Export no iPhone</li>
                <li>Vá em <strong>Automations</strong> &rarr; crie uma nova <strong>REST API</strong></li>
                <li>Cole a <strong>URL</strong> acima no campo de endpoint</li>
                <li>Tempo limite: <strong>120</strong></li>
                <li>Em &quot;Adicionar Cabeçalhos&quot;:
                  <ul className="list-disc list-inside ml-4 mt-1 space-y-0.5">
                    <li><strong>Chave:</strong> Authorization</li>
                    <li><strong>Valor:</strong> cole o header acima (Bearer + key)</li>
                  </ul>
                </li>
                <li>Tipo de Dados: <strong>Métricas de Saúde</strong></li>
                <li>Selecionar Métricas: <strong>Todos Selecionados</strong>
                  <p className="ml-4 mt-1 italic">O proxy divide payloads grandes automaticamente — pode selecionar tudo sem problema.</p>
                </li>
                <li>Formato de Exportação: <strong>JSON</strong></li>
                <li>Desative &quot;Resumir Dados&quot;</li>
                <li>Sincronizar Cadência: <strong>5 minutos</strong></li>
              </ol>
              <p className="mt-2 font-medium text-foreground">Para importar histórico:</p>
              <p className="mt-1">Use &quot;Exportação Manual&quot; dentro da automação. Selecione o período desejado e clique &quot;Iniciar Exportação&quot;.</p>
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
                  <th className="pb-2 pr-3">HRV</th>
                  <th className="pb-2 pr-3">FC</th>
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
                    <td className="py-1.5 pr-3">{r.hrv != null ? `${r.hrv}ms` : "\u2014"}</td>
                    <td className="py-1.5 pr-3">{r.heartRate != null ? `${r.heartRate}bpm` : "\u2014"}</td>
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

      {/* Health Metrics */}
      {syncStatus?.healthMetrics && syncStatus.healthMetrics.length > 0 && (
        <Card className="mb-6">
          <h2 className="mb-3 text-lg font-semibold">Metricas de saude importadas</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-left text-muted">
                  <th className="pb-2 pr-3">Data</th>
                  <th className="pb-2 pr-3">Metrica</th>
                  <th className="pb-2 pr-3">Valor</th>
                  <th className="pb-2">Unidade</th>
                </tr>
              </thead>
              <tbody>
                {syncStatus.healthMetrics.map((m) => (
                  <tr key={`${m.date}-${m.metric}`} className="border-b border-border/50">
                    <td className="py-1.5 pr-3">{m.date}</td>
                    <td className="py-1.5 pr-3">{METRIC_LABELS[m.metric] || m.metric}</td>
                    <td className="py-1.5 pr-3">{m.value.toLocaleString("pt-BR")}</td>
                    <td className="py-1.5">{m.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Manual File Import */}
      <Card className="mb-6">
        <h2 className="mb-2 text-lg font-semibold">Importar historico completo</h2>
        <p className="mb-2 text-sm text-muted">
          Importe seus dados <strong>anteriores</strong> do Apple Health para ter insights completos desde o inicio.
        </p>
        <p className="mb-3 text-xs text-muted">
          No Health Auto Export, va em <strong>Exportacao Manual</strong>, selecione o periodo desejado,
          exporte como JSON, e envie o arquivo aqui. Arquivos grandes sao divididos automaticamente.
        </p>

        {importResult && (
          <div className={`mb-3 rounded px-3 py-2 text-sm ${importResult.ok ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
            {importResult.message}
          </div>
        )}

        {importing && importProgress && (
          <div className="mb-3">
            <div className="mb-1 flex justify-between text-xs text-muted">
              <span>Importando...</span>
              <span>{importProgress.current}/{importProgress.total} partes</span>
            </div>
            <div className="h-2 w-full rounded-full bg-surface-alt">
              <div
                className="h-2 rounded-full bg-primary transition-all"
                style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        <label className={`flex cursor-pointer items-center justify-center gap-2 rounded border-2 border-dashed border-border px-4 py-6 text-sm transition-colors hover:border-primary hover:bg-surface-alt ${importing ? "pointer-events-none opacity-50" : ""}`}>
          <input
            type="file"
            accept=".json"
            onChange={handleFileImport}
            disabled={importing}
            className="hidden"
          />
          {importing ? "Importando..." : "Selecionar arquivo JSON"}
        </label>
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
