import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { randomBytes, randomInt } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

const createSchema = z.object({
  label: z.string().max(100).optional(),
  expiresInDays: z.number().int().min(1).max(90).default(30),
  shareSosEvents: z.boolean().optional().default(false),
});

function generateToken(): string {
  return randomBytes(24).toString("base64url");
}

function generatePin(): string {
  return String(randomInt(100000, 1000000));
}

// GET: List active access links for current user
export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const accesses = await prisma.professionalAccess.findMany({
    where: { userId: session.userId, revokedAt: null },
    select: {
      id: true,
      token: true,
      label: true,
      expiresAt: true,
      lastAccessedAt: true,
      createdAt: true,
      accessLogs: {
        where: { action: "pin_validated" },
        select: { createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(accesses);
}

// POST: Create a new access link
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }

    // Limit to 5 active links per user
    const activeCount = await prisma.professionalAccess.count({
      where: { userId: session.userId, revokedAt: null },
    });
    if (activeCount >= 5) {
      return NextResponse.json(
        { error: "Limite de 5 acessos ativos. Revogue um antes de criar outro." },
        { status: 400 },
      );
    }

    const token = generateToken();
    const pin = generatePin();
    const pinHash = await bcrypt.hash(pin, 10);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (parsed.data.expiresInDays ?? 30));

    const access = await prisma.professionalAccess.create({
      data: {
        userId: session.userId,
        token,
        pinHash,
        label: parsed.data.label ?? null,
        expiresAt,
        shareSosEvents: parsed.data.shareSosEvents ?? false,
      },
    });

    // Return token and PIN (PIN is only shown once!)
    return NextResponse.json({
      id: access.id,
      token,
      pin,
      label: access.label,
      expiresAt: access.expiresAt,
    });
  } catch {
    return NextResponse.json({ error: "Erro ao criar acesso" }, { status: 500 });
  }
}

// DELETE: Revoke an access link
export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });
  }

  const access = await prisma.professionalAccess.findFirst({
    where: { id, userId: session.userId, revokedAt: null },
  });
  if (!access) {
    return NextResponse.json({ error: "Acesso não encontrado" }, { status: 404 });
  }

  await prisma.professionalAccess.update({
    where: { id },
    data: { revokedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
