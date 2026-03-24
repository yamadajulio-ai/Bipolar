import type { CorrelationResult, DataConfidence } from "./types";

/** Pearson correlation on values (used internally for Spearman). */
function pearsonCorrelation(x: number[], y: number[]): number | null {
  const n = x.length;
  if (n < 2) return null;
  const mx = x.reduce((s, v) => s + v, 0) / n;
  const my = y.reduce((s, v) => s + v, 0) / n;
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx;
    const dy = y[i] - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  const denom = Math.sqrt(dx2 * dy2);
  if (denom === 0) return null;
  return num / denom;
}

/** Assign fractional ranks (handles ties correctly via averaging). */
export function assignRanks(arr: number[]): number[] {
  const n = arr.length;
  const indexed = arr.map((v, i) => ({ v, i }));
  indexed.sort((a, b) => a.v - b.v);
  const ranks = new Array<number>(n);
  let i = 0;
  while (i < n) {
    let j = i;
    while (j < n - 1 && indexed[j + 1].v === indexed[j].v) j++;
    const avgRank = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) ranks[indexed[k].i] = avgRank;
    i = j + 1;
  }
  return ranks;
}

/** Metadata returned when correlation cannot be computed. */
export interface SpearmanResult {
  rho: number | null;
  n: number;
  reason?: "insufficient_variation" | "too_many_ties" | "insufficient_data";
}

/** Spearman rank correlation — Pearson on ranks, correct with ties.
 *  Returns structured result with metadata when computation fails. */
export function spearmanCorrelation(x: number[], y: number[]): SpearmanResult {
  if (x.length !== y.length || x.length < 14) {
    return { rho: null, n: x.length, reason: "insufficient_data" };
  }

  const ranksX = assignRanks(x);
  const ranksY = assignRanks(y);

  // Check for insufficient variation (all same rank = no variation)
  const uniqueX = new Set(ranksX).size;
  const uniqueY = new Set(ranksY).size;
  if (uniqueX === 1 || uniqueY === 1) {
    return { rho: null, n: x.length, reason: "insufficient_variation" };
  }

  // Check for too many ties (>80% of values are the same rank)
  const maxTieRatioX = Math.max(...Array.from(countValues(ranksX).values())) / ranksX.length;
  const maxTieRatioY = Math.max(...Array.from(countValues(ranksY).values())) / ranksY.length;
  if (maxTieRatioX > 0.8 || maxTieRatioY > 0.8) {
    return { rho: null, n: x.length, reason: "too_many_ties" };
  }

  const rho = pearsonCorrelation(ranksX, ranksY);
  if (rho === null) {
    return { rho: null, n: x.length, reason: "insufficient_variation" };
  }

  return { rho, n: x.length };
}

/** Legacy wrapper: returns number | null for backward compatibility. */
export function spearmanCorrelationLegacy(x: number[], y: number[]): number | null {
  return spearmanCorrelation(x, y).rho;
}

function countValues(arr: number[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const v of arr) {
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return counts;
}

export function buildCorrelationResult(rho: number, n: number): CorrelationResult {
  const absRho = Math.abs(rho);
  const strength = absRho < 0.2 ? "muito_fraca" as const
    : absRho < 0.4 ? "fraca" as const
    : absRho < 0.6 ? "moderada" as const
    : "forte" as const;
  const direction = rho >= 0 ? "positiva" as const : "negativa" as const;
  const confidence: DataConfidence = n >= 21 ? "alta" : n >= 14 ? "media" : "baixa";
  return { rho: Math.round(rho * 100) / 100, strength, direction, n, confidence };
}
