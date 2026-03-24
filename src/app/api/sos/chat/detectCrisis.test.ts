import { describe, it, expect } from "vitest";
import { _detectCrisisInTexts as detectCrisisInTexts } from "@/lib/sos/crisisDetection";
import type { CrisisResult } from "@/lib/sos/crisisDetection";

// Helpers: boolean checks (backward-compatible with existing tests)
const detect = (text: string) => detectCrisisInTexts([text]) !== "none";
const detectMulti = (texts: string[]) => detectCrisisInTexts(texts) !== "none";
// Helpers: exact result checks (for tier-specific tests)
const detectResult = (text: string): CrisisResult => detectCrisisInTexts([text]);
const detectMultiResult = (texts: string[]): CrisisResult => detectCrisisInTexts(texts);

describe("detectCrisisInTexts", () => {
  // ── EXPLICIT patterns (always trigger) ─────────────────────────

  describe("EXPLICIT — suicidal ideation", () => {
    it.each([
      "quero me matar",
      "eu quero morrer",
      "tenho desejo de morrer",
      "penso em morrer todo dia",
      "não aguento mais viver",
      "estou cansada de viver",
      "cansei de viver",
      "sem razão pra viver",
      "sem razão para viver",
      "quero dormir e não acordar mais",
      "não queria mais existir",
      "não quero mais estar aqui",
      "vou dar cabo da minha vida",
      "acabar com a minha vida",
      "acabar com minha vida",
      "seria melhor sem mim",
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
    it("EXPLICIT crisis in message 1 stays detected after 10+ benign messages", () => {
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

  // ── Round 8 red team — coverage gaps & contextual window ────────

  describe("Round 8 — missing EXPLICIT variants must detect", () => {
    it.each([
      "não quero mais viver",
      "nao quero mais viver",
      "não queria mais viver",
      "nao queria mais viver",
      "engoli os comprimidos",
      "engoli os remédios",
      "engoli as pílulas",
      "engoli várias pílulas",
      "engoli varias pilulas",
      "engoli muitas pílulas",
      "tomei muitas pílulas",
      "tomei várias pílulas",
      "me enforquei",
      "me joguei",
      "pulei da ponte",
      "pulei do prédio",
    ])("detects: %s", (text) => {
      expect(detect(text)).toBe(true);
    });
  });

  // ── Round 9 — overdose intent, poison, benign overrides ─────────

  describe("Round 9 — future intent overdose must detect", () => {
    it.each([
      "vou tomar vários comprimidos",
      "vou tomar varios comprimidos",
      "vou tomar muitas pílulas",
      "vou tomar muitos remédios",
      "vou tomar todos os remédios",
      "vou tomar todas as pílulas",
      "quero tomar todos os comprimidos",
      "vou misturar remédio com álcool",
      "vou misturar medicamento com bebida",
      "quero misturar remédio com bebida",
    ])("detects: %s", (text) => {
      expect(detect(text)).toBe(true);
    });
  });

  describe("Round 9 — poison/blister pack must detect", () => {
    it.each([
      "tomei veneno",
      "bebi veneno",
      "engoli veneno",
      "engoli a cartela inteira",
      "tomei a cartela toda",
      "engoli a cartela toda",
    ])("detects: %s", (text) => {
      expect(detect(text)).toBe(true);
    });
  });

  describe("Round 9 — misturei requires medical term (no FP on benign mixing)", () => {
    it("'misturei remédio' → true", () => {
      expect(detect("misturei remédio")).toBe(true);
    });
    it("'misturei medicamento' → true", () => {
      expect(detect("misturei medicamento")).toBe(true);
    });
    it("'misturei álcool com remédio' → true", () => {
      expect(detect("misturei álcool com remédio")).toBe(true);
    });
    it("'misturei bebida com medicamento' → true", () => {
      expect(detect("misturei bebida com medicamento")).toBe(true);
    });
    it("'misturei bebida com energético' → false (no medical term)", () => {
      expect(detect("misturei bebida com energético")).toBe(false);
    });
    it("'misturei cerveja com suco' → false", () => {
      expect(detect("misturei cerveja com suco")).toBe(false);
    });
  });

  describe("Round 9 — benign overrides prevent false positives", () => {
    it.each([
      "vou me matar de trabalhar",
      "vou me matar de rir",
      "vou me matar de estudar",
      "me joguei no sofá",
      "me joguei na cama",
      "me joguei na piscina",
      "queria desaparecer da reunião",
      "queria desaparecer do trabalho",
      "queria desaparecer do grupo",
      "tomei muitas pílulas de vitamina",
      "engoli as pílulas de vitamina",
    ])("does NOT detect: %s", (text) => {
      expect(detect(text)).toBe(false);
    });
  });

  describe("Round 11 — benign override must NOT suppress other crisis phrases in same message", () => {
    it.each([
      "quero morrer, vou me matar de trabalhar",
      "não quero mais viver, queria desaparecer do trabalho",
      "tomei muitos remédios e pílulas de vitamina",
      "vou me enforcar, me joguei no sofá ontem",
      "cansei de viver, mas me joguei na cama e dormi",
    ])("detects crisis even with benign phrase: %s", (text) => {
      expect(detect(text)).toBe(true);
    });
  });

  describe("Round 11 — me joguei no rio/mar/água must detect", () => {
    it.each([
      "me joguei no rio",
      "me joguei no mar",
      "me joguei na água",
    ])("detects: %s", (text) => {
      expect(detect(text)).toBe(true);
    });
  });

  describe("Round 11 — remaining benign overrides still work", () => {
    it.each([
      "me joguei no sofá",
      "me joguei na cama",
      "me joguei no jogo",
      "vou me matar de rir",
      "queria desaparecer da reunião",
      "tomei pílulas de vitamina",
    ])("does NOT detect: %s", (text) => {
      expect(detect(text)).toBe(false);
    });
  });

  describe("Round 11 — poison/cartela/medicamento intent must detect", () => {
    it.each([
      "vou beber veneno",
      "quero beber veneno",
      "vou engolir a cartela inteira",
      "vou tomar uma cartela inteira",
      "tomei todos os comprimidos",
      "tomei todas as pílulas",
      "engoli todas as pílulas",
      "engoli todos os comprimidos",
      "tomei muitos medicamentos",
      "engoli muitos medicamentos",
      "vou tomar muitos medicamentos",
    ])("detects: %s", (text) => {
      expect(detect(text)).toBe(true);
    });
  });

  describe("Round 12 — veneno with articles must detect", () => {
    it.each([
      "vou beber o veneno",
      "quero beber o veneno",
      "bebi o veneno",
      "vou beber um pouco de veneno",
      "tomei o veneno",
    ])("detects: %s", (text) => {
      expect(detect(text)).toBe(true);
    });
  });

  describe("Round 12 — cartela do remédio must detect", () => {
    it.each([
      "vou engolir a cartela do remédio",
      "vou tomar a cartela do remédio",
      "engoli a cartela do remédio",
      "tomei a cartela do remédio",
      "tomei todos os medicamentos",
    ])("detects: %s", (text) => {
      expect(detect(text)).toBe(true);
    });
  });

  describe("Round 12 — missing ideation variants must detect", () => {
    it.each([
      "queria morrer",
      "eu me mato hoje",
      "vou acabar comigo",
      "quero acabar comigo",
      "não quero viver",
      "não queria viver",
    ])("detects: %s", (text) => {
      expect(detect(text)).toBe(true);
    });
  });

  describe("Round 12 — future mixing cerveja/vinho must detect", () => {
    it.each([
      "vou misturar cerveja com remédio",
      "vou misturar vinho com medicamento",
      "quero misturar cerveja com remédio",
    ])("detects: %s", (text) => {
      expect(detect(text)).toBe(true);
    });
  });

  describe("Round 12 — pulei benign override prevents false positive", () => {
    it.each([
      "pulei do ônibus",
      "pulei do sofá",
      "pulei da cama",
    ])("does NOT detect: %s", (text) => {
      expect(detect(text)).toBe(false);
    });
  });

  describe("Round 12 — double benign in same message stays false", () => {
    it.each([
      "vou me matar de rir e me matar de trabalhar",
      "me joguei na cama e me joguei no sofá",
    ])("does NOT detect: %s", (text) => {
      expect(detect(text)).toBe(false);
    });
  });

  // ── Round 13 — suicidar/tirar vida/envenenar/cortar pulsos ─────

  describe("Round 13 — P0: suicide family must detect", () => {
    it.each([
      "quero me suicidar",
      "vou me suicidar",
      "vou cometer suicídio",
      "quero tirar minha vida",
      "vou tirar minha vida",
      "vou por fim à minha vida",
      "vou por fim a minha vida",
      "seria melhor morrer",
    ])("detects: %s", (text) => {
      expect(detect(text)).toBe(true);
    });
  });

  describe("Round 13 — P0: envenenar must detect", () => {
    it.each([
      "vou me envenenar",
      "quero me envenenar",
      "me envenenei",
    ])("detects: %s", (text) => {
      expect(detect(text)).toBe(true);
    });
  });

  describe("Round 13 — P0: cortar pulsos must detect", () => {
    it.each([
      "vou cortar meus pulsos",
      "cortei meus pulsos",
      "cortei os pulsos",
      "vou cortar os pulsos",
      "cortei meu pulso",
      "vou cortar meu pulso",
    ])("detects: %s", (text) => {
      expect(detect(text)).toBe(true);
    });
  });

  describe("Round 13 — P0: pular na frente do carro/trem must detect", () => {
    it.each([
      "vou pular na frente do carro",
      "vou pular na frente do trem",
      "pulei na frente do onibus",
    ])("detects: %s", (text) => {
      expect(detect(text)).toBe(true);
    });
  });

  describe("Round 13 — P1: colloquial hyperbole false positives must NOT detect", () => {
    it.each([
      "me mato de rir",
      "eu me mato de trabalhar",
      "vou acabar comigo de vergonha",
      "quero acabar comigo de rir",
    ])("does NOT detect: %s", (text) => {
      expect(detect(text)).toBe(false);
    });
  });

  describe("Round 13 — benign pular na frente (not vehicles) must NOT detect", () => {
    it.each([
      "pulei na frente do espelho",
      "pulei na frente da camera",
    ])("does NOT detect: %s", (text) => {
      expect(detect(text)).toBe(false);
    });
  });

  // ── Round 14 — narrowing FP surface + expanded coverage ──────

  describe("Round 14 — P1: tirar a própria vida / por um fim na must detect", () => {
    it.each([
      "vou tirar a própria vida",
      "quero tirar minha própria vida",
      "vou por um fim na minha vida",
    ])("detects: %s", (text) => {
      expect(detect(text)).toBe(true);
    });
  });

  describe("Round 14 — P1: não quero existir must detect", () => {
    it("detects: não quero existir", () => {
      expect(detect("não quero existir")).toBe(true);
    });
    it("detects: nao quero existir", () => {
      expect(detect("nao quero existir")).toBe(true);
    });
  });

  describe("Round 14 — P1: envenenar without self-ref must NOT detect", () => {
    it.each([
      "vou envenenar o rato",
      "envenenei a comida",
      "quero envenenar meu cachorro",
    ])("does NOT detect: %s", (text) => {
      expect(detect(text)).toBe(false);
    });
  });

  describe("Round 14 — benign 'vou morrer de X' must NOT detect", () => {
    it.each([
      "vou morrer de calor",
      "vou morrer de fome",
      "vou morrer de vergonha",
      "vou morrer de rir",
      "vou morrer de saudade",
    ])("does NOT detect: %s", (text) => {
      expect(detect(text)).toBe(false);
    });
  });

  describe("Round 14 — benign 'vou morrer de X' must NOT suppress real crisis in same message", () => {
    it.each([
      "vou morrer de calor, quero me matar",
      "vou morrer de fome, vou me suicidar",
    ])("detects crisis even with benign: %s", (text) => {
      expect(detect(text)).toBe(true);
    });
  });

  describe("Round 14 — benign 'estou sangrando' variants must NOT detect", () => {
    it.each([
      "estou sangrando por causa da menstruação",
      "estou sangrando do nariz",
      "estou sangrando pela gengiva",
    ])("does NOT detect: %s", (text) => {
      expect(detect(text)).toBe(false);
    });
  });

  describe("Round 14 — 'estou sangrando' without benign context still detects", () => {
    it("detects: estou sangrando", () => {
      expect(detect("estou sangrando")).toBe(true);
    });
  });

  describe("Round 14 — benign 'comprei arma de brinquedo' must NOT detect", () => {
    it.each([
      "comprei uma arma de brinquedo",
      "comprei uma arma de pressão",
      "comprei arma de airsoft",
    ])("does NOT detect: %s", (text) => {
      expect(detect(text)).toBe(false);
    });
  });

  describe("Round 14 — 'comprei uma arma' without qualifier still detects", () => {
    it("detects: comprei uma arma", () => {
      expect(detect("comprei uma arma")).toBe(true);
    });
  });

  describe("Round 14 — 'nao vejo saida' moved to CONTEXTUAL", () => {
    it("does NOT detect alone: não vejo saída", () => {
      expect(detect("não vejo saída")).toBe(false);
    });
    it("detects with harm context: não vejo saída + sofrendo", () => {
      expect(detectMulti(["não vejo saída", "estou sofrendo demais"])).toBe(true);
    });
  });

  describe("Round 14 — 'tomar tudo' narrowed to med context", () => {
    it("does NOT detect: vou tomar tudo de água", () => {
      expect(detect("vou tomar tudo de água")).toBe(false);
    });
    it("does NOT detect alone: tomei tudo", () => {
      expect(detect("tomei tudo")).toBe(false);
    });
    it("detects: tomei tudo de remédio", () => {
      expect(detect("tomei tudo de remédio")).toBe(true);
    });
    it("detects with harm context: tomei tudo + sofrendo", () => {
      expect(detectMulti(["tomei tudo", "estou sofrendo demais"])).toBe(true);
    });
  });

  // ── Round 15 — narrowing ambiguous EXPLICIT, tightening overrides ──

  describe("Round 15 — suicídio alone moved to CONTEXTUAL", () => {
    it.each([
      "prevenção do suicídio é importante",
      "li um artigo sobre suicídio",
      "ele falou de suicídio na palestra",
    ])("does NOT detect alone: %s", (text) => {
      expect(detect(text)).toBe(false);
    });
    it("detects: cometer suicídio (explicit)", () => {
      expect(detect("cometer suicídio")).toBe(true);
    });
    it("detects with harm context: suicídio + sofrendo", () => {
      expect(detectMulti(["suicídio", "estou sofrendo demais"])).toBe(true);
    });
  });

  describe("Round 15 — tirar a vida requires self-ref", () => {
    it.each([
      "ele tentou tirar a vida da esposa",
      "vou tirar a vida do inimigo",
      "tirei a vida de um peixe",
    ])("does NOT detect (third party): %s", (text) => {
      expect(detect(text)).toBe(false);
    });
    it.each([
      "vou tirar minha vida",
      "quero tirar minha própria vida",
      "vou tirar a própria vida",
    ])("detects (self-ref): %s", (text) => {
      expect(detect(text)).toBe(true);
    });
  });

  describe("Round 15 — vou morrer moved to CONTEXTUAL", () => {
    it.each([
      "vou morrer de calor",
      "vou morrer cedo",
      "vou morrer um dia",
      "vou morrer sozinho",
    ])("does NOT detect alone: %s", (text) => {
      expect(detect(text)).toBe(false);
    });
    it("detects with harm context: vou morrer + sofrendo", () => {
      expect(detectMulti(["vou morrer", "estou sofrendo demais"])).toBe(true);
    });
  });

  describe("Round 15 — não quero acordar moved to CONTEXTUAL", () => {
    it("does NOT detect alone: não quero acordar cedo", () => {
      expect(detect("não quero acordar cedo")).toBe(false);
    });
    it("detects with harm context: não quero acordar + sem esperança", () => {
      expect(detectMulti(["não quero acordar", "sem esperança nenhuma"])).toBe(true);
    });
  });

  describe("Round 15 — sangrando override tightened", () => {
    it.each([
      "estou sangrando por causa da menstruação",
      "estou sangrando pelo nariz",
      "estou sangrando do nariz",
      "estou sangrando pela gengiva",
    ])("does NOT detect (benign): %s", (text) => {
      expect(detect(text)).toBe(false);
    });
    it("detects: estou sangrando (no qualifier)", () => {
      expect(detect("estou sangrando")).toBe(true);
    });
    it("detects: estou sangrando por causa de uma facada", () => {
      expect(detect("estou sangrando por causa de uma facada")).toBe(true);
    });
    it("detects: estou sangrando pela perna", () => {
      expect(detect("estou sangrando pela perna")).toBe(true);
    });
  });

  describe("Round 15 — tomei tudo requires med context or CONTEXTUAL", () => {
    it.each([
      "tomei tudo que o médico receitou",
      "tomei tudo de água depois da corrida",
    ])("does NOT detect alone: %s", (text) => {
      expect(detect(text)).toBe(false);
    });
  });

  // ── Round 16 — negation overrides, penso em suicídio, desaparecer/besteira to CONTEXTUAL ──

  describe("Round 16 — negation overrides must NOT detect", () => {
    it.each([
      "não quero morrer",
      "não vou me matar",
      "não vou me suicidar",
      "não penso em morrer",
      "não quero acabar comigo",
      "não quero tirar minha vida",
      "não quero desaparecer",
      "não vou fazer besteira",
      "não queria morrer",
    ])("does NOT detect: %s", (text) => {
      expect(detect(text)).toBe(false);
    });
  });

  describe("Round 16 — negation + real crisis in same message still detects", () => {
    it.each([
      "não quero morrer, mas quero me matar",
      "não vou me matar, mas tomei todos os remédios",
      "não quero desaparecer, mas não aguento mais viver",
    ])("detects: %s", (text) => {
      expect(detect(text)).toBe(true);
    });
  });

  describe("Round 16 — penso/pensando em suicídio must detect", () => {
    it.each([
      "penso em suicídio",
      "estou pensando em suicídio",
      "pensei em suicídio",
    ])("detects: %s", (text) => {
      expect(detect(text)).toBe(true);
    });
  });

  describe("Round 16 — quero/vou sumir now covered in CONTEXTUAL", () => {
    it("does NOT detect alone: quero sumir", () => {
      expect(detect("quero sumir")).toBe(false);
    });
    it("does NOT detect alone: vou sumir", () => {
      expect(detect("vou sumir")).toBe(false);
    });
    it("detects with harm context: quero sumir + sofrendo", () => {
      expect(detectMulti(["quero sumir", "estou sofrendo demais"])).toBe(true);
    });
    it("detects with harm context: vou sumir + sem esperança", () => {
      expect(detectMulti(["vou sumir", "sem esperança nenhuma"])).toBe(true);
    });
  });

  describe("Round 16 — desaparecer moved to CONTEXTUAL", () => {
    it.each([
      "quero desaparecer",
      "quero desaparecer por um tempo",
      "quero desaparecer da internet",
    ])("does NOT detect alone: %s", (text) => {
      expect(detect(text)).toBe(false);
    });
    it("detects with harm context: quero desaparecer + desesperada", () => {
      expect(detectMulti(["quero desaparecer", "estou desesperada"])).toBe(true);
    });
  });

  describe("Round 16 — fazer besteira moved to CONTEXTUAL", () => {
    it.each([
      "vou fazer besteira",
      "vou fazer uma besteira",
      "vou fazer uma besteira e mandar mensagem pro ex",
    ])("does NOT detect alone: %s", (text) => {
      expect(detect(text)).toBe(false);
    });
    it("detects with harm context: vou fazer besteira + não aguento", () => {
      expect(detectMulti(["vou fazer besteira", "não aguento mais"])).toBe(true);
    });
  });

  describe("Round 16 — me mato pra/para/por overrides must NOT detect", () => {
    it.each([
      "me mato pra pagar as contas",
      "me mato para sustentar meus filhos",
      "me mato por essa empresa",
      "vou me matar trabalhando nesse projeto",
    ])("does NOT detect: %s", (text) => {
      expect(detect(text)).toBe(false);
    });
  });

  // ── Round 17 — HARM_CONTEXT narrowed, clinical language, negation for self-harm ──

  describe("Round 17 — HARM_CONTEXT 'minha vida' removed to prevent FP", () => {
    it.each([
      "li um artigo sobre suicídio que mudou minha vida",
      "a prevenção do suicídio salvou minha vida",
      "suicídio é tema da minha vida acadêmica",
    ])("does NOT detect: %s", (text) => {
      expect(detect(text)).toBe(false);
    });
  });

  describe("Round 17 — clinical language must detect (EXPLICIT)", () => {
    it.each([
      "tenho ideação suicida",
      "estou com ideação suicida",
      "pensamentos suicidas",
      "tenho pensamentos suicidas",
      "estou suicida",
    ])("detects: %s", (text) => {
      expect(detect(text)).toBe(true);
    });
  });

  describe("Round 17 — negation overrides for self-harm must NOT detect", () => {
    it.each([
      "não quero me cortar",
      "não vou me machucar",
      "não quero me ferir",
      "não vou me enforcar",
      "não quero me envenenar",
      "não vou cortar meus pulsos",
      "não quero tomar tudo",
      "não quero engolir veneno",
      "não penso em suicídio",
      "não pensei em suicídio",
    ])("does NOT detect: %s", (text) => {
      expect(detect(text)).toBe(false);
    });
  });

  describe("Round 17 — negation + real crisis in same message still detects", () => {
    it.each([
      "não quero me cortar, mas tomei todos os remédios",
      "não penso em suicídio, mas quero morrer",
      "não vou me machucar, mas não aguento mais viver",
    ])("detects: %s", (text) => {
      expect(detect(text)).toBe(true);
    });
  });

  describe("Round 17 — suicidar without 'me' moved to CONTEXTUAL (third-party)", () => {
    it.each([
      "ele quer se suicidar",
      "meu amigo falou em suicidar",
    ])("does NOT detect alone: %s", (text) => {
      expect(detect(text)).toBe(false);
    });
    it("detects with self-ref: quero me suicidar", () => {
      expect(detect("quero me suicidar")).toBe(true);
    });
  });

  describe("Round 17 — 'me matar por/pra' real crisis vs benign", () => {
    it.each([
      "quero me matar por não aguentar mais",
      "quero me matar porque não suporto",
      "vou me matar por causa da dor",
    ])("detects (real crisis — no benign continuation): %s", (text) => {
      expect(detect(text)).toBe(true);
    });
    it.each([
      "me mato pra pagar as contas",
      "me mato para sustentar minha família",
      "vou me matar pra estudar pra prova",
    ])("does NOT detect (benign work/money): %s", (text) => {
      expect(detect(text)).toBe(false);
    });
  });

  describe("Round 17 — acabar com minha vida in HARM_CONTEXT validates contextual", () => {
    it("detects: tomei tudo + acabar com minha vida", () => {
      expect(detectMulti(["tomei tudo", "quero acabar com minha vida"])).toBe(true);
    });
    it("detects: vou morrer + acabar comigo", () => {
      expect(detectMulti(["vou morrer", "quero acabar comigo"])).toBe(true);
    });
  });

  // ── Session 4 audit — medication brand names & passive ideation ──────

  describe("Session 4 audit — medication brand names must detect", () => {
    it.each([
      "tomei todo o rivotril",
      "tomei todos os rivotril",
      "tomei muitos rivotril",
      "engoli vários diazepam",
      "vou tomar todos os lexotan",
      "vou engolir todo o frontal",
      "misturei cerveja com rivotril",
      "misturei clonazepam com álcool",
      "misturei rivotril com vinho",
      "tomei muita sertralina",
      "engoli todos os haldol",
      "vou tomar todo o litio",
      "misturei quetiapina com cerveja",
      "tomei vários amitriptilina",
      "vou engolir todo o tryptanol",
    ])("detects: %s", (text) => {
      expect(detect(text)).toBe(true);
    });
  });

  describe("Session 4 audit — medication mention without overdose/mixing must NOT detect", () => {
    it.each([
      "tomo rivotril todo dia",
      "meu remédio é clonazepam",
      "comecei a tomar sertralina",
      "o médico receitou quetiapina",
      "parei de tomar o haldol",
    ])("does NOT detect: %s", (text) => {
      expect(detect(text)).toBe(false);
    });
  });

  describe("Session 4 audit — passive ideation 'preferia não acordar'", () => {
    it.each([
      "preferia não acordar amanhã",
      "prefiro não acordar",
      "preferia nao acordar",
    ])("detects: %s", (text) => {
      expect(detect(text)).toBe(true);
    });
  });

  describe("Session 4 audit — 'não quero mais nada' contextual", () => {
    it("does NOT detect alone: não quero mais nada", () => {
      expect(detect("não quero mais nada")).toBe(false);
    });
    it("detects with harm context: não quero mais nada + sofrendo", () => {
      expect(detectMulti(["não quero mais nada", "estou sofrendo demais"])).toBe(true);
    });
    it("detects with 2 contextual: não quero mais nada + quero sumir", () => {
      expect(detectMulti(["não quero mais nada", "quero sumir"])).toBe(true);
    });
  });

  // ── Session 4 audit R2 — numeric doses, progressive self-harm, demais, containers ──

  describe("Session 4 R2 — numeric dose + generic medication must detect", () => {
    it.each([
      "tomei 20 comprimidos",
      "tomei 15 comprimidos",
      "engoli 30 remédios",
      "engoli 10 pilulas",
      "bebi 5 medicamentos",
      "vou tomar 50 comprimidos",
      "quero engolir 20 remédios",
    ])("detects: %s", (text) => {
      expect(detect(text)).toBe(true);
    });
  });

  describe("Session 4 R2 — numeric dose + medication brand must detect", () => {
    it.each([
      "tomei 20 clonazepam",
      "engoli 30 quetiapina",
      "tomei 15 rivotril",
      "bebi 10 diazepam",
      "vou tomar 20 sertralina",
      "quero engolir 50 haldol",
    ])("detects: %s", (text) => {
      expect(detect(text)).toBe(true);
    });
  });

  describe("Session 4 R2 — written-out number doses must detect", () => {
    it.each([
      "tomei vinte clonazepam",
      "engoli dez comprimidos",
      "tomei quinze rivotril",
      "engoli trinta remédios",
    ])("detects: %s", (text) => {
      expect(detect(text)).toBe(true);
    });
  });

  describe("Session 4 R2 — 'demais' quantifier must detect", () => {
    it.each([
      "tomei remédio demais",
      "tomei comprimido demais",
      "engoli remédio demais",
      "engoli medicamento demais",
    ])("detects: %s", (text) => {
      expect(detect(text)).toBe(true);
    });
  });

  describe("Session 4 R2 — container patterns must detect", () => {
    it.each([
      "tomei um frasco de remédio",
      "engoli uma caixa de rivotril",
      "bebi um frasco de clonazepam",
      "vou tomar a caixa",
      "vou engolir um frasco",
    ])("detects: %s", (text) => {
      expect(detect(text)).toBe(true);
    });
  });

  describe("Session 4 R2 — progressive self-harm (gerund) must detect", () => {
    it.each([
      "estou me cortando",
      "estou me machucando",
      "estou me ferindo",
      "me cortando agora",
      "me machucando",
      "me ferindo",
    ])("detects: %s", (text) => {
      expect(detect(text)).toBe(true);
    });
  });

  describe("Session 4 R2 — normal medication amounts still do NOT detect", () => {
    it.each([
      "tomei 1 comprimido de manhã",
      "tomo 2 remédios por dia",
      "tomei 3 comprimidos hoje",
      "tomo 4 medicamentos",
    ])("does NOT detect: %s", (text) => {
      expect(detect(text)).toBe(false);
    });
  });

  // ── Revalidation R2 — numeric dose, demais, progressive self-harm, false positives ──

  describe("Revalidation R2 — numeric dose must detect", () => {
    it.each([
      "tomei 20 comprimidos",
      "tomei 15 clonazepam",
      "engoli 10 rivotril",
      "tomei 30 diazepam",
      "vou tomar 20 comprimidos",
      "quero engolir 10 remedios",
      "tomei vinte comprimidos",
      "engoli dez rivotril",
      "tomei um frasco de rivotril",
      "tomei uma caixa de clonazepam",
      "engoli a caixa inteira de rivotril",
      "tomei a caixa toda de diazepam",
    ])("detects: %s", (text) => {
      expect(detect(text)).toBe(true);
    });
  });

  describe("Revalidation R2 — 'remédio demais' must detect", () => {
    it.each([
      "tomei remédio demais",
      "tomei remedio demais",
      "tomei comprimido demais",
      "engoli remédio demais",
    ])("detects: %s", (text) => {
      expect(detect(text)).toBe(true);
    });
  });

  describe("Revalidation R2 — progressive self-harm must detect", () => {
    it.each([
      "estou me cortando",
      "estou me machucando",
      "estou me ferindo",
      "estou me enforcando",
      "me cortando agora",
      "me machucando agora",
    ])("detects: %s", (text) => {
      expect(detect(text)).toBe(true);
    });
  });

  describe("Revalidation R2 — normal numeric medication does NOT detect", () => {
    it.each([
      "tomei 2 comprimidos de vitamina",
      "tomo 1 rivotril por dia",
      "o médico receitou 2 comprimidos",
    ])("does NOT detect: %s", (text) => {
      expect(detect(text)).toBe(false);
    });
  });

  describe("Round 8 — contextual window prevents false-positive accumulation", () => {
    it("benign contextual words across 10+ messages do NOT trigger (ponte msg1 + faca msg10)", () => {
      const messages = [
        "passei pela ponte hoje",
        "fui ao mercado",
        "almocei com minha mãe",
        "trabalhei o dia todo",
        "assisti um filme",
        "jantei em casa",
        "fiz exercício",
        "li um livro",
        "conversei com amigos",
        "vi uma faca na cozinha",
      ];
      // ponte in msg1 and faca in msg10 — both contextual but >6 messages apart
      // With windowed contextual (last 6), only faca is in window → 1 hit → false
      expect(detectMulti(messages)).toBe(false);
    });

    it("contextual words within 6-message window still trigger", () => {
      const messages = [
        "oi",
        "tudo bem",
        "pensei na ponte",
        "e na faca",
      ];
      expect(detectMulti(messages)).toBe(true);
    });

    it("benign accumulation: ponte early + faca late with many messages between → false", () => {
      const messages = [
        "tem uma ponte bonita aqui",
        "sim",
        "ok",
        "tá",
        "hmm",
        "não sei",
        "talvez",
        "vi uma faca na cozinha",
      ];
      // ponte is message 1 (outside last 6), faca is message 8 (inside last 6)
      // Only 1 contextual hit in window → false
      expect(detectMulti(messages)).toBe(false);
    });
  });

  // ── Bipolar-specific CONTEXTUAL patterns ──────────────────────

  describe("Bipolar-specific CONTEXTUAL — moderate single hit without harm → false", () => {
    it.each([
      "não durmo há dias",
      "estou agitada",
      "perdi o controle da dieta",
      "gastei tudo no mercado",
      "ouvindo vozes do vizinho", // benign override: "do vizinho"
      "pensamentos acelerados",
      "irritada demais com tudo",
      "sem dormir faz dias",
      "cabeca nao para",
      "estou descontrolada",
      "estou explodindo de raiva",
      "gastei muito dinheiro no shopping",
    ])("does NOT detect alone: %s", (text) => {
      expect(detect(text)).toBe(false);
    });
  });

  describe("Bipolar-specific CONTEXTUAL — severe single hit → decompensation", () => {
    it.each([
      "estou num estado misto",
      "acordada há muito tempo",
    ])("returns decompensation alone: %s", (text) => {
      expect(detectResult(text)).toBe("decompensation");
    });

    it("'fora de controle' alone is NOT severe (downgraded R12)", () => {
      expect(detectResult("fora de controle")).toBe("none");
    });
  });

  describe("Bipolar-specific CONTEXTUAL — 2+ hits → true", () => {
    it.each([
      "estado misto e agitação forte",
      "não durmo há dias e ouço vozes",
      "pensamentos acelerados e perdi o controle",
      "gastei tudo e estou descontrolada",
      "sem dormir faz dias e irritada demais",
      "estado misto e cabeca nao para",
      "acelerado e explodindo de raiva",
    ])("detects 2+ bipolar signals: %s", (text) => {
      expect(detect(text)).toBe(true);
    });
  });

  describe("Bipolar-specific CONTEXTUAL — 1 hit + harm context → true", () => {
    it.each([
      ["estou num estado misto", "não aguento mais"],
      ["não durmo há dias", "estou desesperada"],
      ["perdi o controle", "estou sofrendo demais"],
      ["ouvindo vozes", "preciso de ajuda urgente"],
      ["pensamentos acelerados", "sem esperança"],
      ["irritada demais", "surtando"],
    ])("detects across messages: %s + %s", (msg1, msg2) => {
      expect(detectMulti([msg1, msg2])).toBe(true);
    });
  });

  describe("Bipolar-specific — multi-day insomnia variants (moderate: needs corroboration)", () => {
    it.each([
      "não consigo dormir há dias",
      "não durmo faz noites",
      "não durmo há 2 noites",
    ])("does NOT detect alone: %s", (text) => {
      expect(detect(text)).toBe(false);
      expect(detectMulti([text, "estou sofrendo demais"])).toBe(true);
    });
  });

  describe("Bipolar-specific — multi-day insomnia variants (severe: ≥3d → decompensation)", () => {
    it.each([
      "não durmo há 3 noites",
      "sem dormir a 4 dias",
      "acordado há muito tempo",
      "sem dormir faz uma semana",
    ])("returns decompensation alone: %s", (text) => {
      expect(detectResult(text)).toBe("decompensation");
      // With harm context → escalates to crisis
      expect(detectMultiResult([text, "estou sofrendo demais"])).toBe("crisis");
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // P0 REGRESSION: benign medication adherence must NEVER trigger
  // ══════════════════════════════════════════════════════════════════

  describe("P0 regression — benign medication adherence must NOT detect", () => {
    it.each([
      "tomei rivotril hoje",
      "tomei sertralina de manhã",
      "tomei quetiapina antes de dormir",
      "tomei clonazepam",
      "tomei diazepam ontem",
      "engoli o comprimido de fluoxetina",
      "bebi o litio com água",
      "tomei carbamazepina agora",
      "tomei risperidona",
      "tomei haloperidol",
      "tomei amitriptilina",
      "tomei tryptanol",
      "tomei haldol",
      "tomei frontal",
      "tomei lexotan",
      "tomei alprazolam",
      "tomei clozapina à noite",
      "tomei seroquel com o jantar",
      "vou tomar rivotril agora",
      "vou tomar sertralina",
      "quero tomar meu clonazepam",
      // Single-dose brand name (therapeutic)
      "tomei 1 rivotril antes de dormir",
      "tomei 1 clonazepam",
      "tomei 1 sertralina de manhã",
    ])("does NOT detect: %s", (text) => {
      expect(detect(text)).toBe(false);
    });
  });

  describe("P0 regression — medication with overdose quantifier STILL detects", () => {
    it.each([
      "tomei muitos rivotril",
      "tomei todos os clonazepam",
      "engoli vários diazepam",
      "tomei um monte de sertralina",
      "vou tomar muitos rivotril",
      "vou engolir todos os lexotan",
      "quero tomar vários alprazolam",
      "quero engolir um monte de quetiapina",
    ])("detects: %s", (text) => {
      expect(detect(text)).toBe(true);
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // TIER SEPARATION: bipolar decompensation vs crisis
  // ══════════════════════════════════════════════════════════════════

  describe("Tier separation — pure bipolar 2+ hits → decompensation (not crisis)", () => {
    it.each([
      "estado misto e agitação forte",
      "não durmo há dias e ouço vozes",
      "pensamentos acelerados e perdi o controle",
      "gastei tudo e estou descontrolada",
      "sem dormir faz dias e irritada demais",
      "estado misto e cabeca nao para",
      "acelerado e explodindo de raiva",
    ])("returns decompensation: %s", (text) => {
      expect(detectResult(text)).toBe("decompensation");
    });
  });

  describe("Tier separation — bipolar + harm context → crisis (escalated)", () => {
    it.each([
      ["estou num estado misto", "não aguento mais"],
      ["não durmo há dias", "estou desesperada"],
      ["pensamentos acelerados", "sem esperança"],
      ["irritada demais", "surtando"],
      ["ouvindo vozes", "preciso de ajuda urgente"],
    ])("returns crisis: %s + %s", (msg1, msg2) => {
      expect(detectMultiResult([msg1, msg2])).toBe("crisis");
    });
  });

  describe("Tier separation — bipolar + harm contextual → crisis (mixed)", () => {
    it.each([
      "agitado e quero sumir",
      "estado misto e tenho um plano",
      "não durmo há dias e fiz testamento",
    ])("returns crisis: %s", (text) => {
      expect(detectResult(text)).toBe("crisis");
    });
  });

  describe("Tier separation — EXPLICIT always returns crisis", () => {
    it.each([
      "quero me matar",
      "tomei todos os remédios",
      "vou me suicidar",
    ])("returns crisis: %s", (text) => {
      expect(detectResult(text)).toBe("crisis");
    });
  });

  describe("Tier separation — moderate bipolar hit alone → none", () => {
    it.each([
      "estou agitada",
      "não durmo há dias",
      "pensamentos acelerados",
      "gastei tudo",
    ])("returns none: %s", (text) => {
      expect(detectResult(text)).toBe("none");
    });
  });

  describe("Tier separation — severe bipolar hit alone → decompensation", () => {
    it.each([
      "estou num estado misto",
      "ouvindo vozes",
    ])("returns decompensation: %s", (text) => {
      expect(detectResult(text)).toBe("decompensation");
    });
  });

  describe("Tier separation — 'fora de controle' downgraded to regular contextual (R12)", () => {
    it("returns none alone (needs 2+ hits)", () => {
      expect(detectResult("fora de controle")).toBe("none");
    });
    it("returns decompensation with 2 bipolar hits", () => {
      expect(detectResult("fora de controle e pensamentos acelerados")).toBe("decompensation");
    });
    it("returns crisis with harm context", () => {
      expect(detectMultiResult(["fora de controle", "não aguento mais"])).toBe("crisis");
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // P2: Extended insomnia duration patterns
  // ══════════════════════════════════════════════════════════════════

  describe("Extended insomnia — severe durations → decompensation alone", () => {
    it.each([
      "não durmo há 10 dias",
      "sem dormir faz 15 dias",
      "não consigo dormir há 72 horas",
      "acordado há 48 horas",
      "sem dormir faz duas semanas",
      "não durmo há um mês",
      "sem dormir a 12 dias",
    ])("returns decompensation alone, crisis with harm: %s", (text) => {
      expect(detectResult(text)).toBe("decompensation");
      expect(detectMultiResult([text, "estou sofrendo demais"])).toBe("crisis");
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // P2: Passive ideation gap coverage
  // ══════════════════════════════════════════════════════════════════

  describe("Passive ideation — new variants must detect", () => {
    it.each([
      "não queria ter acordado hoje",
      "queria dormir pra sempre",
      "queria dormir para sempre",
      "não quero estar vivo",
      "não quero estar viva",
      "não queria estar vivo",
      "não queria estar viva",
      "dar fim em mim",
      "não queria ter nascido",
    ])("detects: %s", (text) => {
      expect(detect(text)).toBe(true);
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // R11 — Written-out numbers threshold split
  // ══════════════════════════════════════════════════════════════════

  describe("R11 — written-out numbers: generic meds ≥5 only", () => {
    it.each([
      "tomei dois comprimidos",
      "tomei dois comprimidos de manhã",
      "tomei três comprimidos",
      "tomei quatro comprimidos",
      "tomei dois remédios",
      "tomei três remédios por dia",
    ])("does NOT detect generic low count: %s", (text) => {
      expect(detect(text)).toBe(false);
    });

    it.each([
      "tomei cinco comprimidos",
      "tomei dez remédios",
      "engoli vinte comprimidos",
      "tomei quinze pílulas",
      "vou tomar cem medicamentos",
    ])("detects generic high count: %s", (text) => {
      expect(detect(text)).toBe(true);
    });
  });

  describe("R11 — written-out numbers: brand meds ≥2 (doubling is concerning)", () => {
    it.each([
      "tomei dois rivotril",
      "tomei três clonazepam",
      "engoli dois diazepam",
      "tomei quatro sertralina",
      "vou tomar dois quetiapina",
    ])("detects brand ≥2: %s", (text) => {
      expect(detect(text)).toBe(true);
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // R11 — BIPOLAR_SEVERE single-hit decompensation
  // ══════════════════════════════════════════════════════════════════

  describe("R11 — severe bipolar single-hit → decompensation", () => {
    it.each([
      "ouvindo vozes",
      "ouço vozes",
      "estado misto",
      "não durmo há 3 dias",
      "sem dormir faz 72 horas",
      "acordado há uma semana",
      "não consigo dormir há muito tempo",
    ])("returns decompensation: %s", (text) => {
      expect(detectResult(text)).toBe("decompensation");
    });
  });

  describe("R11 — moderate bipolar single-hit still requires corroboration", () => {
    it.each([
      "estou agitada",
      "gastei tudo no mercado",
      "pensamentos acelerados",
      "irritada demais com tudo",
      "gastei muito dinheiro no shopping",
      "não durmo há 2 noites",
    ])("returns none (needs 2+ hits): %s", (text) => {
      expect(detectResult(text)).toBe("none");
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // R11 — New lexical patterns (Brazilian means, vehicular, self-harm)
  // ══════════════════════════════════════════════════════════════════

  describe("R11 — Brazilian poisoning means must detect", () => {
    it.each([
      "tomei chumbinho",
      "bebi água sanitária",
      "engoli soda cáustica",
      "tomei raticida",
      "vou tomar chumbinho",
      "quero beber cloro",
      "tomei desinfetante",
    ])("detects: %s", (text) => {
      expect(detect(text)).toBe(true);
    });
  });

  describe("R11 — gas means must detect", () => {
    it.each([
      "abri o gás",
      "liguei o gás",
      "vou abrir o gás",
    ])("detects: %s", (text) => {
      expect(detect(text)).toBe(true);
    });
  });

  describe("R11 — vehicular self-harm must detect", () => {
    it.each([
      "vou bater o carro no poste",
      "vou jogar o carro contra o muro",
      "quero meter o carro no caminhão",
      "vou jogar carro no rio",
    ])("detects: %s", (text) => {
      expect(detect(text)).toBe(true);
    });
  });

  describe("R11 — self-harm beyond cutting must detect", () => {
    it.each([
      "me queimei",
      "vou me queimar",
      "me mutilar",
      "me mutilei",
      "me furar",
      "me furei",
      "me esfaquear",
      "estou me queimando",
      "estou me mutilando",
      "abri os pulsos",
      "abrir meus pulsos",
    ])("detects: %s", (text) => {
      expect(detect(text)).toBe(true);
    });
  });

  describe("R11 — 'fazer merda' as contextual", () => {
    it("does NOT detect alone: vou fazer merda", () => {
      expect(detect("vou fazer merda")).toBe(false);
    });
    it("does NOT detect benign: vou fazer merda no trabalho", () => {
      expect(detect("vou fazer merda no trabalho")).toBe(false);
    });
    it("detects with harm context: vou fazer merda + não aguento", () => {
      expect(detectMulti(["vou fazer merda", "não aguento mais"])).toBe(true);
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // R11 — New benign overrides
  // ══════════════════════════════════════════════════════════════════

  describe("R11 — benign overrides for broad patterns", () => {
    it.each([
      "me joguei no chão de cansaço",
      "me joguei na rede",
      "me joguei na cadeira",
      "pulei da cadeira de susto",
      "pulei do banco",
      "tomei uma caixa de leite",
      "bebi um frasco de água",
      "tomei uma caixa de suco",
    ])("does NOT detect: %s", (text) => {
      expect(detect(text)).toBe(false);
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // R12 — Gas/cleaning benign overrides
  // ══════════════════════════════════════════════════════════════════

  describe("R12 — gas for cooking must NOT detect", () => {
    it.each([
      "liguei o gás pra fazer café",
      "liguei o gás para cozinhar",
      "abri o gás e fiz o almoço",
      "abri o gás para esquentar a comida",
      "liguei o gás pra ferver água",
    ])("does NOT detect: %s", (text) => {
      expect(detect(text)).toBe(false);
    });
  });

  describe("R12 — gas without cooking context still detects", () => {
    it.each([
      "abri o gás",
      "liguei o gás",
    ])("detects: %s", (text) => {
      expect(detect(text)).toBe(true);
    });
  });

  describe("R12 — cleaning products in domestic context must NOT detect", () => {
    it.each([
      "usei cloro na limpeza",
      "usei desinfetante no banheiro",
      "usei água sanitária na cozinha",
      "comprei cloro pra limpeza",
      "cloro para limpar o chão",
      "água sanitária pra lavar roupa",
      "desinfetante na limpeza do banheiro",
    ])("does NOT detect: %s", (text) => {
      expect(detect(text)).toBe(false);
    });
  });

  describe("R12 — cleaning products ingestion still detects", () => {
    it.each([
      "bebi cloro",
      "tomei água sanitária",
      "engoli desinfetante",
      "quero beber cloro",
    ])("detects: %s", (text) => {
      expect(detect(text)).toBe(true);
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // R12 — Accidental self-harm benign overrides
  // ══════════════════════════════════════════════════════════════════

  describe("R12 — accidental self-harm must NOT detect", () => {
    it.each([
      "me queimei no forno",
      "me queimei no fogão",
      "me queimei com óleo",
      "me queimei com água quente",
      "me queimei na panela",
      "furei o dedo costurando",
      "furei o dedo com agulha",
      "me furei costurando",
      "me furei com espinho",
      "bati o carro sem querer",
      "bati o carro no estacionamento",
      "bati o carro na garagem",
      "me machuquei cozinhando",
      "me machuquei treinando",
      "me machuquei jogando bola",
      "me machuquei na academia",
    ])("does NOT detect: %s", (text) => {
      expect(detect(text)).toBe(false);
    });
  });

  describe("R12 — intentional self-harm still detects", () => {
    it.each([
      "me queimei",
      "vou me queimar",
      "me furei",
      "vou me furar",
      "vou bater o carro no poste",
      "vou me machucar",
    ])("detects: %s", (text) => {
      expect(detect(text)).toBe(true);
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // R12 — Insomnia with external cause benign overrides
  // ══════════════════════════════════════════════════════════════════

  describe("R12 — insomnia from external cause must NOT count as bipolar signal", () => {
    it.each([
      "não dormi por causa do bebê",
      "não dormi porque o vizinho fez barulho",
      "sem dormir por causa do plantão",
      "não consigo dormir por causa da dor",
      "não dormi por causa do calor",
      "acordada por causa do barulho",
      "não dormi porque tinha prova",
    ])("does NOT detect alone: %s", (text) => {
      expect(detect(text)).toBe(false);
    });
  });

  describe("R12 — insomnia without external cause still counts", () => {
    it.each([
      "não durmo há dias",
      "sem dormir faz dias",
      "não consigo dormir há dias",
    ])("does NOT detect alone (moderate, needs corroboration): %s", (text) => {
      expect(detectResult(text)).toBe("none");
      expect(detectMultiResult([text, "estou agitada"])).toBe("decompensation");
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // R12 — 'fora de controle' downgraded from BIPOLAR_SEVERE
  // ══════════════════════════════════════════════════════════════════

  describe("R12 — 'fora de controle' requires 2+ bipolar hits or harm context", () => {
    it("alone → none", () => {
      expect(detectResult("fora de controle")).toBe("none");
    });
    it("'fora de controle' + agitado → decompensation", () => {
      expect(detectResult("fora de controle e agitado")).toBe("decompensation");
    });
    it("'fora de controle' + harm context → crisis", () => {
      expect(detectMultiResult(["fora de controle", "não aguento mais"])).toBe("crisis");
    });
    it("'perdi o controle da dieta' alone → none (benign)", () => {
      expect(detectResult("perdi o controle da dieta")).toBe("none");
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // R13 — Brazilian poisoning synonyms
  // ══════════════════════════════════════════════════════════════════

  describe("R13 — poisoning synonyms must detect", () => {
    it.each([
      "tomei veneno de rato",
      "bebi veneno de rato",
      "vou tomar veneno de rato",
      "bebi qboa",
      "tomei cândida",
      "engoli lixívia",
      "vou beber qboa",
      "vou tomar candida",
    ])("detects: %s", (text) => {
      expect(detect(text)).toBe(true);
    });
  });

  describe("R13 — gas synonyms must detect", () => {
    it.each([
      "abri o gás",
      "liguei o gás",
      "gás aberto",
      "botijão",
      "glp",
    ])("detects: %s", (text) => {
      expect(detect(text)).toBe(true);
    });
  });

  describe("R13 — gas supply benign overrides", () => {
    it.each([
      "botijão acabou",
      "botijão vazio",
      "preciso trocar o botijão",
      "comprar botijão novo",
    ])("does NOT detect: %s", (text) => {
      expect(detect(text)).toBe(false);
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // R13 — Vehicle variants (moto, caminhão, ônibus)
  // ══════════════════════════════════════════════════════════════════

  describe("R13 — vehicle variants must detect", () => {
    it.each([
      "vou bater a moto no poste",
      "vou jogar o caminhão contra o muro",
      "vou bater o ônibus no rio",
      "quero meter a moto no muro",
      "pulei na frente do caminhão",
      "pular na frente do metrô",
      "pular na frente da moto",
      "pulei na frente da carreta",
    ])("detects: %s", (text) => {
      expect(detect(text)).toBe(true);
    });
  });

  describe("R13 — accidental vehicle benign overrides", () => {
    it.each([
      "bati a moto sem querer",
      "bati o caminhão na garagem",
      "bati o carro acidentalmente",
    ])("does NOT detect: %s", (text) => {
      expect(detect(text)).toBe(false);
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // R13 — New psych medications
  // ══════════════════════════════════════════════════════════════════

  describe("R13 — new psych meds must detect with overdose quantifier", () => {
    it.each([
      "tomei muitos olanzapina",
      "tomei muitos zyprexa",
      "engoli vários aripiprazol",
      "tomei muitos abilify",
      "vou tomar todos os lamotrigina",
      "tomei muitos valproato",
      "engoli vários depakote",
      "tomei muitos depakene",
      "vou engolir todos os venlafaxina",
      "tomei muitos desvenlafaxina",
      "engoli vários topiramato",
      "tomei muitos oxcarbazepina",
      "misturei cerveja com olanzapina",
      "misturei aripiprazol com vinho",
      "tomei 3 olanzapina",
      "tomei dois lamotrigina",
      "engoli vinte depakote",
    ])("detects: %s", (text) => {
      expect(detect(text)).toBe(true);
    });
  });

  describe("R13 — new psych meds therapeutic use must NOT detect", () => {
    it.each([
      "tomei olanzapina antes de dormir",
      "tomei zyprexa",
      "comecei aripiprazol",
      "meu médico receitou lamotrigina",
      "tomo valproato todo dia",
      "tomei 1 depakote",
      "tomei venlafaxina de manhã",
      "tomei desvenlafaxina",
      "tomo topiramato",
      "tomei oxcarbazepina",
    ])("does NOT detect: %s", (text) => {
      expect(detect(text)).toBe(false);
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // R13 — Legitimate medication dose benign overrides
  // ══════════════════════════════════════════════════════════════════

  describe("R13 — prescribed dose must NOT detect", () => {
    it.each([
      "meu psiquiatra mandou tomar dois clonazepam",
      "médico receitou tomar 3 comprimidos",
      "psiquiatra orientou tomar dois rivotril",
      "por orientação médica tomei 3 clonazepam",
      "por orientação do psiquiatra",
      "dobrou a dose do meu remédio",
      "aumentou a dose",
      "esqueci a dose e tomei duas",
      "tomo cinco comprimidos por dia",
      "tomo 3 remédios de manhã",
      "tomo dois medicamentos ao dia",
    ])("does NOT detect: %s", (text) => {
      expect(detect(text)).toBe(false);
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // R13 — Canonicalization / adversarial tests
  // ══════════════════════════════════════════════════════════════════

  describe("R13 — uppercase must still detect", () => {
    it.each([
      "QUERO ME MATAR",
      "VOU ME SUICIDAR",
      "TOMEI TODOS OS REMÉDIOS",
      "NÃO AGUENTO MAIS VIVER",
      "ESTOU SANGRANDO",
    ])("detects uppercase: %s", (text) => {
      expect(detect(text)).toBe(true);
    });
  });

  describe("R13 — mixed case must still detect", () => {
    it.each([
      "Quero Me Matar",
      "Vou Me Suicidar",
      "Tomei Todos Os Remédios",
    ])("detects mixed case: %s", (text) => {
      expect(detect(text)).toBe(true);
    });
  });

  describe("R13 — text with extra whitespace must still detect", () => {
    it.each([
      "quero   me   matar",
      "não  aguento  mais  viver",
      "tomei  todos  os  remédios",
    ])("detects with extra spaces: %s", (text) => {
      expect(detect(text)).toBe(true);
    });
  });

  describe("R13 — text with emoji context must still detect", () => {
    it.each([
      "quero me matar 😢",
      "vou me suicidar 💔",
      "não aguento mais viver 😭",
    ])("detects with emoji: %s", (text) => {
      expect(detect(text)).toBe(true);
    });
  });

  describe("R13 — benign text with emoji must NOT detect", () => {
    it.each([
      "vou me matar de rir 😂",
      "me joguei no sofá 😴",
    ])("does NOT detect: %s", (text) => {
      expect(detect(text)).toBe(false);
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // R14-audit — P0: benign dose prefix + crisis suffix must DETECT
  // GPT Pro audit: override must NOT mask explicit crisis in same message
  // ══════════════════════════════════════════════════════════════════

  describe("R14-audit P0 — benign medical prefix + crisis suffix must detect", () => {
    it.each([
      // Medical instruction + "o resto" (taking all remaining meds)
      "por orientação médica tomei 2 clonazepam, mas agora vou tomar o resto",
      "por orientação do psiquiatra tomei rivotril, e vou engolir o resto",
      // Medical instruction + overdose quantity
      "meu psiquiatra mandou tomar dois, eu tomei vinte",
      "psiquiatra receitou tomar 1, mas tomei todos os remédios",
      "médico orientou tomar sertralina, mas tomei muitos comprimidos",
      // Medical instruction + alcohol mixing
      "por orientação médica tomei clonazepam e depois misturei com álcool",
      "por orientação médica tomei clonazepam e misturei cerveja com remédio",
      "psiquiatra mandou tomar rivotril, misturei remédio com cerveja",
      // Medical instruction + suicidal intent
      "meu psiquiatra mandou tomar dois comprimidos, mas quero morrer",
      "por orientação médica tomei rivotril e agora quero me matar",
      "dobrou a dose do meu remédio e agora quero acabar comigo",
      // Medical instruction + container/all pills
      "aumentou a dose e tomei a cartela inteira",
      "esqueci a dose e tomei duas, depois engoli a caixa toda",
      // "Dose adjustment" followed by real crisis
      "mudou a dose, mas eu tomei todos os medicamentos",
      "ajustou a dose e eu tomei muitos remédios pra apagar",
    ])("detects crisis even with medical prefix: %s", (text) => {
      expect(detect(text)).toBe(true);
    });
  });

  describe("R14-audit P0 — dose overrides still work when NO escalation present", () => {
    it.each([
      "meu psiquiatra mandou tomar dois clonazepam",
      "médico receitou tomar 3 comprimidos",
      "psiquiatra orientou tomar dois rivotril",
      "por orientação médica tomei 3 clonazepam",
      "por orientação do psiquiatra vou tomar quetiapina",
      "dobrou a dose do meu remédio",
      "aumentou a dose",
      "esqueci a dose e tomei duas",
      "tomo cinco comprimidos por dia",
      "tomo 3 remédios de manhã",
    ])("does NOT detect: %s", (text) => {
      expect(detect(text)).toBe(false);
    });
  });

  describe("R14-audit P1 — 'tomar o resto' with medication context detects", () => {
    it.each([
      "vou tomar o resto dos remédios",
      "quero engolir o resto",
      "vou engolir o resto agora",
      "engoli o resto dos comprimidos",
      // R15: "tomar o resto" + med context → promoted to EXPLICIT
      "tomei o resto dos medicamentos",
      "vou tomar o resto do clonazepam",
    ])("detects: %s", (text) => {
      expect(detect(text)).toBe(true);
    });
  });

  // R15 audit: "tomar o resto" without medication context → CONTEXTUAL_HARM (single hit)
  // Single contextual hit without corroboration should NOT trigger crisis
  describe("R15 — 'tomar o resto' without medication context → single hit, no detect", () => {
    it.each([
      "tomei o resto",
      "vou tomar o resto agora",
      "vou tomar o resto do café",
      "tomei o resto do antibiótico amanhã",
    ])("does NOT detect standalone: %s", (text) => {
      expect(detect(text)).toBe(false);
    });
  });

  // R15 audit: "tomar o resto" without med context + harm context → crisis
  describe("R15 — 'tomar o resto' without med + harm context → crisis", () => {
    it.each([
      ["tomei o resto", "não aguento mais"],
      ["vou tomar o resto agora", "estou desesperada"],
    ])("detects with harm corroboration: %s + %s", (a, b) => {
      expect(detectMulti([a, b])).toBe(true);
    });
  });

  describe("R14-audit P1 — connector-split crisis (mas/só que/depois/e agora)", () => {
    it.each([
      "tomo remédio certinho, mas hoje quero me matar",
      "por orientação médica tomo 2 por dia, só que cansei de viver",
      "aumentou a dose, depois tomei todos os comprimidos",
      "médico mandou tomar sertralina, e agora vou me enforcar",
    ])("detects crisis after connector: %s", (text) => {
      expect(detect(text)).toBe(true);
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // R15-audit — New overdose/alcohol paraphrase patterns
  // ══════════════════════════════════════════════════════════════════

  describe("R15 — new overdose paraphrases must detect", () => {
    it.each([
      // "virar a cartela"
      "vou virar a cartela",
      "quero virar a cartela",
      "virei a cartela inteira",
      // "de uma vez" — engolir stays EXPLICIT
      "engoli todos de uma vez",
      "quero engolir tudo de uma vez",
      // "bebi junto com o remédio"
      "bebi junto com o remédio",
      "bebi com medicamento",
      // "juntei remédio e cerveja"
      "juntei remédio e cerveja",
      "juntei cerveja com remédio",
      "juntei medicamento com álcool",
      "juntei vodka e medicamento",
    ])("detects: %s", (text) => {
      expect(detect(text)).toBe(true);
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // R16-audit — Downgraded patterns: conditional/contextual behavior
  // ══════════════════════════════════════════════════════════════════

  describe("R16 — 'mandar tudo pra dentro' moved to MEDICATION_CONDITIONAL", () => {
    it.each([
      "vou mandar tudo pra dentro",
      "mandei tudo pra dentro",
      "quero mandar tudo para dentro",
    ])("does NOT detect alone: %s", (text) => {
      expect(detect(text)).toBe(false);
    });

    it.each([
      "vou mandar tudo pra dentro, todos os comprimidos",
      "mandei tudo pra dentro, o rivotril todo",
      "quero mandar tudo para dentro, os remédios",
    ])("detects with med context: %s", (text) => {
      expect(detect(text)).toBe(true);
    });

    it("detects with harm corroboration", () => {
      expect(detectMulti(["mandei tudo pra dentro", "não aguento mais"])).toBe(true);
    });
  });

  describe("R16 — 'tomar tudo de uma vez' moved to MEDICATION_CONDITIONAL", () => {
    it.each([
      "vou tomar tudo de uma vez",
      "tomei tudo de uma vez",
    ])("does NOT detect alone: %s", (text) => {
      expect(detect(text)).toBe(false);
    });

    it.each([
      "vou tomar tudo de uma vez, os comprimidos",
      "tomei tudo de uma vez, os remédios todos",
    ])("detects with med context: %s", (text) => {
      expect(detect(text)).toBe(true);
    });
  });

  describe("R16 — 'quero apagar de vez' moved to CONTEXTUAL_HARM", () => {
    it("does NOT detect alone: quero apagar de vez", () => {
      expect(detect("quero apagar de vez")).toBe(false);
    });

    it("detects with harm context: quero apagar de vez + sofrendo", () => {
      expect(detectMulti(["quero apagar de vez", "estou sofrendo demais"])).toBe(true);
    });

    it("detects with 2 contextual: quero apagar de vez + quero sumir", () => {
      expect(detectMulti(["quero apagar de vez", "quero sumir"])).toBe(true);
    });
  });

  describe("R15 — numbers 10-19 by extenso + medication word must detect", () => {
    it.each([
      "tomei treze comprimidos",
      "engoli catorze remédios",
      "tomei quatorze medicamentos",
      "engoli dezesseis comprimidos",
      "tomei dezessete pílulas",
      "engoli dezoito remédios",
      "tomei dezenove comprimidos",
      // Brand meds with 10-19 (threshold ≥2 for brands)
      "tomei treze clonazepam",
      "engoli dezesseis sertralina",
    ])("detects: %s", (text) => {
      expect(detect(text)).toBe(true);
    });
  });

  describe("R15 — engoli with high written-out numbers (10+) without med word must detect", () => {
    it.each([
      "engoli dez",
      "engoli onze",
      "engoli doze",
      "engoli treze",
      "engoli quinze",
      "engoli dezesseis",
      "engoli dezoito",
      "engoli dezenove",
      "engoli vinte",
      "engoli trinta",
    ])("detects: %s", (text) => {
      expect(detect(text)).toBe(true);
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // R15-audit — MEDICATION_CONDITIONAL behavior tests
  // ══════════════════════════════════════════════════════════════════

  describe("R15 — 'misturei com cerveja' + medication context → crisis", () => {
    it.each([
      "misturei com cerveja o remédio",
      "tomei clonazepam e misturei com álcool",
      "misturei com vodka o medicamento",
      "misturei com vinho minha medicação",
    ])("detects with med context: %s", (text) => {
      expect(detect(text)).toBe(true);
    });
  });

  describe("R15 — 'misturei com cerveja' WITHOUT medication context → no detect alone", () => {
    it.each([
      "misturei com cerveja",
      "misturei energético com cerveja",
      "misturei com vodka o suco",
      "misturei com vinho na festa",
    ])("does NOT detect standalone: %s", (text) => {
      expect(detect(text)).toBe(false);
    });
  });

  describe("R15 — 'misturei com cerveja' without med + harm context → crisis", () => {
    it.each([
      ["misturei com cerveja", "quero morrer"],
      ["misturei com vodka", "não aguento mais"],
    ])("detects with harm corroboration: %s + %s", (a, b) => {
      expect(detectMulti([a, b])).toBe(true);
    });
  });

  describe("R15 — 'tomei [10+]' conditional: with med context → crisis", () => {
    it.each([
      "tomei 15 comprimidos de clonazepam",
      "tomei 20 do meu remédio",
      "tomei 12 medicamentos",
    ])("detects with med context: %s", (text) => {
      expect(detect(text)).toBe(true);
    });
  });

  describe("R15 — 'tomei [10+]' without med context → no detect alone", () => {
    it.each([
      "tomei 10 na prova",
      "tomei 15 no exame",
      "tomei 20",
    ])("does NOT detect standalone: %s", (text) => {
      expect(detect(text)).toBe(false);
    });
  });

  describe("R15 — 'tomei [dez-dezenove]' written conditional", () => {
    it.each([
      "tomei dez",
      "tomei quinze",
      "tomei dezenove",
    ])("does NOT detect without med context: %s", (text) => {
      expect(detect(text)).toBe(false);
    });

    it.each([
      "tomei dez comprimidos",
      "tomei quinze remédios",
      "tomei dezenove clonazepam",
    ])("detects WITH med context: %s", (text) => {
      expect(detect(text)).toBe(true);
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // R15-audit — Aggressive negative tests (FP guards)
  // GPT Pro audit: required adversarial negatives for new patterns
  // ══════════════════════════════════════════════════════════════════

  describe("R15 — aggressive false positive negatives", () => {
    it.each([
      // Unit-based FP for numeric patterns
      "tomei 10 gotas",
      "tomei 10 ml",
      "tomei 15 gotas do colírio",
      "tomei 10 gotinhas",
      "tomei 30 mg",
      "tomei 10 doses da vacina",
      "tomei 2 jatos do spray",
      "engoli 10 gotas",
      "engoli 15 ml",
      // Food/drink FP for "o resto"
      "vou tomar o resto do café",
      "tomei o resto do suco",
      "vou tomar o resto do antibiótico amanhã",
      // Social FP for "misturei com cerveja"
      "misturei energético com cerveja",
      "misturei suco com cerveja",
      "misturei com cerveja o energético",
      // General FP
      "tomei 10 na prova",
      "tomei 10 minutos pra chegar",
      "tomei 20 horas de sono",
      "tomei 15 dias de férias",
    ])("does NOT detect: %s", (text) => {
      expect(detect(text)).toBe(false);
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // R15-audit — Dose escalation: "pra potencializar"
  // ══════════════════════════════════════════════════════════════════

  describe("R15 — 'pra potencializar' as dose escalation invalidates benign override", () => {
    it.each([
      "por orientação médica tomei clonazepam, misturei com cerveja pra potencializar",
      "psiquiatra mandou tomar rivotril, misturei com álcool pra potencializar",
    ])("detects: %s", (text) => {
      expect(detect(text)).toBe(true);
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // R15-audit — Interval masking: no concatenation artifacts
  // ══════════════════════════════════════════════════════════════════

  describe("R15 — interval masking prevents false concatenation", () => {
    it("benign override removal does not create artificial crisis tokens", () => {
      // "me matar de rir e morrer de calor" — both halves are hyperbole.
      // Sequential replace could theoretically create artifacts; interval masking should not.
      expect(detect("me matar de rir e morrer de calor")).toBe(false);
    });

    it("overlapping benign overrides are handled correctly", () => {
      // Multiple overlapping benign patterns should not produce unexpected results
      expect(detect("vou me matar de rir no trabalho")).toBe(false);
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // R16-audit — Gotas/doses + psychiatric medication (FN fix)
  // ══════════════════════════════════════════════════════════════════

  describe("R16 — gotas/doses + psych med must detect", () => {
    it.each([
      "tomei 80 gotas de rivotril",
      "tomei 50 gotas de clonazepam",
      "engoli 30 doses de diazepam",
      "tomei 10 gotas de quetiapina",
      "vou tomar 20 gotas de clonazepam",
      "tomei vinte gotas de rivotril",
      "tomei quinze doses de clonazepam",
    ])("detects: %s", (text) => {
      expect(detect(text)).toBe(true);
    });
  });

  describe("R16 — gotas/doses without psych med still do NOT detect", () => {
    it.each([
      "tomei 10 gotas",
      "tomei 10 gotas do colírio",
      "tomei 10 gotinhas",
      "tomei 10 doses da vacina",
      "tomei 15 gotas de vitamina D",
    ])("does NOT detect: %s", (text) => {
      expect(detect(text)).toBe(false);
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // R16-audit — Dose multiplier patterns (FN fix)
  // ══════════════════════════════════════════════════════════════════

  describe("R16 — dose multiplier patterns must detect", () => {
    it.each([
      "foi 10x a dose",
      "3x a dose",
      "tomei 10 vezes a dose",
      "5 vezes o que eu devia",
      "3 vezes a dose",
      "10 vezes o que eu deveria",
    ])("detects: %s", (text) => {
      expect(detect(text)).toBe(true);
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // R16-audit — MED_CONTEXT_STRONG vs WEAK
  // ══════════════════════════════════════════════════════════════════

  describe("R16 — WEAK med context alone does NOT promote conditional", () => {
    it.each([
      "tomei 15 e a dose era diferente",
      "tomei 10 e a receita mudou",
    ])("does NOT detect: %s", (text) => {
      expect(detect(text)).toBe(false);
    });
  });

  describe("R16 — STRONG med context promotes conditional", () => {
    it.each([
      "tomei 15 comprimidos",
      "tomei 10 e era clonazepam",
      "tomei 12, era remédio",
    ])("detects with STRONG context: %s", (text) => {
      expect(detect(text)).toBe(true);
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // R16-audit — Cross-message medication context promotion
  // ══════════════════════════════════════════════════════════════════

  describe("R16 — cross-message med context (1-2 turns back) promotes conditional", () => {
    it("detects: 'o rivotril tá aqui' + 'tomei o resto'", () => {
      expect(detectMulti(["o rivotril tá aqui", "tomei o resto"])).toBe(true);
    });

    it("detects: 'peguei a cartela de clonazepam' + 'algo' + 'tomei 14'", () => {
      expect(detectMulti(["peguei a cartela de clonazepam", "sei lá", "tomei 14"])).toBe(true);
    });

    it("detects: 'tenho o remédio aqui' + 'misturei com cerveja'", () => {
      expect(detectMulti(["tenho o remédio aqui", "misturei com cerveja"])).toBe(true);
    });

    it("does NOT promote if med context is 3+ turns back", () => {
      expect(detectMulti([
        "o rivotril tá aqui",
        "oi",
        "tudo bem",
        "tomei o resto",
      ])).toBe(false);
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // R16-audit — weakMedHits vs harmHits separation
  // ══════════════════════════════════════════════════════════════════

  describe("R16 — weakMedHit + bipolarHit does NOT trigger crisis", () => {
    it("'tomei 10 na prova' + 'estou agitada' → none (no false trigger)", () => {
      expect(detectMultiResult(["tomei 10 na prova", "estou agitada"])).toBe("none");
    });

    it("'misturei com cerveja' (no med) + 'pensamentos acelerados' → none", () => {
      expect(detectMultiResult(["misturei com cerveja", "pensamentos acelerados"])).toBe("none");
    });

    it("'tomei 20' (no med) + 'insônia' → NOT crisis (weakMed + bipolar)", () => {
      // tomei 20 without med context = weakMedHit
      // insomnia = bipolarHit
      // R16: weakMed + bipolar does NOT escalate to crisis
      expect(detectMultiResult(["tomei 20", "não durmo há dias"])).not.toBe("crisis");
    });
  });

  describe("R16 — weakMedHit still works with harm corroboration", () => {
    it("'tomei 20' (no med) + harm context → crisis", () => {
      expect(detectMultiResult(["tomei 20", "estou sofrendo demais"])).toBe("crisis");
    });

    it("2 weak med hits → crisis", () => {
      expect(detectMultiResult(["tomei 20", "misturei com cerveja"])).toBe("crisis");
    });

    it("weak med + regular harm → crisis", () => {
      expect(detectMultiResult(["tomei 15", "tenho um plano"])).toBe("crisis");
    });
  });
});
