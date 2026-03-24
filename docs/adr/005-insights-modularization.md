# ADR-005: Insights Engine Modularization

## Status
Accepted (2026-03-23)

## Context
The insights engine (`src/lib/insights/computeInsights.ts`) grew to over 2000 lines, concentrating sleep analysis, mood thermometer, cycling detection, episode prediction, spending-mood correlation, social jet lag, streak calculations, stability scoring, and heatmap generation in a single file. This created several problems:

- **Risk concentration**: a bug in one domain (e.g., sleep regularity) could break all insights.
- **Testing difficulty**: tests required mocking the entire input surface even when testing a single domain.
- **Merge conflicts**: multiple features touching the same file simultaneously.
- **Cognitive load**: new contributors had to understand the entire file to modify one calculation.

## Decision
Split `computeInsights.ts` into domain-specific modules while keeping the main function as an orchestrator:

1. **Domain modules**: each calculation domain (sleep, mood, cycling, prediction, spending, streaks, stability) becomes its own module under `src/lib/insights/`.
2. **Orchestrator**: `computeInsights.ts` remains as the entry point, importing and composing results from domain modules.
3. **Shared types**: `InsightsResult` and sub-types stay in a shared types file to maintain the public API contract.
4. **Independent testing**: each domain module has its own test file, testing only its inputs and outputs.

## Consequences
- Each domain can be tested, reviewed, and modified independently.
- A bug in sleep analysis cannot cascade into mood or prediction calculations.
- New insight domains can be added as new modules without touching existing code.
- The orchestrator file stays small and readable, serving as a table of contents for the insights engine.
- Migration is incremental — modules can be extracted one at a time without breaking the existing API.
