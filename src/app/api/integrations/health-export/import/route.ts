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

    // 1. Upsert sleep nights
    let sleepImported = 0;
    for (const night of result.sleepNights) {
      const data = {
        bedtime: night.bedtime,
        wakeTime: night.wakeTime,
        totalHours: night.totalHours,
        quality: night.quality,
        awakenings: night.awakenings,
        hrv: night.hrv ?? null,
        heartRate: night.heartRate ?? null,
      };
      await prisma.sleepLog.upsert({
        where: {
          userId_date: { userId: session.userId, date: night.date },
        },
        update: data,
        create: { userId: session.userId, date: night.date, ...data },
      });
      sleepImported++;
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
        const existing = await prisma.sleepLog.findUnique({
          where: { userId_date: { userId: session.userId, date } },
        });
        if (!existing) continue;
        const updateData: Record<string, number> = {};
        if (hrv !== undefined && hrv >= 1 && hrv <= 300) updateData.hrv = hrv;
        if (hr !== undefined && hr >= 20 && hr <= 250) updateData.heartRate = hr;
        if (Object.keys(updateData).length > 0) {
          await prisma.sleepLog.update({
            where: { userId_date: { userId: session.userId, date } },
            data: updateData,
          });
          hrvHrEnriched++;
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
      });
      metricsImported++;
    }

    return NextResponse.json({
      imported: sleepImported,
      hrvHrEnriched,
      metricsImported,
      metricTypes: [...new Set(result.genericMetrics.map((m) => m.metric))],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json(
      { error: "Erro ao processar dados importados" },
      { status: 500 },
    );
  }
}
