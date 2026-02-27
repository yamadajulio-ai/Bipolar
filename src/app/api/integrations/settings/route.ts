import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { generateApiKey } from "@/lib/integrations/healthExport";

const VALID_SERVICES = ["health_auto_export"] as const;

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
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const keys = await prisma.integrationKey.findMany({
    where: { userId: session.userId },
    select: { id: true, service: true, apiKey: true, enabled: true, createdAt: true },
  });

  return NextResponse.json(keys);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
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
    });

    return NextResponse.json(key, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Erro ao gerar chave de integracao." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
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
    });

    if (!existing) {
      return NextResponse.json({ error: "Integracao nao encontrada" }, { status: 404 });
    }

    const updated = await prisma.integrationKey.update({
      where: { id: existing.id },
      data: { enabled: parsed.data.enabled },
    });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json(
      { error: "Erro ao atualizar integracao." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
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
  } catch {
    return NextResponse.json(
      { error: "Erro ao remover integracao." },
      { status: 500 },
    );
  }
}
