export interface PlannerBlockData {
  id: string;
  title: string;
  category: string;
  kind: string;
  isRoutine: boolean;
  startAt: Date;
  endAt: Date;
  notes: string | null;
  energyCost: number;
  stimulation: number;
  sourceType?: string; // "app" | "google"
  recurrence: {
    freq: string;
    interval: number;
    weekDays: string | null;
    until: Date | null;
  } | null;
  exceptions: {
    occurrenceDate: Date;
    isCancelled: boolean;
    overrideStartAt: Date | null;
    overrideEndAt: Date | null;
    overrideTitle: string | null;
    overrideNotes: string | null;
  }[];
}

export interface ExpandedOccurrence {
  blockId: string;
  title: string;
  category: string;
  kind: string;
  isRoutine: boolean;
  startAt: Date;
  endAt: Date;
  notes: string | null;
  energyCost: number;
  stimulation: number;
  sourceType?: string; // "app" | "google"
  isRecurring: boolean;
  occurrenceDate: string; // YYYY-MM-DD anchor for this occurrence
}

export interface StabilityRuleData {
  lateEventCutoffMin: number;
  windDownMin: number;
  minBufferBeforeSleep: number;
  maxLateNightsPerWeek: number;
  protectAnchors: boolean;
  targetSleepTimeMin: number | null;
  targetWakeTimeMin: number | null;
}

export type AlertSeverity = "info" | "warning";

export interface StabilityAlert {
  type: "conflict" | "late_night" | "wind_down" | "max_late_nights" | "anchor_override";
  severity: AlertSeverity;
  message: string;
  date: string; // YYYY-MM-DD
  blockIds: string[];
}
