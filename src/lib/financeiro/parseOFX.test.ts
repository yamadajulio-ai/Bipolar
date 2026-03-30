import { describe, it, expect } from "vitest";
import { parseOFX } from "./parseOFX";

// ── Sample OFX data from common Brazilian banks ──────────────────

const ITAU_OFX = `
OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX>
<SIGNONMSGSRSV1>
<SONRS>
<STATUS><CODE>0<SEVERITY>INFO</STATUS>
<DTSERVER>20260315120000[-3:BRT]
<LANGUAGE>POR
</SONRS>
</SIGNONMSGSRSV1>
<BANKMSGSRSV1>
<STMTTRNRS>
<TRNUID>0
<STATUS><CODE>0<SEVERITY>INFO</STATUS>
<STMTRS>
<CURDEF>BRL
<BANKACCTFROM>
<BANKID>0341
<ACCTID>12345
<ACCTTYPE>CHECKING
</BANKACCTFROM>
<BANKTRANLIST>
<DTSTART>20260301120000[-3:BRT]
<DTEND>20260315120000[-3:BRT]
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260301120000[-3:BRT]
<TRNAMT>-45.90
<FITID>20260301001
<MEMO>SUPERMERCADO CARREFOUR
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260302120000[-3:BRT]
<TRNAMT>-15.50
<FITID>20260302001
<MEMO>UBER TRIP
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260305120000[-3:BRT]
<TRNAMT>3500.00
<FITID>20260305001
<MEMO>SALARIO EMPRESA LTDA
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260307120000[-3:BRT]
<TRNAMT>-89.90
<FITID>20260307001
<MEMO>DROGARIA SAO PAULO
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260310120000[-3:BRT]
<TRNAMT>-32.00
<FITID>20260310001
<MEMO>IFOOD PEDIDO 123456
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260312120000[-3:BRT]
<TRNAMT>-149.90
<FITID>20260312001
<MEMO>NETFLIX.COM
</STMTTRN>
</BANKTRANLIST>
<LEDGERBAL>
<BALAMT>5200.00
<DTASOF>20260315120000[-3:BRT]
</LEDGERBAL>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>
`;

const NUBANK_OFX = `
OFXHEADER:100
DATA:OFXSGML
VERSION:102

<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<CURDEF>BRL
<BANKACCTFROM>
<BANKID>0260
<ACCTID>999888
<ACCTTYPE>CHECKING
</BANKACCTFROM>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260315
<TRNAMT>-25.00
<FITID>nu001
<MEMO>PIX ENVIADO JOAO SILVA
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260315
<TRNAMT>100.00
<FITID>nu002
<MEMO>PIX RECEBIDO MARIA
</STMTTRN>
</BANKTRANLIST>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>
`;

const BB_OFX_XML = `<?xml version="1.0" encoding="UTF-8"?>
<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<CURDEF>BRL</CURDEF>
<BANKACCTFROM>
<BANKID>0001</BANKID>
<ACCTID>54321</ACCTID>
<ACCTTYPE>CHECKING</ACCTTYPE>
</BANKACCTFROM>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT</TRNTYPE>
<DTPOSTED>20260320</DTPOSTED>
<TRNAMT>-200.00</TRNAMT>
<FITID>bb001</FITID>
<MEMO>COMPRA CARTAO VISA</MEMO>
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEP</TRNTYPE>
<DTPOSTED>20260320</DTPOSTED>
<TRNAMT>5000.00</TRNAMT>
<FITID>bb002</FITID>
<MEMO>FOLHA DE PAGAMENTO</MEMO>
</STMTTRN>
</BANKTRANLIST>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`;

// ── Tests ──────────────────────────────────────────────────────

describe("parseOFX", () => {
  describe("Itaú OFX (SGML format with timezone)", () => {
    const txs = parseOFX(ITAU_OFX);

    it("parses all 6 transactions", () => {
      expect(txs).toHaveLength(6);
    });

    it("parses dates correctly (strips timezone)", () => {
      expect(txs[0].date).toBe("2026-03-01");
      expect(txs[2].date).toBe("2026-03-05");
      expect(txs[5].date).toBe("2026-03-12");
    });

    it("parses amounts correctly", () => {
      expect(txs[0].amount).toBe(-45.90);
      expect(txs[2].amount).toBe(3500.00);
      expect(txs[4].amount).toBe(-32.00);
    });

    it("extracts descriptions from MEMO", () => {
      expect(txs[0].description).toBe("SUPERMERCADO CARREFOUR");
      expect(txs[1].description).toBe("UBER TRIP");
    });

    it("detects bank from BANKID 0341 → Itaú", () => {
      expect(txs[0].account).toBe("Itaú");
    });

    it("categorizes transactions", () => {
      expect(txs[0].category).toBe("Mercado"); // SUPERMERCADO
      expect(txs[1].category).toBe("Transporte"); // UBER
      expect(txs[2].category).toBe("Salario"); // SALARIO
      expect(txs[3].category).toBe("Farmacia"); // DROGARIA
      expect(txs[4].category).toBe("Delivery"); // IFOOD
      expect(txs[5].category).toBe("Assinatura"); // NETFLIX
    });
  });

  describe("Nubank OFX (short date format)", () => {
    const txs = parseOFX(NUBANK_OFX);

    it("parses 2 transactions", () => {
      expect(txs).toHaveLength(2);
    });

    it("parses short date format YYYYMMDD", () => {
      expect(txs[0].date).toBe("2026-03-15");
    });

    it("handles positive PIX as Transferencia", () => {
      expect(txs[1].amount).toBe(100.00);
      expect(txs[1].category).toBe("Transferencia"); // PIX credit
    });

    it("detects bank from BANKID 0260 → Nubank", () => {
      expect(txs[0].account).toBe("Nubank");
    });
  });

  describe("Banco do Brasil OFX (XML format)", () => {
    const txs = parseOFX(BB_OFX_XML);

    it("parses 2 transactions from XML format", () => {
      expect(txs).toHaveLength(2);
    });

    it("parses amounts", () => {
      expect(txs[0].amount).toBe(-200.00);
      expect(txs[1].amount).toBe(5000.00);
    });

    it("handles DEP type as Salario for FOLHA", () => {
      expect(txs[1].category).toBe("Salario");
    });

    it("detects bank from BANKID 0001 → Banco do Brasil", () => {
      expect(txs[0].account).toBe("Banco do Brasil");
    });
  });

  describe("Edge cases", () => {
    it("returns empty array for empty input", () => {
      expect(parseOFX("")).toEqual([]);
    });

    it("returns empty array for non-OFX content", () => {
      expect(parseOFX("just some random text")).toEqual([]);
    });

    it("handles OFX with no transactions", () => {
      const noTx = `<OFX><BANKTRANLIST></BANKTRANLIST></OFX>`;
      expect(parseOFX(noTx)).toEqual([]);
    });

    it("skips transactions with invalid dates", () => {
      const bad = `<OFX><BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>99999999<TRNAMT>-10.00<MEMO>TEST</STMTTRN>
</BANKTRANLIST></OFX>`;
      expect(parseOFX(bad)).toEqual([]);
    });

    it("skips transactions with invalid amounts", () => {
      const bad = `<OFX><BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260301<TRNAMT>abc<MEMO>TEST</STMTTRN>
</BANKTRANLIST></OFX>`;
      expect(parseOFX(bad)).toEqual([]);
    });

    it("handles commas in amount (Brazilian format)", () => {
      const commaAmount = `<OFX><BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260301<TRNAMT>-1234,56<MEMO>TEST</STMTTRN>
</BANKTRANLIST></OFX>`;
      const txs = parseOFX(commaAmount);
      expect(txs).toHaveLength(1);
      expect(txs[0].amount).toBe(-1234.56);
    });

    it("truncates long descriptions to 200 chars", () => {
      const longDesc = "A".repeat(300);
      const long = `<OFX><BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260301<TRNAMT>-10.00<MEMO>${longDesc}</STMTTRN>
</BANKTRANLIST></OFX>`;
      const txs = parseOFX(long);
      expect(txs[0].description.length).toBeLessThanOrEqual(200);
    });
  });
});
