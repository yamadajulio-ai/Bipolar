// ── SOS Response Guardrails ──────────────────────────────────────
// Post-LLM safety check for SOS chatbot responses.
// Catches dangerous patterns that the system prompt should prevent
// but defense-in-depth requires verifying.
//
// These patterns are SOS-specific (crisis context). The narrative
// forbidden patterns (src/lib/ai/generateNarrative.ts) cover clinical
// language in insights; these cover crisis-specific risks.
//
// All patterns operate on NFD-normalized, accent-stripped, lowercased text.

const SOS_FORBIDDEN_PATTERNS: { pattern: RegExp; reason: string }[] = [
  // Diagnostic assertions — AI must never diagnose
  {
    pattern: /voc[eê] tem\s+(depress[aã]o|bipolar|transtorno)/i,
    reason: "diagnostic_assertion",
  },
  {
    pattern: /diagn[oó]stic/i,
    reason: "diagnostic_language",
  },
  // Prescription / medication interference
  {
    pattern: /prescrev|receitar|medicar/i,
    reason: "prescription_language",
  },
  {
    pattern: /pare de tomar|suspenda/i,
    reason: "medication_interference",
  },
  // Dismissal of professional help
  {
    pattern: /n[aã]o precisa de (m[eé]dico|profissional|ajuda)/i,
    reason: "dismissal_of_help",
  },
  // Normalization of suicidal ideation — extremely dangerous
  {
    pattern: /[eé] normal sentir vontade de morrer/i,
    reason: "suicide_normalization",
  },
  {
    pattern: /suic[ií]dio [eé] (compreens[ií]vel|natural)/i,
    reason: "suicide_normalization",
  },
  // Minimization of suffering
  {
    pattern: /n[aã]o [eé] t[aã]o grave/i,
    reason: "suffering_minimization",
  },
  {
    pattern: /[eé] s[oó] (ansiedade|estresse|stress)/i,
    reason: "suffering_minimization",
  },
  // Encouraging self-harm methods
  {
    pattern: /como (se\s*matar|cometer\s*suic[ií]dio|tirar\s*(a\s*)?(sua|minha)\s*vida)/i,
    reason: "self_harm_method",
  },
  // Discouraging calling emergency services
  {
    pattern: /n[aã]o (precisa|precis[ae])\s*(ligar|chamar)\s*(o\s*|pro\s*|pra\s*|pro\s*o\s*|ao\s*)?(samu|192|188|cvv|bombeiro)/i,
    reason: "discouraging_emergency",
  },
];

export interface SosGuardrailResult {
  safe: boolean;
  matchedPattern?: string;
  reason?: string;
}

/**
 * Normalize text for safety check: lowercase, NFD decompose, strip accents.
 */
function normalizeForCheck(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Check an SOS assistant response for forbidden patterns.
 * Returns { safe: true } if no patterns match, or { safe: false, matchedPattern, reason }
 * for the first match found.
 */
export function checkSosResponse(text: string): SosGuardrailResult {
  const normalized = normalizeForCheck(text);
  for (const { pattern, reason } of SOS_FORBIDDEN_PATTERNS) {
    if (pattern.test(normalized)) {
      return { safe: false, matchedPattern: pattern.source, reason };
    }
  }
  return { safe: true };
}

/**
 * Safe fallback message when guardrail triggers.
 * Provides crisis resources without any clinical content.
 */
export const SOS_GUARDRAIL_FALLBACK =
  "Estou aqui com você. Se precisar de ajuda imediata, ligue 192 (SAMU) ou 188 (CVV). Você também pode usar a respiração guiada aqui no app.";
