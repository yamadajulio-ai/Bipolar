import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { checkRateLimit } from "@/lib/security";

const HEADERS = { "Cache-Control": "no-store" };

const contextualSchema = z.object({
  contextKey: z.string().min(3).max(200).regex(/^[a-z_]+:.+$/),
  useful: z.boolean(),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401, headers: HEADERS });
  }

  // Rate limit: 30 por 15 min
  const allowed = await checkRateLimit(`ctx-feedback:${session.userId}`, 30, 15 * 60 * 1000);
  if (!allowed) {
    return NextResponse.json({ error: "Muitas requisições" }, { status: 429, headers: HEADERS });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400, headers: HEADERS });
  }

  const parsed = contextualSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400, headers: HEADERS });
  }

  await prisma.contextualFeedback.upsert({
    where: {
      userId_contextKey: {
        userId: session.userId,
        contextKey: parsed.data.contextKey,
      },
    },
    update: { useful: parsed.data.useful },
    create: {
      userId: session.userId,
      contextKey: parsed.data.contextKey,
      useful: parsed.data.useful,
    },
  });

  return NextResponse.json({ ok: true }, { headers: HEADERS });
}
