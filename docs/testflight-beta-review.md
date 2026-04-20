# TestFlight — Beta App Review · respostas prontas

> Formulário que o App Store Connect vai pedir ao submeter o primeiro build de **External Testing**.

---

## What to test (em inglês — vai pro tester também)

```
First beta. Please test:
1. Sign up with email (or Sign in with Apple).
2. Daily check-in flow (/hoje and /checkin).
3. Medication reminder at the time you configure.
4. Face ID unlock on re-open.
5. Crisis support flow (/sos) — text and voice modes.
6. Push notifications (grant permission on first open).

Known limits: content is in Portuguese (pt-BR); this app targets Brazilian users with bipolar disorder.
```

## Test Information (opcional, mas recomendado)

- **Beta App Description:**
  ```
  Suporte Bipolar is a companion app for people with bipolar disorder in Brazil.
  It provides daily check-in, sleep tracking, medication reminders, crisis support,
  and IPSRT-based routine monitoring. Not a medical device. Not a substitute for
  professional care.
  ```

- **Feedback Email:** `yamadaclubes@gmail.com` (ou um dedicado)
- **Marketing URL:** `https://suportebipolar.com`
- **Privacy Policy URL:** `https://suportebipolar.com/privacidade`

---

## App Review — Sign-In Information

Mesmo para TestFlight External a Apple pede acesso pra testar:

- **Sign-in required:** Yes
- **Username:** `reviewer@suportebipolar.com`
- **Password:** *(gerar via `node scripts/seed-demo-account.mjs` — a seed cria a conta com 30 dias de dados)*
- **Notes:**
  ```
  Reviewer account seeded with 30 days of sample mood, sleep, and medication data.
  "Sign in with Apple" is also available on login screen.
  ```

---

## Defesa Guideline 4.2 (se rejeitarem como "wrapper de website")

Cole na seção **App Review → Notes** ou em resposta a rejeição:

```
This app is not a web-view wrapper. It uses the following native iOS capabilities
unavailable to Safari, registered and functional in the submitted build:

1. APNs push notifications (@capacitor/push-notifications) — used for medication
   reminders and crisis check-in nudges. Triggered from a server-side APNs worker.

2. Local notifications (@capacitor/local-notifications) — user-scheduled reminders
   for sleep window, medication doses, and daily check-in.

3. Face ID / Touch ID biometric unlock (@capgo/capacitor-native-biometric) — gates
   access to mood/medication history. NSFaceIDUsageDescription declared in Info.plist.

4. Sign in with Apple (@capacitor-community/apple-sign-in) — primary auth option,
   required per Guideline 4.8 when third-party sign-in is offered.

5. Haptic feedback (@capacitor/haptics) — used on check-in confirmation and SOS
   activation for tactile feedback in crisis moments.

6. Native share sheet (@capacitor/share) — exports mood/sleep charts and monthly
   reports to Messages, Mail, and clinician-facing PDFs.

7. Universal Links (com.apple.developer.associated-domains:
   applinks:suportebipolar.com) — deep links from email campaigns and SMS reminders
   open specific routes inside the app.

8. Speech recognition + microphone (NSSpeechRecognitionUsageDescription,
   NSMicrophoneUsageDescription) — voice SOS mode transcribes user speech during
   acute crisis to reduce friction.

9. Background remote-notification mode (UIBackgroundModes) — delivers silent APNs
   pushes for time-sensitive medication windows.

10. Custom URL scheme (suportebipolar://) — for in-app deep links from reminder
    notifications.

11. Offline crisis card — key SOS contacts and coping instructions cached via
    Capacitor Preferences, readable without network.

12. Apple Health integration (via Health Auto Export + Cloudflare Worker proxy)
    — sleep data imports.

The app's value is in the combination of these native capabilities with the
bipolar-specific clinical logic (IPSRT routine tracking, life-chart visualization,
professional access tokens). The web site at suportebipolar.com does not offer
push notifications, biometric unlock, or offline crisis support.
```

---

## Export Compliance

Quando o build processar, o App Store Connect vai pedir:

- **"Does your app use encryption?"** → **Yes**
- **"Does your app qualify for any of the exemptions in Category 5 Part 2 of the
  U.S. Export Administration Regulations?"** → **Yes**
- **Qual exemption:** selecione **(b)** — "Your app uses, accesses, implements,
  or incorporates encryption that is:"
  - ☑ "Limited to encryption within the operating system (iOS)"
  - ☑ "Making a call over HTTPS using standard APIs"
  - ☑ "Encrypting existing data at rest only with a key stored outside the app"

Isso se aplica porque você usa HTTPS padrão, Keychain (via Sign in with Apple e
biometria), e APNs — tudo crypto do sistema, não algoritmo customizado.

Uma vez respondido para a versão 1.0, fica lembrado para todos os builds
subsequentes dessa versão. Quando você for pra 1.1 ou 2.0, responde de novo.

---

## Rejeições mais prováveis e como responder

### 4.2 (Minimum Functionality / "web wrapper")
→ Use a defesa acima. Enfatize os 12 recursos nativos.

### 5.1.1 (Legal — Privacy)
→ Política de privacidade tem que estar acessível **antes do login** na tela de
cadastro, e na URL `https://suportebipolar.com/privacidade`. Verificar que abre.

### 5.1.2 (Data collection for health)
→ App coleta dados sensíveis de saúde mental. Garanta que a política de
privacidade lista: o que coleta, por que, onde armazena (PostgreSQL Neon),
retenção, direito de exportar/deletar. App já tem isso — só citar na review note.

### 2.1 (App Completeness)
→ Build crashando na primeira abertura. Testar em device real antes de
submeter. Usar Xcode Organizer → pegar crash logs se rejeitar.

### 3.1.1 (In-App Purchase)
→ Se tiver qualquer cobrança dentro do app, tem que usar IAP. Por enquanto você
não tem — se adicionar assinatura no futuro, tem que migrar pra StoreKit.

---

## Timeline esperado

- Upload → processamento: 10–30 min
- Build pronto → Submit for Beta Review: clique manual seu
- Beta Review (primeira vez): **12h–48h**
- Builds subsequentes da mesma versão: **instantâneo** (sem review)
- Build expira: **90 dias** após upload
