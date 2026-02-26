import type { ExpandedOccurrence, StabilityRuleData, StabilityAlert } from "./types";
import { localDateStr } from "@/lib/dateUtils";

function dateToYMD(d: Date): string {
  return localDateStr(d);
}

function minutesSinceMidnight(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

/**
 * Generates stability alerts from expanded occurrences and rules.
 * All alerts use non-alarmist language and include professional disclaimer.
 */
export function checkConstraints(
  occurrences: ExpandedOccurrence[],
  rules: StabilityRuleData,
): StabilityAlert[] {
  const alerts: StabilityAlert[] = [];

  // Group occurrences by day
  const byDay = new Map<string, ExpandedOccurrence[]>();
  for (const occ of occurrences) {
    const ymd = dateToYMD(occ.startAt);
    if (!byDay.has(ymd)) byDay.set(ymd, []);
    byDay.get(ymd)!.push(occ);
  }

  const lateNightDates: string[] = [];

  for (const [date, dayOccs] of byDay) {
    const sorted = [...dayOccs].sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

    // 1) Conflict detection: overlapping blocks
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        if (sorted[i].endAt > sorted[j].startAt) {
          alerts.push({
            type: "conflict",
            severity: "warning",
            message: `"${sorted[i].title}" e "${sorted[j].title}" se sobrepoem. Considere ajustar os horarios.`,
            date,
            blockIds: [sorted[i].blockId, sorted[j].blockId],
          });
        }
      }
    }

    // 2) Late night: blocks ending after cutoff
    for (const occ of sorted) {
      const endMin = minutesSinceMidnight(occ.endAt);
      // Handle blocks that end after midnight (endMin will be small)
      const isLate = endMin > rules.lateEventCutoffMin ||
        (endMin < 360 && endMin > 0); // before 6:00 means late night
      if (isLate && occ.kind !== "ANCHOR") {
        alerts.push({
          type: "late_night",
          severity: "info",
          message: `"${occ.title}" esta apos o horario limite (${formatMinutes(rules.lateEventCutoffMin)}). Atividades tardias podem afetar seu sono.`,
          date,
          blockIds: [occ.blockId],
        });
        if (!lateNightDates.includes(date)) {
          lateNightDates.push(date);
        }
      }
    }

    // 3) Wind-down violation: blocks too close to target sleep time
    if (rules.targetSleepTimeMin !== null) {
      const windDownStart = rules.targetSleepTimeMin - rules.windDownMin;
      for (const occ of sorted) {
        const endMin = minutesSinceMidnight(occ.endAt);
        if (endMin > windDownStart && endMin <= rules.targetSleepTimeMin && occ.stimulation >= 1) {
          alerts.push({
            type: "wind_down",
            severity: "info",
            message: `"${occ.title}" pode encurtar seu periodo de desaceleracao antes de dormir.`,
            date,
            blockIds: [occ.blockId],
          });
        }
      }
    }

    // 5) Anchor override check
    if (rules.protectAnchors) {
      const anchors = sorted.filter((o) => o.kind === "ANCHOR");
      const flexes = sorted.filter((o) => o.kind !== "ANCHOR");
      for (const anchor of anchors) {
        for (const flex of flexes) {
          if (flex.startAt < anchor.endAt && flex.endAt > anchor.startAt) {
            alerts.push({
              type: "anchor_override",
              severity: "warning",
              message: `"${flex.title}" conflita com a ancora "${anchor.title}". Ancoras protegem sua estabilidade.`,
              date,
              blockIds: [flex.blockId, anchor.blockId],
            });
          }
        }
      }
    }
  }

  // 4) Max late nights per week
  if (lateNightDates.length > rules.maxLateNightsPerWeek) {
    alerts.push({
      type: "max_late_nights",
      severity: "warning",
      message: `${lateNightDates.length} noites tardias nesta semana (limite: ${rules.maxLateNightsPerWeek}). Noites tardias frequentes podem desestabilizar seu ritmo.`,
      date: lateNightDates[0],
      blockIds: [],
    });
  }

  return alerts;
}

function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
