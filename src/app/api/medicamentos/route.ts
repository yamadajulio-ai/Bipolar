import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { checkRateLimit } from "@/lib/security";
import { localToday } from "@/lib/dateUtils";
import * as Sentry from "@sentry/nextjs";

const createSchema = z.object({
  name: z.string().min(1).max(100),
  dosageText: z.string().max(50).optional(),
  instructions: z.string().max(200).optional(),
  isAsNeeded: z.boolean().optional(),
  schedules: z.array(z.object({
    timeLocal: z.string().regex(/^\d{2}:\d{2}$/, "Horário deve ser HH:MM"),
  })).min(1, "Adicione pelo menos um horário"),
});

/** GET /api/medicamentos — list user's active medications with schedules */
export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  if (!(await checkRateLimit(`med_read:${session.userId}`, 60, 60_000))) {
    return NextResponse.json({ error: "Muitas requisições" }, { status: 429 });
  }

  const medications = await prisma.medication.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "asc" },
    include: {
      schedules: {
        where: { effectiveTo: null },
        orderBy: { timeLocal: "asc" },
      },
    },
  });

  return NextResponse.json(medications);
}

/** POST /api/medicamentos — create a new medication with schedules */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  if (!(await checkRateLimit(`med_write:${session.userId}`, 30, 60_000))) {
    return NextResponse.json({ error: "Muitas requisições" }, { status: 429 });
  }

  try {
    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const today = localToday();
    const medication = await prisma.medication.create({
      data: {
        userId: session.userId,
        name: parsed.data.name,
        dosageText: parsed.data.dosageText || null,
        instructions: parsed.data.instructions || null,
        isAsNeeded: parsed.data.isAsNeeded ?? false,
        startDate: today,
        schedules: {
          create: parsed.data.schedules.map((s) => ({
            timeLocal: s.timeLocal,
            effectiveFrom: today,
          })),
        },
      },
      include: {
        schedules: { orderBy: { timeLocal: "asc" } },
      },
    });

    return NextResponse.json(medication, { status: 201 });
  } catch (err) {
    Sentry.captureException(err, { tags: { endpoint: "medicamentos" } });
    return NextResponse.json({ error: "Erro ao salvar medicamento." }, { status: 500 });
  }
}
