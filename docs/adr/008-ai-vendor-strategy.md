# ADR-008: AI Vendor Strategy (Multi-Model)

## Status
Accepted (2026-03-23)

## Context
The AI narrative feature generates personalized mental health insights from user data (mood, sleep, medication adherence). It was initially built on Claude Sonnet 4 (Anthropic) but was migrated to GPT-5.4 (OpenAI Responses API) due to structured output capabilities and quality improvements. This migration exposed vendor lock-in risks: API contract changes, pricing shifts, model deprecations, and quality regressions can force emergency re-engineering.

Additionally, certain high-risk inputs (e.g., `riskLevel: "atencao_alta"`, active suicidal ideation indicators) must produce deterministic, clinically reviewed responses — not probabilistic LLM output.

## Decision
1. **Vendor-neutral interface**: All AI calls are abstracted behind an internal interface. The narrative generation layer does not import vendor-specific SDKs directly; it calls through an adapter that can be swapped.
2. **Environment variable controls active model**: `OPENAI_NARRATIVE_MODEL` (default: `gpt-5.4`) selects the model at runtime. This allows canary deployments (e.g., switching to `gpt-5.2`) without code changes.
3. **High-risk deterministic bypass**: When `riskLevel` is `"atencao_alta"`, the LLM is bypassed entirely. A fixed, clinically reviewed template is returned instead. This ensures safety-critical content is never subject to LLM hallucination or drift.
4. **Structured Outputs + post-validation**: JSON Schema is enforced at the API level (OpenAI Structured Outputs), with Zod post-parse validation and 17 forbidden pattern checks as defense-in-depth.
5. **`store: false`**: No user data is persisted on the vendor side (LGPD compliance).

## Consequences
- Migrating to a new AI vendor (e.g., back to Anthropic, or to Gemini) requires only writing a new adapter and updating the environment variable — no changes to business logic or UI.
- The deterministic bypass guarantees that the highest-risk users always receive safe, reviewed content, regardless of LLM availability or behavior.
- The forbidden patterns layer catches harmful output (diagnostic claims, medication advice, minimization of symptoms) even if the model's safety training fails.
- Trade-off: the abstraction layer adds a small amount of indirection. This is justified by the operational flexibility it provides.
