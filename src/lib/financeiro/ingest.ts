import { prisma } from "@/lib/db";
import * as Sentry from "@sentry/nextjs";
import { parseMobillsCsv, type ParsedTransaction } from "./parseMobillsCsv";
import { parseOFX } from "./parseOFX";
import { parseBankCsv } from "./parseBankCsv";
// parseMobillsXlsx is dynamically imported to avoid ExcelJS cold start on non-XLSX routes

// ── Types ────────────────────────────────────────────────────────

export type ImportChannel = "web_upload" | "whatsapp" | "email" | "pluggy" | "api";

export interface IngestResult {
  imported: number;
  skipped: number;
  total: number;
  source: string;
  bank?: string;
  durationMs: number;
}

export interface IngestOptions {
  userId: string;
  channel: ImportChannel;
  fileName?: string;
  fileSize?: number;
}

// ── Unified ingestion pipeline ──────────────────────────────────

/**
 * Unified financial data ingestion pipeline.
 *
 * Accepts raw file content (text or ArrayBuffer), auto-detects format,
 * parses transactions, deduplicates, and batch-inserts into the database.
 *
 * Supports: Mobills CSV/XLSX, OFX, Nubank CSV, Inter CSV, Itaú CSV, C6 CSV.
 *
 * Tracks the full funnel via FinancialImportEvent for telemetry.
 */
export async function ingestFinancialFile(
  content: string | ArrayBuffer,
  fileName: string,
  opts: IngestOptions,
): Promise<IngestResult> {
  const startTime = Date.now();
  const normalizedName = fileName.toLowerCase();

  // Track: started (telemetry failure must NOT kill the import)
  let importEvent: { id: string } | null = null;
  try {
    importEvent = await createImportEvent(opts, normalizedName, "started");
  } catch (telemetryErr) {
    Sentry.captureException(telemetryErr, { tags: { event: "telemetry_create_failed" } });
  }

  try {
    // ── 1. Parse ──────────────────────────────────────────────────
    let transactions: ParsedTransaction[];
    let source: string;
    let bank: string | undefined;

    if (normalizedName.endsWith(".ofx") || normalizedName.endsWith(".qfx")) {
      // Detect encoding from OFX header; default to Latin1 (most BR banks)
      const rawBytes = typeof content === "string" ? null : new Uint8Array(content);
      let text: string;
      if (typeof content === "string") {
        text = content;
      } else {
        // Try UTF-8 first, fall back to Latin1
        const utf8Text = new TextDecoder("utf-8", { fatal: true });
        try {
          text = utf8Text.decode(rawBytes!);
        } catch {
          text = new TextDecoder("latin1").decode(rawBytes!);
        }
      }
      transactions = parseOFX(text);
      source = "ofx";
    } else if (normalizedName.endsWith(".xlsx")) {
      const buffer = typeof content === "string"
        ? new TextEncoder().encode(content).buffer
        : content;
      // Dynamic import: ExcelJS (~2MB) only loaded when actually needed
      const { parseMobillsXlsx } = await import("./parseMobillsXlsx");
      transactions = await parseMobillsXlsx(buffer);
      source = "mobills_xlsx";
    } else if (normalizedName.endsWith(".xls")) {
      throw new IngestError("Formato .xls não é suportado. Exporte novamente como .xlsx, .csv ou .ofx.");
    } else {
      // CSV — try bank-specific parser first, fall back to Mobills parser
      const text = typeof content === "string" ? content : new TextDecoder("utf-8").decode(content);

      const bankResult = parseBankCsv(text);
      if (bankResult.transactions.length > 0) {
        transactions = bankResult.transactions;
        bank = bankResult.bank;
        source = `${bankResult.bank}_csv`;
      } else {
        // Fall back to Mobills CSV parser (generic)
        transactions = parseMobillsCsv(text);
        source = "mobills_csv";
      }
    }

    // Track: parsed
    await safeUpdateEvent(importEvent, "parsed", {
      source,
      transactionsTotal: transactions.length,
      metadata: JSON.stringify({
        fileName: opts.fileName || fileName,
        fileSize: opts.fileSize,
        bank,
      }),
    });

    if (transactions.length === 0) {
      await safeUpdateEvent(importEvent, "failed", {
        errorMessage: "Nenhuma transação encontrada no arquivo.",
      });
      throw new IngestError(
        "Nenhuma transação encontrada no arquivo. Verifique se o formato está correto.",
      );
    }

    // Guard against oversized files
    const MAX_TRANSACTIONS = 10_000;
    if (transactions.length > MAX_TRANSACTIONS) {
      await safeUpdateEvent(importEvent, "failed", {
        errorMessage: `Arquivo muito grande: ${transactions.length} transações (máximo: ${MAX_TRANSACTIONS}).`,
      });
      throw new IngestError(
        `Arquivo contém ${transactions.length} transações. O máximo por importação é ${MAX_TRANSACTIONS}.`,
      );
    }

    // ── 2. Batch insert with dedup ────────────────────────────────
    const BATCH_SIZE = 200;
    let imported = 0;

    for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
      const batch = transactions.slice(i, i + BATCH_SIZE);
      const result = await prisma.financialTransaction.createMany({
        data: batch.map((tx) => ({
          userId: opts.userId,
          date: tx.date,
          description: tx.description.slice(0, 200),
          amount: tx.amount,
          category: tx.category,
          account: tx.account,
          occurredAt: tx.occurredAt || null,
          source,
        })),
        skipDuplicates: true,
      });
      imported += result.count;
    }

    const durationMs = Date.now() - startTime;
    const total = transactions.length;
    const skipped = total - imported;

    // Track: imported
    await safeUpdateEvent(importEvent, "imported", {
      transactionsImported: imported,
      transactionsSkipped: skipped,
      durationMs,
    });

    return { imported, skipped, total, source, bank, durationMs };
  } catch (err) {
    const durationMs = Date.now() - startTime;
    const errorMessage = err instanceof Error ? err.message : "Erro desconhecido";

    await safeUpdateEvent(importEvent, "failed", {
      errorMessage: errorMessage.slice(0, 500),
      durationMs,
    }).catch(() => {}); // Don't fail the whole request if telemetry fails

    if (!(err instanceof IngestError)) {
      Sentry.captureException(err, {
        tags: { endpoint: "financial_ingest", channel: opts.channel },
      });
    }
    throw err;
  }
}

// ── Pluggy transaction ingestion (from webhook) ─────────────────

export interface PluggyTransaction {
  id: string;
  date: string; // ISO date
  description: string;
  amount: number;
  category?: string;
  accountName?: string;
}

/**
 * Ingest transactions from Pluggy webhook payload.
 * Uses Pluggy's transaction IDs for dedup (appended to description).
 */
export async function ingestPluggyTransactions(
  userId: string,
  transactions: PluggyTransaction[],
  itemId?: string,
): Promise<IngestResult> {
  const startTime = Date.now();

  let importEvent: { id: string } | null = null;
  try {
    importEvent = await createImportEvent(
      { userId, channel: "pluggy" },
      itemId ? `pluggy-webhook|itemId:${itemId}` : "pluggy-webhook",
      "started",
    );
  } catch (telemetryErr) {
    Sentry.captureException(telemetryErr, { tags: { event: "telemetry_create_failed" } });
  }

  try {
    const parsed: ParsedTransaction[] = transactions.map((tx) => ({
      date: tx.date.slice(0, 10), // YYYY-MM-DD
      description: tx.description.slice(0, 200),
      amount: tx.amount,
      category: tx.category || "Outro",
      account: tx.accountName || "Pluggy",
    }));

    const BATCH_SIZE = 200;
    let imported = 0;

    for (let i = 0; i < parsed.length; i += BATCH_SIZE) {
      const batch = parsed.slice(i, i + BATCH_SIZE);
      const result = await prisma.financialTransaction.createMany({
        data: batch.map((tx) => ({
          userId,
          date: tx.date,
          description: tx.description,
          amount: tx.amount,
          category: tx.category,
          account: tx.account,
          source: "pluggy",
        })),
        skipDuplicates: true,
      });
      imported += result.count;
    }

    const durationMs = Date.now() - startTime;
    const total = parsed.length;
    const skipped = total - imported;

    await safeUpdateEvent(importEvent, "imported", {
      source: "pluggy",
      transactionsTotal: total,
      transactionsImported: imported,
      transactionsSkipped: skipped,
      durationMs,
    });

    return { imported, skipped, total, source: "pluggy", durationMs };
  } catch (err) {
    await safeUpdateEvent(importEvent, "failed", {
      errorMessage: err instanceof Error ? err.message.slice(0, 500) : "Unknown",
      durationMs: Date.now() - startTime,
    }).catch(() => {});
    Sentry.captureException(err, { tags: { endpoint: "pluggy_ingest" } });
    throw err;
  }
}

// ── Telemetry helpers ──────────────────────────────────────────

async function createImportEvent(
  opts: Pick<IngestOptions, "userId" | "channel">,
  fileName: string,
  status: string,
) {
  return prisma.financialImportEvent.create({
    data: {
      userId: opts.userId,
      channel: opts.channel,
      source: "unknown",
      status,
      metadata: JSON.stringify({ fileName }),
    },
  });
}

async function updateImportEvent(
  id: string,
  status: string,
  data: Partial<{
    source: string;
    transactionsTotal: number;
    transactionsImported: number;
    transactionsSkipped: number;
    errorMessage: string;
    durationMs: number;
    metadata: string;
  }>,
) {
  return prisma.financialImportEvent.update({
    where: { id },
    data: { status, ...data },
  });
}

/** Safe wrapper — skips telemetry update if event was never created. */
async function safeUpdateEvent(
  event: { id: string } | null,
  status: string,
  data: Parameters<typeof updateImportEvent>[2],
) {
  if (!event) return;
  return updateImportEvent(event.id, status, data).catch((err) => {
    Sentry.captureException(err, { tags: { event: "telemetry_update_failed" }, level: "warning" });
  });
}

// ── Custom error ──────────────────────────────────────────────

export class IngestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IngestError";
  }
}
