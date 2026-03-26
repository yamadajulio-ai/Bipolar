import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseHealthExportPayloadV2 } from "@/lib/integrations/healthExport";
import {
  mergeWearableNights,
  safeParseProvenance,
  type WearableNight,
} from "@/lib/sleepMerge";

/**
 * POST — Manual JSON import (session auth, from browser).
 * Accepts the same payload format as Health Auto Export.
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

    // 1. Smart merge sleep nights — shared helper (Serializable tx, stale purge, provenance)
    let sleepImported = 0;
    if (result.sleepNights.length > 0) {
      const nights: WearableNight[] = result.sleepNights.map((n) => ({
        date: n.date, bedtime: n.bedtime, wakeTime: n.wakeTime,
        totalHours: n.totalHours, quality: n.quality,
        awakenings: n.awakenings, awakeMinutes: n.awakeMinutes,
        hrv: n.hrv, heartRate: n.heartRate,
        hasStages: n.hasStages ?? true,
        providerRecordId: n.providerRecordId,
      }));
      await mergeWearableNights(prisma, session.userId, nights, "hae", `hae_browser_${Date.now()}`);
      sleepImported = result.sleepNights.length;
    }

    // 2. Enrich existing SleepLogs with standalone HRV/HR (with provenance tracking)
    let hrvHrEnriched = 0;
    if (result.sleepNights.length === 0) {
      const { hrvByDate, hrByDate } = result.hrvHrData;
      const allDates = [...new Set([...hrvByDate.keys(), ...hrByDate.keys()])];

      if (allDates.length > 0) {
        // Fetch records with provenance so we can update it per-record
        const existingLogs = await prisma.sleepLog.findMany({
          where: { userId: session.userId, date: { in: allDates } },
          select: { id: true, date: true, fieldProvenance: true },
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const enrichOps: any[] = [];
        const enrichedDates = new Set<string>();

        for (const log of existingLogs) {
          const hrv = hrvByDate.get(log.date);
          const hr = hrByDate.get(log.date);
          const updateData: Record<string, unknown> = {};
          if (hrv !== undefined && hrv >= 1 && hrv <= 300) updateData.hrv = hrv;
          if (hr !== undefined && hr >= 20 && hr <= 250) updateData.heartRate = hr;

          if (Object.keys(updateData).length > 0) {
            // Update fieldProvenance to track wearable source for enriched biometrics
            const fp = safeParseProvenance(log.fieldProvenance);
            if (updateData.hrv !== undefined) fp.hrv = "hae";
            if (updateData.heartRate !== undefined) fp.heartRate = "hae";
            updateData.fieldProvenance = JSON.stringify(fp);

            enrichOps.push(
              prisma.sleepLog.update({
                where: { id: log.id },
                data: updateData,
              }),
            );
            enrichedDates.add(log.date);
          }
        }

        if (enrichOps.length > 0) await prisma.$transaction(enrichOps);
        hrvHrEnriched = enrichedDates.size;
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
    return NextResponse.json(
      { error: "Erro ao processar dados importados" },
      { status: 500 },
    );
  }
}
