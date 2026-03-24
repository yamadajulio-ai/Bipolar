# ADR-007: localStorage vs sessionStorage for Sensitive Health Data

## Status
Accepted (2026-03-23)

## Context
The application handles draft data from check-in and weekly assessment forms that contain Protected Health Information (PHI), including mood scores, sleep data, and PHQ-9 responses. This draft data needs temporary client-side persistence so users don't lose progress if they navigate away briefly. However, browser storage mechanisms have different security profiles: `localStorage` persists indefinitely across tabs and browser restarts, while `sessionStorage` is scoped to a single tab and clears when the tab is closed.

A specific concern is PHQ-9 item 9, which screens for suicidal ideation. This data is classified as high-risk under LGPD art. 11 (dados sensíveis de saúde) and carries additional clinical liability if exposed or persisted inappropriately.

## Decision
1. **Use `sessionStorage`** (not `localStorage`) for all health-related draft data, including check-in drafts, weekly assessment (ASRM/PHQ-9/FAST) in-progress responses, and mood thermometer pending submissions.
2. **PHQ-9 item 9 scores are never persisted client-side** — not in `sessionStorage`, not in `localStorage`, not in any browser storage mechanism. Item 9 values exist only in React component state and are submitted directly to the server.
3. **Non-health preferences** (theme, locale, dismissed banners) may continue using `localStorage` as they carry no PHI risk.

## Consequences
- The exposure window for health drafts is reduced to the lifetime of a single browser tab. Closing the tab automatically clears all PHI from the client.
- Users who close their tab mid-assessment will lose draft progress. This is an acceptable trade-off given that assessments take 2-3 minutes to complete.
- PHQ-9 item 9 data never touches any browser persistence layer, eliminating the risk of suicidality screening scores being recoverable from a shared or compromised device.
- Developers must be careful to distinguish health data (sessionStorage only) from UI preferences (localStorage allowed) when adding new client-side persistence.
