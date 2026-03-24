# ADR-009: SOS Abuse Controls & Rate Limiting

## Status
Accepted (2026-03-23)

## Context
The SOS endpoint (`/api/sos/chat`) provides crisis support via an LLM-powered chatbot. By design, it does not require authentication — a person in crisis must not be blocked by a login wall. However, this public accessibility creates abuse vectors: automated scraping, prompt injection attacks, resource exhaustion, and attempts to extract harmful content from the underlying LLM.

The endpoint also handles the most sensitive interaction in the application: conversations with users who may be experiencing suicidal ideation or acute psychiatric crisis.

## Decision
1. **Rate limiting by identity tier**:
   - **Anonymous users**: 60 requests per minute, keyed by masked IP address (IPv4 /24, IPv6 /64 — no full IP stored).
   - **Authenticated users**: 60 requests per minute, keyed by `userId`.
   - Rate limiting is DB-backed and atomic (`$transaction`) to prevent race conditions.
2. **Response guardrails**: 11 forbidden patterns are enforced on all LLM output before it reaches the user. These include: diagnostic claims, medication dosage advice, minimization of suicidal ideation, instructions for self-harm, and claims of being a medical professional. Violations trigger a safe fallback response.
3. **Crisis detection**: Input is analyzed for crisis indicators before LLM processing. Detected crisis triggers an immediate structured response with emergency resources (SAMU 192, CVV 188) rather than waiting for LLM generation.
4. **Telemetry on all abuse/error paths**: Every rate limit hit, guardrail violation, and LLM error is logged with structured metadata (no PII) for monitoring and tuning.
5. **No CAPTCHA**: CAPTCHAs are explicitly rejected for this endpoint — they are inaccessible during crisis states (trembling hands, impaired cognition, screen readers).

## Consequences
- The SOS endpoint remains accessible to anyone in crisis without authentication barriers, while rate limiting prevents automated abuse.
- IP masking ensures abuse tracking does not create a surveillance risk for vulnerable users.
- The guardrail layer acts as a safety net independent of the LLM's own safety training — even a fully jailbroken model cannot produce forbidden output patterns.
- Telemetry enables proactive detection of abuse campaigns or guardrail gaps without storing conversation content.
- Trade-off: the 60 req/min limit could theoretically affect a legitimate user in an extended crisis conversation. At typical message lengths, this allows one message per second, which far exceeds normal conversational pace.
