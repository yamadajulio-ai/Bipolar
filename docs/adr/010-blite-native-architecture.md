# ADR 010: B-lite Native Architecture (iOS App Store)

**Status:** Accepted
**Date:** 2026-03-28
**Deciders:** GPT Pro audit + project owner

## Context

The iOS app used `server.url` in Capacitor config, loading 100% of content from the remote Vercel server via WebView. This violates:
- Apple Guideline 4.2 (app must not be merely a repackaged website)
- Apple Guideline 2.5.2 (apps must be self-contained in their bundles)
- Capacitor docs (server.url is "not intended for production")

## Decision

**B-lite**: Core clinical features in the local bundle + remote API with token-based auth + secondary content via web.

### Architecture Boundaries

The native app is a **separate runtime**, not a reuse of SSR/Server Components.

**FORBIDDEN imports in apps/native (and any future native bundle code):**
- `next/headers`
- `next/cookies`
- `@/lib/auth` (uses iron-session + cookies)
- `@/lib/db` (direct Prisma — use API endpoints instead)
- Any `"use server"` directive
- Any module that calls `cookies()` or `headers()` from next/headers

**ALLOWED shared code:**
- Domain types and validation (Zod schemas)
- Date utilities (`@/lib/dateUtils`)
- Constants (`@/lib/constants`)
- Pure computation functions (insights algorithms, streak calculation)
- UI components (presentational only, no server data fetching)

### Auth Model

- **Web:** iron-session + httpOnly cookies + CSRF (unchanged)
- **Native:** access token (15min, base64url-encoded) + refresh token (30d, opaque, rotated)
- Refresh tokens stored in iOS Keychain (never localStorage/Preferences)
- Token reuse detection: entire family revoked on replay
- Device session table: `NativeSession` with deviceId, platform, tokenFamily

### API Namespace

- `/api/native/*` — bearer token auth, no CSRF
- `/api/native/home` — aggregated BFF for /hoje screen
- `/api/native/plano-de-crise` — offline sync with optimistic concurrency (serverRev)

### Offline Strategy

- Crisis plan: cached locally, synced with serverRev/clientRev conflict detection
- De-escalation kit (breathing 4-7-8 + grounding 5-4-3-2-1): 100% offline
- Emergency numbers: hardcoded, always available

### Route Classification

| Category | Count | Examples |
|----------|-------|---------|
| v1 Bundle Local | 15 | /hoje, /checkin, /sono, /medicamentos, /plano-de-crise, /sos |
| Web/Auxiliary | 22 | /, /admin/*, /privacidade, /termos, /ferramentas/* |
| Phase 2 | 27 | /insights, /diario/*, /exercicios/*, /financeiro, /cursos/* |

## Consequences

- Web app continues working exactly as before (zero regression)
- Native app requires separate data layer (fetch + bearer token)
- Monorepo structure recommended for shared domain/contracts/ui
- App Store review narrative strengthened by offline safety features
- Google login deferred from iOS v1 (Apple + email/password first)
- SOS chat deferred to phase 2 (operational maturity needed)
