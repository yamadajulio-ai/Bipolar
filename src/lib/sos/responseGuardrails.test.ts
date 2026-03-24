import { describe, it, expect } from "vitest";
import { checkSosResponse, SOS_GUARDRAIL_FALLBACK } from "./responseGuardrails";

describe("checkSosResponse", () => {
  describe("safe responses", () => {
    const safeTexts = [
      "Entendo que está difícil. Quer me contar mais sobre como está se sentindo?",
      "Faz sentido sentir isso. Estou aqui com você.",
      "Enquanto conversamos, o 188 pode atender a qualquer momento.",
      "Quer tentar um exercício de respiração rápido comigo?",
      "Você está fazendo a coisa certa ao buscar ajuda.",
      "Estou aqui como uma IA, um ouvinte temporário.",
    ];

    for (const text of safeTexts) {
      it(`passes: "${text.slice(0, 50)}..."`, () => {
        const result = checkSosResponse(text);
        expect(result.safe).toBe(true);
        expect(result.matchedPattern).toBeUndefined();
      });
    }
  });

  describe("diagnostic assertions", () => {
    it("catches 'você tem depressão'", () => {
      const result = checkSosResponse("Parece que você tem depressão.");
      expect(result.safe).toBe(false);
      expect(result.reason).toBe("diagnostic_assertion");
    });

    it("catches 'você tem transtorno'", () => {
      const result = checkSosResponse("Você tem transtorno bipolar.");
      expect(result.safe).toBe(false);
      expect(result.reason).toBe("diagnostic_assertion");
    });

    it("catches 'diagnóstico'", () => {
      const result = checkSosResponse("O diagnóstico sugere que...");
      expect(result.safe).toBe(false);
      expect(result.reason).toBe("diagnostic_language");
    });
  });

  describe("prescription language", () => {
    it("catches 'prescrever'", () => {
      const result = checkSosResponse("Eu vou prescrever um medicamento.");
      expect(result.safe).toBe(false);
      expect(result.reason).toBe("prescription_language");
    });

    it("catches 'receitar'", () => {
      const result = checkSosResponse("Posso receitar algo para você.");
      expect(result.safe).toBe(false);
      expect(result.reason).toBe("prescription_language");
    });

    it("catches 'medicar'", () => {
      const result = checkSosResponse("Você precisa medicar isso.");
      expect(result.safe).toBe(false);
      expect(result.reason).toBe("prescription_language");
    });
  });

  describe("medication interference", () => {
    it("catches 'pare de tomar'", () => {
      const result = checkSosResponse("Pare de tomar sua medicação.");
      expect(result.safe).toBe(false);
      expect(result.reason).toBe("medication_interference");
    });

    it("catches 'suspenda'", () => {
      const result = checkSosResponse("Suspenda o uso imediatamente.");
      expect(result.safe).toBe(false);
      expect(result.reason).toBe("medication_interference");
    });
  });

  describe("dismissal of professional help", () => {
    it("catches 'não precisa de médico'", () => {
      const result = checkSosResponse("Você não precisa de médico.");
      expect(result.safe).toBe(false);
      expect(result.reason).toBe("dismissal_of_help");
    });

    it("catches 'não precisa de ajuda'", () => {
      const result = checkSosResponse("Você não precisa de ajuda profissional.");
      expect(result.safe).toBe(false);
      expect(result.reason).toBe("dismissal_of_help");
    });
  });

  describe("suicide normalization", () => {
    it("catches 'é normal sentir vontade de morrer'", () => {
      const result = checkSosResponse("É normal sentir vontade de morrer às vezes.");
      expect(result.safe).toBe(false);
      expect(result.reason).toBe("suicide_normalization");
    });

    it("catches 'suicídio é compreensível'", () => {
      const result = checkSosResponse("O suicídio é compreensível em certas situações.");
      expect(result.safe).toBe(false);
      expect(result.reason).toBe("suicide_normalization");
    });

    it("catches 'suicídio é natural'", () => {
      const result = checkSosResponse("O suicídio é natural quando se sofre tanto.");
      expect(result.safe).toBe(false);
      expect(result.reason).toBe("suicide_normalization");
    });
  });

  describe("suffering minimization", () => {
    it("catches 'não é tão grave'", () => {
      const result = checkSosResponse("Calma, não é tão grave assim.");
      expect(result.safe).toBe(false);
      expect(result.reason).toBe("suffering_minimization");
    });

    it("catches 'é só ansiedade'", () => {
      const result = checkSosResponse("Relaxa, é só ansiedade.");
      expect(result.safe).toBe(false);
      expect(result.reason).toBe("suffering_minimization");
    });
  });

  describe("discouraging emergency services", () => {
    it("catches 'não precisa ligar pro SAMU'", () => {
      const result = checkSosResponse("Não precisa ligar pro SAMU, vai ficar bem.");
      expect(result.safe).toBe(false);
      expect(result.reason).toBe("discouraging_emergency");
    });

    it("catches 'não precisa chamar o 192'", () => {
      const result = checkSosResponse("Não precisa chamar o 192.");
      expect(result.safe).toBe(false);
      expect(result.reason).toBe("discouraging_emergency");
    });
  });

  describe("accent handling", () => {
    it("catches patterns with accents", () => {
      const result = checkSosResponse("Você tem depressão severa.");
      expect(result.safe).toBe(false);
    });

    it("catches patterns without accents", () => {
      const result = checkSosResponse("Voce tem depressao.");
      expect(result.safe).toBe(false);
    });
  });

  describe("fallback message", () => {
    it("has a non-empty fallback", () => {
      expect(SOS_GUARDRAIL_FALLBACK).toBeTruthy();
      expect(SOS_GUARDRAIL_FALLBACK.length).toBeGreaterThan(20);
    });

    it("fallback itself is safe", () => {
      const result = checkSosResponse(SOS_GUARDRAIL_FALLBACK);
      expect(result.safe).toBe(true);
    });
  });
});
