/**
 * Lightweight crisis text detection for journal entries.
 * Checks for Portuguese crisis keywords/phrases and returns
 * whether SOS flow should be offered (never blocks saving).
 */

const CRISIS_PATTERNS: RegExp[] = [
  // Suicidal ideation
  /\b(quer[oe]?\s+morrer|quero\s+me\s+matar|pensan[dt]o\s+em\s+(morrer|suic[ií]dio)|vou\s+me\s+matar)\b/i,
  /\b(n[aã]o\s+(aguento|suporto|consigo)\s+mais\s+viver)\b/i,
  /\b(melhor\s+(sem\s+mim|se\s+eu\s+morresse|se\s+eu\s+n[aã]o\s+existisse))\b/i,
  /\b(suic[ií]d(io|a)|me\s+matar|acabar\s+com\s+tudo|tirar\s+minha\s+vida)\b/i,
  /\b(n[aã]o\s+vejo\s+sa[ií]da|sem\s+esperan[cç]a|n[aã]o\s+tem\s+(solu[cç][aã]o|jeito))\b/i,
  // Self-harm
  /\b(me\s+(cortar|machucar|ferir)|autolesão|automutila[cç][aã]o)\b/i,
  /\b(me\s+fazendo\s+mal|me\s+machucando)\b/i,
  // Extreme distress
  /\b(n[aã]o\s+consigo\s+(respirar|parar\s+de\s+chorar)|desespero\s+total)\b/i,
  /\b(perdi\s+o\s+controle\s+(total|completo)|surto\s+total)\b/i,
];

export interface CrisisDetectionResult {
  /** Whether crisis-related content was detected */
  detected: boolean;
}

/**
 * Scans journal text for crisis indicators.
 * Returns detection result — NEVER blocks entry saving.
 * The UI should offer SOS resources if detected.
 */
export function detectCrisisContent(text: string): CrisisDetectionResult {
  const normalized = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents for matching
    .toLowerCase();

  // Also check original text (with accents) for patterns that use accented chars
  const originalLower = text.toLowerCase();

  for (const pattern of CRISIS_PATTERNS) {
    if (pattern.test(normalized) || pattern.test(originalLower)) {
      return { detected: true };
    }
  }

  return { detected: false };
}
