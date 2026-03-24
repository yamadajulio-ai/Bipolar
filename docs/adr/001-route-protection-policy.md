# ADR-001: Route Protection Policy

## Status
Accepted (2026-03-23)

## Context
During a security audit, 13 routes were found missing from the middleware protection list. The app handles sensitive health data (LGPD art. 11) and any unprotected route represents a potential data leak. A consistent policy was needed to prevent new routes from accidentally being left unprotected.

## Decision
Adopt a "public explicit, everything else protected" middleware pattern. The middleware maintains an explicit allowlist of public routes (`PUBLIC_PATHS`). Any route not in the allowlist requires authentication by default. New routes are protected automatically unless explicitly added to the public list.

## Consequences
- New routes default to protected — developers must consciously opt a route into the public allowlist.
- The 13 previously unprotected routes are now covered.
- Adding a new public page requires updating the `PUBLIC_PATHS` set in middleware, creating a deliberate review point.
- Risk of accidentally blocking a page that should be public is mitigated by the explicit naming convention and E2E tests that verify middleware behavior.
