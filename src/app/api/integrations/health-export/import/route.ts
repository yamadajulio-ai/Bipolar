import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseHealthExportPayload } from "@/lib/integrations/healthExport";

/**
 * POST — Manual JSON import (session auth, from browser).
 * Accepts the same payload format as Health Auto Export.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();

  try {
    const body = await request.json();

    const sleepNights = parseHealthExportPayload(body);

    if (sleepNights.length === 0) {
      return NextResponse.json(
        { error: "Nenhum dado de sono encontrado no JSON. Verifique se o formato está correto." },
        { status: 400 },
      );
    }

    let imported = 0;
    for (const night of sleepNights) {
      await prisma.sleepLog.upsert({
        where: {
          userId_date: { userId: session.userId, date: night.date },
        },
        update: {
          bedtime: night.bedtime,
          wakeTime: night.wakeTime,
          totalHours: night.totalHours,
          quality: night.quality,
          awakenings: night.awakenings,
        },
        create: {
          userId: session.userId,
          date: night.date,
          bedtime: night.bedtime,
          wakeTime: night.wakeTime,
          totalHours: night.totalHours,
          quality: night.quality,
          awakenings: night.awakenings,
        },
      });
      imported++;
    }

    return NextResponse.json({ imported, nights: sleepNights });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json(
      { error: "Erro ao processar JSON", detail: message },
      { status: 500 },
    );
  }
}
