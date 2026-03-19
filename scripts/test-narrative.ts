/**
 * Quick smoke test: calls generateNarrative V2 with realistic mock data.
 * Usage: npx tsx scripts/test-narrative.ts
 */
import { readFileSync } from "fs";
const envContent = readFileSync(".env.local", "utf-8");
for (const line of envContent.split("\n")) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match && !process.env[match[1].trim()]) {
    process.env[match[1].trim()] = match[2].trim().replace(/^"|"$/g, "");
  }
}
import { generateNarrative } from "../src/lib/ai/generateNarrative";
import type { InsightsResult } from "../src/lib/insights/computeInsights";
import type { NarrativeExtraData } from "../src/lib/ai/narrative-types";

const mockInsights = {
  sleep: {
    avgDuration: 7.2, bedtimeVariance: 45, durationVariability: 38,
    sleepTrend: "stable", sleepTrendDelta: 0.1, avgQuality: 3.5,
    midpoint: "03:30", socialJetLag: 42,
    sleepHeadline: "Sono estável com boa regularidade",
    dataConfidence: "alta", recordCount: 25, alerts: [],
    avgDurationColor: "green", bedtimeVarianceColor: "green",
    midpointTrend: null, midpointDelta: null,
    durationVariabilityColor: "green", socialJetLagLabel: null,
  },
  mood: {
    moodTrend: "stable", moodAmplitude: 1, moodAmplitudeLabel: "Baixa",
    medicationAdherence: 0.88, medicationResponseRate: "22/25 dias",
    topWarningSigns: [{ key: "irritabilidade", label: "Irritabilidade", count: 3 }],
    moodHeadline: "Humor estável com baixa oscilação", alerts: [],
  },
  thermometer: {
    position: 52, maniaScore: 20, depressionScore: 15,
    zone: "eutimia", zoneLabel: "Estabilidade",
    mixedFeatures: false, mixedStrength: null,
    instability: "baixa", factors: ["humor estável", "sono regular"],
    daysUsed: 25, baselineAvailable: true,
  },
  rhythm: {
    hasEnoughData: true, overallRegularity: 72,
    usedSleepFallback: false, usedPlannerFallback: false,
    anchors: {
      wake: { label: "Acordar", variance: 30, regularityScore: 80, windowScore: 75, color: "green", source: "sleep", daysCount: 25 },
      sleep: { label: "Dormir", variance: 45, regularityScore: 65, windowScore: 60, color: "yellow", source: "sleep", daysCount: 25 },
    },
    alerts: [],
  },
  chart: {
    chartData: [],
    correlation: { rho: 0.35, strength: "moderada", direction: "positiva", n: 25, confidence: "alta" },
    lagCorrelation: { rho: 0.42, strength: "moderada", direction: "positiva", n: 24, confidence: "alta" },
    correlationNote: null, lagCorrelationNote: null,
  },
  combinedPatterns: [{ variant: "info", title: "Sono e humor", message: "Noites curtas coincidem com humor mais baixo" }],
  risk: { score: 2, level: "ok", factors: [] },
  prediction: { maniaRisk: 10, depressionRisk: 15, maniaSignals: [], depressionSignals: [], level: "baixo", recommendations: [], daysUsed: 25 },
  cycling: { polaritySwitches: 1, isRapidCycling: false, avgCycleLength: null, episodes: [] },
  seasonality: { monthlyMood: [], hasSeasonalPattern: false, peakMonths: [], troughMonths: [], description: null },
  heatmap: [],
} as unknown as InsightsResult;

const mockExtra: NarrativeExtraData = {
  assessments: [
    { date: "2026-03-17", asrmTotal: 4, phq9Total: 6, phq9Item9: 0, fastAvg: 3.8 },
    { date: "2026-03-10", asrmTotal: 3, phq9Total: 7, phq9Item9: 0, fastAvg: 3.5 },
  ],
  lifeEvents: [{ date: "2026-03-15", eventType: "therapy" }],
  cognitiveTests: [],
};

async function main() {
  console.log("Testing generateNarrative V2...\n");
  const start = Date.now();
  const { narrative, persistence } = await generateNarrative(mockInsights, mockExtra);
  const elapsed = Date.now() - start;

  console.log(`Time: ${(elapsed / 1000).toFixed(1)}s | Bypass: ${persistence.bypassLlm} | Guardrail: ${persistence.guardrailPassed ? "PASS" : "FAIL"}`);
  console.log(`Tokens: in=${persistence.inputTokens} out=${persistence.outputTokens} reasoning=${persistence.reasoningTokens}`);
  console.log("=".repeat(60));
  console.log("HEADLINE:", narrative.overview.headline);
  console.log("SUMMARY:", narrative.overview.summary);
  for (const [key, section] of Object.entries(narrative.sections)) {
    if (section.status === "absent") continue;
    console.log(`\n[${section.status}] ${section.title}: ${section.summary}`);
  }
  console.log("\nSuggestions:", narrative.actions.practicalSuggestions);
  console.log("Share with professional:", narrative.actions.shareWithProfessional);
}

main().catch(console.error);
