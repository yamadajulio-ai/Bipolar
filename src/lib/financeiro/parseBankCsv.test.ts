import { describe, it, expect } from "vitest";
import { parseBankCsv } from "./parseBankCsv";

// ── Nubank Credit Card CSV ──────────────────────────────────────

const NUBANK_CC_CSV = `date,title,amount
2026-03-01,SUPERMERCADO PAO DE ACUCAR,150.00
2026-03-02,UBER TRIP SAO PAULO,25.90
2026-03-05,SPOTIFY PREMIUM,19.90
2026-03-10,FARMACIA DROGASIL,45.00
`;

const NUBANK_CC_CSV_BR = `data,categoria,titulo,valor
01/03/2026,Supermercado,PAO DE ACUCAR,"150,00"
02/03/2026,Transporte,UBER TRIP,"25,90"
`;

// ── Nubank Conta CSV ─────────────────────────────────────────────

const NUBANK_CONTA_CSV = `Data,Valor,Identificador,Descrição
2026-03-15,-25.00,pix-123,PIX ENVIADO JOAO
2026-03-15,100.00,pix-456,PIX RECEBIDO MARIA
2026-03-16,-89.90,boleto-789,BOLETO PLANO DE SAUDE
`;

// ── Banco Inter CSV ─────────────────────────────────────────────

const INTER_CSV = `Data Lançamento;Histórico;Descrição;Valor;Saldo
01/03/2026;PIX RECEBIDO;SALARIO EMPRESA LTDA;5000,00;5000,00
02/03/2026;COMPRA DEBITO;MERCADO EXTRA;-234,56;4765,44
05/03/2026;PIX ENVIADO;ALUGUEL APARTAMENTO;-1500,00;3265,44
`;

// ── Itaú CSV ────────────────────────────────────────────────────

const ITAU_CSV = `data;lancamento;ag_orig;lote;doc;valor
01/03/2026;SALARIO;0001;000;000;"5.000,00"
02/03/2026;UBER TRIP;0001;000;000;"-25,90"
05/03/2026;NETFLIX.COM;0001;000;000;"-39,90"
`;

// ── C6 Bank CSV ─────────────────────────────────────────────────

const C6_CSV = `Data da Transação;Descrição;Tipo de Transação;Valor;Identificador
01/03/2026;PIX RECEBIDO;CREDITO;1000,00;abc123
02/03/2026;COMPRA DEBITO VISA;DEBITO;-89,90;def456
`;

// ── Unknown format CSV ──────────────────────────────────────────

const UNKNOWN_CSV = `random,columns,here
a,b,c
`;

// ── Tests ──────────────────────────────────────────────────────

describe("parseBankCsv", () => {
  describe("Nubank Credit Card", () => {
    it("detects Nubank CC and parses transactions", () => {
      const { transactions, bank } = parseBankCsv(NUBANK_CC_CSV);
      expect(bank).toBe("nubank_cc");
      expect(transactions).toHaveLength(4);
    });

    it("negates amounts (CC expenses are positive in export)", () => {
      const { transactions } = parseBankCsv(NUBANK_CC_CSV);
      expect(transactions[0].amount).toBe(-150.00);
      expect(transactions[1].amount).toBe(-25.90);
    });

    it("sets account to Nubank Cartão", () => {
      const { transactions } = parseBankCsv(NUBANK_CC_CSV);
      expect(transactions[0].account).toBe("Nubank Cartão");
    });

    it("parses Brazilian format (dd/mm/yyyy, comma decimal)", () => {
      const { transactions, bank } = parseBankCsv(NUBANK_CC_CSV_BR);
      expect(bank).toBe("nubank_cc");
      expect(transactions).toHaveLength(2);
      expect(transactions[0].date).toBe("2026-03-01");
      expect(transactions[0].amount).toBe(-150.00);
    });
  });

  describe("Nubank Conta", () => {
    it("detects Nubank Conta and parses transactions", () => {
      const { transactions, bank } = parseBankCsv(NUBANK_CONTA_CSV);
      expect(bank).toBe("nubank_conta");
      expect(transactions).toHaveLength(3);
    });

    it("preserves sign (negative=debit, positive=credit)", () => {
      const { transactions } = parseBankCsv(NUBANK_CONTA_CSV);
      expect(transactions[0].amount).toBe(-25.00);
      expect(transactions[1].amount).toBe(100.00);
    });

    it("sets account to Nubank Conta", () => {
      const { transactions } = parseBankCsv(NUBANK_CONTA_CSV);
      expect(transactions[0].account).toBe("Nubank Conta");
    });
  });

  describe("Banco Inter", () => {
    it("detects Inter and parses semicolon-delimited CSV", () => {
      const { transactions, bank } = parseBankCsv(INTER_CSV);
      expect(bank).toBe("inter");
      expect(transactions).toHaveLength(3);
    });

    it("parses Brazilian dates and amounts", () => {
      const { transactions } = parseBankCsv(INTER_CSV);
      expect(transactions[0].date).toBe("2026-03-01");
      expect(transactions[0].amount).toBe(5000.00);
      expect(transactions[1].amount).toBe(-234.56);
    });

    it("sets account to Inter", () => {
      const { transactions } = parseBankCsv(INTER_CSV);
      expect(transactions[0].account).toBe("Inter");
    });
  });

  describe("Itaú", () => {
    it("detects Itaú and parses transactions", () => {
      const { transactions, bank } = parseBankCsv(ITAU_CSV);
      expect(bank).toBe("itau");
      expect(transactions).toHaveLength(3);
    });

    it("parses quoted Brazilian amounts with thousand separators", () => {
      const { transactions } = parseBankCsv(ITAU_CSV);
      expect(transactions[0].amount).toBe(5000.00);
      expect(transactions[1].amount).toBe(-25.90);
    });

    it("sets account to Itaú", () => {
      const { transactions } = parseBankCsv(ITAU_CSV);
      expect(transactions[0].account).toBe("Itaú");
    });
  });

  describe("C6 Bank", () => {
    it("detects C6 and parses transactions", () => {
      const { transactions, bank } = parseBankCsv(C6_CSV);
      expect(bank).toBe("c6");
      expect(transactions).toHaveLength(2);
    });

    it("parses amounts correctly", () => {
      const { transactions } = parseBankCsv(C6_CSV);
      expect(transactions[0].amount).toBe(1000.00);
      expect(transactions[1].amount).toBe(-89.90);
    });
  });

  describe("Unknown format", () => {
    it("returns empty for unknown CSV format", () => {
      const { transactions, bank } = parseBankCsv(UNKNOWN_CSV);
      expect(bank).toBe("unknown");
      expect(transactions).toHaveLength(0);
    });

    it("returns empty for empty input", () => {
      const { transactions, bank } = parseBankCsv("");
      expect(bank).toBe("unknown");
      expect(transactions).toHaveLength(0);
    });
  });

  describe("Edge cases", () => {
    it("handles BOM prefix", () => {
      const { transactions } = parseBankCsv("\uFEFF" + NUBANK_CC_CSV);
      expect(transactions).toHaveLength(4);
    });

    it("handles CRLF line endings", () => {
      const crlf = NUBANK_CC_CSV.replace(/\n/g, "\r\n");
      const { transactions } = parseBankCsv(crlf);
      expect(transactions).toHaveLength(4);
    });

    it("handles empty lines", () => {
      const withEmpty = NUBANK_CC_CSV + "\n\n\n";
      const { transactions } = parseBankCsv(withEmpty);
      expect(transactions).toHaveLength(4);
    });
  });
});
