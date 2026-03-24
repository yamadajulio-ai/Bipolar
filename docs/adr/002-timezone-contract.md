# ADR-002: Timezone Contract — America/Sao_Paulo

## Status
Accepted (2026-03-23)

## Context
Vercel serverless functions run in UTC. The entire user base is Brazilian (timezone America/Sao_Paulo, UTC-3). Using JavaScript's native `getFullYear()`, `getMonth()`, or `getDate()` on the server returns UTC values, which causes date boundaries (streak cutoffs, daily insights, cron matching) to shift by 3 hours. This led to bugs where check-ins near midnight were attributed to the wrong day.

## Decision
Establish `America/Sao_Paulo` as the canonical timezone for all user-facing date calculations. Concrete rules:

1. All date helpers (`localDateStr()`, `localToday()` in `src/lib/dateUtils.ts`) use `toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" })`.
2. Streak calculations in `streaks.ts` use the same explicit timezone formatting.
3. Server-side code must never use `getFullYear()`, `getMonth()`, or `getDate()` for user-facing dates.
4. The `sv-SE` locale is used because it produces ISO-format `YYYY-MM-DD` strings without additional parsing.

## Consequences
- All date logic is consistent regardless of where the server runs (Vercel edge, serverless, local dev).
- Streak and insight calculations align with the user's actual midnight.
- If the product expands beyond Brazil, this contract must be revised to support per-user timezone selection.
- Every new date calculation must use the shared helpers rather than raw Date methods.
