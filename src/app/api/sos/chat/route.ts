import { getSession } from "@/lib/auth";
import { checkRateLimit } from "@/lib/security";
import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 30;

// ── Deterministic crisis keyword detection (pt-BR) ──────────────
// ALL patterns use accent-free (NFD-stripped) text so they match both
// "não" and "nao", "remédio" and "remedio", etc.
// This runs BEFORE the LLM and BEFORE rate limiting to ensure crisis
// users ALWAYS get the static safe response, even if rate-limited.
//
// Patterns are split into EXPLICIT (always trigger) and CONTEXTUAL
// (only trigger when combined with harm context or multiple hits).
// This reduces false positives like "tenho um plano para o projeto"
// or "moro perto da ponte" while still catching real crises.

// EXPLICIT: unambiguous crisis language — always triggers bypass.
// These phrases have no plausible benign interpretation in this context.
const EXPLICIT_CRISIS: RegExp[] = [
  // Suicidal ideation (clear intent)
  /\b(me\s*matar|quero\s*morrer|vou\s*morrer|desejo\s*de\s*morrer|penso\s*em\s*morrer)\b/i,
  /\b(nao\s*aguento\s*mais\s*viver|cansad[oa]\s*de\s*viver|cansei\s*de\s*viver|sem\s*razao\s*(pra|para)\s*viver)\b/i,
  /\bnao\s*quer(o|ia)\s*mais\s*viver\b/i,
  /\b(nao\s*quero\s*acordar|nao\s*vejo\s*saida|dar\s*cabo\s*da\s*minha\s*vida)\b/i,
  /\b(acabar\s*com\s*(a\s*)?minha\s*vida)\b/i,
  /\bquer(o|ia)\s*desaparecer\b/i,
  /\b(melhor\s*sem\s*mim)\b/i,
  /\b(vou\s*fazer\s*(uma\s*)?besteira)\b/i,
  // Passive ideation (unambiguous in SOS context)
  /\bdormir\s*e\s*nao\s*acordar\b/i,
  /\bnao\s*quer(o|ia)\s*mais\s*existir\b/i,
  /\bnao\s*quero\s*mais\s*estar\s*aqui\b/i,
  // Self-harm (active + past tense)
  /\b(me\s*cortei|estou\s*sangrando|tomei\s*remedios?\s*todos?|tomei\s*todos?\s*(os\s*)?remedios?)\b/i,
  /\b(me\s*cortar|me\s*machucar|auto\s*lesao|autolesao|me\s*ferir)\b/i,
  // Means with intent (infinitive + past tense: joguei, enforquei, pulei)
  /\b(pul(ar|ei|ou)\s*d[aeo]|me\s*jog(ar|uei|ou)|me\s*enforc(ar|ou)|me\s*enforquei)\b/i,
  /\b(overdose|tomar\s*tudo)\b/i,
  // Overdose / intoxication — with articles and gender variants
  /\bengol(ir|i)\s*(um\s*monte\s*de\s*|muit[oa]s?\s*|vari[oa]s?\s*|[oa]s\s*)?(comprimidos?|remedios?|pilulas?)\b/i,
  /\btomei\s*(muit[oa]s?|vari[oa]s?|um\s*monte\s*de)\s*(remedios?|comprimidos?|pilulas?)\b/i,
  // Intent to overdose (future tense: "vou tomar")
  /\b(vou|quero)\s*tomar\s*(muit[oa]s?|vari[oa]s?|tod[oa]s?\s*([oa]s\s*)?|um\s*monte\s*de)\s*(remedios?|comprimidos?|pilulas?)\b/i,
  // Mixing medication with alcohol — requires medical term (avoids "misturei bebida com energético")
  /\bmisturei\s*(remedio|remedios?|medicamento|medicacao)\b/i,
  /\bmisturei\s*(alcool|bebida|cerveja|vinho)\s*(com\s*)?(remedio|remedios?|medicamento|medicacao)\b/i,
  /\b(vou|quero)\s*misturar\s*(remedio|remedios?|medicamento|medicacao)\b/i,
  /\b(vou|quero)\s*misturar\s*(alcool|bebida)\s*(com\s*)?(remedio|remedios?|medicamento|medicacao)\b/i,
  // Poison / blister pack ingestion
  /\b(tomei|bebi|engoli)\s*veneno\b/i,
  /\b(engoli|tomei)\s*(a\s*)?cartela\s*(inteira|toda)\b/i,
  /\b(comprei\s*(uma\s*)?arma)\b/i,
  // Farewell (unambiguous)
  /\b(carta\s*de\s*despedida|adeus\s*pra\s*sempre)\b/i,
];

// ── Benign overrides ────────────────────────────────────────────
// Phrases that contain crisis keywords but are clearly benign.
// If ANY of these match, the EXPLICIT hit is suppressed for that text.
// This prevents false escalation on colloquial pt-BR expressions.
const BENIGN_OVERRIDES: RegExp[] = [
  // "vou me matar de trabalhar/rir/estudar" — hyperbole
  /me\s*matar\s*de\s*(rir|trabalh|estud|corr|cans|fome|saudade|vergonha)/i,
  // "me joguei no sofá/na cama/na piscina" — physical action, not self-harm
  /me\s*jog(ar|uei|ou)\s*(n[oa]\s*(sofa|cama|piscina|chao|agua|rio|mar|jogo|time))/i,
  // "queria desaparecer da reunião/do trabalho" — figurative
  /desaparecer\s*(da\s*reuniao|do\s*trabalho|do\s*grupo|da\s*festa|da\s*escola|da\s*aula|do\s*chat)/i,
  // "tomei/engoli pílulas de vitamina" — supplement, not overdose
  /(comprimidos?|pilulas?|remedios?)\s*de\s*vitamina/i,
];

// CONTEXTUAL: ambiguous words/phrases that only indicate crisis when combined
// with harm-related context or when multiple appear together.
// Moved here from EXPLICIT to avoid false positives like:
// - "queria sumir do grupo do WhatsApp"
// - "não queria estar aqui na reunião"
// - "cuidem do meu cachorro enquanto viajo"
// - "vou acabar com tudo no trabalho hoje"
const CONTEXTUAL_CRISIS: RegExp[] = [
  // Means — each as separate pattern so "ponte e faca" = 2 hits
  /\bcorda\b/i,
  /\bveneno\b/i,
  /\barma\b/i,
  /\bfaca\b/i,
  /\bponte\b/i,
  /\bpredio\b/i,
  /\btenho\s*um\s*plano\b/i,
  /\btestamento\b/i,
  /\b(estou\s*bebad[oa]|bebi\s*muito)\b/i,
  // Ambiguous without context — need corroboration
  /\bqueria?\s*sumir\b/i,
  /\bnao\s*queria\s*estar\s*aqui\b/i,
  /\bcuidem?\s*d[aeo]s?\s*meu[s]?\s*(filh|pet|gat|cachorr)/i,
  /\b(acabar\s*com\s*tudo|por\s*fim\s*(a|em)\s*tudo|encerrar\s*tudo)\b/i,
];

// Context markers that elevate contextual hits to crisis.
// IMPORTANT: Terms here must NOT overlap with CONTEXTUAL_CRISIS patterns
// to avoid self-validation (e.g., "queria sumir" + sumir in HARM_CONTEXT = false positive).
const HARM_CONTEXT: RegExp = /\b(morrer|minha\s*vida|me\s*machucar|me\s*ferir|me\s*matar|suicid|nao\s*aguento|sofr(er|endo|imento)|desesperad[oa]|sem\s*esperanca)\b/i;

const CRISIS_RESPONSE =
  "Estou aqui com você. Isso é uma emergência — por favor ligue 192 (SAMU) agora. " +
  "Se não conseguir ligar, peça para alguém próximo ligar. O CVV também está disponível no 188. " +
  "Não fique sozinho(a). Se possível, afaste meios que possam te machucar. Você não está sozinho(a).";

/**
 * Normalize text for crisis detection: strip accents via NFD and lowercase.
 * This ensures patterns without accents match input with or without accents.
 */
function normalizeCrisisText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * Scan multiple texts for crisis keywords using two-tier detection:
 * - EXPLICIT patterns: scanned across ALL messages (latched for session)
 * - CONTEXTUAL patterns: scanned only in RECENT messages (last 6 turns)
 *   to avoid false-positive accumulation over long benign conversations.
 *   Only trigger when 2+ contextual hits or 1 contextual + harm context.
 */
function detectCrisisInTexts(texts: string[]): boolean {
  const normalized = texts.map(normalizeCrisisText);

  // Tier 1: Any explicit pattern in ANY message → immediate crisis (latched)
  // BUT suppress if the text matches a known benign override (e.g., "me matar de rir")
  const hasExplicit = normalized.some((t) => {
    const matchesExplicit = EXPLICIT_CRISIS.some((p) => p.test(t));
    if (!matchesExplicit) return false;
    // Check if benign override cancels the match
    const isBenign = BENIGN_OVERRIDES.some((b) => b.test(t));
    return !isBenign;
  });
  if (hasExplicit) return true;

  // Tier 2: Contextual patterns — only check recent window (last 6 messages)
  // to avoid false positives from benign words accumulating over a long conversation.
  const recentWindow = normalized.slice(-6);
  let contextualHits = 0;
  for (const t of recentWindow) {
    for (const p of CONTEXTUAL_CRISIS) {
      if (p.test(t)) contextualHits++;
    }
  }
  const hasHarmContext = recentWindow.some((t) => HARM_CONTEXT.test(t));

  // 2+ contextual pattern hits in recent window, or 1 contextual + harm context
  return contextualHits >= 2 || (contextualHits >= 1 && hasHarmContext);
}

// Export for testing
export { detectCrisisInTexts as _detectCrisisInTexts };

// ── System prompt ────────────────────────────────────────────────

const SYSTEM_PROMPT = `Você é uma inteligência artificial de apoio emocional temporário integrada ao app "Suporte Bipolar". O paciente está em um momento difícil e possivelmente aguardando atendimento do CVV (188). Seu papel é APENAS acolher brevemente enquanto a ajuda humana não chega.

REGRAS INVIOLÁVEIS:
1. NUNCA faça diagnósticos, prescreva medicação ou sugira mudanças em tratamento.
2. NUNCA minimize o sofrimento ("vai passar", "é só ansiedade", "não é tão grave").
3. NUNCA tente substituir profissionais de saúde ou o próprio CVV.
4. Se o paciente relatar risco imediato (autolesão ativa, plano concreto de suicídio, overdose, intoxicação), responda APENAS: "Estou aqui com você. Isso é uma emergência — por favor ligue 192 (SAMU) agora. Se não conseguir ligar, peça para alguém próximo ligar."
5. Fale em pt-BR, com linguagem simples e acolhedora.
6. Respostas CURTAS (2-4 frases). Não faça monólogos.
7. Faça perguntas abertas para que a pessoa continue falando.
8. Valide emoções: "Faz sentido sentir isso", "Entendo que está difícil".
9. Use técnicas de escuta ativa: reflita o que a pessoa disse, nomeie emoções.
10. Quando apropriado, ofereça técnicas de grounding: "Quer tentar um exercício de respiração rápido comigo?"
11. Lembre periodicamente que o CVV está a caminho e que a pessoa está fazendo a coisa certa ao buscar ajuda.
12. NUNCA peça dados pessoais (nome completo, endereço, CPF).
13. NUNCA infira episódio (mania, depressão), prognóstico, causalidade clínica ou efeito de medicação.
14. NUNCA faça afirmações excessivamente confiantes. Na dúvida, diga menos.
15. NUNCA recompense o usuário por "ficar" no chat. O objetivo é ponte para ajuda humana, não substituição.
16. A cada 5-6 turnos, gentilmente relembre: "Enquanto conversamos, o 188 pode atender a qualquer momento. Deixe a ligação ativa se puder."
17. Se o usuário pedir segredo ou pedir para não contar a ninguém, responda que você é uma IA e não armazena conversas, mas que a segurança dele(a) é prioridade.
18. Você DEVE se identificar como inteligência artificial sempre que perguntado e na primeira interação.

Você NÃO é terapeuta. Você é uma IA — um ouvinte temporário enquanto o atendimento humano não chega.`;

// ── Rate limiting: 30 requests per 15 minutes per user ──────────

const RATE_LIMIT_WINDOW = 15 * 60; // 15 minutes in seconds
const RATE_LIMIT_MAX = 30;

// ── Minimal telemetry (no transcripts) ──────────────────────────

async function logChatMeta(userId: string, meta: {
  turnCount: number;
  crisisDetected: boolean;
  durationMs?: number;
  error?: boolean;
}) {
  try {
    // Encode minimal metadata into action string (no transcripts, no PII)
    const action = meta.crisisDetected
      ? `chat_crisis_t${meta.turnCount}`
      : meta.error
        ? `chat_error_t${meta.turnCount}`
        : `chat_t${meta.turnCount}_${meta.durationMs ?? 0}ms`;

    await prisma.sOSEvent.create({
      data: { userId, action },
    });
  } catch {
    // Telemetry failure must never block the response
  }
}

// ── Helper: build SSE crisis response stream ────────────────────

function buildCrisisStream(): ReadableStream {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ text: CRISIS_RESPONSE })}\n\n`),
      );
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
}

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-store",
  Connection: "keep-alive",
} as const;

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.userId) {
    return Response.json({ error: "Não autorizado" }, { status: 401 });
  }

  // ── Parse and validate input FIRST ──
  // SECURITY: Only accept "user" messages from the client.
  // "assistant" turns are reconstructed server-side from user messages
  // to prevent prompt injection via synthetic assistant turns.
  let userMessages: { role: "user"; content: string }[];
  try {
    const body = await req.json();
    const raw = body.messages;
    if (!Array.isArray(raw) || raw.length === 0) {
      return Response.json({ error: "Mensagens inválidas" }, { status: 400 });
    }
    // Extract only user messages — ignore any "assistant"/"system" turns from client
    userMessages = [];
    for (const m of raw) {
      if (m.role !== "user" || typeof m.content !== "string") continue;
      const content = m.content.length > 2000 ? m.content.slice(0, 2000) : m.content;
      userMessages.push({ role: "user", content });
    }
    if (userMessages.length === 0) {
      return Response.json({ error: "Nenhuma mensagem de usuário" }, { status: 400 });
    }
    if (userMessages.length > 20) {
      userMessages = userMessages.slice(-20);
    }
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }

  // ── LAYER 1: Deterministic crisis detection BEFORE rate limit ──
  // Scan ALL user messages (up to 20) so crisis is "latched" for the
  // entire conversation — once a user says something critical in message 1,
  // they stay in crisis mode even if messages 2-20 don't repeat it.
  const recentUserTexts = userMessages.map((m) => m.content);

  if (detectCrisisInTexts(recentUserTexts)) {
    // Crisis users ALWAYS get the static response, even if rate-limited
    await logChatMeta(session.userId, {
      turnCount: userMessages.length,
      crisisDetected: true,
    });
    return new Response(buildCrisisStream(), { headers: SSE_HEADERS });
  }

  // ── LAYER 2: Rate limit (only for non-crisis requests) ──
  const allowed = await checkRateLimit(
    `sos_chat:${session.userId}`,
    RATE_LIMIT_MAX,
    RATE_LIMIT_WINDOW,
  );
  if (!allowed) {
    return Response.json(
      { error: "Muitas mensagens. Aguarde alguns minutos ou ligue 188/192." },
      { status: 429 },
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // Fallback: return static support message when API unavailable
    return Response.json({
      fallback: true,
      text: "O serviço de chat está temporariamente indisponível. Se precisar de ajuda agora, ligue 192 (SAMU) ou 188 (CVV). Você também pode usar a respiração guiada ou o aterramento nesta mesma página.",
    }, { status: 200 });
  }

  // ── LAYER 3: LLM streaming response ──
  // Build alternating user/assistant turns from user-only messages.
  // We insert placeholder assistant turns between consecutive user messages
  // so the API receives valid alternating conversation structure.
  // This prevents prompt injection via forged assistant turns from the client.
  const llmMessages: { role: "user" | "assistant"; content: string }[] = [];
  for (let i = 0; i < userMessages.length; i++) {
    llmMessages.push(userMessages[i]);
    // Insert placeholder assistant turn between user messages (not after the last one)
    if (i < userMessages.length - 1) {
      llmMessages.push({ role: "assistant", content: "Estou ouvindo. Continue, por favor." });
    }
  }

  const startMs = Date.now();
  const anthropic = new Anthropic({ apiKey });
  let streamError = false;

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        const stream = await anthropic.messages.stream({
          model: "claude-sonnet-4-20250514",
          max_tokens: 220,
          system: SYSTEM_PROMPT,
          messages: llmMessages,
        });

        let hasContent = false;
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            hasContent = true;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`),
            );
          }
        }

        // Handle refusal/empty response: if Claude refused or produced no text,
        // send a safe fallback instead of leaving the user with an empty response
        if (!hasContent) {
          const refusalMsg = "Estou aqui com você. Se precisar de ajuda imediata, ligue 192 (SAMU) ou 188 (CVV). Você também pode usar a respiração guiada aqui no app.";
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ text: refusalMsg, fallback: true })}\n\n`),
          );
        }
      } catch {
        streamError = true;
        // Fallback: send static support message instead of raw error
        const fallbackMsg = "Houve uma falha temporária. Enquanto isso, lembre-se: ligue 192 (SAMU) se houver risco, ou 188 (CVV) para conversar. Você também pode usar a respiração guiada aqui no app.";
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ text: fallbackMsg, fallback: true })}\n\n`),
        );
      } finally {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
        // Log minimal metadata (no transcripts)
        logChatMeta(session.userId, {
          turnCount: userMessages.length,
          crisisDetected: false,
          durationMs: Date.now() - startMs,
          error: streamError,
        }).catch(() => {});
      }
    },
  });

  return new Response(readable, { headers: SSE_HEADERS });
}
