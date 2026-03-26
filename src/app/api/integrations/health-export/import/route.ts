import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseHealthExportPayloadV2 } from "@/lib/integrations/healthExport";
import { bedtimesOverlap, mergeWearableIntoManual } from "@/lib/sleepMerge";

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

    // 1. Smart merge: preserve manual subjective data instead of delete-all
    let sleepImported = 0;
    if (result.sleepNights.length > 0) {
      const affectedDates = [...new Set(result.sleepNights.map((n) => n.date))];

      // Fetch all existing records for affected dates
      const existingRecords = await prisma.sleepLog.findMany({
        where: { userId: session.userId, date: { in: affectedDates } },
        select: {
          id: true,
          date: true,
          bedtime: true,
          source: true,
          quality: true,
          preRoutine: true,
          notes: true,
          excluded: true,
        },
      });

      // Build a lookup: date → records[]
      const existingByDate = new Map<string, typeof existingRecords>();
      for (const rec of existingRecords) {
        const list = existingByDate.get(rec.date) || [];
        list.push(rec);
        existingByDate.set(rec.date, list);
      }

      // Track which existing record IDs are consumed by a merge
      const consumedIds = new Set<string>();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const txOps: any[] = [];

      for (const night of result.sleepNights) {
        const dateRecords = existingByDate.get(night.date) || [];

        // Find a manual record with overlapping bedtime (±30min)
        const manualMatch = dateRecords.find(
          (r) => r.source === "manual" && !consumedIds.has(r.id) && bedtimesOverlap(night.bedtime, r.bedtime),
        );

        let wearableData: Record<string, unknown> = {
          bedtime: night.bedtime,
          wakeTime: night.wakeTime,
          totalHours: night.totalHours,
          quality: night.quality,
          awakenings: night.awakenings,
          awakeMinutes: night.awakeMinutes,
          hrv: night.hrv ?? null,
          heartRate: night.heartRate ?? null,
          source: "hae",
        };

        if (manualMatch) {
          // Merge: wearable objective + manual subjective
          consumedIds.add(manualMatch.id);
          wearableData = mergeWearableIntoManual(
            wearableData,
            {
              quality: manualMatch.quality,
              preRoutine: manualMatch.preRoutine,
              notes: manualMatch.notes,
              excluded: manualMatch.excluded,
            },
            true, // HAE always has real timing data
          );

          // Delete the old manual record if bedtime differs (will be recreated with wearable timing)
          if (manualMatch.bedtime !== night.bedtime) {
            txOps.push(
              prisma.sleepLog.delete({ where: { id: manualMatch.id } }),
            );
          }
        }

        // Also delete any stale wearable records for this date+bedtime overlap
        const staleWearable = dateRecords.filter(
          (r) => r.source !== "manual" && !consumedIds.has(r.id) && bedtimesOverlap(night.bedtime, r.bedtime),
        );
        for (const stale of staleWearable) {
          consumedIds.add(stale.id);
          txOps.push(prisma.sleepLog.delete({ where: { id: stale.id } }));
        }

        // Upsert the merged record
        txOps.push(
          prisma.sleepLog.upsert({
            where: {
              userId_date_bedtime: {
                userId: session.userId,
                date: night.date,
                bedtime: night.bedtime,
              },
            },
            update: wearableData as any, // eslint-disable-line @typescript-eslint/no-explicit-any
            create: { userId: session.userId, date: night.date, ...wearableData } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
            select: { id: true },
          }),
        );
      }

      await prisma.$transaction(txOps);
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
