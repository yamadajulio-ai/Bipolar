# ADR-004: AI Narrative — Explicit Opt-In Consent

## Status
Accepted (2026-03-23)

## Context
The AI narrative feature sends aggregated health data (mood scores, sleep patterns, medication adherence, assessment results) to OpenAI's API for natural-language insight generation. Under LGPD art. 11, processing sensitive health data requires explicit, informed consent with a specific purpose. Additionally, the data crosses borders (OpenAI servers in the US), triggering LGPD art. 33 requirements for international transfer.

## Decision
Implement explicit opt-in consent per scope, enforced at the server level:

1. **Consent scope**: `ai_narrative` — a dedicated scope in the Consent Center (`/consentimentos`).
2. **UI gate**: the narrative section shows a consent checkbox. No AI generation occurs until the user actively opts in.
3. **Server enforcement**: the API route checks the consent record in the database before calling OpenAI. Missing or revoked consent returns a structured error, never a fallback narrative.
4. **`store: false`**: all OpenAI API calls include `store: false` to prevent OpenAI from persisting the request data.
5. **DELETE endpoint**: users can request deletion of their stored narrative via `DELETE /api/narrativa`, exercising their LGPD right to erasure.
6. **High-risk bypass**: when `riskLevel` is `atencao_alta`, a fixed template is used instead of the LLM, avoiding sending crisis-level data to an external API.

## Consequences
- No narrative is generated without active, recorded consent — compliance with LGPD art. 11.
- Users who never opt in see no AI content and no data leaves the system.
- The consent record is versioned and timestamped, creating an audit trail.
- Revoking consent immediately stops future generations and enables deletion of past narratives.
- The high-risk bypass ensures the most sensitive situations never reach the external API.
