import { getSession } from "@/lib/auth";
import { checkRateLimit } from "@/lib/security";
import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 30;

// ── Deterministic crisis keyword detection (pt-BR) ──────────────
// Patterns match common expressions of suicidal ideation, self-harm,
// active plans, means, intoxication and farewell in Brazilian Portuguese.
// This runs BEFORE the LLM and short-circuits to a safe static response.

const CRISIS_PATTERNS: RegExp[] = [
  // Suicidal ideation
  /\b(me\s*matar|quero\s*morrer|vou\s*morrer|desejo\s*de\s*morrer|penso\s*em\s*morrer)\b/i,
  /\b(acabar\s*com\s*tudo|por\s*fim\s*(a|em)\s*tudo|encerrar\s*tudo)\b/i,
  /\b(não\s*aguento\s*mais\s*viver|cansad[oa]\s*de\s*viver|sem\s*razão\s*(pra|para)\s*viver)\b/i,
  /\b(queria?\s*sumir|quero\s*desaparecer|melhor\s*sem\s*mim)\b/i,
  // Self-harm
  /\b(me\s*cortar|me\s*machucar|auto\s*lesão|autolesão|me\s*ferir)\b/i,
  /\b(estou\s*sangrando|me\s*cortei|tomei\s*remédios?\s*todos?)\b/i,
  // Means / plan
  /\b(pular\s*d[aeo]|me\s*jogar|me\s*enforcar|corda|veneno|arma)\b/i,
  /\b(overdose|tomar\s*tudo|engolir\s*comprimidos?)\b/i,
  /\b(comprei\s*(uma\s*)?arma|tenho\s*um\s*plano)\b/i,
  // Intoxication
  /\b(estou\s*bêbad[oa]|bebi\s*muito|misturei\s*remédio|misturei\s*álcool)\b/i,
  // Farewell
  /\b(carta\s*de\s*despedida|adeus\s*pra\s*sempre|testamento)\b/i,
  /\b(cuidem?\s*d[aeo]s?\s*meu[s]?\s*(filh|pet|gat|cachorr))/i,
];

const CRISIS_RESPONSE = "Estou aqui com você. Isso é uma emergência — por favor ligue 192 (SAMU) agora. Se não conseguir ligar, peça para alguém próximo ligar. O CVV também está disponível no 188. Você não está sozinho(a).";

function detectCrisis(text: string): boolean {
  const normalized = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const original = text.toLowerCase();
  return CRISIS_PATTERNS.some((p) => p.test(original) || p.test(normalized));
}

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

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.userId) {
    return Response.json({ error: "Não autorizado" }, { status: 401 });
  }

  // Rate limit: 30 requests per 15 minutes
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
    // Fallback: return static crisis response when API unavailable
    return Response.json({
      fallback: true,
      text: "O serviço de chat está temporariamente indisponível. Se precisar de ajuda agora, ligue 192 (SAMU) ou 188 (CVV). Você também pode usar a respiração guiada ou o aterramento nesta mesma página.",
    }, { status: 200 });
  }

  let messages: { role: "user" | "assistant"; content: string }[];
  try {
    const body = await req.json();
    messages = body.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      return Response.json({ error: "Mensagens inválidas" }, { status: 400 });
    }
    if (messages.length > 40) {
      messages = messages.slice(-40);
    }
    for (const m of messages) {
      if (!["user", "assistant"].includes(m.role) || typeof m.content !== "string") {
        return Response.json({ error: "Formato inválido" }, { status: 400 });
      }
      if (m.content.length > 2000) {
        m.content = m.content.slice(0, 2000);
      }
    }
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }

  // ── Deterministic crisis detection on latest user message ──
  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
  if (lastUserMsg && detectCrisis(lastUserMsg.content)) {
    await logChatMeta(session.userId, {
      turnCount: messages.length,
      crisisDetected: true,
    });

    // Return static clinically-approved response, bypass LLM
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ text: CRISIS_RESPONSE })}\n\n`),
        );
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-store",
        Connection: "keep-alive",
      },
    });
  }

  // ── LLM streaming response ──
  const startMs = Date.now();
  const modelId = "claude-sonnet-4-20250514";
  const anthropic = new Anthropic({ apiKey });

  let streamError: string | undefined;

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        const stream = await anthropic.messages.stream({
          model: modelId,
          max_tokens: 300,
          system: SYSTEM_PROMPT,
          messages,
        });

        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`),
            );
          }
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (err) {
        streamError = err instanceof Error ? err.message : "Erro interno";
        // Fallback: send static support message instead of raw error
        const fallbackMsg = "Houve uma falha temporária. Enquanto isso, lembre-se: ligue 192 (SAMU) se houver risco, ou 188 (CVV) para conversar. Você também pode usar a respiração guiada aqui no app.";
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ text: fallbackMsg, fallback: true })}\n\n`),
        );
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } finally {
        // Log minimal metadata (no transcripts)
        logChatMeta(session.userId, {
          turnCount: messages.length,
          crisisDetected: false,
          durationMs: Date.now() - startMs,
          error: !!streamError,
        }).catch(() => {});
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-store",
      Connection: "keep-alive",
    },
  });
}
