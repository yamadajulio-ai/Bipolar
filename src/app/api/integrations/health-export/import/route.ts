import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/security";
import { parseHealthExportPayloadV2 } from "@/lib/integrations/healthExport";
import {
  mergeWearableNights,
  enrichStandaloneHrvHr,
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

  // Rate limit: 30 imports per hour per user
  if (!(await checkRateLimit(`hae_import:${session.userId}`, 30, 3600_000))) {
    return NextResponse.json({ error: "Muitas requisições" }, { status: 429 });
  }

  // Body size limit: reject payloads > 5MB to prevent memory abuse
  const contentLength = request.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > 5_000_000) {
    return NextResponse.json(
      { error: "Payload muito grande", detail: "Máximo 5MB por requisição" },
      { status: 413 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "JSON inválido" },
      { status: 400 },
    );
  }

  try {
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

    // 2. Enrich existing SleepLogs with standalone HRV/HR (transactional, canonical record only)
    // Always run enrichment — standalone HRV/HR data may cover dates not in sleepNights
    let hrvHrEnriched = 0;
    const { hrvByDate, hrByDate } = result.hrvHrData;
    if (hrvByDate.size > 0 || hrByDate.size > 0) {
      // Filter out dates that already got HRV/HR from the sleep merge above
      const mergedDates = new Set(result.sleepNights.filter((n) => n.hrv != null || n.heartRate != null).map((n) => n.date));
      const standaloneHrv = new Map([...hrvByDate].filter(([d]) => !mergedDates.has(d)));
      const standaloneHr = new Map([...hrByDate].filter(([d]) => !mergedDates.has(d)));
      if (standaloneHrv.size > 0 || standaloneHr.size > 0) {
        hrvHrEnriched = await enrichStandaloneHrvHr(
          prisma, session.userId, standaloneHrv, standaloneHr, "hae", `hae_browser_enrich_${Date.now()}`,
        );
      }
    }

    // 3. Upsert generic health metrics (batched transaction)
    let metricsImported = 0;
    if (result.genericMetrics.length > 0) {
      const metricOps = result.genericMetrics.map((gm) =>
        prisma.healthMetric.upsert({
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
        }),
      );
      await prisma.$transaction(metricOps);
      metricsImported = result.genericMetrics.length;
    }

    return NextResponse.json({
      imported: sleepImported,
      hrvHrEnriched,
      metricsImported,
      metricTypes: [...new Set(result.genericMetrics.map((m) => m.metric))],
      skippedCount: result.skippedCount,
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { endpoint: "health-export-import" } });
    return NextResponse.json(
      { error: "Erro ao processar dados importados" },
      { status: 500 },
    );
  }
}
