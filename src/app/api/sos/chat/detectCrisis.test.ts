import { describe, it, expect } from "vitest";
import { _detectCrisisInTexts as detectCrisisInTexts } from "./route";

// Helper: wraps a single string in the array format detectCrisisInTexts expects
const detect = (text: string) => detectCrisisInTexts([text]);
const detectMulti = (texts: string[]) => detectCrisisInTexts(texts);

describe("detectCrisisInTexts", () => {
  // ── EXPLICIT patterns (always trigger) ─────────────────────────

  describe("EXPLICIT — suicidal ideation", () => {
    it.each([
      "quero me matar",
      "eu quero morrer",
      "vou morrer hoje",
      "tenho desejo de morrer",
      "penso em morrer todo dia",
      "não aguento mais viver",
      "estou cansada de viver",
      "cansei de viver",
      "sem razão pra viver",
      "sem razão para viver",
      "não quero acordar amanhã",
      "quero dormir e não acordar mais",
      "não queria mais existir",
      "não quero mais estar aqui",
      "não vejo saída",
      "vou dar cabo da minha vida",
      "acabar com a minha vida",
      "acabar com minha vida",
      "quero desaparecer",
      "seria melhor sem mim",
      "vou fazer besteira",
      "vou fazer uma besteira",
    ])("detects: %s", (text) => {
      expect(detect(text)).toBe(true);
    });
  });

  describe("EXPLICIT — self-harm (active)", () => {
    it.each([
      "me cortei agora",
      "estou sangrando",
      "tomei remedios todos",
      "tomei todos os remédios",
      "tomei todos os remedios",
      "me cortar",
      "vou me machucar",
      "auto lesao",
      "autolesao",
      "vou me ferir",
    ])("detects: %s", (text) => {
      expect(detect(text)).toBe(true);
    });
  });

  describe("EXPLICIT — means with intent", () => {
    it.each([
      "vou pular da ponte",
      "vou me jogar",
      "vou me enforcar",
      "overdose",
      "vou tomar tudo",
      "engolir comprimidos",
      "engoli comprimidos",
      "comprei uma arma",
      "comprei arma",
    ])("detects: %s", (text) => {
      expect(detect(text)).toBe(true);
    });
  });

  describe("EXPLICIT — farewell", () => {
    it.each([
      "escrevi uma carta de despedida",
      "adeus pra sempre",
    ])("detects: %s", (text) => {
      expect(detect(text)).toBe(true);
    });
  });

  // ── CONTEXTUAL patterns (need corroboration) ───────────────────

  describe("CONTEXTUAL — single hit without harm context → false", () => {
    it.each([
      "tenho um plano pro projeto",
      "passei pela ponte hoje",
      "vi uma faca na cozinha",
      "moro perto do prédio",
      "bebi muito café hoje",
      "queria sumir do grupo do WhatsApp",
      "não queria estar aqui na reunião",
      "cuidem do meu cachorro enquanto viajo",
      "vou acabar com tudo no trabalho hoje",
      "preciso de uma corda pra amarrar a caixa",
    ])("does NOT detect: %s", (text) => {
      expect(detect(text)).toBe(false);
    });
  });

  describe("CONTEXTUAL — 2+ hits in same message → true", () => {
    it.each([
      "tenho um plano e uma faca",
      "comprei veneno e corda",
      "ponte e faca",
      "estou bêbado e tenho um plano",
      "misturei remédio e queria sumir",
      "fiz meu testamento e queria sumir",
    ])("detects: %s", (text) => {
      expect(detect(text)).toBe(true);
    });
  });

  describe("CONTEXTUAL — 1 hit + harm context → true", () => {
    it.each([
      ["não aguento mais", "tenho um plano"],
      ["estou sofrendo demais", "queria sumir"],
      ["quero morrer", "tenho uma faca"],  // "quero morrer" is EXPLICIT anyway
      ["estou desesperada", "acabar com tudo"],
      ["sem esperança nenhuma", "fiz meu testamento"],
    ])("detects across messages: %s + %s", (msg1, msg2) => {
      expect(detectMulti([msg1, msg2])).toBe(true);
    });
  });

  describe("CONTEXTUAL — 2 hits across messages → true", () => {
    it("detects 'ponte' in one message and 'faca' in another", () => {
      expect(detectMulti(["pensei na ponte", "e na faca"])).toBe(true);
    });

    it("detects 'testamento' + 'veneno' across messages", () => {
      expect(detectMulti(["fiz meu testamento", "comprei veneno"])).toBe(true);
    });
  });

  // ── False positive guards ──────────────────────────────────────

  describe("False positive guards", () => {
    it("does NOT trigger on benign 'sumir' without harm context", () => {
      expect(detect("queria sumir do grupo do WhatsApp")).toBe(false);
    });

    it("does NOT trigger on benign 'acabar' without harm context", () => {
      expect(detect("vou acabar com tudo no trabalho hoje")).toBe(false);
    });

    it("does NOT trigger on isolated means mention", () => {
      expect(detect("tem uma ponte bonita aqui perto")).toBe(false);
    });

    it("does NOT trigger on benign 'plano'", () => {
      expect(detect("tenho um plano de estudos")).toBe(false);
    });

    it("does NOT trigger on empty text", () => {
      expect(detect("")).toBe(false);
    });

    it("does NOT trigger on casual conversation", () => {
      expect(detect("hoje estou me sentindo um pouco triste mas ok")).toBe(false);
    });
  });

  // ── Accent normalization ───────────────────────────────────────

  describe("Accent normalization (NFD stripping)", () => {
    it("detects with accents: não aguento mais viver", () => {
      expect(detect("não aguento mais viver")).toBe(true);
    });

    it("detects without accents: nao aguento mais viver", () => {
      expect(detect("nao aguento mais viver")).toBe(true);
    });

    it("detects: tomei todos os remédios (with accent)", () => {
      expect(detect("tomei todos os remédios")).toBe(true);
    });
  });

  // ── Auditor red team cases ─────────────────────────────────────

  describe("Auditor red team — must pass", () => {
    it("'tomei todos os remédios' → true (P0 fix)", () => {
      expect(detect("tomei todos os remédios")).toBe(true);
    });

    it("'engoli comprimidos' → true (P0 fix)", () => {
      expect(detect("engoli comprimidos")).toBe(true);
    });

    it("'cansei de viver' → true (P0 fix)", () => {
      expect(detect("cansei de viver")).toBe(true);
    });

    it("'queria sumir do grupo do WhatsApp' → false (P1 fix)", () => {
      expect(detect("queria sumir do grupo do WhatsApp")).toBe(false);
    });

    it("'vou acabar com tudo no trabalho hoje' → false (P1 fix)", () => {
      expect(detect("vou acabar com tudo no trabalho hoje")).toBe(false);
    });

    it("'ponte e faca' → true (P1 fix — counts as 2 contextual hits)", () => {
      expect(detect("ponte e faca")).toBe(true);
    });
  });

  // ── Round 6 red team — overdose/intoxication & passive ideation ──

  describe("Round 6 — overdose/intoxication must detect", () => {
    it.each([
      "misturei álcool com remédio",
      "misturei remedio com alcool",
      "misturei medicamento com bebida",
      "tomei muitos remédios",
      "tomei muitos remedios",
      "tomei vários comprimidos",
      "tomei varios comprimidos",
      "engoli um monte de comprimidos",
      "engoli muitos comprimidos",
      "engoli vários remédios",
    ])("detects: %s", (text) => {
      expect(detect(text)).toBe(true);
    });
  });

  describe("Round 6 — passive ideation must detect", () => {
    it.each([
      "quero dormir e não acordar mais",
      "quero dormir e nao acordar",
      "não queria mais existir",
      "nao quero mais existir",
      "não quero mais estar aqui",
    ])("detects: %s", (text) => {
      expect(detect(text)).toBe(true);
    });
  });

  describe("Round 6 — crisis latch across conversation", () => {
    it("crisis in message 1 stays detected after 10+ benign messages", () => {
      const messages = [
        "quero morrer",
        "sim",
        "não sei",
        "talvez",
        "ok",
        "tá",
        "hmm",
        "não sei o que fazer",
        "tô aqui ainda",
        "oi",
      ];
      expect(detectMulti(messages)).toBe(true);
    });
  });
});
