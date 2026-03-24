import { getSession } from "@/lib/auth";
import { checkRateLimit } from "@/lib/security";
import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";
import * as Sentry from "@sentry/nextjs";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod/v4";
import { createHmac, timingSafeEqual } from "crypto";
import { trackError } from "@/lib/telemetry";
import { checkSosResponse, SOS_GUARDRAIL_FALLBACK } from "@/lib/sos/responseGuardrails";

// ── HMAC signing for assistant messages ──────────────────────────
// Prevents prompt injection via forged assistant turns from the client.
// The server signs each assistant response with a truncated HMAC.
// On subsequent requests, the server verifies the tag before accepting
// assistant messages into the LLM context. No tag or invalid tag → dropped.
const HMAC_KEY = process.env.SOS_HMAC_KEY || process.env.NEXTAUTH_SECRET || "";

// Fail-closed: in production, refuse to operate without a real HMAC key.
// In development, allow a hardcoded fallback for local testing only.
function getHmacKey(): string {
  if (HMAC_KEY) return HMAC_KEY;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SOS_HMAC_KEY or NEXTAUTH_SECRET must be set in production");
  }
  return "sos-hmac-dev-only";
}

function signAssistantTurn(content: string, userId: string, seq?: number): string {
  const key = getHmacKey();
  const payload = seq != null ? `sos:${userId}:${seq}:${content}` : `sos:${userId}:${content}`;
  return createHmac("sha256", key)
    .update(payload)
    .digest("hex")
    .slice(0, 32);
}

function verifyAssistantTurn(content: string, userId: string, tag: string, seq?: number): boolean {
  if (!tag || tag.length !== 32) return false;
  // Try with seq first (new format), then without (backward compat for pre-seq messages)
  const expectedWithSeq = seq != null ? signAssistantTurn(content, userId, seq) : null;
  const expectedWithout = signAssistantTurn(content, userId);
  try {
    if (expectedWithSeq) {
      const matchSeq = timingSafeEqual(Buffer.from(expectedWithSeq), Buffer.from(tag));
      if (matchSeq) return true;
    }
    return timingSafeEqual(Buffer.from(expectedWithout), Buffer.from(tag));
  } catch {
    return false;
  }
}

export const maxDuration = 30;

// ── Crisis detection (extracted to dedicated module) ────────────
import {
  detectCrisisInTexts,
  CRISIS_RESPONSE,
  DECOMPENSATION_RESPONSE,
} from "@/lib/sos/crisisDetection";
export { detectCrisisInTexts as _detectCrisisInTexts } from "@/lib/sos/crisisDetection";
export type { CrisisResult } from "@/lib/sos/crisisDetection";

// ── (Crisis patterns, overrides, and detection logic are in @/lib/sos/crisisDetection.ts) ──

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
19. O app possui modo voz: o usuário pode falar pelo microfone (o navegador transcreve) e ouvir suas respostas em voz alta (síntese de fala). Se o usuário perguntar sobre falar por voz, explique que ele pode ativar o botão "Voz" no topo do chat para conversar sem as mãos — o app ouve e responde em voz alta. Isso NÃO é uma ligação telefônica, é reconhecimento de fala do navegador + síntese de voz.

Você NÃO é terapeuta. Você é uma IA — um ouvinte temporário enquanto o atendimento humano não chega.`;

// ── Input schema (Zod) ───────────────────────────────────────────
const MessageSchema = z.object({
  role: z.literal("user"),
  content: z.string().min(1).max(2000),
});
const ChatInputSchema = z.object({
  messages: z.array(MessageSchema).min(1).max(100),
});

// ── Rate limiting: 30 requests per 15 minutes per user ──────────

const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes in milliseconds
const RATE_LIMIT_MAX = 30;

// ── Minimal telemetry (no transcripts) ──────────────────────────

async function logChatMeta(userId: string, meta: {
  turnCount: number;
  crisisDetected: boolean;
  decompensation?: boolean;
  durationMs?: number;
  error?: boolean;
  hmacDrops?: number;
}) {
  try {
    // Encode minimal metadata into action string (no transcripts, no PII)
    const hmacSuffix = meta.hmacDrops ? `_hd${meta.hmacDrops}` : "";
    const action = meta.crisisDetected
      ? meta.decompensation
        ? `chat_decomp_t${meta.turnCount}${hmacSuffix}`
        : `chat_crisis_t${meta.turnCount}${hmacSuffix}`
      : meta.error
        ? `chat_error_t${meta.turnCount}${hmacSuffix}`
        : `chat_t${meta.turnCount}_${meta.durationMs ?? 0}ms${hmacSuffix}`;

    await prisma.sOSEvent.create({
      data: { userId, action },
    });
  } catch {
    // Telemetry failure must never block the response
  }
}

// ── Helper: build SSE crisis response stream ────────────────────

function buildCrisisStream(userId: string, seq?: number): ReadableStream {
  const encoder = new TextEncoder();
  const tag = signAssistantTurn(CRISIS_RESPONSE, userId, seq);
  return new ReadableStream({
    start(controller) {
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ text: CRISIS_RESPONSE })}\n\n`),
      );
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ tag, seq })}\n\n`),
      );
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
}

function buildDecompensationStream(userId: string, seq?: number): ReadableStream {
  const encoder = new TextEncoder();
  const tag = signAssistantTurn(DECOMPENSATION_RESPONSE, userId, seq);
  return new ReadableStream({
    start(controller) {
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ text: DECOMPENSATION_RESPONSE })}\n\n`),
      );
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ tag, seq })}\n\n`),
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

  // Consent tracking: log whether user has sos_chatbot consent.
  // NEVER block SOS — art. 11, II, e (proteção da vida/incolumidade) overrides.
  // Consent is tracked for audit/compliance but the chatbot always works.

  // ── Parse and validate input ──
  // SECURITY: Accept both "user" and "assistant" messages from the client
  // to maintain conversation coherence (so the LLM remembers what it said).
  // Assistant messages are validated strictly: capped at 500 chars and
  // scanned for injection patterns. The system prompt is always server-controlled.
  // Zod schema validates user messages (string content, 2000 char cap, max 100).
  let userMessages: { role: "user"; content: string }[];
  let allUserTexts: string[]; // ALL user texts for crisis detection (no window limit)
  let llmConversation: { role: "user" | "assistant"; content: string }[];
  let hmacDropCount = 0; // Track silent HMAC drops for telemetry
  let assistantSeq = 0; // Sequence counter for assistant messages
  try {
    const body = await req.json();

    // Pre-filter: accept user and assistant messages with strict validation.
    // SECURITY: assistant turns from the client are accepted to maintain
    // conversation coherence, but capped at 500 chars and scanned for
    // injection patterns. The system prompt is always server-controlled.
    const raw = body.messages;
    if (!Array.isArray(raw) || raw.length === 0) {
      return Response.json({ error: "Mensagens inválidas" }, { status: 400 });
    }

    // Injection patterns that should never appear in legitimate assistant responses
    const INJECTION_PATTERNS = [
      // English injection patterns
      /\b(system|sistema)\s*:/i,
      /\bREGRAS?\s*(INVIOLAVEIS|INVIOLÁVEIS)/i,
      /\bignore\s*(previous|all|above)\s*(instructions?|prompts?)/i,
      /\byou\s*are\s*now\b/i,
      /\bforget\s*(everything|all|your)\b/i,
      /\bnew\s*instructions?\b/i,
      /\b(act|behave|pretend)\s*as\b/i,
      // pt-BR injection patterns
      /\bignore\s*(as\s*)?(instrucoes|regras)\b/i,
      /\ba\s*partir\s*de\s*agora\s*voce\b/i,
      /\bvoce\s*(e|eh|sera)\s*(agora\s*)?(um\s*)?(meu\s*)?(medico|psiquiatra|terapeuta|doutor)/i,
      /\bresponda\s*como\s*(se\s*fosse\s*|um\s*)?(medico|psiquiatra|terapeuta)/i,
      /\bmude\s*suas?\s*(instrucoes|regras|personalidade)/i,
      /\besqueca\s*(tudo|suas?\s*(instrucoes|regras))/i,
      /\bfinja\s*(que\s*)?(e|ser)\b/i,
      /\b(agora\s*voce|de\s*agora\s*em\s*diante)\s*(e|eh|sera|pode)\s*(um\s*)?(medico|meu\s*psiquiatra)/i,
    ];

    hmacDropCount = 0;
    assistantSeq = 0;
    const validatedMessages: { role: "user" | "assistant"; content: string }[] = [];
    for (const m of raw) {
      if (typeof m !== "object" || m === null) continue;
      const role = (m as Record<string, unknown>).role;
      const content = (m as Record<string, unknown>).content;
      if (typeof content !== "string" || !content.trim()) continue;

      if (role === "user") {
        validatedMessages.push({
          role: "user",
          content: content.slice(0, 2000),
        });
      } else if (role === "assistant") {
        // Cap assistant messages at 500 chars (real responses are ~350 chars with max_tokens: 220)
        const capped = content.slice(0, 500);
        // SECURITY: Verify HMAC tag before accepting any assistant message.
        // This ensures only server-generated responses are included in LLM context.
        // Tries seq-bound tag first, then legacy (no seq) for backward compatibility.
        const tag = (m as Record<string, unknown>).tag;
        const msgSeq = (m as Record<string, unknown>).seq;
        const seqNum = typeof msgSeq === "number" ? msgSeq : undefined;
        if (typeof tag !== "string" || !verifyAssistantTurn(capped, session.userId, tag, seqNum)) {
          hmacDropCount++; // Count for telemetry
          continue; // No valid tag → drop (forged or pre-HMAC legacy message)
        }
        assistantSeq++;
        // Also scan for injection patterns as defense-in-depth
        const normalized = capped.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        const isSuspicious = INJECTION_PATTERNS.some((p) => p.test(normalized));
        if (!isSuspicious) {
          validatedMessages.push({
            role: "assistant",
            content: capped,
          });
        }
      }
      // Silently ignore any other roles (system, etc.)
    }

    // Extract user-only messages for crisis detection and Zod validation
    const userOnly = validatedMessages
      .filter((m): m is { role: "user"; content: string } => m.role === "user");

    if (userOnly.length === 0) {
      return Response.json({ error: "Nenhuma mensagem de usuário" }, { status: 400 });
    }

    const parsed = ChatInputSchema.safeParse({ messages: userOnly });
    if (!parsed.success) {
      return Response.json({ error: "Mensagens inválidas" }, { status: 400 });
    }
    userMessages = parsed.data.messages;
    // Capture ALL user texts for crisis detection BEFORE slicing.
    // This ensures EXPLICIT crisis in message 1 stays latched even after
    // 20+ messages, while CONTEXTUAL still uses its own 6-message window.
    allUserTexts = userMessages.map((m) => m.content);

    // For LLM context, use the full conversation (both roles), limited to last 40 messages
    llmConversation = validatedMessages;
    if (llmConversation.length > 40) {
      llmConversation = llmConversation.slice(-40);
    }
    // Ensure conversation starts with a user message (Anthropic API requirement)
    while (llmConversation.length > 0 && llmConversation[0].role !== "user") {
      llmConversation.shift();
    }
    // Ensure proper alternation: merge consecutive same-role messages
    const alternating: { role: "user" | "assistant"; content: string }[] = [];
    for (const msg of llmConversation) {
      if (alternating.length > 0 && alternating[alternating.length - 1].role === msg.role) {
        // Merge consecutive same-role messages
        alternating[alternating.length - 1].content += "\n" + msg.content;
      } else {
        alternating.push({ ...msg });
      }
    }
    llmConversation = alternating;
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }

  // ── LAYER 1: Deterministic crisis detection BEFORE rate limit ──
  // Scan ALL user messages (not sliced) so crisis is truly "latched" for
  // the entire conversation. detectCrisisInTexts scans ALL for EXPLICIT
  // and only the last 6 for CONTEXTUAL, so passing all is safe.
  const recentUserTexts = allUserTexts;

  const crisisResult = detectCrisisInTexts(recentUserTexts);

  if (crisisResult === "crisis") {
    // Crisis users ALWAYS get the static response, even if rate-limited
    // Fire-and-forget: NEVER block the crisis response on telemetry
    trackError({
      name: "sos_crisis_detected",
      errorType: "crisis_deterministic",
      endpoint: "sos-chat",
      extra: { turnCount: allUserTexts.length, type: "crisis" },
    });
    logChatMeta(session.userId, {
      turnCount: allUserTexts.length,
      crisisDetected: true,
      hmacDrops: hmacDropCount || undefined,
    }).catch(() => {});
    return new Response(buildCrisisStream(session.userId, assistantSeq), { headers: SSE_HEADERS });
  }

  if (crisisResult === "decompensation") {
    // Bipolar decompensation: urgent psychiatric care, not SAMU
    trackError({
      name: "sos_crisis_detected",
      errorType: "crisis_deterministic",
      endpoint: "sos-chat",
      extra: { turnCount: allUserTexts.length, type: "decompensation" },
    });
    logChatMeta(session.userId, {
      turnCount: allUserTexts.length,
      crisisDetected: true,
      decompensation: true,
      hmacDrops: hmacDropCount || undefined,
    }).catch(() => {});
    return new Response(buildDecompensationStream(session.userId, assistantSeq), { headers: SSE_HEADERS });
  }

  // ── LAYER 2: Rate limit (only for non-crisis requests) ──
  const allowed = await checkRateLimit(
    `sos_chat:${session.userId}`,
    RATE_LIMIT_MAX,
    RATE_LIMIT_WINDOW,
  );
  if (!allowed) {
    trackError({
      name: "sos_rate_limit_hit",
      errorType: "rate_limit",
      endpoint: "sos-chat",
      extra: { userId: session.userId, turnCount: allUserTexts.length },
    });
    return Response.json(
      { error: "Muitas mensagens. Aguarde alguns minutos ou ligue 188/192." },
      { status: 429 },
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // Fallback: return static support message when API unavailable
    trackError({
      name: "sos_api_key_missing",
      errorType: "config",
      endpoint: "sos-chat",
      message: "ANTHROPIC_API_KEY not set — returning static fallback",
    });
    return Response.json({
      fallback: true,
      text: "O serviço de chat está temporariamente indisponível. Se precisar de ajuda agora, ligue 192 (SAMU) ou 188 (CVV). Você também pode usar a respiração guiada ou o aterramento nesta mesma página.",
    }, { status: 200 });
  }

  // ── LAYER 3: LLM streaming response ──
  // Use the validated conversation with real assistant context.
  // The client sends both user and assistant turns; assistant turns are
  // capped at 500 chars and scanned for injection patterns (see above).
  // The alternating array already ensures proper role alternation
  // (consecutive same-role messages are merged, starts with user).
  const llmMessages = llmConversation;

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
        let fullText = "";
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            hasContent = true;
            fullText += event.delta.text;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`),
            );
          }
        }

        if (hasContent) {
          // ── LAYER 4: Post-stream response guardrail ──
          // Check the full LLM response for forbidden patterns (diagnostic
          // assertions, prescription language, suicide normalization, etc.)
          // If unsafe, send a guardrail replacement event that the client
          // uses to replace the streamed text with a safe fallback.
          const guardrailResult = checkSosResponse(fullText);
          if (!guardrailResult.safe) {
            trackError({
              name: "sos_guardrail_triggered",
              errorType: "forbidden_pattern",
              endpoint: "sos-chat",
              extra: {
                reason: guardrailResult.reason,
                matchedPattern: guardrailResult.matchedPattern,
                turnCount: userMessages.length,
              },
            });
            const nextSeq = assistantSeq;
            const fallbackTag = signAssistantTurn(SOS_GUARDRAIL_FALLBACK, session.userId, nextSeq);
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({
                guardrail: true,
                text: SOS_GUARDRAIL_FALLBACK,
                fallback: true,
              })}\n\n`),
            );
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ tag: fallbackTag, seq: nextSeq })}\n\n`),
            );
          } else {
            // Send HMAC tag + seq for the complete response so client can prove authenticity on next request
            const nextSeq = assistantSeq;
            const tag = signAssistantTurn(fullText, session.userId, nextSeq);
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ tag, seq: nextSeq })}\n\n`),
            );
          }
        }

        // Handle refusal/empty response: if Claude refused or produced no text,
        // send a safe fallback instead of leaving the user with an empty response
        if (!hasContent) {
          trackError({
            name: "sos_llm_empty_response",
            errorType: "empty_response",
            endpoint: "sos-chat",
            extra: { turnCount: userMessages.length },
          });
          const refusalMsg = "Estou aqui com você. Se precisar de ajuda imediata, ligue 192 (SAMU) ou 188 (CVV). Você também pode usar a respiração guiada aqui no app.";
          const nextSeq = assistantSeq;
          const refusalTag = signAssistantTurn(refusalMsg, session.userId, nextSeq);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ text: refusalMsg, fallback: true })}\n\n`),
          );
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ tag: refusalTag, seq: nextSeq })}\n\n`),
          );
        }
      } catch (err) {
        Sentry.captureException(err, { tags: { endpoint: "sos-chat" } });
        trackError({
          name: "sos_api_error",
          errorType: err instanceof Error ? err.constructor.name : "unknown",
          endpoint: "sos-chat",
          message: err instanceof Error ? err.message : "Unknown error",
          extra: { turnCount: userMessages.length },
        });
        streamError = true;
        // Fallback: send static support message instead of raw error
        const fallbackMsg = "Houve uma falha temporária. Enquanto isso, lembre-se: ligue 192 (SAMU) se houver risco, ou 188 (CVV) para conversar. Você também pode usar a respiração guiada aqui no app.";
        const nextSeq = assistantSeq;
        const fallbackTag = signAssistantTurn(fallbackMsg, session.userId, nextSeq);
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ text: fallbackMsg, fallback: true })}\n\n`),
        );
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ tag: fallbackTag, seq: nextSeq })}\n\n`),
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
          hmacDrops: hmacDropCount || undefined,
        }).catch(() => {});
      }
    },
  });

  return new Response(readable, { headers: SSE_HEADERS });
}
