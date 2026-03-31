# Prompt de Auditoria — Suporte Bipolar iOS App (2026-03-31)

> Copie tudo a partir de `---` abaixo e cole na GPT Pro, SuperGrok, Gemini Pro e Perplexity Pro.

---

# Auditoria Completa: App iOS de Saúde Mental → App Store

Você é um auditor especialista em:
- Apple App Store Review Guidelines (versão atual)
- Segurança de aplicações de saúde (OWASP Mobile Top 10, HIPAA-adjacent, LGPD)
- UX mobile (iOS HIG, WCAG 2.1 AA)
- Engenharia de software (Next.js, React, Capacitor, PostgreSQL)
- Compliance regulatória para apps de saúde mental

Analise TODOS os artefatos abaixo (código-fonte real, schemas, configs iOS, review notes) e retorne uma auditoria exaustiva com:

1. **App Store Rejection Risks** — TODOS os riscos de rejeição com Guideline específica, probabilidade (alta/média/baixa), e ação corretiva
2. **Melhorias para aprovação** — O que adicionar/mudar para maximizar chance na primeira submissão
3. **Melhorias de UX/UI** — Problemas de usabilidade, acessibilidade, design
4. **Melhorias de Segurança** — Vulnerabilidades, gaps, boas práticas faltando
5. **Melhorias de Performance** — Gargalos, bundle size, otimizações
6. **Melhorias Clínicas/Regulatórias** — Riscos legais, disclaimers, compliance LGPD
7. **Melhorias Gerais** — Qualquer outra área

Para cada item: **Severidade** (P0 crítico / P1 importante / P2 nice-to-have), **Descrição**, **Ação corretiva concreta**.

Ao final, responda as **8 perguntas específicas** listadas no fim.

---

## 1. O QUE É O APP

**Suporte Bipolar** — app gratuito de automonitoramento para pessoas com transtorno bipolar no Brasil.
- Mobile-first (iPhone), idioma pt-BR
- Baseado em protocolos IPSRT (Interpersonal and Social Rhythm Therapy) e pesquisas do PROMAN/USP
- **NÃO é dispositivo médico regulado. NÃO diagnostica, NÃO prescreve, NÃO substitui profissional.**
- Age rating: 17+
- Preço: Gratuito

---

## 2. STACK TÉCNICA COMPLETA

| Camada | Tecnologia | Versão |
|---|---|---|
| Framework | Next.js (App Router, Server Components) | 16.1.6 |
| UI | React + TypeScript + Tailwind CSS v4 | React 19.2.3 |
| Mobile | Capacitor (iOS WebView → Vercel) | 8.2.0 |
| Database | Prisma ORM + PostgreSQL (Neon, sa-east-1) | Prisma 6.19.2 |
| Auth | iron-session + argon2id + bcryptjs (legacy rehash) | iron-session 8.0.4 |
| AI Narrativas | OpenAI GPT-5.4 (store:false) | openai 6.32.0 |
| AI SOS Chatbot | Anthropic Claude | @anthropic-ai/sdk 0.78.0 |
| Gráficos | Recharts (lazy-loaded, ~400KB saving) | 3.7.0 |
| Animações | Motion for React | 12.38.0 |
| Validation | Zod | 4.3.6 |
| Monitoring | Sentry (@sentry/nextjs) | 10.42.0 |
| Analytics | Vercel Analytics (anônimo, sem PII) | 2.0.1 |
| Email | Postmark (DKIM + Return-Path verified) | — |
| Push | APNs nativo (Capacitor) + Web Push (web-push 3.6.7) | — |
| Deploy | Vercel Pro + Cloudflare Pro (proxy ON, SSL Full Strict) | — |
| Backup | Cloudflare R2 (sa-east-1) + pg_dump | — |

### Números do projeto
- **52 modelos** no banco de dados
- **76 páginas** (page.tsx)
- **94 rotas de API** (route.ts)
- **112 componentes** React
- **262 arquivos de teste** (Vitest unit + Playwright E2E)
- **12 plugins nativos** Capacitor

---

## 3. ARQUITETURA iOS (CAPACITOR + WEBVIEW)

O app usa Capacitor 8 com `server.url` apontando para `https://suportebipolar.com` (Vercel). O WebView carrega a aplicação SSR remotamente — o app NÃO pode ser exportado como static (depende de Server Components, API routes, middleware, Prisma).

### capacitor.config.ts (CÓDIGO REAL)
```typescript
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.suportebipolar.app',
  appName: 'Suporte Bipolar',
  webDir: 'out',
  server: {
    url: 'https://suportebipolar.com',
    iosScheme: 'https',
    hostname: 'suportebipolar.com',
    errorPath: '/offline-fallback.html',
  },
  ios: {
    contentInset: 'always',
    preferredContentMode: 'mobile',
    backgroundColor: '#ffffff',
    allowsLinkPreview: false,
    webContentsDebuggingEnabled: process.env.NODE_ENV !== 'production',
  },
  plugins: {
    PushNotifications: { presentationOptions: ['badge', 'sound', 'alert'] },
    LocalNotifications: { smallIcon: 'ic_stat_icon', iconColor: '#527a6e', sound: 'notification.wav' },
    NativeBiometric: {},
    SplashScreen: { launchShowDuration: 2000, launchAutoHide: true, backgroundColor: '#ffffff', launchFadeOutDuration: 300, showSpinner: false },
    Keyboard: { resizeOnFullScreen: true },
  },
};
export default config;
```

### 9 Pilares Nativos (Guideline 4.2 — Minimum Functionality)
1. **Face ID / Touch ID** — biometria no launch + resume, iOS Keychain storage. NÃO alcançável via web (Safari Web API biometric é experimental/unreliable).
2. **Push Notifications (APNs)** — lembretes 9h/22h, medicação, avaliação. Privacy: títulos genéricos no lock screen. NÃO usa Web Push.
3. **Local Notifications** — lembretes offline sem internet.
4. **Offline Crisis Resources** — CVV 188, SAMU 192, Bombeiros 193, exercício grounding 5-4-3-2-1, tudo cacheado localmente.
5. **Haptic Feedback** — heavy (SOS), success (check-in), medium (biometric). NÃO disponível em Safari.
6. **Deep Links** — custom scheme `suportebipolar://` + universal links (AASA configurado).
7. **Native Share Sheet** — compartilhar contatos de crise, relatórios.
8. **Status Bar Integration** — styling nativo theme-aware.
9. **Voice-Assisted SOS** — STT/TTS hands-free, consent explícito. NÃO funciona via web em background/lock.

### App.entitlements (CÓDIGO REAL)
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>aps-environment</key>
  <string>development</string>
  <key>com.apple.developer.applesignin</key>
  <array><string>Default</string></array>
  <key>com.apple.developer.associated-domains</key>
  <array>
    <string>applinks:suportebipolar.com</string>
    <string>webcredentials:suportebipolar.com</string>
  </array>
</dict>
</plist>
```

### Info.plist — Entradas Relevantes
- `NSFaceIDUsageDescription`: "O Suporte Bipolar usa Face ID para proteger seus dados de saúde. Somente você pode acessar seus registros de humor, sono e avaliações."
- `NSMicrophoneUsageDescription`: "O modo de voz do SOS usa o microfone para transcrever o que você fala durante o acolhimento por voz. O áudio não é gravado nem armazenado."
- `NSSpeechRecognitionUsageDescription`: "O modo de voz do SOS usa reconhecimento de fala da Apple para converter sua voz em texto..."
- `CFBundleURLSchemes`: `suportebipolar`
- `UIBackgroundModes`: `remote-notification`
- `UIRequiredDeviceCapabilities`: `armv7`
- Orientações: Portrait + Landscape (iPhone), todas (iPad)

### PrivacyInfo.xcprivacy
- `NSPrivacyTracking`: false (ZERO tracking, sem IDFA)
- Collected Data Types (todos linked=true, tracking=false): Health & Fitness, Email, User ID, Name, User-Generated Content, Product Interaction
- Diagnostics: crash reports (Sentry, PII scrubbed, linked=false)
- Phone Number: emergency contacts (linked=false)
- Financial Info: medication costs
- Other Health Data: HRV from wearables
- Required Reason API: `NSPrivacyAccessedAPICategoryUserDefaults` (CA92.1 — @capacitor/preferences)

### offline-fallback.html (FUNCIONAL SEM INTERNET)
```html
<!-- 154 linhas, funcional offline -->
- Header: "Sem conexão com a internet"
- Emergency Contacts com tel: links: CVV 188, SAMU 192, Bombeiros 193, PM 190
- Exercício de grounding 5-4-3-2-1 (funcional offline)
- Dark mode via prefers-color-scheme
- Botão "Tentar novamente" (location.reload)
- Safe area insets, semantic HTML
```

---

## 4. SEGURANÇA (CÓDIGO-FONTE REAL)

### 4.1 Middleware (303 linhas)
```typescript
// CSRF: Double-submit HMAC-SHA256 cookie
// Layer 1: Sec-Fetch-Site/Origin/Referer check (fail-closed)
// Layer 2: Cookie + Header match + HMAC signature verification
// Exemptions: /api/native/ (Bearer token), /api/cron/ (CRON_SECRET),
//   webhooks (Postmark, Pluggy, WhatsApp, Apple OAuth), professional access (token+PIN)

// Session: iron-session encrypted cookie, 30d max, 7d idle, 1h sliding refresh
// Revocation check every 5min (detects password change)
// Absolute 30d lifetime cap

// Onboarded gate: blocks pre-onboarding users from data-writing APIs
// SOS always public (never gated — crisis endpoint)
// Professional viewer: no-store, private, max-age=0
// Admin: no-store, no-cache, must-revalidate
```

### 4.2 Auth (auth.ts — CÓDIGO COMPLETO)
```typescript
// Password hashing: argon2id (OWASP recommended)
// Legacy: transparent bcrypt→argon2 rehash on successful login
// Session sliding window: refresh stamp every 1h
// Inactivity timeout: 7 days
// Absolute lifetime: 30 days
// Revocation check: every 5min, verifies user exists + passwordChangedAt
// Legacy cookie migration: "empresa-bipolar-session" → "suporte-bipolar-session"
// SESSION_SECRET: min 32 chars + min 8 unique chars entropy check
```

### 4.3 Native Auth (native-auth.ts — CÓDIGO COMPLETO)
```typescript
// Opaque access tokens: 15min, HMAC-signed base64url (NOT JWT)
// Refresh tokens: 30d, SHA-256 hashed in DB
// Token family tracking: groups all rotated tokens from one login
// Rotation: new refresh token on every refresh, old invalidated
// Reuse detection: if rotated-away token reused → entire family revoked
// Race condition handling: updateMany with refreshTokenHash in WHERE (atomic)
// Constant-time comparison via timingSafeEqual
```

### 4.4 CSRF (security.ts — CÓDIGO COMPLETO)
```typescript
// HMAC-signed double-submit cookie
// Format: nonce(32 bytes hex).HMAC-SHA256(nonce, SESSION_SECRET)
// Cookie: __Host-csrf (Secure, no Domain, Path=/, NOT httpOnly — client must read)
// Validation: constant-time char-by-char comparison + HMAC verify via crypto.subtle
// Edge Runtime compatible (Web Crypto API)
```

### 4.5 Rate Limiting (security.ts)
```typescript
// DB-backed atomic ($transaction) — prevents race conditions
// per-endpoint, windowMs in milliseconds
// 100% coverage: ALL 94 API routes have rate limiting
// Read-only check available (isRateLimited) for dedup markers
```

### 4.6 Additional Security
- **CSP enforced** (not report-only): `default-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`
- **HSTS**: 63,072,000 sec (2 years) with preload
- **X-Frame-Options**: DENY
- **X-Content-Type-Options**: nosniff
- **Referrer-Policy**: strict-origin-when-cross-origin
- **Permissions-Policy**: `camera=(), geolocation=()` (microphone allowed for SOS voice)
- **Password reset**: SHA-256 hash in DB, raw token only in email, anti-enumeration (identical response for duplicate emails)
- **OAuth refresh tokens**: AES-256-GCM encrypted (Google + Apple)
- **Apple Sign-In**: nonce replay protection
- **Google account linking**: state parameter + timingSafeEqual CSRF
- **IP masking**: /24 for IPv4, /64 for IPv6 (LGPD minimization)
- **Data masking**: email "u***@example.com"
- **Input sanitization**: HTML entity escaping
- **Error messages**: 100% pt-BR (zero English leaking)
- **Step-up auth**: delete account + export require re-confirmation
- **Session rotation on login** (anti-fixation)
- **Clear-Site-Data on logout**

### 4.7 LGPD Consent System (consent.ts — CÓDIGO COMPLETO)
```typescript
// Essential scopes: health_data, journal_data, terms_of_use (cannot revoke)
// Auto-migration for legacy accounts (pre-consent system)
// All health read/write routes check consent BEFORE proceeding
// AI Narrative: explicit versioned consent naming "OpenAI"
// SOS Chatbot: no consent gate (LGPD Art. 11 II e — vital interest)
// Consent model: scope, version, grantedAt, revokedAt, ipAddress (masked)
```

---

## 5. DATABASE SCHEMA (52 MODELOS — COMPLETO)

### Modelos Principais (com campos relevantes)
```prisma
model User {
  id, email (unique), passwordHash?, passwordChangedAt?, authProvider ("email"|"google"|"apple"),
  googleSub? (unique), appleSub? (unique), appleRefreshToken?,
  name?, whatsappPhone? (unique, E.164), role ("user"|"admin"),
  onboarded (default false), onboardingGoal?, createdAt
  // 30+ relations
}

model DiaryEntry {
  userId, date (YYYY-MM-DD), mood (1-5), sleepHours (0-24), note?,
  energyLevel? (1-5), anxietyLevel? (1-5), irritability? (1-5),
  tookMedication? ("sim"|"nao"|"nao_sei"), warningSigns? (JSON),
  // Snapshot aggregation
  mode (LEGACY_SINGLE|AUTO_FROM_SNAPSHOT), snapshotCount, moodRange?,
  moodInstability?, anxietyPeak?, irritabilityPeak?, abruptShifts?,
  riskScoreCurrent?, riskScoreDaily?, riskScorePeak?
  @@unique([userId, date])
}

model MoodSnapshot {
  userId, diaryEntryId, capturedAt (UTC), localDate (YYYY-MM-DD),
  timezone ("America/Sao_Paulo"), clientRequestId (unique, idempotência),
  mood (1-5), energy (1-5), anxiety? (1-5), irritability? (1-5),
  warningSignsNow? (JSON), note?
}

model SleepLog {
  userId, date, bedtime (HH:MM), wakeTime (HH:MM),
  bedtimeAt? (UTC), wakeTimeAt? (UTC), totalHours, quality (0-100),
  perceivedQuality? (0-100), awakenings, awakeMinutes,
  hrv? (ms), heartRate? (bpm), excluded (default false),
  source ("manual"|"hae"|"health_connect"|"unknown_legacy"),
  fieldProvenance? (JSON), providerRecordId?, rawHash?, mergeLog? (JSON)
  @@unique([userId, date, bedtime])
}

model WeeklyAssessment {
  userId, date (YYYY-MM-DD, week ending),
  asrmScores? (JSON [0-4]×5), asrmTotal? (0-20, >=6 hipomania),
  phq9Scores? (JSON [0-3]×9), phq9Total? (0-27),
  phq9Item9? (ideação suicida, separado para safety),
  fastScores? (JSON), fastAvg?
  @@unique([userId, date])
}

model Medication {
  userId, name, dosageText?, instructions?, isActive, isAsNeeded (PRN),
  riskRole ("mood_stabilizer"|"antipsychotic"|"antidepressant"|"anxiolytic"|"sleep_aid"|"prn"|"other"),
  startDate, endDate?
}
model MedicationSchedule { medicationId, timeLocal (HH:mm), effectiveFrom, effectiveTo? }
model MedicationLog { medicationId, scheduleId, date, status (TAKEN|MISSED), source }

model Narrative {
  userId, periodStart, periodEnd, status ("completed"|"failed"|"fallback"),
  riskLevel, dataQuality, model ("gpt-5.4"), sourceFingerprint (SHA-256),
  outputJson (JSON), guardrailPassed, guardrailViolations (String[]),
  inputTokens?, outputTokens?, latencyMs?
}

model ProfessionalAccess {
  userId, token (unique), pinHash (argon2), label?,
  expiresAt, revokedAt?, failedPinAttempts (lockout: 5→15min, 10→24h, 20→revogação)
}
model ProfessionalNote { accessId, content (Text, max 5000), @@index([accessId, createdAt]) }
model AccessLog { accessId, action, ip? (masked) }

model Consent {
  userId, scope ("health_data"|"terms_of_use"|"ai_narrative"|"push_notifications"|"whatsapp"|"professional_sharing"),
  version (Int), grantedAt, revokedAt?, ipAddress? (masked /24)
}

// Risk v2: 3-rail alert system
model DailyRiskSnapshot { userId, localDate, alertLayer (CLEAR|YELLOW|ORANGE|RED), safety/syndrome/prodrome (JSON) }
model AlertEpisode { userId, layer, startedAt, minHoldUntil?, modalCooldownUntil?, resolvedAt? }
model SafetyScreeningSession { userId, source, asq? (JSON), bssa? (JSON), disposition, alertLayer }

model NativeSession {
  userId, deviceId, platform, refreshTokenHash (unique, SHA-256),
  tokenFamily, rotatedFrom?, revokedAt?, lastIp? (masked /24)
}

// + CrisisPlan, JournalEntry, LifeChartEvent, HealthMetric, FinancialTransaction,
//   PlannerBlock, GoogleAccount, IntegrationKey, PushSubscription, CognitiveTest,
//   SocioeconomicProfile, SOSEvent, RateLimit, NewsArticle, etc.
```

---

## 6. CLINICAL SAFETY

### SafetyNudge Component
- **Triggers**: PHQ-9 item 9 ≥ 1, riskLevel "atencao_alta", mixed state (forte/provável), ≥3 noites curtas consecutivas, ≥2 sinais de mania
- **2 níveis**: atenção (CVV 188 + link SOS) e cuidado (CAPS/UBS)
- **Safety gate RED**: SafetyModeScreen (early return no dashboard — UI simplificada)

### Risk v2: Three-Rail Alert System
- **RED**: Acute safety (ASQ/BSSA positive) → SafetyModeScreen only
- **ORANGE/YELLOW**: Attention → AlertCard + optional screening
- **CLEAR**: Baseline
- **Hysteresis**: minHoldUntil (12-48h), modalCooldownUntil (24h)

### AI Guardrails (17 forbidden patterns)
- Narrativa IA proibida de: diagnosticar, prescrever, sugerir mudança de medicação, minimizar risco
- High-risk: safety prefix extra + template fallback se guardrails falharem
- `store: false` (LGPD: zero persistência na OpenAI)

### Disclaimers (persistentes em toda a aplicação)
- Onboarding (Steps 6-7): consent + disclaimer
- Footer: "Conteúdo educacional — não substitui tratamento médico"
- AI narratives: "Esta análise é apenas educacional — não é diagnóstico"
- SOS: "Em caso de crise imediata, ligue CVV 188"
- Chatbot: "Conversando com uma IA. Não substitui atendimento profissional."
- Weekly assessment: "indicadores de rastreio, não um diagnóstico"
- Report button no chatbot

---

## 7. ACESSIBILIDADE

- 196+ atributos `aria-*`, 103+ atributos `role=`
- Touch targets ≥44px em 113+ instâncias (35+ arquivos)
- `prefers-reduced-motion` e `prefers-reduced-transparency` respeitados
- WCAG AA contraste verificado matematicamente (17 pares, todos PASS)
- Dark mode 100% tokenizado (zero `dark:*-gray` hardcoded)
- Suite E2E dedicada (`e2e/accessibility.spec.ts`): WCAG, ARIA, keyboard navigation
- `role="alert" aria-live="assertive"` em ErrorBoundary
- `role="progressbar"` com `aria-valuenow/min/max` em StabilityScoreWidget
- `role="figure" aria-label` em MiniTrendChart
- CoachMarks: focus trap + Escape dismiss + auto-focus
- iOS input zoom prevention: global `font-size: 16px` em inputs

---

## 8. PERFORMANCE

- **Recharts**: todas as 11 instâncias lazy-loaded (`dynamic(() => import(...), { ssr: false })`) — ~400KB bundle reduction
- **Memoization**: 50+ instâncias de `useCallback`, `useMemo`, `React.memo`
- **ISR**: `/noticias` revalidates every 3600s
- **Cache headers**: APIs `no-store, max-age=0`; Admin `no-store, no-cache, must-revalidate`
- **Sharp**: image optimization
- **Parallel data fetching**: Dashboard `/hoje` (1050 linhas) busca 15+ queries em paralelo via Promise.all

---

## 9. TESTES (262 ARQUIVOS)

### E2E (Playwright — Chrome + Safari Mobile 390×844)
- `accessibility.spec.ts` — WCAG compliance, ARIA, keyboard navigation
- `api-security.spec.ts` — CSRF validation, rate limits, auth bypass attempts
- `clinical-safety.spec.ts` — Disclaimer visibility, assessment validation, safety nudges
- `performance.spec.ts` — LCP, CLS, memory
- `critical-flows.spec.ts` — Core user journeys
- `middleware-smoke.spec.ts` — Auth redirect, session
- `user-flows.spec.ts` — Sign up, check-in, insights

### Unit (Vitest)
- 255+ test files covering auth, security, sleep aggregation, risk scoring, etc.

---

## 10. API SURFACE COMPLETA (94 ROTAS)

### Auth & Account
```
/api/auth/login, /cadastro, /logout, /forgot-password, /reset-password
/api/auth/google-login, /google-login/callback, /google/disconnect
/api/auth/apple-login, /apple-login/callback
/api/auth/complete-onboarding, /excluir-conta, /export
```

### Health Data
```
/api/diario (CRUD mood), /diario/snapshots, /diario/tendencias, /diario/confirm-summary
/api/sono (CRUD sleep), /sono/excluir, /sono/tendencias
/api/avaliacao-semanal (ASRM + PHQ-9 + FAST)
/api/medicamentos (CRUD), /medicamentos/[id], /medicamentos/logs, /medicamentos/summary
/api/life-chart, /api/funcionamento, /api/cognitivo
/api/exercicios, /api/perfil-socioeconomico
```

### AI & Insights
```
/api/insights-narrative (POST=generate, GET=cached, DELETE=LGPD)
/api/insights-narrative/feedback
/api/insights-summary
```

### Crisis
```
/api/sos (event logging, public), /sos/chat (Anthropic Claude), /sos/report
/api/plano-de-crise, /api/safety-screening
```

### Financial
```
/api/financeiro (CRUD), /financeiro/[id], /financeiro/import, /financeiro/import-email
/financeiro/inbound-email, /financeiro/pluggy/connect, /financeiro/pluggy/webhook
/financeiro/feedback, /financeiro/historico, /financeiro/range, /financeiro/resumo
```

### Integrations
```
/api/integrations/health-export (HAE), /health-export/import, /health-export/status
/api/integrations/health-connect, /health-connect/status
/api/integrations/settings
/api/google/sync
```

### Professional Access (LGPD data sharing)
```
/api/acesso-profissional (create link+PIN)
/api/acesso-profissional/[token] (validate PIN)
/api/acesso-profissional/[token]/notas (GET/POST/DELETE professional notes)
```

### Native App
```
/api/native/auth/login, /auth/refresh, /auth/logout, /auth/apple-login
/api/native/home, /api/native/plano-de-crise
```

### Cron (Vercel Cron, CRON_SECRET auth)
```
/api/cron/send-reminders (every minute — push + WhatsApp)
/api/cron/purge-access-logs (daily 03:00 UTC — LGPD: purge >90d)
/api/cron/reactivation (daily — 3-tier re-engagement)
```

### Other
```
/api/consentimentos, /api/display-preferences, /api/feedback, /api/feedback/contextual
/api/health, /api/journal (CRUD), /api/journal/consent, /api/journal/export
/api/journal/reflection, /api/lembretes, /api/meta-events, /api/noticias
/api/planner/blocks, /api/planner/rules, /api/push-subscriptions
/api/relatorio, /api/relatorio/export, /api/whatsapp/webhook, /api/admin/audit
```

---

## 11. CONTA APPLE DEVELOPER

- **Tipo**: Individual (Julio Cesar de Sousa Yamada)
- **Enrollment ID**: 5J4DNRWRS2
- **Team ID**: 7MQYXX5DRU
- **Bundle ID**: com.suportebipolar.app
- **SKU**: suportebipolar-ios-001
- **Build atual**: uploaded para App Store Connect (2026-03-31), processando no TestFlight
- **Risco 5.1.1(ix)**: conta individual pode não satisfazer requirement de entidade legal para apps de saúde com dados sensíveis. Análise SuperGrok anterior: 55% individual vs 85%+ organização.

---

## 12. APP STORE REVIEW NOTES (COMPLETO)

### Demo Account
- Email: `reviewer@suportebipolar.com`
- Password: `Review2026!SB`
- Pre-populated com 30 dias de dados (humor, sono, avaliações, journal)

### Walkthrough (5 min)
1. Login → Face ID prompt (Cancel to skip)
2. Dashboard `/hoje` → mood card, medication dose progress, sleep summary, theme toggle
3. Check-in `/checkin` → mood (1-5), energy, anxiety, irritability + haptic feedback
4. Sleep `/sono` → history color-coded + add record
5. Insights `/insights` → AI narrative, stability score ring, heatmap, cycling analysis
6. SOS `/sos` → CVV 188, SAMU 192, grounding, chatbot, voice mode
7. Weekly Assessment → ASRM + PHQ-9 + FAST
8. Account `/conta` → Face ID toggle, theme, export (LGPD), delete account
9. Push Notifications → contextual request after first check-in, scheduled 9:00 + 22:00

### Privacy (iOS app)
- **ZERO tracking**: GA, Clarity, Meta Pixel load ONLY on public marketing site, NOT in authenticated app
- Vercel Analytics: anonymous performance metrics only
- No health data for advertising
- No iCloud, no IDFA
- Delete account + all data in-app
- LGPD-compliant, PrivacyInfo.xcprivacy included

### Third-Party AI Disclosure (Guideline 5.1.2)
- **AI Narratives**: OpenAI GPT (`store:false`, zero retention). Explicit consent screen naming "OpenAI". Versioned, revocable.
- **SOS Chatbot**: Anthropic Claude. Banner: "Suas mensagens são processadas pela Anthropic (IA)." No consent gate (LGPD Art. 11 II e — vital interest).
- Both: minimum data, no PII beyond clinical necessity.

### Content Rating
- Medical/Treatment Information: Yes (self-monitoring only)
- Unrestricted Web Access: No
- Age Rating: 17+
- **NOT** regulated medical device

---

## 13. APP STORE METADATA

```
App Name: Suporte Bipolar
Subtitle: Humor, sono e autocuidado
Category: Health & Fitness / Medical
Keywords: bipolar,humor,sono,saude mental,autocuidado,depressao,mania,IPSRT,diario,insights

Promotional Text: "Registre humor e sono em 30 segundos. Insights com IA, avaliacoes clinicas e modo SOS. Gratuito, seguro e baseado em evidencias."

Support: https://suportebipolar.com/ajuda
Privacy: https://suportebipolar.com/privacidade
Marketing: https://suportebipolar.com

Screenshots (sugeridos): Dashboard, Check-in, Insights+gráficos, Sono histórico, SOS mode, Biometria, Avaliação semanal, AI narrative
```

---

## 14. AUDITORIAS ANTERIORES

| Auditoria | Score | Data |
|---|---|---|
| GPT Pro R1 | 4.5/10 | 2026-03 |
| GPT Pro R2 | 7.4/10 | 2026-03 |
| GPT Pro R3 | 8.2/10 | 2026-03 |
| Code readiness | 8.7/10 | 2026-03-28 |
| Security | 9.75/10 | 2026-03-28 |
| Clinical safety | 9.9/10 | 2026-03-28 |

---

## 15. PERGUNTAS ESPECÍFICAS

Responda cada uma com análise fundamentada:

1. **`server.url` (WebView remoto)** — É risco real de Guideline 4.2 dado os 9 pilares nativos? O que fazer para mitigar além do que já temos?

2. **Conta individual vs organização** — É realmente bloqueador para 5.1.1(ix)? Vale migrar antes de submeter ou submeter individual e ver?

3. **`aps-environment: development`** — Precisa mudar para `production` manualmente antes de submeter? Ou o Xcode Archive para App Store resolve automaticamente?

4. **Privacy labels** — Quais categorias exatas devemos marcar no App Store Connect para ser 100% consistente com nosso PrivacyInfo.xcprivacy? Liste cada uma.

5. **AI + saúde mental** — O fato de usarmos OpenAI + Anthropic para gerar conteúdo de saúde mental cria risco adicional na review? Nosso disclosure é suficiente?

6. **Features v1.0** — Existe funcionalidade que devemos REMOVER da v1.0 para reduzir superfície de ataque na review? Ou algo que devemos ADICIONAR?

7. **Info.plist** — Está faltando alguma key obrigatória para submissão? (Temos: FaceID, Microphone, Speech Recognition, URL Schemes, Background Modes)

8. **Screenshots** — Qual sequência de 8 screenshots maximiza a primeira impressão do reviewer? O que incluir/excluir?

---

**Seja exaustivo. Não economize. Prefiro 50 itens reais a 10 genéricos. Para cada item: severidade, descrição, ação corretiva concreta com file/linha quando aplicável.**
