import { KEYWORD_CATEGORY, CATEGORY_DEFAULTS } from "./defaults";

export interface QuickAddResult {
  title: string;
  category: string;
  kind: string;
  startAt: string; // ISO datetime
  endAt: string;   // ISO datetime
  energyCost: number;
  stimulation: number;
  isComplete: boolean; // true = ready to create, false = open modal prefilled
}

const DAY_NAMES: Record<string, number> = {
  dom: 0, domingo: 0,
  seg: 1, segunda: 1,
  ter: 2, terca: 2,
  qua: 3, quarta: 3,
  qui: 4, quinta: 4,
  sex: 5, sexta: 5,
  sab: 6, sabado: 6,
};

/**
 * Deterministic pt-BR parser for quick-add text.
 * Extracts: date, time range, title, category.
 * contextDate = YYYY-MM-DD (the currently viewed date, defaults to today)
 */
export function quickAddParse(text: string, contextDate?: string): QuickAddResult {
  const now = new Date();
  const baseDate = contextDate ? new Date(contextDate + "T12:00:00") : now;

  let remaining = text.trim().toLowerCase();
  let targetDate = new Date(baseDate);
  let startHour: number | null = null;
  let startMinute = 0;
  let endHour: number | null = null;
  let endMinute = 0;
  let foundDate = false;

  // 1. Extract date tokens
  if (/\bhoje\b/.test(remaining)) {
    targetDate = new Date(baseDate);
    remaining = remaining.replace(/\bhoje\b/, "").trim();
    foundDate = true;
  } else if (/\bamanha\b/.test(remaining) || /\bamanhã\b/.test(remaining)) {
    targetDate = new Date(baseDate);
    targetDate.setDate(targetDate.getDate() + 1);
    remaining = remaining.replace(/\b(amanha|amanhã)\b/, "").trim();
    foundDate = true;
  } else if (/\btodo dia\b/.test(remaining)) {
    remaining = remaining.replace(/\btodo dia\b/, "").trim();
    foundDate = true;
    // todo dia = use contextDate
  } else {
    // Check day names
    for (const [name, dayNum] of Object.entries(DAY_NAMES)) {
      const regex = new RegExp(`\\b${name}\\b`);
      if (regex.test(remaining)) {
        remaining = remaining.replace(regex, "").trim();
        // Find next occurrence of this day
        const currentDay = baseDate.getDay();
        let diff = dayNum - currentDay;
        if (diff <= 0) diff += 7;
        targetDate = new Date(baseDate);
        targetDate.setDate(targetDate.getDate() + diff);
        foundDate = true;
        break;
      }
    }
  }

  // 2. Extract time - range format: "14-15" or "14:30-15:30"
  const rangeMatch = remaining.match(/(\d{1,2})(?:[h:](\d{2}))?\s*[-–]\s*(\d{1,2})(?:[h:](\d{2}))?/);
  if (rangeMatch) {
    startHour = parseInt(rangeMatch[1], 10);
    startMinute = rangeMatch[2] ? parseInt(rangeMatch[2], 10) : 0;
    endHour = parseInt(rangeMatch[3], 10);
    endMinute = rangeMatch[4] ? parseInt(rangeMatch[4], 10) : 0;
    remaining = remaining.replace(rangeMatch[0], "").trim();
  } else {
    // Single time: "14h" or "14:30" or "14h30"
    const singleMatch = remaining.match(/(\d{1,2})[h:](\d{2})?/);
    if (singleMatch) {
      startHour = parseInt(singleMatch[1], 10);
      startMinute = singleMatch[2] ? parseInt(singleMatch[2], 10) : 0;
      remaining = remaining.replace(singleMatch[0], "").trim();
    }
  }

  // 3. Clean remaining text for title
  remaining = remaining.replace(/\s+/g, " ").trim();
  // Remove leading/trailing punctuation
  remaining = remaining.replace(/^[,\-–\s]+|[,\-–\s]+$/g, "").trim();

  // 4. Detect category from keywords in remaining text
  let category = "outro";
  const words = remaining.split(/\s+/);
  for (const word of words) {
    const normalized = word.replace(/[áàã]/g, "a").replace(/[éê]/g, "e")
      .replace(/[íì]/g, "i").replace(/[óô]/g, "o").replace(/[úù]/g, "u")
      .replace(/ç/g, "c");
    if (KEYWORD_CATEGORY[normalized]) {
      category = KEYWORD_CATEGORY[normalized];
      break;
    }
    if (KEYWORD_CATEGORY[word]) {
      category = KEYWORD_CATEGORY[word];
      break;
    }
  }

  const defaults = CATEGORY_DEFAULTS[category] || CATEGORY_DEFAULTS.outro;

  // Build title (capitalize first letter)
  const title = remaining
    ? remaining.charAt(0).toUpperCase() + remaining.slice(1)
    : category.charAt(0).toUpperCase() + category.slice(1);

  // Build startAt/endAt
  if (startHour !== null) {
    targetDate.setHours(startHour, startMinute, 0, 0);
  } else {
    // Default: next round hour
    targetDate.setHours(now.getHours() + 1, 0, 0, 0);
  }

  const startAt = new Date(targetDate);
  let endAt: Date;

  if (endHour !== null) {
    endAt = new Date(targetDate);
    endAt.setHours(endHour, endMinute, 0, 0);
    // Handle overnight
    if (endAt <= startAt) {
      endAt.setDate(endAt.getDate() + 1);
    }
  } else {
    endAt = new Date(startAt.getTime() + defaults.durationMin * 60000);
  }

  // isComplete = has title + date + time
  const isComplete = remaining.length > 0 && (foundDate || contextDate !== undefined) && startHour !== null;

  return {
    title,
    category,
    kind: defaults.kind,
    startAt: startAt.toISOString(),
    endAt: endAt.toISOString(),
    energyCost: defaults.energyCost,
    stimulation: defaults.stimulation,
    isComplete,
  };
}
