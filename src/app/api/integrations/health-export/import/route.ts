import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseHealthExportPayloadV2 } from "@/lib/integrations/healthExport";
import {
  findBestMatch,
  computeAbsoluteTimestamps,
  computeRawHash,
  reconcileWearableIntoExisting,
  withSerializableTransaction,
  type ExistingRecord,
} from "@/lib/sleepMerge";

// Fields to select for merge comparison
const MERGE_SELECT = {
  id: true,
  date: true,
  bedtime: true,
  wakeTime: true,
  bedtimeAt: true,
  wakeTimeAt: true,
  totalHours: true,
  quality: true,
  perceivedQuality: true,
  awakenings: true,
  awakeMinutes: true,
  hrv: true,
  heartRate: true,
  excluded: true,
  source: true,
  fieldProvenance: true,
  providerRecordId: true,
  rawHash: true,
  preRoutine: true,
  notes: true,
  mergeLog: true,
} as const;

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

    // 1. Smart merge sleep nights — Serializable transaction (read→match→reconcile→write atomic)
    let sleepImported = 0;
    if (result.sleepNights.length > 0) {
      const importBatchId = `hae_browser_${Date.now()}`;
      const affectedDates = [...new Set(result.sleepNights.map((n) => n.date))];

      await withSerializableTransaction(prisma, async (tx) => {
        const txPrisma = tx as typeof prisma;

        // Fetch ALL existing records for affected dates (not just manual)
        const existingRecords = await txPrisma.sleepLog.findMany({
          where: { userId: session.userId, date: { in: affectedDates } },
          select: MERGE_SELECT,
        });

        // Group by date
        const existingByDate = new Map<string, typeof existingRecords>();
        for (const rec of existingRecords) {
          const list = existingByDate.get(rec.date) || [];
          list.push(rec);
          existingByDate.set(rec.date, list);
        }

        const consumedIds = new Set<string>();

        for (const night of result.sleepNights) {
          const dateRecords = (existingByDate.get(night.date) || []).filter((r) => !consumedIds.has(r.id));
          const { bedtimeAt, wakeTimeAt } = computeAbsoluteTimestamps(night.date, night.bedtime, night.wakeTime);

          // Find best match (checks fieldProvenance, not just source)
          const matchResult = findBestMatch(
            { bedtime: night.bedtime, bedtimeAt, wakeTimeAt },
            dateRecords,
          );

          const existingRecord = matchResult?.match as ExistingRecord | undefined ?? null;
          if (existingRecord) consumedIds.add(existingRecord.id);

          const rawHash = computeRawHash({
            date: night.date, bedtime: night.bedtime, wakeTime: night.wakeTime,
            totalHours: night.totalHours, quality: night.quality,
          });

          const reconciled = reconcileWearableIntoExisting(
            {
              bedtime: night.bedtime,
              wakeTime: night.wakeTime,
              totalHours: night.totalHours,
              quality: night.quality,
              awakenings: night.awakenings,
              awakeMinutes: night.awakeMinutes,
              hrv: night.hrv,
              heartRate: night.heartRate,
              hasStages: night.hasStages ?? true,
              providerRecordId: night.providerRecordId,
              rawHash,
            },
            existingRecord,
            night.date,
            "hae",
            importBatchId,
            matchResult?.overlapScore,
          );

          for (const op of reconciled.operations) {
            if (op.type === "delete") {
              await txPrisma.sleepLog.delete({ where: { id: op.id } });
            }
          }

          // Delete stale wearable records overlapping this night
          const staleWearable = dateRecords.filter(
            (r) => r.id !== existingRecord?.id && !consumedIds.has(r.id) &&
              r.source !== "manual" && r.source !== "unknown_legacy" &&
              findBestMatch({ bedtime: night.bedtime, bedtimeAt, wakeTimeAt }, [r]) !== null,
          );
          for (const stale of staleWearable) {
            consumedIds.add(stale.id);
            await txPrisma.sleepLog.delete({ where: { id: stale.id } });
          }

          await txPrisma.sleepLog.upsert({
            where: {
              userId_date_bedtime: {
                userId: session.userId,
                date: night.date,
                bedtime: night.bedtime,
              },
            },
            update: reconciled.data as any, // eslint-disable-line @typescript-eslint/no-explicit-any
            create: { userId: session.userId, date: night.date, ...reconciled.data } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
            select: { id: true },
          });
        }
      });

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
    return NextResponse.json(
      { error: "Erro ao processar dados importados" },
      { status: 500 },
    );
  }
}
