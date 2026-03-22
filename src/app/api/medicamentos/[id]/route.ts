import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { checkRateLimit } from "@/lib/security";
import { localToday } from "@/lib/dateUtils";
import * as Sentry from "@sentry/nextjs";

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  dosageText: z.string().max(50).optional(),
  instructions: z.string().max(200).optional(),
  isAsNeeded: z.boolean().optional(),
  isActive: z.boolean().optional(),
  schedules: z.array(z.object({
    timeLocal: z.string().regex(/^\d{2}:\d{2}$/, "Horário deve ser HH:MM"),
  })).min(1).optional(),
});

/** PATCH /api/medicamentos/[id] — update medication */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  if (!(await checkRateLimit(`med_write:${session.userId}`, 30, 60_000))) {
    return NextResponse.json({ error: "Muitas requisições" }, { status: 429 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    // Verify ownership
    const existing = await prisma.medication.findFirst({
      where: { id, userId: session.userId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Medicamento não encontrado" }, { status: 404 });
    }

    const today = localToday();

    // If deactivating, set endDate
    const updateData: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
    if (parsed.data.dosageText !== undefined) updateData.dosageText = parsed.data.dosageText;
    if (parsed.data.instructions !== undefined) updateData.instructions = parsed.data.instructions;
    if (parsed.data.isAsNeeded !== undefined) updateData.isAsNeeded = parsed.data.isAsNeeded;
    if (parsed.data.isActive !== undefined) {
      updateData.isActive = parsed.data.isActive;
      if (!parsed.data.isActive) updateData.endDate = today;
    }

    // If schedules changed, end old ones and create new (effective tomorrow)
    if (parsed.data.schedules) {
      // End current schedules
      await prisma.medicationSchedule.updateMany({
        where: { medicationId: id, effectiveTo: null },
        data: { effectiveTo: today },
      });

      // Create new schedules effective from tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

      await prisma.medicationSchedule.createMany({
        data: parsed.data.schedules.map((s) => ({
          medicationId: id,
          timeLocal: s.timeLocal,
          effectiveFrom: tomorrowStr,
        })),
      });
    }

    const updated = await prisma.medication.update({
      where: { id },
      data: updateData,
      include: {
        schedules: {
          where: { effectiveTo: null },
          orderBy: { timeLocal: "asc" },
        },
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    Sentry.captureException(err, { tags: { endpoint: "medicamentos_update" } });
    return NextResponse.json({ error: "Erro ao atualizar medicamento." }, { status: 500 });
  }
}

/** DELETE /api/medicamentos/[id] — deactivate (soft delete) medication */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.medication.findFirst({
    where: { id, userId: session.userId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Medicamento não encontrado" }, { status: 404 });
  }

  const today = localToday();

  await prisma.$transaction([
    prisma.medication.update({
      where: { id },
      data: { isActive: false, endDate: today },
    }),
    prisma.medicationSchedule.updateMany({
      where: { medicationId: id, effectiveTo: null },
      data: { effectiveTo: today },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
