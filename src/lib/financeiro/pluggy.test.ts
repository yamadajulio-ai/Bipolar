import { describe, it, expect, vi, beforeEach } from "vitest";
import { mapPluggyTransactions, type PluggyRawTransaction } from "./pluggy";

// Note: We only test the pure function `mapPluggyTransactions` here.
// The API-calling functions (getApiToken, createConnectToken, fetchTransactions)
// require network mocking which is better tested in integration tests.

describe("mapPluggyTransactions", () => {
  const raw: PluggyRawTransaction[] = [
    {
      id: "tx-1",
      date: "2026-03-15T14:30:00.000Z",
      description: "PIX RECEBIDO - JOAO SILVA",
      amount: 500.00,
      type: "CREDIT",
      category: { name: "Transferência" },
      account: { name: "Conta Corrente", bankName: "Nubank" },
    },
    {
      id: "tx-2",
      date: "2026-03-16T09:15:00.000Z",
      description: "SUPERMERCADO EXTRA",
      amount: -234.56,
      type: "DEBIT",
      category: undefined,
      account: { name: "Conta Corrente" },
    },
    {
      id: "tx-3",
      date: "2026-03-17T22:00:00.000Z",
      description: "NETFLIX",
      amount: -39.90,
      type: "DEBIT",
    },
  ];

  it("maps all transactions", () => {
    const result = mapPluggyTransactions(raw);
    expect(result).toHaveLength(3);
  });

  it("truncates date to YYYY-MM-DD", () => {
    const result = mapPluggyTransactions(raw);
    expect(result[0].date).toBe("2026-03-15");
    expect(result[1].date).toBe("2026-03-16");
  });

  it("preserves description", () => {
    const result = mapPluggyTransactions(raw);
    expect(result[0].description).toBe("PIX RECEBIDO - JOAO SILVA");
  });

  it("preserves amount and sign", () => {
    const result = mapPluggyTransactions(raw);
    expect(result[0].amount).toBe(500.00);
    expect(result[1].amount).toBe(-234.56);
  });

  it("uses category name when available", () => {
    const result = mapPluggyTransactions(raw);
    expect(result[0].category).toBe("Transferência");
  });

  it("defaults category to Outro when missing", () => {
    const result = mapPluggyTransactions(raw);
    expect(result[1].category).toBe("Outro");
    expect(result[2].category).toBe("Outro");
  });

  it("formats accountName as 'bankName - name' when bankName available", () => {
    const result = mapPluggyTransactions(raw);
    expect(result[0].accountName).toBe("Nubank - Conta Corrente");
  });

  it("uses just account name when bankName missing", () => {
    const result = mapPluggyTransactions(raw);
    expect(result[1].accountName).toBe("Conta Corrente");
  });

  it("returns undefined accountName when no account", () => {
    const result = mapPluggyTransactions(raw);
    expect(result[2].accountName).toBeUndefined();
  });

  it("preserves transaction id", () => {
    const result = mapPluggyTransactions(raw);
    expect(result[0].id).toBe("tx-1");
  });

  it("handles empty array", () => {
    expect(mapPluggyTransactions([])).toEqual([]);
  });
});
