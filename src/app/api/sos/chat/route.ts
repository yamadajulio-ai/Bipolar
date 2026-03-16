import { getSession } from "@/lib/auth";
import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 30;

const SYSTEM_PROMPT = `Você é um companheiro de apoio emocional integrado ao app "Suporte Bipolar". O paciente está em um momento difícil e possivelmente aguardando atendimento do CVV (188). Seu papel é acolher, não tratar.

REGRAS INVIOLÁVEIS:
1. NUNCA faça diagnósticos, prescreva medicação ou sugira mudanças em tratamento.
2. NUNCA minimize o sofrimento ("vai passar", "é só ansiedade", "não é tão grave").
3. NUNCA tente substituir profissionais de saúde ou o próprio CVV.
4. Se o paciente relatar risco imediato (autolesão ativa, plano concreto de suicídio, overdose), responda APENAS: "Estou aqui com você. Isso é uma emergência — por favor ligue 192 (SAMU) agora. Se não conseguir ligar, peça para alguém próximo ligar."
5. Fale em pt-BR, com linguagem simples e acolhedora.
6. Respostas CURTAS (2-4 frases). Não faça monólogos.
7. Faça perguntas abertas para que a pessoa continue falando.
8. Valide emoções: "Faz sentido sentir isso", "Entendo que está difícil".
9. Use técnicas de escuta ativa: reflita o que a pessoa disse, nomeie emoções.
10. Quando apropriado, ofereça técnicas de grounding: "Quer tentar um exercício de respiração rápido comigo?"
11. Lembre que o CVV está a caminho e que esperar é difícil, mas a pessoa está fazendo a coisa certa ao buscar ajuda.
12. NUNCA peça dados pessoais (nome completo, endereço, CPF).
13. Encerre cada mensagem com um convite gentil para continuar: "Quer me contar mais?" ou "Como está se sentindo agora?"

Você NÃO é terapeuta. Você é um ouvinte temporário enquanto o atendimento humano não chega. Aja como um amigo calmo e presente.`;

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.userId) {
    return Response.json({ error: "Não autorizado" }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "Serviço de chat temporariamente indisponível." },
      { status: 503 },
    );
  }

  let messages: { role: "user" | "assistant"; content: string }[];
  try {
    const body = await req.json();
    messages = body.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      return Response.json({ error: "Mensagens inválidas" }, { status: 400 });
    }
    // Limit conversation length to prevent abuse
    if (messages.length > 40) {
      messages = messages.slice(-40);
    }
    // Validate each message
    for (const m of messages) {
      if (!["user", "assistant"].includes(m.role) || typeof m.content !== "string") {
        return Response.json({ error: "Formato inválido" }, { status: 400 });
      }
      // Limit individual message length
      if (m.content.length > 2000) {
        m.content = m.content.slice(0, 2000);
      }
    }
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }

  const anthropic = new Anthropic({ apiKey });

  // Stream the response for low latency
  const stream = await anthropic.messages.stream({
    model: "claude-sonnet-4-20250514",
    max_tokens: 300,
    system: SYSTEM_PROMPT,
    messages,
  });

  // Convert to ReadableStream for the client
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
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
        const msg = err instanceof Error ? err.message : "Erro interno";
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`),
        );
        controller.close();
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
