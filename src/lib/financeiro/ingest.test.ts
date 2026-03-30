import { describe, it, expect, vi, beforeEach } from "vitest";
import { ingestFinancialFile, ingestPluggyTransactions, IngestError } from "./ingest";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("@/lib/db", () => ({
  prisma: {
    financialTransaction: {
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    financialImportEvent: {
      create: vi.fn().mockResolvedValue({ id: "evt-1" }),
      update: vi.fn().mockResolvedValue({}),
    },
  },
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  addBreadcrumb: vi.fn(),
  captureMessage: vi.fn(),
}));

import { prisma } from "@/lib/db";

const mockCreateMany = prisma.financialTransaction.createMany as ReturnType<typeof vi.fn>;
const mockEventCreate = prisma.financialImportEvent.create as ReturnType<typeof vi.fn>;
const mockEventUpdate = prisma.financialImportEvent.update as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockCreateMany.mockResolvedValue({ count: 0 });
  mockEventCreate.mockResolvedValue({ id: "evt-1" });
  mockEventUpdate.mockResolvedValue({});
});

const opts = { userId: "user-1", channel: "web_upload" as const };

// ── CSV routing ──────────────────────────────────────────────────

const MOBILLS_CSV = `DATA;DESCRICAO;VALOR;CATEGORIA;CONTA
01/03/2026;Supermercado;-150,00;Alimentacao;Nubank
02/03/2026;Salario;3500,00;Salario;BB`;

const NUBANK_CSV = `date,title,amount
2026-03-01,UBER TRIP,25.00`;

const OFX_CONTENT = `<OFX><BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260301<TRNAMT>-50.00<MEMO>MERCADO</STMTTRN>
</BANKTRANLIST></OFX>`;

describe("ingestFinancialFile", () => {
  describe("Format routing", () => {
    it("routes .csv to bank parser then Mobills fallback", async () => {
      mockCreateMany.mockResolvedValue({ count: 2 });
      const result = await ingestFinancialFile(MOBILLS_CSV, "export.csv", opts);
      expect(result.source).toBe("mobills_csv");
      expect(result.total).toBe(2);
    });

    it("routes bank-detected CSV correctly", async () => {
      mockCreateMany.mockResolvedValue({ count: 1 });
      const result = await ingestFinancialFile(NUBANK_CSV, "nubank.csv", opts);
      expect(result.source).toBe("nubank_cc_csv");
      expect(result.bank).toBe("nubank_cc");
    });

    it("routes .ofx to OFX parser", async () => {
      mockCreateMany.mockResolvedValue({ count: 1 });
      const result = await ingestFinancialFile(OFX_CONTENT, "extrato.ofx", opts);
      expect(result.source).toBe("ofx");
      expect(result.total).toBe(1);
    });

    it("routes .qfx to OFX parser", async () => {
      mockCreateMany.mockResolvedValue({ count: 1 });
      const result = await ingestFinancialFile(OFX_CONTENT, "extrato.qfx", opts);
      expect(result.source).toBe("ofx");
    });

    it("rejects .xls with IngestError", async () => {
      await expect(ingestFinancialFile("", "old.xls", opts))
        .rejects.toThrow(IngestError);
      await expect(ingestFinancialFile("", "old.xls", opts))
        .rejects.toThrow("xls não é suportado");
    });

    it("accepts .xlsx extension (passes to XLSX parser)", async () => {
      // XLSX with invalid content returns 0 transactions → IngestError
      await expect(ingestFinancialFile("not-a-zip", "file.xlsx", opts))
        .rejects.toThrow("Nenhuma transação");
    });
  });

  describe("Empty/invalid file handling", () => {
    it("throws IngestError for empty CSV", async () => {
      await expect(ingestFinancialFile("", "empty.csv", opts))
        .rejects.toThrow(IngestError);
    });

    it("throws IngestError for CSV with only headers", async () => {
      await expect(ingestFinancialFile("DATA;VALOR\n", "headers.csv", opts))
        .rejects.toThrow("Nenhuma transação");
    });

    it("throws IngestError for OFX with no transactions", async () => {
      await expect(ingestFinancialFile("<OFX></OFX>", "empty.ofx", opts))
        .rejects.toThrow("Nenhuma transação");
    });
  });

  describe("Transaction limit", () => {
    it("rejects files with >10k transactions", async () => {
      // Build a CSV with 10001 rows
      const header = "DATA;DESCRICAO;VALOR;CATEGORIA;CONTA";
      const rows = Array.from({ length: 10001 }, (_, i) =>
        `01/03/2026;Item ${i};-1,00;Outro;Conta`
      );
      const bigCsv = [header, ...rows].join("\n");

      await expect(ingestFinancialFile(bigCsv, "big.csv", opts))
        .rejects.toThrow("10000");
    });
  });

  describe("Batch insert", () => {
    it("batches in groups of 200", async () => {
      // 450 transactions → 3 batches (200 + 200 + 50)
      const header = "DATA;DESCRICAO;VALOR;CATEGORIA;CONTA";
      const rows = Array.from({ length: 450 }, (_, i) =>
        `01/03/2026;Item ${i};-${i + 1},00;Outro;Conta`
      );
      const csv = [header, ...rows].join("\n");

      mockCreateMany.mockResolvedValue({ count: 200 });
      // Last batch has 50 items
      mockCreateMany.mockResolvedValueOnce({ count: 200 });
      mockCreateMany.mockResolvedValueOnce({ count: 200 });
      mockCreateMany.mockResolvedValueOnce({ count: 50 });

      const result = await ingestFinancialFile(csv, "batch.csv", opts);
      expect(mockCreateMany).toHaveBeenCalledTimes(3);
      expect(result.imported).toBe(450);
    });

    it("counts skipped transactions correctly", async () => {
      mockCreateMany.mockResolvedValue({ count: 1 }); // Only 1 of 2 inserted (1 dup)
      const result = await ingestFinancialFile(MOBILLS_CSV, "dup.csv", opts);
      expect(result.imported).toBe(1);
      expect(result.skipped).toBe(1);
      expect(result.total).toBe(2);
    });

    it("truncates descriptions to 200 chars", async () => {
      const longDesc = "A".repeat(300);
      const csv = `DATA;DESCRICAO;VALOR;CATEGORIA;CONTA\n01/03/2026;${longDesc};-10,00;Outro;Conta`;
      mockCreateMany.mockResolvedValue({ count: 1 });
      await ingestFinancialFile(csv, "long.csv", opts);

      const callData = mockCreateMany.mock.calls[0][0].data[0];
      expect(callData.description.length).toBeLessThanOrEqual(200);
    });

    it("propagates occurredAt from OFX timestamps", async () => {
      const ofx = `<OFX><BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260301235900[-3:BRT]<TRNAMT>-10.00<MEMO>LATE NIGHT</STMTTRN>
</BANKTRANLIST></OFX>`;
      mockCreateMany.mockResolvedValue({ count: 1 });
      await ingestFinancialFile(ofx, "night.ofx", opts);

      const callData = mockCreateMany.mock.calls[0][0].data[0];
      expect(callData.occurredAt).toBeInstanceOf(Date);
    });
  });

  describe("Telemetry", () => {
    it("creates import event on start", async () => {
      mockCreateMany.mockResolvedValue({ count: 2 });
      await ingestFinancialFile(MOBILLS_CSV, "test.csv", opts);
      expect(mockEventCreate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: "started" }) }),
      );
    });

    it("updates event to imported on success", async () => {
      mockCreateMany.mockResolvedValue({ count: 2 });
      await ingestFinancialFile(MOBILLS_CSV, "test.csv", opts);
      expect(mockEventUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: "imported" }) }),
      );
    });

    it("updates event to failed on error", async () => {
      await ingestFinancialFile("", "empty.csv", opts).catch(() => {});
      expect(mockEventUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: "failed" }) }),
      );
    });

    it("continues import even if telemetry create fails", async () => {
      mockEventCreate.mockRejectedValue(new Error("DB down"));
      mockCreateMany.mockResolvedValue({ count: 2 });
      const result = await ingestFinancialFile(MOBILLS_CSV, "test.csv", opts);
      expect(result.imported).toBe(2); // Import succeeded despite telemetry failure
    });

    it("tracks duration in milliseconds", async () => {
      mockCreateMany.mockResolvedValue({ count: 2 });
      const result = await ingestFinancialFile(MOBILLS_CSV, "test.csv", opts);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe("OFX encoding", () => {
    it("handles UTF-8 OFX content", async () => {
      const utf8Ofx = `<OFX><BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260301<TRNAMT>-10.00<MEMO>FARMÁCIA SÃO PAULO</STMTTRN>
</BANKTRANLIST></OFX>`;
      mockCreateMany.mockResolvedValue({ count: 1 });
      const result = await ingestFinancialFile(utf8Ofx, "utf8.ofx", opts);
      expect(result.imported).toBe(1);
    });

    it("handles ArrayBuffer content for OFX", async () => {
      const buffer = new TextEncoder().encode(OFX_CONTENT).buffer;
      mockCreateMany.mockResolvedValue({ count: 1 });
      const result = await ingestFinancialFile(buffer, "binary.ofx", opts);
      expect(result.imported).toBe(1);
    });
  });

  describe("Error handling", () => {
    it("throws IngestError (not Sentry-reported) for user errors", async () => {
      const Sentry = await import("@sentry/nextjs");
      await ingestFinancialFile("", "empty.csv", opts).catch(() => {});
      expect(Sentry.captureException).not.toHaveBeenCalled();
    });

    it("reports non-IngestError to Sentry", async () => {
      mockCreateMany.mockRejectedValue(new Error("DB connection failed"));
      const Sentry = await import("@sentry/nextjs");
      await ingestFinancialFile(MOBILLS_CSV, "db-fail.csv", opts).catch(() => {});
      expect(Sentry.captureException).toHaveBeenCalled();
    });
  });
});

// ── Pluggy ingestion ──────────────────────────────────────────────

describe("ingestPluggyTransactions", () => {
  const pluggyTxs = [
    { id: "p1", date: "2026-03-01T12:00:00Z", description: "PIX RECEBIDO", amount: 100, category: "Transferencia", accountName: "Nubank - Conta" },
    { id: "p2", date: "2026-03-02T15:30:00Z", description: "UBER", amount: -25.90 },
  ];

  it("maps and ingests Pluggy transactions", async () => {
    mockCreateMany.mockResolvedValue({ count: 2 });
    const result = await ingestPluggyTransactions("user-1", pluggyTxs);
    expect(result.source).toBe("pluggy");
    expect(result.total).toBe(2);
    expect(result.imported).toBe(2);
  });

  it("truncates date to YYYY-MM-DD", async () => {
    mockCreateMany.mockResolvedValue({ count: 1 });
    await ingestPluggyTransactions("user-1", [pluggyTxs[0]]);
    const callData = mockCreateMany.mock.calls[0][0].data[0];
    expect(callData.date).toBe("2026-03-01");
  });

  it("defaults category to Outro when missing", async () => {
    mockCreateMany.mockResolvedValue({ count: 1 });
    await ingestPluggyTransactions("user-1", [pluggyTxs[1]]);
    const callData = mockCreateMany.mock.calls[0][0].data[0];
    expect(callData.category).toBe("Outro");
  });

  it("defaults account to Pluggy when missing", async () => {
    mockCreateMany.mockResolvedValue({ count: 1 });
    await ingestPluggyTransactions("user-1", [pluggyTxs[1]]);
    const callData = mockCreateMany.mock.calls[0][0].data[0];
    expect(callData.account).toBe("Pluggy");
  });

  it("uses provided accountName", async () => {
    mockCreateMany.mockResolvedValue({ count: 1 });
    await ingestPluggyTransactions("user-1", [pluggyTxs[0]]);
    const callData = mockCreateMany.mock.calls[0][0].data[0];
    expect(callData.account).toBe("Nubank - Conta");
  });
});

// ── IngestError ──────────────────────────────────────────────────

describe("IngestError", () => {
  it("has correct name", () => {
    const err = new IngestError("test");
    expect(err.name).toBe("IngestError");
    expect(err.message).toBe("test");
    expect(err).toBeInstanceOf(Error);
  });
});
