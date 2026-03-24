# ADR-003: Session Security — iron-session with Multi-Layer Expiry

## Status
Accepted (2026-03-23)

## Context
The application stores sensitive health data protected under LGPD art. 11 (dados sensíveis de saúde). A session mechanism was needed that balances security with usability for a mobile-first audience that checks in daily. Key threats: session hijacking, stale sessions after password change, and indefinite session lifetime.

## Decision
Use `iron-session` with encrypted cookies and a three-layer expiry model:

1. **Idle timeout**: 7 days — sessions expire after 7 days of inactivity.
2. **Absolute timeout**: 30 days — sessions expire regardless of activity after 30 days.
3. **Sliding refresh**: 1 hour — session cookie is refreshed on each request if more than 1 hour has passed since the last refresh.
4. **passwordChangedAt invalidation**: when a user changes their password, the `passwordChangedAt` timestamp is updated. All sessions created before that timestamp are rejected on next request.
5. **Session rotation**: new session ID is issued after step-up auth to prevent fixation attacks.
6. **Logout**: sends `Clear-Site-Data` header to wipe all client-side state.

## Consequences
- Password changes immediately invalidate all other sessions across devices without needing a session store or revocation list.
- Daily users stay logged in for up to 7 days between visits, reducing friction.
- The 30-day absolute limit ensures no session lives forever, even with continuous use.
- Step-up auth (re-enter password or recent OAuth) is required for destructive actions (account deletion, clinical export).
- No external session store is needed — iron-session encrypts everything into the cookie itself.
