"use client";

import { useState, useRef, useCallback } from "react";

interface ImportResult {
  imported: number;
  skipped: number;
  total: number;
}

export function ImportCSV({ onImported }: { onImported: () => void }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFileChange(file: File | null) {
    if (!file) return;
    const name = file.name.toLowerCase();
    if (!name.endsWith(".csv") && !name.endsWith(".xlsx")) {
      setError("Formato não suportado. Use .csv ou .xlsx");
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

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-semibold text-foreground">
          Importar transações
        </h3>
        <button
          type="button"
          onClick={() => setShowGuide(!showGuide)}
          className="text-xs font-medium text-primary hover:underline"
        >
          {showGuide ? "Fechar guia" : "Como exportar do Mobills?"}
        </button>
      </div>

      {/* Step-by-step guide */}
      {showGuide && (
        <div className="mb-4 rounded-lg border border-primary/20 bg-primary/5 p-4 dark:bg-primary/10">
          <p className="mb-2 text-sm font-semibold text-foreground">
            Passo a passo para exportar do Mobills:
          </p>
          <ol className="list-inside list-decimal space-y-1.5 text-sm text-muted">
            <li>Abra o app <strong>Mobills</strong> no celular</li>
            <li>Vá em <strong>Menu → Exportar dados</strong></li>
            <li>Escolha o período desejado (mês)</li>
            <li>Selecione o formato <strong>CSV</strong> ou <strong>Excel (.xlsx)</strong></li>
            <li>Envie o arquivo para você mesmo (email, WhatsApp, etc.)</li>
            <li>No computador ou celular, escolha o arquivo abaixo</li>
          </ol>
          <p className="mt-2 text-xs text-muted">
            Também funciona com qualquer planilha que tenha as colunas: Data, Descrição, Valor, Categoria, Conta
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
              ? "border-green-400 bg-green-50 dark:border-green-600 dark:bg-green-950/30"
              : "border-border-soft bg-surface-alt hover:border-primary/50 hover:bg-surface dark:border-border-strong dark:bg-surface-raised/50 dark:hover:border-primary/50 dark:hover:bg-surface-raised"
          }
        `}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.xlsx"
          className="hidden"
          onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
        />

        {selectedFile ? (
          <div>
            <div className="mb-1 text-2xl">📄</div>
            <p className="text-sm font-medium text-foreground">{selectedFile.name}</p>
            <p className="mt-1 text-xs text-muted">
              {(selectedFile.size / 1024).toFixed(1)} KB — Clique para trocar
            </p>
          </div>
        ) : (
          <div>
            <div className="mb-1 text-2xl">📁</div>
            <p className="text-sm font-medium text-foreground">
              Toque para escolher o arquivo
            </p>
            <p className="mt-1 text-xs text-muted">
              ou arraste aqui — CSV ou XLSX
            </p>
          </div>
        )}
      </div>

      {/* Import button */}
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
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Importando...
          </span>
        ) : selectedFile ? (
          `Importar ${selectedFile.name}`
        ) : (
          "Selecione um arquivo primeiro"
        )}
      </button>

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
