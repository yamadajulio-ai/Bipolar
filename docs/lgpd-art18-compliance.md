# LGPD Art. 18 — Compliance Matrix

> Last updated: 2026-03-28

## Data Retention Schedule

| Data Category | Retention Period | Justification | Purge Mechanism |
|---|---|---|---|
| MoodSnapshot, SleepLog, MedicationDose | Active account lifetime | Essential for longitudinal clinical tracking (Art. 11 §1) | Cascade delete on account deletion |
| WeeklyAssessment (ASRM, PHQ-9, FAST) | Active account lifetime | Clinical assessment history | Cascade delete |
| AIInsightNarrative | Active account lifetime | User-requested AI analysis | Cascade delete + DELETE endpoint |
| SOSEvent | Active account lifetime | Crisis history for safety | Cascade delete |
| CognitiveTest | Active account lifetime | Cognitive tracking | Cascade delete |
| Consent records | Active account lifetime + 5 years post-deletion | LGPD Art. 8 §2 — proof of consent | **Not cascade deleted** — retained for legal compliance |
| AdminAuditLog | 1 year | Security audit trail | Cron purge (`/api/cron/purge`) |
| RateLimit entries | Auto-expiring (windowMs) | Transient security data | Auto-cleanup in `checkRateLimit()` |
| PushSubscription | Until unsubscribed or 400-strike cleanup | Delivery mechanism | 400 error auto-cleanup |
| MessageLog (WhatsApp/Push) | 90 days | Delivery audit | Cron purge |
| AccessLog (Professional) | 90 days | Professional access audit | Cron purge |
| DailyRiskSnapshot | Active account lifetime | Clinical safety tracking | Cascade delete |
| AlertEpisode | Active account lifetime | Clinical alert history | Cascade delete |
| LifeChartEvent | Active account lifetime | NIMH life chart | Cascade delete |

## Art. 18 Rights Implementation

| Right | Article | Implementation | Status |
|---|---|---|---|
| Confirmation of processing | Art. 18, I | `/consentimentos` page shows all active consents | DONE |
| Access to data | Art. 18, II | `/api/relatorio/export` (30/90 day JSON export) | DONE |
| Correction of data | Art. 18, III | Edit endpoints for all user-facing data | DONE |
| Anonymization/blocking | Art. 18, IV | IP masking (/24, /64), Sentry PII scrub | DONE |
| Deletion | Art. 18, VI | `/api/auth/excluir-conta` — cascade delete + `Clear-Site-Data` + token revocation | DONE |
| Information about sharing | Art. 18, VII | Privacy policy + consent center transparency | DONE |
| Consent revocation | Art. 18, IX | `/consentimentos` toggle per scope + `/api/consentimentos` API | DONE |
| Data portability | Art. 18, V | `/api/relatorio/export` JSON format | DONE |

## Subprocessor Registry

| Subprocessor | Purpose | Data Shared | Legal Basis | DPA |
|---|---|---|---|---|
| Vercel (Pro) | Hosting, serverless functions | All app data (encrypted in transit) | Art. 7, V (contract execution) | Vercel DPA |
| Neon (PostgreSQL) | Database | All persistent data (encrypted at rest) | Art. 7, V | Neon DPA |
| Cloudflare (Pro) | CDN, WAF, Workers, R2 backup | Request metadata, backups | Art. 7, V | Cloudflare DPA |
| OpenAI | AI narrative generation | Mood/sleep/medication summaries (no PII) | Art. 11 §1 (explicit consent, `store: false`) | OpenAI DPA |
| Sentry | Error monitoring | Stack traces (PII scrubbed, replays OFF) | Art. 7, IX (legitimate interest) | Sentry DPA |
| Meta (CAPI) | Analytics attribution | Masked IP, user agent, _fbc/_fbp cookies | Art. 7, I (explicit consent via cookie banner) | Meta DPA |
| Google (OAuth) | Authentication | Email, Google ID | Art. 7, V | Google DPA |
| Apple (SIWA) | Authentication | Email, Apple sub | Art. 7, V | Apple DPA |

## Backup Purge Policy

- **Cloudflare R2** (`suporte-bipolar-backups`): Daily database backups
- **Retention**: 30 days rolling (lifecycle rule on R2 bucket)
- **Account deletion**: User data is cascade-deleted from live DB immediately. Backups containing deleted user data expire within 30 days via R2 lifecycle.
- **Gap**: No on-demand purge from backups. Acceptable under LGPD Art. 16, II — retention necessary for legal compliance during backup window.

## Audit Trail

- **AdminAuditLog**: Tracks all admin page views with userId, action, masked IP, metadata
- **AccessLog**: Professional dashboard access with token, PIN attempt, IP
- **Consent**: All consent grants/revocations timestamped with IP and scope
- **MessageLog**: WhatsApp/Push delivery tracking for communication audit
- **Session**: iron-session with `createdAt`, `lastActive`, `lastRevocationCheck` for session lifecycle audit

## Consent Scopes (11 total)

1. `health_data` — Mood, sleep, medication (essential for core function)
2. `terms_of_use` — Terms acceptance (essential)
3. `journal_data` — Diary entries
4. `assessments` — Weekly assessments (ASRM, PHQ-9, FAST)
5. `crisis_plan` — Crisis plan data
6. `sos_chatbot` — SOS AI chatbot conversations
7. `clinical_export` — Clinical data export
8. `ai_narrative` — AI-generated insights
9. `push_notifications` — Push notification delivery
10. `whatsapp_reminders` — WhatsApp reminder messages
11. `analytics` — Cookie-based analytics (Meta Pixel)

## Data Minimization Practices

- IP addresses masked to /24 (IPv4) and /64 (IPv6) before storage
- Sentry: replays OFF, PII scrubbing enabled, breadcrumb whitelist
- OpenAI: `store: false` — no data retention by AI provider
- Meta CAPI: server-side consent gate, masked IP
- Professional dashboard: PII revealed only on-demand with audit logging
- Admin pages: small-cohort suppression (n < 10) prevents re-identification
- LGPD SELECT clauses on all Prisma queries — only fetch needed fields
