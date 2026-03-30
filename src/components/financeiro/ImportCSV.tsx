"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface ImportResult {
  imported: number;
  skipped: number;
  total: number;
  source?: string;
  bank?: string;
}

type ImportTab = "arquivo" | "banco" | "email" | "whatsapp";

export function ImportCSV({ onImported }: { onImported: () => void }) {
  const [activeTab, setActiveTab] = useState<ImportTab>("arquivo");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [importEmail, setImportEmail] = useState<string | null>(null);
  const [pluggyAvailable, setPluggyAvailable] = useState(false);
  const [pluggyLoading, setPluggyLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Fetch import email and Pluggy availability on mount
  useEffect(() => {
    fetch("/api/financeiro/import-email")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.email) setImportEmail(data.email); })
      .catch(() => {});

    fetch("/api/financeiro/pluggy/connect")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.available) setPluggyAvailable(true); })
      .catch(() => {});
  }, []);

  function handleFileChange(file: File | null) {
    if (!file) return;
    const name = file.name.toLowerCase();
    if (!name.endsWith(".csv") && !name.endsWith(".xlsx") && !name.endsWith(".ofx") && !name.endsWith(".qfx")) {
      setError("Formato não suportado. Use .csv, .xlsx, .ofx ou .qfx");
      setSelectedFile(null);
      return;
    }
    setSelectedFile(file);
    setError(null);
    setResult(null);
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileChange(file);
  }, []);

  async function handleUpload() {
    if (!selectedFile) {
      setError("Selecione um arquivo primeiro");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const res = await fetch("/api/financeiro/import", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        let msg = "Erro ao importar";
        try {
          const data = await res.json();
          msg = data.errors?.file?.[0] || data.error || msg;
        } catch {
          msg = `Erro ${res.status}: ${res.statusText}`;
        }
        setError(msg);
        return;
      }

      const data: ImportResult = await res.json();
      setResult(data);
      setSelectedFile(null);
      onImported();

      if (fileRef.current) fileRef.current.value = "";
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      setError(`Erro de conexão: ${msg}`);
    } finally {
      setLoading(false);
    }
  }

  async function handlePluggyConnect() {
    setPluggyLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/financeiro/pluggy/connect", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Erro ao conectar");
        return;
      }

      const { accessToken } = await res.json();

      // Open Pluggy Connect widget
      // The widget is loaded via script tag and handles the bank auth flow
      if (typeof window !== "undefined") {
        window.open(
          `https://connect.pluggy.ai/?accessToken=${accessToken}`,
          "pluggy-connect",
          "width=500,height=700,menubar=no,toolbar=no",
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro de conexão");
    } finally {
      setPluggyLoading(false);
    }
  }

  const tabs: { key: ImportTab; label: string; icon: string }[] = [
    { key: "arquivo", label: "Arquivo", icon: "📄" },
    { key: "banco", label: "Banco direto", icon: "🏦" },
    { key: "email", label: "Email", icon: "📧" },
    { key: "whatsapp", label: "WhatsApp", icon: "💬" },
  ];

  return (
    <div>
      <h3 className="mb-3 text-base font-semibold text-foreground">
        Importar transações
      </h3>

      {/* Tab navigation */}
      <div className="mb-4 flex gap-1 rounded-lg bg-surface-alt p-1" role="tablist" aria-label="Métodos de importação">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={activeTab === tab.key}
            aria-controls={`tabpanel-${tab.key}`}
            onClick={() => { setActiveTab(tab.key); setError(null); setResult(null); }}
            className={`flex-1 rounded-md px-2 py-2.5 min-h-[44px] text-xs font-medium transition-all ${
              activeTab === tab.key
                ? "bg-surface text-foreground shadow-sm"
                : "text-muted hover:text-foreground"
            }`}
          >
            <span className="mr-1" aria-hidden="true">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Arquivo ───────────────────────────────────────── */}
      {activeTab === "arquivo" && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs text-muted">
              CSV, XLSX ou OFX — do Mobills, banco ou outro app
            </p>
            <button
              type="button"
              onClick={() => setShowGuide(!showGuide)}
              className="text-xs font-medium text-primary hover:underline"
            >
              {showGuide ? "Fechar guia" : "Como exportar?"}
            </button>
          </div>

          {showGuide && (
            <div className="mb-4 rounded-lg border border-primary/20 bg-primary/5 p-4 dark:bg-primary/10">
              <p className="mb-2 text-sm font-semibold text-foreground">
                De onde posso importar?
              </p>
              <div className="space-y-3 text-sm text-muted">
                <div>
                  <p className="font-medium text-foreground">Mobills</p>
                  <p>Menu → Exportar dados → CSV ou Excel</p>
                </div>
                <div>
                  <p className="font-medium text-foreground">Nubank</p>
                  <p>App → Conta ou Cartão → Menu (⋯) → Exportar extrato → CSV</p>
                </div>
                <div>
                  <p className="font-medium text-foreground">Inter</p>
                  <p>App → Extrato → Exportar → CSV</p>
                </div>
                <div>
                  <p className="font-medium text-foreground">Itaú</p>
                  <p>Internet Banking → Extrato → Salvar como OFX</p>
                </div>
                <div>
                  <p className="font-medium text-foreground">Outros bancos</p>
                  <p>Procure "Exportar extrato" em OFX — formato universal</p>
                </div>
              </div>
              <p className="mt-3 text-xs text-muted">
                Aceita colunas: Data, Descrição, Valor, Categoria, Conta
              </p>
            </div>
          )}

          {/* Drop zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileRef.current?.click(); }}
            aria-label="Área para selecionar ou arrastar arquivo de importação"
            className={`
              cursor-pointer rounded-[var(--radius-card)] border-2 border-dashed p-6 text-center transition-all
              ${isDragging
                ? "border-primary bg-primary/10 dark:bg-primary/20"
                : selectedFile
                  ? "border-success-border bg-success-bg-subtle"
                  : "border-border-soft bg-surface-alt hover:border-primary/50 hover:bg-surface dark:border-border-strong dark:bg-surface-raised/50 dark:hover:border-primary/50 dark:hover:bg-surface-raised"
              }
            `}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.xlsx,.ofx,.qfx"
              className="hidden"
              onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
            />

            {selectedFile ? (
              <div>
                <div className="mb-1 text-2xl" aria-hidden="true">📄</div>
                <p className="text-sm font-medium text-foreground">{selectedFile.name}</p>
                <p className="mt-1 text-xs text-muted">
                  {(selectedFile.size / 1024).toFixed(1)} KB — Clique para trocar
                </p>
              </div>
            ) : (
              <div>
                <div className="mb-1 text-2xl" aria-hidden="true">📁</div>
                <p className="text-sm font-medium text-foreground">
                  Toque para escolher o arquivo
                </p>
                <p className="mt-1 text-xs text-muted">
                  CSV, XLSX ou OFX — arraste ou toque
                </p>
              </div>
            )}
          </div>

          <button
            onClick={handleUpload}
            disabled={loading || !selectedFile}
            className={`
              mt-3 w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-all
              ${selectedFile && !loading
                ? "bg-primary hover:bg-primary/90 active:scale-[0.98]"
                : "cursor-not-allowed bg-border-soft dark:bg-border-strong"
              }
            `}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg aria-hidden="true" className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Importando...
              </span>
            ) : selectedFile ? (
              `Importar ${selectedFile.name}`
            ) : (
              "Selecione um arquivo"
            )}
          </button>
        </div>
      )}

      {/* ── Tab: Banco direto ─────────────────────────────────── */}
      {activeTab === "banco" && (
        <div className="space-y-4">
          {pluggyAvailable ? (
            <div className="text-center">
              <div className="mb-2 text-3xl" aria-hidden="true">🏦</div>
              <h4 className="text-sm font-semibold mb-1">Conecte seu banco</h4>
              <p className="text-xs text-muted mb-4">
                Conecte sua conta bancária e suas transações serão importadas automaticamente.
                Nenhuma senha bancária é compartilhada conosco — a conexão é feita via Open Finance.
              </p>
              <button
                onClick={handlePluggyConnect}
                disabled={pluggyLoading}
                className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
              >
                {pluggyLoading ? "Conectando..." : "Conectar banco"}
              </button>
              <p className="mt-3 text-xs text-muted">
                Compatível com Nubank, Inter, Itaú, Bradesco, BB, Santander e outros.
              </p>
            </div>
          ) : (
            <div className="text-center py-4">
              <div className="mb-2 text-3xl" aria-hidden="true">🏦</div>
              <h4 className="text-sm font-semibold mb-1">Conexão bancária</h4>
              <p className="text-xs text-muted mb-2">
                Em breve você poderá conectar seu banco diretamente e as transações
                serão importadas automaticamente via Open Finance.
              </p>
              <p className="text-xs text-muted">
                Enquanto isso, exporte o extrato do seu banco em formato <strong>OFX</strong> ou <strong>CSV</strong> e
                importe pela aba &quot;Arquivo&quot;.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Email ──────────────────────────────────────── */}
      {activeTab === "email" && (
        <div className="space-y-4">
          <div className="text-center">
            <div className="mb-2 text-3xl" aria-hidden="true">📧</div>
            <h4 className="text-sm font-semibold mb-1">Importe por email</h4>
            <p className="text-xs text-muted mb-3">
              Envie seu extrato (CSV, XLSX ou OFX) como anexo para o endereço abaixo.
              As transações serão importadas automaticamente.
            </p>

            {importEmail ? (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 dark:bg-primary/10">
                <p className="text-xs text-muted mb-1">Seu endereço de importação:</p>
                <div className="flex items-center justify-center gap-2">
                  <code className="text-sm font-mono font-medium text-primary break-all">
                    {importEmail}
                  </code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(importEmail).then(() => {
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }).catch(() => {});
                    }}
                    className="shrink-0 rounded border border-border px-3 py-2 min-h-[44px] text-xs hover:bg-surface-alt"
                    aria-label="Copiar endereço"
                  >
                    {copied ? "Copiado!" : "Copiar"}
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted italic">
                O import por email será disponibilizado em breve.
              </p>
            )}

            <div className="mt-3 text-left rounded-lg border border-border p-3">
              <p className="text-xs font-medium text-foreground mb-1">Como funciona:</p>
              <ol className="list-inside list-decimal space-y-1 text-xs text-muted">
                <li>No seu app financeiro, exporte o extrato</li>
                <li>Envie o arquivo como anexo para o endereço acima</li>
                <li>As transações aparecem automaticamente aqui</li>
              </ol>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: WhatsApp ───────────────────────────────────── */}
      {activeTab === "whatsapp" && (
        <div className="space-y-4">
          <div className="text-center">
            <div className="mb-2 text-3xl" aria-hidden="true">💬</div>
            <h4 className="text-sm font-semibold mb-1">Importe pelo WhatsApp</h4>
            <p className="text-xs text-muted mb-3">
              Envie seu extrato (CSV, XLSX ou OFX) como documento para o WhatsApp do Suporte Bipolar.
              As transações são importadas automaticamente.
            </p>

            <div className="rounded-lg border border-border p-3 text-left">
              <p className="text-xs font-medium text-foreground mb-1">Como funciona:</p>
              <ol className="list-inside list-decimal space-y-1 text-xs text-muted">
                <li>Exporte o extrato do seu banco ou app financeiro</li>
                <li>Envie o arquivo como <strong>documento</strong> (não foto) pelo WhatsApp</li>
                <li>Você receberá uma confirmação com o número de transações importadas</li>
              </ol>
              <p className="mt-2 text-xs text-muted">
                <strong>Importante:</strong> seu número de WhatsApp precisa estar cadastrado no seu perfil
                para que possamos identificar sua conta.
              </p>
            </div>

            <p className="mt-3 text-xs text-muted italic">
              Formatos aceitos: CSV, XLSX e OFX.
            </p>
          </div>
        </div>
      )}

      {/* Success */}
      {result && (
        <div className="mt-3 rounded-lg border border-success-border bg-success-bg-subtle p-3">
          <p className="text-sm font-medium text-success-fg">
            {result.imported} {result.imported === 1 ? "transação importada" : "transações importadas"} com sucesso!
          </p>
          {result.skipped > 0 && (
            <p className="mt-0.5 text-xs text-success-fg">
              {result.skipped} {result.skipped === 1 ? "duplicata ignorada" : "duplicatas ignoradas"}
            </p>
          )}
          {result.bank && (
            <p className="mt-0.5 text-xs text-success-fg">
              Banco detectado: {result.bank}
            </p>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-3 rounded-lg border border-danger-border bg-danger-bg-subtle p-3">
          <p className="text-sm font-medium text-danger-fg">{error}</p>
        </div>
      )}
    </div>
  );
}
