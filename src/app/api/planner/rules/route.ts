import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

const rulesSchema = z.object({
  lateEventCutoffMin: z.number().int().min(0).max(1440).optional(),
  windDownMin: z.number().int().min(0).max(240).optional(),
  minBufferBeforeSleep: z.number().int().min(0).max(240).optional(),
  maxLateNightsPerWeek: z.number().int().min(0).max(7).optional(),
  protectAnchors: z.boolean().optional(),
  targetSleepTimeMin: z.number().int().min(0).max(1440).nullable().optional(),
  targetWakeTimeMin: z.number().int().min(0).max(1440).nullable().optional(),
});

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  let rules = await prisma.stabilityRule.findUnique({
    where: { userId: session.userId },
  });

  if (!rules) {
    rules = await prisma.stabilityRule.create({
      data: { userId: session.userId },
    });
  }

  return NextResponse.json(rules);
}

export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = rulesSchema.safeParse(body);

    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path?.[0] || "geral");
        if (!fieldErrors[key]) fieldErrors[key] = [];
        fieldErrors[key].push(issue.message);
      }
      return NextResponse.json({ errors: fieldErrors }, { status: 400 });
    }

    const rules = await prisma.stabilityRule.upsert({
      where: { userId: session.userId },
      update: {
        ...(parsed.data.lateEventCutoffMin !== undefined && { lateEventCutoffMin: parsed.data.lateEventCutoffMin }),
        ...(parsed.data.windDownMin !== undefined && { windDownMin: parsed.data.windDownMin }),
        ...(parsed.data.minBufferBeforeSleep !== undefined && { minBufferBeforeSleep: parsed.data.minBufferBeforeSleep }),
        ...(parsed.data.maxLateNightsPerWeek !== undefined && { maxLateNightsPerWeek: parsed.data.maxLateNightsPerWeek }),
        ...(parsed.data.protectAnchors !== undefined && { protectAnchors: parsed.data.protectAnchors }),
        ...(parsed.data.targetSleepTimeMin !== undefined && { targetSleepTimeMin: parsed.data.targetSleepTimeMin }),
        ...(parsed.data.targetWakeTimeMin !== undefined && { targetWakeTimeMin: parsed.data.targetWakeTimeMin }),
      },
      create: {
        userId: session.userId,
        ...parsed.data,
      },
    });

    return NextResponse.json(rules);
  } catch {
    return NextResponse.json(
      { error: "Erro ao salvar regras." },
      { status: 500 },
    );
  }
}
