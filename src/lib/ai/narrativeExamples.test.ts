import { describe, it, expect } from "vitest";
import { z } from "zod/v4";
import {
  ALL_EXAMPLE_OUTPUTS,
  EXAMPLES_VERSION,
  FEW_SHOT_MESSAGES,
} from "./narrativeExamples";

// ── Mirror the Zod schema from generateNarrative.ts ──────────

const sectionZod = z.object({
  status: z.enum(["notable", "stable", "limited", "absent"]),
  title: z.string().max(100),
  summary: z.string().max(600),
  keyPoints: z.array(z.string().max(200)).max(4),
  metrics: z.array(z.string().max(200)).max(5),
  suggestions: z.array(z.string().max(200)).max(3),
  evidenceIds: z.array(z.string().max(60)).max(10),
});

const narrativeV2Schema = z.object({
  schemaVersion: z.literal("narrative_v2"),
  overview: z.object({
    headline: z.string().min(1).max(200),
    summary: z.string().min(1).max(1200),
    dataQualityNote: z.string().max(300),
    evidenceIds: z.array(z.string().max(60)).max(15),
  }),
  sections: z.object({
    sleep: sectionZod,
    mood: sectionZod,
    socialRhythms: sectionZod,
    plannerContext: sectionZod,
    financialContext: sectionZod,
    cognition: sectionZod,
    weeklyAssessments: sectionZod,
    lifeEvents: sectionZod,
    correlations: sectionZod,
    overallTrend: sectionZod,
  }),
  actions: z.object({
    shareWithProfessional: z.boolean(),
    practicalSuggestions: z.array(z.string().max(200)).min(2).max(3),
  }),
  closing: z.object({ text: z.string().min(1).max(300) }),
});

describe("narrativeExamples", () => {
  it("has a version string", () => {
    expect(EXAMPLES_VERSION).toBeTruthy();
    expect(typeof EXAMPLES_VERSION).toBe("string");
  });

  it("has 4 example outputs", () => {
    expect(ALL_EXAMPLE_OUTPUTS).toHaveLength(4);
  });

  it("has 8 few-shot messages (4 user + 4 assistant)", () => {
    expect(FEW_SHOT_MESSAGES).toHaveLength(8);
    const users = FEW_SHOT_MESSAGES.filter((m) => m.role === "user");
    const assistants = FEW_SHOT_MESSAGES.filter((m) => m.role === "assistant");
    expect(users).toHaveLength(4);
    expect(assistants).toHaveLength(4);
  });

  for (let i = 0; i < ALL_EXAMPLE_OUTPUTS.length; i++) {
    it(`example ${i + 1} passes Zod schema validation`, () => {
      const result = narrativeV2Schema.safeParse(ALL_EXAMPLE_OUTPUTS[i]);
      if (!result.success) {
        // Show useful error message
        const issues = result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
        throw new Error(`Zod validation failed:\n${issues.join("\n")}`);
      }
      expect(result.success).toBe(true);
    });

    it(`example ${i + 1} has schemaVersion "narrative_v2"`, () => {
      expect(ALL_EXAMPLE_OUTPUTS[i].schemaVersion).toBe("narrative_v2");
    });

    it(`example ${i + 1} has at least 2 practical suggestions`, () => {
      expect(ALL_EXAMPLE_OUTPUTS[i].actions.practicalSuggestions.length).toBeGreaterThanOrEqual(2);
    });

    it(`example ${i + 1} has non-empty headline`, () => {
      expect(ALL_EXAMPLE_OUTPUTS[i].overview.headline.length).toBeGreaterThan(0);
    });

    it(`example ${i + 1} has non-empty closing text`, () => {
      expect(ALL_EXAMPLE_OUTPUTS[i].closing.text.length).toBeGreaterThan(0);
    });
  }

  it("assistant messages are valid JSON that parse to the schema", () => {
    const assistantMessages = FEW_SHOT_MESSAGES.filter((m) => m.role === "assistant");
    for (const msg of assistantMessages) {
      const parsed = JSON.parse(msg.content);
      const result = narrativeV2Schema.safeParse(parsed);
      expect(result.success).toBe(true);
    }
  });
});
