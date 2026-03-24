# ADR-006: SOS AI Governance Envelope

## Status
Accepted (2026-03-23)

## Context
The application uses two separate AI vendors for different flows:

- **AI Narrative** (insights page): OpenAI GPT-5.4 via Responses API
- **SOS Chatbot** (crisis support): Anthropic Claude Sonnet 4 via Messages API

The narrative stack has comprehensive governance:
- Structured Outputs (JSON Schema nativo)
- Zod post-parse validation
- 25 forbidden patterns with `normalizeForSafetyCheck()` + `containsForbiddenContent()`
- `trackError` telemetry (Sentry structured warnings)
- Model allowlist
- `store: false` (LGPD)
- ADR-004 documenting consent and safety decisions

The SOS chatbot is the **highest-risk flow** in the application (crisis users, suicide risk) but had governance gaps relative to the narrative:

| Layer | Narrative | SOS (before) |
|-------|-----------|-------------|
| Input validation | Zod schema | Zod schema |
| HMAC signing | N/A (no multi-turn) | HMAC-SHA256 truncated |
| Injection defense | N/A | 14 regex patterns + HMAC |
| Crisis detection | N/A | Deterministic (856+ tests) |
| Output forbidden patterns | 25 regex patterns | **MISSING** |
| Output Zod validation | Structured Outputs | **MISSING** (streaming) |
| `trackError` telemetry | Yes (4 call sites) | **MISSING** (only Sentry.captureException) |
| Rate limiting | Per-user | Per-user (crisis bypasses) |
| Model allowlist | Explicit Set | Hardcoded single model |
| ADR | ADR-004 | **MISSING** |

## Decision

### 1. Maintain dual-vendor architecture
Migrating SOS to OpenAI would be a large, risky change to the highest-risk flow. The Anthropic SDK is battle-tested for this use case with 856+ crisis detection tests. We formalize the dual-vendor approach with explicit governance parity.

### 2. Add SOS-specific forbidden pattern guardrails
Create `src/lib/sos/responseGuardrails.ts` with patterns tailored to SOS risk:
- Diagnostic language ("você tem depressão/bipolar/transtorno")
- Prescription language ("prescrever", "receitar", "medicar")
- Medication interference ("pare de tomar", "suspenda")
- Dismissal of professional help ("não precisa de médico")
- Normalization of suicidal ideation
- Applied post-streaming, before sending final response to client

### 3. Add `trackError` telemetry
Structured error telemetry at all SOS failure/safety points:
- Anthropic API errors
- Rate limit hits
- Deterministic crisis detection triggers
- Fallback responses (empty LLM output, API failure)
- Forbidden pattern guardrail triggers

### 4. Accept streaming limitation on structured outputs
The SOS chat streams tokens via SSE for perceived latency. Structured Outputs (JSON mode) is incompatible with streaming free-text responses. This is an accepted trade-off: the forbidden pattern post-check compensates.

## Governance Parity Checklist
When modifying either AI flow, verify both sides maintain:
- [ ] Input validation (Zod)
- [ ] Output safety check (forbidden patterns)
- [ ] `trackError` at all failure points
- [ ] Rate limiting
- [ ] LGPD compliance (no transcript storage)
- [ ] Sentry error capture
- [ ] ADR documentation

## Consequences
- SOS now has output guardrails matching the narrative's safety philosophy
- `trackError` provides structured alerting for SOS incidents (previously only raw Sentry exceptions)
- Dual-vendor is explicitly documented as intentional, not accidental
- Future audits can reference this checklist for governance parity
- Streaming limitation is documented as an accepted trade-off with mitigation
