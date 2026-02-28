"use client";

import { useState, useRef } from "react";

interface ImportResult {
  imported: number;
  skipped: number;
  total: number;
}

export function ImportCSV({ onImported }: { onImported: () => void }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleUpload() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/financeiro/import", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.errors?.file?.[0] || data.error || "Erro ao importar");
        return;
      }

      const data: ImportResult = await res.json();
      setResult(data);
      onImported();

      // Reset file input
      if (fileRef.current) fileRef.current.value = "";
    } catch {
      setError("Erro de conexao ao importar arquivo");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h3 className="mb-2 text-sm font-medium">Importar do Mobills</h3>
      <div className="flex items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="text-sm file:mr-2 file:rounded file:border-0 file:bg-primary file:px-3 file:py-1 file:text-sm file:text-white"
        />
        <button
          onClick={handleUpload}
          disabled={loading}
          className="rounded bg-primary px-4 py-1 text-sm text-white disabled:opacity-50"
        >
          {loading ? "Importando..." : "Importar"}
        </button>
      </div>

      {result && (
        <p className="mt-2 text-sm text-green-600">
          {result.imported} transacoes importadas
          {result.skipped > 0 && `, ${result.skipped} duplicatas ignoradas`}
        </p>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
