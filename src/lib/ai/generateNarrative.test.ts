import { describe, it, expect } from "vitest";

/**
 * Tests for generateNarrative.ts deterministic guardrails.
 *
 * Since FORBIDDEN_PATTERNS and containsForbiddenContent are not exported,
 * we replicate the exact patterns array here and test each one individually.
 * If the source patterns change, these tests must be updated in sync.
 */

// ─── Replicated from generateNarrative.ts ───────────────────────────────────
const FORBIDDEN_PATTERNS = [
  /\bdiagn[oó]stic/i,
  /\bajust(?:e|ar|ando)\s+(?:(?:a|de)\s+)?medica[çc][ãa]o/i,
  /\bvoc[êe]\s+(?:tem|possui|sofre\s+de)\s+/i,
  /\bcausa(?:do|da|r)\s+(?:por|pelo|pela)\b/i,
  /\brecomend(?:o|amos)\s+(?:que\s+)?(?:par|tom|aument|diminu)/i,
  /\bsina(?:l|is)\s+compat[ií]ve(?:l|is)\s+com\b/i,
  /\bpadr[ãa]o\s+sugestivo\s+de\b/i,
  /\bquadro\s+(?:cl[ií]nico\s+)?(?:compat[ií]vel|indicativo|sugestivo)\b/i,
  /\bcaracter[ií]stic(?:o|a)s?\s+de\s+(?:um|uma)?\s*(?:epis[oó]dio|transtorno|fase)\b/i,
  /\bperfil\s+(?:cl[ií]nico|compat[ií]vel)\b/i,
  /\bconfirma(?:r|ndo|[çc][ãa]o)\s+(?:de\s+)?(?:diagn[oó]stic|transtorno|epis[oó]dio)\b/i,
  /\b(?:interromp|suspend|retir)(?:a|e|ar|ir|er)\s+(?:a\s+)?medica[çc][ãa]o\b/i,
  /\bvoc[êe]\s+(?:deve|precisa|deveria)\s+(?:procurar|buscar|ir)\s+(?:um|ao)\s+(?:m[ée]dic|psiqui)/i,
  /\b(?:claramente|evidentemente|obviamente)\s+(?:um|uma)\s+(?:epis[oó]dio|crise|fase)\b/i,
  /\b(?:l[ií]tio|carbolitium|carbamazepina|tegretol|valproato|depakote|depakene|lamotrigina|lamictal|quetiapina|seroquel|olanzapina|zyprexa|risperidona|risperdal|aripiprazol|abilify|clozapina|clozaril|haloperidol|haldol|topiramato|topamax)\b/i,
  /\b(?:depress[ãa]o|mania|hipomania|man[ií]ac[oa]|hipoman[ií]ac[oa]|ciclotimia|distimia|psicose|psic[oó]tic[oa])\b/i,
  /\b(?:epis[oó]dio|transtorno|s[ií]ndrome)\s+(?:bipolar|depressiv[oa]|man[ií]ac[oa]|mist[oa]|afetiv[oa])\b/i,
];

function containsForbiddenContent(text: string): boolean {
  return FORBIDDEN_PATTERNS.some((p) => p.test(text));
}
// ─────────────────────────────────────────────────────────────────────────────

describe("containsForbiddenContent", () => {
  // ── Pattern 0: diagnóstico ─────────────────────────────────────────────
  describe("Pattern: diagnóstico", () => {
    it.each([
      "diagnóstico de transtorno",
      "diagnostico preliminar",
      "O diagnóstico foi confirmado",
      "realizar diagnósticos",
    ])("should BLOCK: %s", (text) => {
      expect(containsForbiddenContent(text)).toBe(true);
    });
  });

  // ── Pattern 1: ajuste de medicação ─────────────────────────────────────
  describe("Pattern: ajuste de medicação", () => {
    it.each([
      "ajuste medicação",       // ajust(e) + medicação (no preposition)
      "ajuste a medicação",     // ajust(e) + a + medicação
      "ajustar a medicação",
      "ajustando medicação",
      "ajustar medicacao",
    ])("should BLOCK: %s", (text) => {
      expect(containsForbiddenContent(text)).toBe(true);
    });

    it("should block 'ajuste de medicação'", () => {
      expect(containsForbiddenContent("ajuste de medicação")).toBe(true);
    });
  });

  // ── Pattern 2: você tem/possui/sofre de ────────────────────────────────
  describe("Pattern: você tem/possui/sofre de", () => {
    it.each([
      "você tem um quadro grave",
      "voce possui sintomas",
      "você sofre de insônia crônica",
    ])("should BLOCK: %s", (text) => {
      expect(containsForbiddenContent(text)).toBe(true);
    });
  });

  // ── Pattern 3: causado por/pelo/pela ───────────────────────────────────
  describe("Pattern: causado por/pelo/pela", () => {
    it.each([
      "causado por estresse",
      "causada pela medicação",
      "causar pelo uso contínuo",
    ])("should BLOCK: %s", (text) => {
      expect(containsForbiddenContent(text)).toBe(true);
    });
  });

  // ── Pattern 4: recomendo/recomendamos que pare/tome/aumente/diminua ───
  describe("Pattern: recomendo que pare/tome", () => {
    it.each([
      "recomendo que pare de tomar",
      "recomendamos que tome mais",
      "recomendo que aumente a dose",
      "recomendamos diminuir",
    ])("should BLOCK: %s", (text) => {
      expect(containsForbiddenContent(text)).toBe(true);
    });
  });

  // ── Pattern 5: sinais compatíveis com ──────────────────────────────────
  describe("Pattern: sinais compatíveis com", () => {
    it.each([
      "sinais compatíveis com uma crise",
      "sinais compativeis com episódio",
    ])("should BLOCK: %s", (text) => {
      expect(containsForbiddenContent(text)).toBe(true);
    });

    it("should block 'sinal compativel com fase'", () => {
      expect(containsForbiddenContent("sinal compativel com fase")).toBe(true);
    });
  });

  // ── Pattern 6: padrão sugestivo de ─────────────────────────────────────
  describe("Pattern: padrão sugestivo de", () => {
    it.each([
      "padrão sugestivo de crise",
      "padrao sugestivo de instabilidade",
    ])("should BLOCK: %s", (text) => {
      expect(containsForbiddenContent(text)).toBe(true);
    });
  });

  // ── Pattern 7: quadro (clínico) compatível/indicativo/sugestivo ───────
  describe("Pattern: quadro compatível/indicativo/sugestivo", () => {
    it.each([
      "quadro clínico compatível",
      "quadro indicativo",
      "quadro sugestivo",
      "quadro clinico compativel",
    ])("should BLOCK: %s", (text) => {
      expect(containsForbiddenContent(text)).toBe(true);
    });
  });

  // ── Pattern 8: características de (um) episódio/transtorno/fase ───────
  describe("Pattern: características de episódio/transtorno", () => {
    it.each([
      "características de um episódio",
      "caracteristicas de transtorno",
      "característica de fase",
      "características de uma fase",
    ])("should BLOCK: %s", (text) => {
      expect(containsForbiddenContent(text)).toBe(true);
    });
  });

  // ── Pattern 9: perfil clínico / perfil compatível ─────────────────────
  describe("Pattern: perfil clínico/compatível", () => {
    it.each([
      "perfil clínico",
      "perfil compatível",
      "perfil clinico sugestivo",
      "perfil compativel com algo",
    ])("should BLOCK: %s", (text) => {
      expect(containsForbiddenContent(text)).toBe(true);
    });
  });

  // ── Pattern 10: confirmação de diagnóstico/transtorno/episódio ────────
  describe("Pattern: confirmação de diagnóstico/transtorno", () => {
    it.each([
      "confirmação de diagnóstico",
      "confirmar transtorno",
      "confirmando episódio",
      "confirmacao de diagnostico",
    ])("should BLOCK: %s", (text) => {
      expect(containsForbiddenContent(text)).toBe(true);
    });
  });

  // ── Pattern 11: interromper/suspender/retirar medicação ────────────────
  describe("Pattern: interromper/suspender medicação", () => {
    it.each([
      "interromper a medicação",   // interromp + er
      "suspender medicação",       // suspend + er
      "suspenda medicacao",        // suspend + a
      "interrompe a medicação",    // interromp + e
      "suspende a medicação",      // suspend + e
      "retire a medicação",        // retir + e
      "retirir medicação",         // retir + ir
    ])("should BLOCK: %s", (text) => {
      expect(containsForbiddenContent(text)).toBe(true);
    });

    it("should block 'retirar a medicação'", () => {
      expect(containsForbiddenContent("retirar a medicação")).toBe(true);
    });
  });

  // ── Pattern 12: você deve procurar um médico/psiquiatra ────────────────
  describe("Pattern: você deve procurar um médico/psiquiatra", () => {
    it.each([
      "você deve procurar um médico",
      "voce precisa ir ao psiquiatra",
      "você deveria buscar um médico",
      "voce deve procurar um psiquiatra",
    ])("should BLOCK: %s", (text) => {
      expect(containsForbiddenContent(text)).toBe(true);
    });
  });

  // ── Pattern 13: claramente/evidentemente/obviamente um episódio/crise ─
  describe("Pattern: claramente/obviamente um episódio/crise", () => {
    it.each([
      "claramente um episódio",
      "obviamente uma crise",
      "evidentemente uma fase",
      "claramente uma crise grave",
    ])("should BLOCK: %s", (text) => {
      expect(containsForbiddenContent(text)).toBe(true);
    });
  });

  // ── Pattern 14: medication names ──────────────────────────────────────
  describe("Pattern: medication names", () => {
    it.each([
      "lítio",
      "litio",
      "carbolitium",
      "carbamazepina",
      "tegretol",
      "valproato",
      "depakote",
      "depakene",
      "lamotrigina",
      "lamictal",
      "quetiapina",
      "seroquel",
      "olanzapina",
      "zyprexa",
      "risperidona",
      "risperdal",
      "aripiprazol",
      "abilify",
      "clozapina",
      "clozaril",
      "haloperidol",
      "haldol",
      "topiramato",
      "topamax",
    ])("should BLOCK medication: %s", (med) => {
      expect(containsForbiddenContent(`Tome ${med} diariamente`)).toBe(true);
    });

    it("should BLOCK medication name alone in text", () => {
      expect(containsForbiddenContent("O uso de quetiapina pode ajudar")).toBe(true);
    });
  });

  // ── Pattern 15: condition/episode/disorder names ──────────────────────
  describe("Pattern: condition names (standalone)", () => {
    it.each([
      "depressão",
      "mania",
      "hipomania",
      "maníaco",
      "maniaco",
      "hipomaníaco",
      "hipomaniaco",
      "ciclotimia",
      "distimia",
      "psicose",
      "psicótico",
      "psicotico",
      "psicótica",
    ])("should BLOCK condition: %s", (condition) => {
      expect(containsForbiddenContent(`Isso sugere ${condition}`)).toBe(true);
    });
  });

  // ── Pattern 16: episódio/transtorno/síndrome + qualifier ──────────────
  describe("Pattern: episódio/transtorno/síndrome + qualifier", () => {
    it.each([
      "episódio depressivo",
      "episodio maníaco",
      "transtorno bipolar",
      "transtorno depressivo",
      "síndrome afetiva",
      "sindrome mista",
      "episódio misto",
      "transtorno afetivo",
    ])("should BLOCK: %s", (text) => {
      expect(containsForbiddenContent(text)).toBe(true);
    });
  });

  // ── Safe strings that should NOT be blocked ───────────────────────────
  describe("Safe strings (should NOT match)", () => {
    it.each([
      "humor abaixo da média",
      "energia elevada nos últimos dias",
      "variação acentuada de sono",
      "dados sugerem tendência de melhora",
      "converse com seu profissional",
      "seu sono ficou mais curto que o habitual",
      "os dados mostram uma oscilação de humor",
      "registros indicam melhora gradual",
      "considere manter uma rotina regular",
      "importante acompanhar com seu profissional de saúde",
      "padrão de sono irregular nas últimas semanas",
      "humor mais elevado que a média do período",
      "atividade física pode contribuir para o bem-estar",
    ])("should ALLOW: %s", (text) => {
      expect(containsForbiddenContent(text)).toBe(false);
    });
  });

  // ── Case insensitivity ────────────────────────────────────────────────
  describe("Case insensitivity", () => {
    it("should block uppercase DIAGNÓSTICO", () => {
      expect(containsForbiddenContent("DIAGNÓSTICO CONFIRMADO")).toBe(true);
    });

    it("should block mixed case Quetiapina", () => {
      expect(containsForbiddenContent("Uso de Quetiapina")).toBe(true);
    });

    it("should block uppercase DEPRESSÃO", () => {
      expect(containsForbiddenContent("DEPRESSÃO severa")).toBe(true);
    });
  });

  // ── Edge cases ────────────────────────────────────────────────────────
  describe("Edge cases", () => {
    it("should not match empty string", () => {
      expect(containsForbiddenContent("")).toBe(false);
    });

    it("should not match whitespace only", () => {
      expect(containsForbiddenContent("   ")).toBe(false);
    });

    it("should block when forbidden word is embedded in longer text", () => {
      expect(
        containsForbiddenContent(
          "Seus dados dos últimos 30 dias mostram que a depressão pode estar se agravando.",
        ),
      ).toBe(true);
    });

    it("should block multiple forbidden terms in same text", () => {
      const text = "O diagnóstico de transtorno bipolar requer avaliação com lítio";
      expect(containsForbiddenContent(text)).toBe(true);
    });

    it("should not false-positive on 'sugestão' (different from 'sugestivo')", () => {
      expect(containsForbiddenContent("Uma sugestão para você")).toBe(false);
    });

    it("should not false-positive on 'diagnosticar' root outside word boundary", () => {
      // "diagnosticar" still starts with "diagnóstic" pattern — should match
      expect(containsForbiddenContent("Não vamos diagnosticar nada aqui")).toBe(true);
    });
  });
});

describe("FORBIDDEN_PATTERNS completeness", () => {
  it("should have exactly 17 patterns", () => {
    expect(FORBIDDEN_PATTERNS).toHaveLength(17);
  });

  it("every pattern should be a RegExp with case-insensitive flag", () => {
    for (const p of FORBIDDEN_PATTERNS) {
      expect(p).toBeInstanceOf(RegExp);
      expect(p.flags).toContain("i");
    }
  });
});
