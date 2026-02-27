import { describe, it, expect } from "vitest";
import { parseMobillsCsv } from "./parseMobillsCsv";

describe("parseMobillsCsv", () => {
  it("parses standard Mobills CSV with comma delimiter", () => {
    const csv = `DATA,DESCRICAO,VALOR,CONTA,CATEGORIA
15/06/2025,Supermercado,-150.50,Nubank,Alimentacao
16/06/2025,Salario,3500.00,Nubank,Renda`;

    const result = parseMobillsCsv(csv);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      date: "2025-06-15",
      description: "Supermercado",
      amount: -150.50,
      category: "Alimentacao",
      account: "Nubank",
    });
    expect(result[1].amount).toBe(3500);
  });

  it("handles BOM prefix", () => {
    const csv = `\uFEFFDATA,DESCRICAO,VALOR,CONTA,CATEGORIA
15/06/2025,Compra,-50,BB,Lazer`;

    const result = parseMobillsCsv(csv);
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe("2025-06-15");
  });

  it("handles semicolon delimiter", () => {
    const csv = `DATA;DESCRICAO;VALOR;CONTA;CATEGORIA
15/06/2025;Uber;-25,90;Nubank;Transporte`;

    const result = parseMobillsCsv(csv);
    expect(result).toHaveLength(1);
    expect(result[0].amount).toBeCloseTo(-25.90);
    expect(result[0].category).toBe("Transporte");
  });

  it("parses Brazilian number format (1.234,56)", () => {
    const csv = `DATA;DESCRICAO;VALOR;CONTA;CATEGORIA
15/06/2025;Aluguel;-1.250,00;BB;Moradia
16/06/2025;Freelance;2.500,50;BB;Renda`;

    const result = parseMobillsCsv(csv);
    expect(result).toHaveLength(2);
    expect(result[0].amount).toBe(-1250);
    expect(result[1].amount).toBeCloseTo(2500.50);
  });

  it("handles quoted fields with commas inside", () => {
    const csv = `DATA,DESCRICAO,VALOR,CONTA,CATEGORIA
15/06/2025,"Restaurante, Jantar",-85.00,Nubank,Alimentacao`;

    const result = parseMobillsCsv(csv);
    expect(result).toHaveLength(1);
    expect(result[0].description).toBe("Restaurante, Jantar");
  });

  it("skips empty lines", () => {
    const csv = `DATA,DESCRICAO,VALOR,CONTA,CATEGORIA
15/06/2025,Cafe,-5,Nubank,Alimentacao

16/06/2025,Agua,-3,Nubank,Alimentacao`;

    const result = parseMobillsCsv(csv);
    expect(result).toHaveLength(2);
  });

  it("returns empty for empty input", () => {
    expect(parseMobillsCsv("")).toEqual([]);
    expect(parseMobillsCsv("   ")).toEqual([]);
  });

  it("returns empty for header-only CSV", () => {
    expect(parseMobillsCsv("DATA,DESCRICAO,VALOR,CONTA,CATEGORIA")).toEqual([]);
  });

  it("handles English column names", () => {
    const csv = `DATE,DESCRIPTION,VALUE,ACCOUNT,CATEGORY
15/06/2025,Coffee,-5,Bank,Food`;

    const result = parseMobillsCsv(csv);
    expect(result).toHaveLength(1);
  });

  it("handles dates already in YYYY-MM-DD format", () => {
    const csv = `DATA,DESCRICAO,VALOR,CONTA,CATEGORIA
2025-06-15,Teste,-10,BB,Outro`;

    const result = parseMobillsCsv(csv);
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe("2025-06-15");
  });

  it("skips rows with invalid dates", () => {
    const csv = `DATA,DESCRICAO,VALOR,CONTA,CATEGORIA
invalid,Teste,-10,BB,Outro
15/06/2025,Valid,-5,BB,Outro`;

    const result = parseMobillsCsv(csv);
    expect(result).toHaveLength(1);
    expect(result[0].description).toBe("Valid");
  });
});
