import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { generateApiKey } from "@/lib/integrations/healthExport";
import { checkRateLimit } from "@/lib/security";
import * as Sentry from "@sentry/nextjs";

const VALID_SERVICES = ["health_auto_export", "health_connect"] as const;

const createKeySchema = z.object({
  service: z.enum(VALID_SERVICES),
});

const toggleSchema = z.object({
  service: z.enum(VALID_SERVICES),
  enabled: z.boolean(),
});

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  if (!(await checkRateLimit(`integ_settings_read:${session.userId}`, 60, 60_000))) {
    return NextResponse.json({ error: "Muitas requisições" }, { status: 429 });
  }

  try {
    const keys = await prisma.integrationKey.findMany({
      where: { userId: session.userId },
      select: { id: true, service: true, apiKey: true, enabled: true, createdAt: true },
    });

    return NextResponse.json(keys);
  } catch (err) {
    Sentry.captureException(err, { tags: { endpoint: "integ_settings" } });
    return NextResponse.json({ error: "Erro ao buscar integrações" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  if (!(await checkRateLimit(`integ_settings_write:${session.userId}`, 30, 60_000))) {
    return NextResponse.json({ error: "Muitas requisições" }, { status: 429 });
  }

  try {
    const body = await request.json();
    const parsed = createKeySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { errors: { service: ["Servico invalido"] } },
        { status: 400 },
      );
    }

    const key = await prisma.integrationKey.upsert({
      where: {
        userId_service: {
          userId: session.userId,
          service: parsed.data.service,
        },
      },
      update: {
        apiKey: generateApiKey(),
        enabled: true,
      },
      create: {
        userId: session.userId,
        service: parsed.data.service,
        apiKey: generateApiKey(),
      },
      select: { id: true, service: true, apiKey: true, enabled: true, createdAt: true },
    });

    return NextResponse.json(key, { status: 201 });
  } catch (err) {
    Sentry.captureException(err, { tags: { endpoint: "integ_settings" } });
    return NextResponse.json(
      { error: "Erro ao gerar chave de integracao." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  if (!(await checkRateLimit(`integ_settings_write:${session.userId}`, 30, 60_000))) {
    return NextResponse.json({ error: "Muitas requisições" }, { status: 429 });
  }

  try {
    const body = await request.json();
    const parsed = toggleSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { errors: { service: ["Dados invalidos"] } },
        { status: 400 },
      );
    }

    const existing = await prisma.integrationKey.findUnique({
      where: {
        userId_service: {
          userId: session.userId,
          service: parsed.data.service,
        },
      },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Integracao nao encontrada" }, { status: 404 });
    }

    const updated = await prisma.integrationKey.update({
      where: { id: existing.id },
      data: { enabled: parsed.data.enabled },
      select: { id: true, service: true, apiKey: true, enabled: true, createdAt: true },
    });

    return NextResponse.json(updated);
  } catch (err) {
    Sentry.captureException(err, { tags: { endpoint: "integ_settings" } });
    return NextResponse.json(
      { error: "Erro ao atualizar integracao." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  if (!(await checkRateLimit(`integ_settings_write:${session.userId}`, 30, 60_000))) {
    return NextResponse.json({ error: "Muitas requisições" }, { status: 429 });
  }

  try {
    const body = await request.json();
    const parsed = createKeySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { errors: { service: ["Servico invalido"] } },
        { status: 400 },
      );
    }

    await prisma.integrationKey.deleteMany({
      where: {
        userId: session.userId,
        service: parsed.data.service,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    Sentry.captureException(err, { tags: { endpoint: "integ_settings" } });
    return NextResponse.json(
      { error: "Erro ao remover integracao." },
      { status: 500 },
    );
  }
}
