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
      "tomei tudo",
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
      "queria desaparecer",
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
      "tirar a vida",
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
    it("detects: tomei tudo", () => {
      expect(detect("tomei tudo")).toBe(true);
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
});
