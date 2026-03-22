import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { checkRateLimit } from "@/lib/security";
import { localToday } from "@/lib/dateUtils";

export type MedicationDayState = "COMPLETE" | "PARTIAL" | "NONE" | "PENDING" | "NOT_TRACKED" | "LEGACY";

export interface DoseStatus {
  scheduleId: string;
  medicationName: string;
  dosageText: string | null;
  timeLocal: string;
  status: "TAKEN" | "MISSED" | "PENDING";
  isOverdue: boolean;
}

export interface MedicationDaySummary {
  date: string;
  state: MedicationDayState;
  expected: number;
  taken: number;
  missed: number;
  pending: number;
  doses: DoseStatus[];
}

/** GET /api/medicamentos/summary?date=YYYY-MM-DD — day summary for check-in */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  if (!(await checkRateLimit(`med_summary:${session.userId}`, 60, 60_000))) {
    return NextResponse.json({ error: "Muitas requisições" }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") || localToday();

  // Get active non-SOS medications with schedules valid for this date
  const medications = await prisma.medication.findMany({
    where: {
      userId: session.userId,
      isActive: true,
      isAsNeeded: false,
      startDate: { lte: date },
      OR: [{ endDate: null }, { endDate: { gte: date } }],
    },
    include: {
      schedules: {
        where: {
          effectiveFrom: { lte: date },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: date } }],
        },
        orderBy: { timeLocal: "asc" },
      },
    },
  });

  if (medications.length === 0) {
    const summary: MedicationDaySummary = {
      date,
      state: "NOT_TRACKED",
      expected: 0,
      taken: 0,
      missed: 0,
      pending: 0,
      doses: [],
    };
    return NextResponse.json(summary);
  }

  // Get existing logs for this date
  const allScheduleIds = medications.flatMap((m) => m.schedules.map((s) => s.id));
  const logs = await prisma.medicationLog.findMany({
    where: { userId: session.userId, date, scheduleId: { in: allScheduleIds } },
  });
  const logMap = new Map(logs.map((l) => [l.scheduleId, l]));

  // Get current time in user timezone to determine overdue
  const nowStr = new Date().toLocaleTimeString("en-GB", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const isToday = date === localToday();

  // Build dose statuses
  const doses: DoseStatus[] = [];
  for (const med of medications) {
    for (const schedule of med.schedules) {
      const log = logMap.get(schedule.id);
      const status = log ? log.status : "PENDING";
      const isOverdue = isToday && status === "PENDING" && schedule.timeLocal <= nowStr;

      doses.push({
        scheduleId: schedule.id,
        medicationName: med.name,
        dosageText: med.dosageText,
        timeLocal: schedule.timeLocal,
        status,
        isOverdue,
      });
    }
  }

  // Sort: overdue first, then by time
  doses.sort((a, b) => {
    if (a.isOverdue && !b.isOverdue) return -1;
    if (!a.isOverdue && b.isOverdue) return 1;
    if (a.status === "PENDING" && b.status !== "PENDING") return -1;
    if (a.status !== "PENDING" && b.status === "PENDING") return 1;
    return a.timeLocal.localeCompare(b.timeLocal);
  });

  const taken = doses.filter((d) => d.status === "TAKEN").length;
  const missed = doses.filter((d) => d.status === "MISSED").length;
  const pending = doses.filter((d) => d.status === "PENDING").length;
  const expected = doses.length;

  let state: MedicationDayState;
  if (taken === expected) state = "COMPLETE";
  else if (taken === 0 && missed === 0) state = "PENDING";
  else if (taken === 0 && missed > 0) state = "NONE";
  else state = "PARTIAL";

  const summary: MedicationDaySummary = { date, state, expected, taken, missed, pending, doses };
  return NextResponse.json(summary);
}
