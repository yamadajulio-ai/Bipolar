import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

const eventSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve ser YYYY-MM-DD"),
  eventType: z.enum([
    "med_change",
    "stressor",
    "travel",
    "hospitalization",
    "therapy",
    "menstrual",
    "other",
  ]),
  label: z.string().min(1).max(200),
  notes: z.string().max(500).optional(),
});

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const days = Math.min(parseInt(searchParams.get("days") || "90", 10), 365);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const events = await prisma.lifeChartEvent.findMany({
    where: { userId: session.userId, date: { gte: cutoffStr } },
    orderBy: { date: "desc" },
  });

  return NextResponse.json(events);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = eventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const event = await prisma.lifeChartEvent.create({
    data: {
      userId: session.userId,
      date: parsed.data.date,
      eventType: parsed.data.eventType,
      label: parsed.data.label,
      notes: parsed.data.notes || null,
    },
  });

  return NextResponse.json(event, { status: 201 });
}

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

  await prisma.lifeChartEvent.deleteMany({
    where: { id, userId: session.userId },
  });

  return NextResponse.json({ ok: true });
}
