import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseHealthExportPayloadV2 } from "@/lib/integrations/healthExport";

/**
 * POST — Manual JSON import (session auth, from browser).
 * Accepts the same payload format as Health Auto Export.
 * The frontend chunks large payloads and sends multiple requests.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const body = await request.json();

    const result = parseHealthExportPayloadV2(body);

    const hasAnyData =
      result.sleepNights.length > 0 ||
      result.hrvHrData.hrvByDate.size > 0 ||
      result.hrvHrData.hrByDate.size > 0 ||
      result.genericMetrics.length > 0;

    if (!hasAnyData) {
      return NextResponse.json(
        { error: "Nenhum dado reconhecido no JSON. Verifique se o formato esta correto." },
        { status: 400 },
      );
    }

    // 1. Delete stale records for affected dates, then create fresh ones.
    //    Wrapped in a transaction to prevent orphaned records.
    let sleepImported = 0;
    if (result.sleepNights.length > 0) {
      const affectedDates = [...new Set(result.sleepNights.map((n) => n.date))];
      const sleepOps = [
        prisma.sleepLog.deleteMany({
          where: { userId: session.userId, date: { in: affectedDates } },
        }),
        ...result.sleepNights.map((night) =>
          prisma.sleepLog.create({
            data: {
              userId: session.userId,
              date: night.date,
              bedtime: night.bedtime,
              wakeTime: night.wakeTime,
              totalHours: night.totalHours,
              quality: night.quality,
              awakenings: night.awakenings,
              awakeMinutes: night.awakeMinutes,
              hrv: night.hrv ?? null,
              heartRate: night.heartRate ?? null,
            },
            select: { id: true },
          }),
        ),
      ];
      await prisma.$transaction(sleepOps);
      sleepImported = result.sleepNights.length;
    }

    // 2. Enrich existing SleepLogs with standalone HRV/HR
    let hrvHrEnriched = 0;
    if (result.sleepNights.length === 0) {
      const { hrvByDate, hrByDate } = result.hrvHrData;
      const allDates = new Set([...hrvByDate.keys(), ...hrByDate.keys()]);
      for (const date of allDates) {
        const hrv = hrvByDate.get(date);
        const hr = hrByDate.get(date);
        if (hrv === undefined && hr === undefined) continue;
        const updateData: Record<string, number> = {};
        if (hrv !== undefined && hrv >= 1 && hrv <= 300) updateData.hrv = hrv;
        if (hr !== undefined && hr >= 20 && hr <= 250) updateData.heartRate = hr;
        if (Object.keys(updateData).length > 0) {
          const updated = await prisma.sleepLog.updateMany({
            where: { userId: session.userId, date },
            data: updateData,
          });
          if (updated.count > 0) hrvHrEnriched++;
        }
      }
    }

    // 3. Upsert generic health metrics
    let metricsImported = 0;
    for (const gm of result.genericMetrics) {
      await prisma.healthMetric.upsert({
        where: {
          userId_date_metric: {
            userId: session.userId,
            date: gm.date,
            metric: gm.metric,
          },
        },
        update: { value: gm.value, unit: gm.unit },
        create: {
          userId: session.userId,
          date: gm.date,
          metric: gm.metric,
          value: gm.value,
          unit: gm.unit,
        },
        select: { id: true },
      });
      metricsImported++;
    }

    return NextResponse.json({
      imported: sleepImported,
      hrvHrEnriched,
      metricsImported,
      metricTypes: [...new Set(result.genericMetrics.map((m) => m.metric))],
      skippedCount: result.skippedCount,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json(
      { error: "Erro ao processar dados importados" },
      { status: 500 },
    );
  }
}
