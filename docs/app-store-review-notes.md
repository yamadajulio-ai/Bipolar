# App Store Review Notes — Suporte Bipolar

---

## ENGLISH (Primary — for Apple Review Team)

---

### Demo Account

- **Email**: reviewer@suportebipolar.com
- **Password**: Review2026!SB
- Pre-populated with 30 days of realistic sample data (mood, sleep, weekly assessments, journal entries, medication logs, wearable metrics)

---

### 5-Minute Walkthrough

1. **Login** — Use the demo credentials above. A Face ID prompt will appear; tap "Cancel" to skip during review.
2. **Dashboard (/hoje)** — View the stability score ring, today's mood/energy/sleep/medication status, risk radar, 7-day trend chart, and body metrics (steps, HRV, heart rate).
3. **Check-in (/checkin)** — Tap "Check-in" in the BottomNav. Register mood (1-5), energy, anxiety, and irritability. Haptic feedback confirms save.
4. **Sleep (/sono)** — Tap "Sono" in the BottomNav. View sleep history with color-coded duration bars. Tap "+" to add a manual sleep record.
5. **Insights (/insights)** — Tap "Insights". View the AI narrative summary, stability score, mood thermometer, combined pattern analysis, correlations, episode prediction, and rapid cycling detection.
6. **SOS Mode (/sos)** — Tap the floating "SOS" button above the BottomNav. See crisis resources (CVV 188, SAMU 192), a grounding exercise (5-4-3-2-1 sensory technique), and an AI chatbot. Voice mode is available via the microphone icon.
7. **Weekly Assessment (/avaliacao-semanal)** — Menu > Avaliacao Semanal. Complete the ASRM (mania), PHQ-9 (depression), and FAST Short (functioning) clinical scales in a guided 4-step wizard.
8. **Account (/conta)** — Menu > Conta. Toggle Face ID/Touch ID, change theme, export all data (LGPD compliance), or permanently delete the account.
9. **Push Notifications** — The app requests push permission contextually after the user completes their first check-in (not on launch). Local notifications are scheduled for 9:00 and 22:00 daily.

---

### 9 Native Pillars (Guideline 4.2 Compliance)

This app provides significant native value that is **not achievable** through a standard mobile website or PWA:

#### 1. Biometric Authentication (Face ID / Touch ID)
- Health data is protected behind biometric authentication on launch AND app resume.
- Uses the iOS Keychain via the NativeBiometric Capacitor plugin.
- **Why not web**: The Web Authentication API on iOS Safari does not provide reliable, automatic biometric gating on every app resume. Only native Keychain integration delivers consistent lock-screen-level protection for sensitive health records.

#### 2. Native Push Notifications (APNs)
- Daily reminders for check-in (9:00) and sleep logging (22:00), medication reminders at user-configured times, and weekly assessment reminders.
- Uses Apple Push Notification service (APNs) directly.
- Notifications never display sensitive health data on the lock screen. Generic titles such as "Bom dia!" are used. Users with privacy mode enabled see only "Suporte Bipolar --- Voce tem um lembrete pendente."
- **Why not web**: iOS Safari does not support reliable Web Push for time-sensitive health reminders. APNs is the only mechanism that guarantees delivery and scheduling fidelity on iOS.

#### 3. Local Notifications
- Medication timing alerts and scheduled routine reminders work entirely offline, without any server round-trip.
- **Why not web**: Background scheduling of local notifications requires native APIs (`LocalNotifications` plugin). The Web Notifications API cannot schedule future notifications without an active service worker and connectivity.

#### 4. Offline Crisis Resources
- Emergency contacts (CVV 188, SAMU 192, Bombeiros 193) with direct `tel:` links.
- A grounding exercise (5-4-3-2-1 sensory technique) and safety messages cached locally via the native Preferences API.
- A dedicated offline fallback page ships inside the app bundle (`out/` directory).
- **Why not web**: A mental health crisis can occur without internet access. Native local storage and a bundled offline page guarantee that life-saving resources are always reachable. A PWA service worker cannot guarantee the same level of offline reliability on iOS Safari.

#### 5. Haptic Feedback
- Tactile responses for SOS activation (heavy impact), check-in completion (success notification), and biometric unlock (medium impact).
- **Why not web**: The Web Vibration API is not available in iOS Safari or WKWebView. Only native `Haptics` plugin calls produce tactile feedback on iPhone.

#### 6. Deep Links / Universal Links
- Custom URL scheme (`suportebipolar://`) for app-to-app navigation.
- Push notification taps navigate directly to the relevant screen inside the app.
- Universal Links (`applinks:suportebipolar.com`) configured for seamless web-to-app handoff.
- **Why not web**: Custom URL schemes and Universal Links require native app registration with iOS. Websites cannot intercept or respond to these link types.

#### 7. Native Share Sheet
- Share crisis contacts with trusted people, share weekly reports with healthcare professionals, and invite others to the app via the native iOS share sheet.
- **Why not web**: The Web Share API on iOS is limited and does not support all share targets or rich content previews that the native `UIActivityViewController` provides.

#### 8. Status Bar Integration
- Native status bar styling matches the app theme (light/dark).
- Keyboard accessory bar for improved text input in journaling and chat.
- **Why not web**: Web apps cannot control iOS status bar appearance or provide native keyboard accessories.

#### 9. Voice-Assisted SOS (Microphone + Speech Recognition)
- Hands-free voice mode in the SOS chatbot for moments of crisis when the user may not be able to type.
- Speech-to-text transcription (no audio is stored or transmitted).
- Text-to-speech for assistant responses.
- Explicit consent is shown before activating voice features.
- **Why not web**: Reliable speech recognition in background or lock-screen scenarios requires native microphone permissions and APIs. The Web Speech API on iOS Safari is unreliable and does not persist across page lifecycle events.

---

### Health & Safety Disclaimers

- Displayed during onboarding (Steps 6-7: consent and final reminders).
- Persistent footer on every screen: "Educational content --- does not replace medical or psychological treatment."
- AI-generated summaries include: "This analysis is educational only --- it is not a medical diagnosis and does not replace professional evaluation."
- SOS page: "In case of immediate crisis, call CVV 188."
- SOS chatbot: a persistent banner with CVV 188 and SAMU 192 links is always visible.
- All safety nudges (SafetyNudge component) include tiered resources: SAMU 192 / CVV 188 / CAPS-UBS.
- Weekly assessment results: "These results are screening indicators, not a diagnosis."
- Chatbot disclosure: "You are talking to an AI. It does not replace professional care."
- A report button is available in the chatbot to flag concerning AI responses.

---

### Regulatory Status

**This app is NOT a regulated medical device.** It is a self-monitoring and self-care support tool. It does not diagnose conditions, does not recommend treatments, and does not replace professional medical evaluation. All clinical disclaimers are prominently displayed throughout the app.

---

### Privacy

- **Zero tracking in the iOS app**: Google Analytics, Microsoft Clarity, and Meta Pixel load ONLY on the public marketing website (suportebipolar.com public pages). They do NOT load inside the authenticated app experience that iOS users interact with.
- **No IDFA**: `NSPrivacyTracking: false`. The app does not use the Advertising Identifier.
- **No iCloud**: No health data is stored in or synced to iCloud.
- **No health data used for advertising or marketing**, ever.
- **Delete account**: Users can permanently delete their account and all associated data directly from the app (Settings > Excluir Conta). Deletion is immediate and irreversible.
- **Data export**: Users can export and delete all their data directly from the app at any time (Settings > Exportar Dados), in compliance with LGPD (Brazilian General Data Protection Law).
- Vercel Analytics (anonymous performance metrics only, no PII) is the only analytics that loads inside the app, for infrastructure monitoring.
- Privacy Manifest (`PrivacyInfo.xcprivacy`) is included in the app bundle with 10 data type declarations.
- Privacy policy: https://suportebipolar.com/privacidade
- Terms of use: https://suportebipolar.com/termos

---

### Third-Party AI Disclosure (Guideline 5.1.2)

This app uses two third-party AI providers. Both are used strictly for **educational purposes** --- the app **does not diagnose, does not prescribe, and does not provide medical advice**.

1. **OpenAI (GPT)** --- Powers the AI narrative summaries on the Insights page.
   - `store: false` is set on every API call. OpenAI does **not** retain or train on any user data.
   - Users see an explicit consent screen naming "OpenAI" as the data processor before first use. Consent is versioned and revocable.
   - Only the minimum clinically necessary data is sent (mood scores, sleep hours, assessment results). No PII beyond what is required for the feature.

2. **Anthropic (Claude)** --- Powers the SOS crisis chatbot.
   - Disclosure banner is always visible: "Your messages are processed by Anthropic (AI)."
   - No consent gate is required because this is a crisis feature (LGPD Art. 11 II e --- vital interest override).
   - No audio is stored or transmitted. Voice mode uses on-device speech-to-text.

**Both providers receive only the minimum data required. Neither provider stores, retains, or trains on user data. All AI outputs include prominent disclaimers that they are educational only and do not replace professional care.**

---

### Offline Behavior

If connectivity is lost, the app shows an **offline crisis screen** with:
- Emergency phone numbers (CVV 188, SAMU 192, Bombeiros 193) as tappable `tel:` links
- A grounding exercise (5-4-3-2-1 sensory technique)
- Safety messages cached locally

**How to test offline**: Enable Airplane Mode on the device, then relaunch the app. The offline crisis screen will appear with all emergency resources accessible.

---

### Content Rating

- **Age Rating**: 17+ (health data, mental health context)
- Medical/Treatment Information: Yes (self-monitoring, NOT treatment)
- Unrestricted Web Access: No
- **This app is NOT a regulated medical device.**

---

### Technical Architecture

Capacitor 8 native iOS app backed by a web service (suportebipolar.com). Native plugins provide biometric authentication, APNs push, local notifications, haptic feedback, deep links, offline crisis resources, voice-assisted SOS, and native share. The web layer delivers the core monitoring features (mood, sleep, assessments, insights, AI narratives). The `out/` directory contains an offline fallback page with crisis resources, ensuring users can access emergency contacts even without internet.

---

### Privacy Nutrition Label Categories

- **Health & Fitness**: mood logs, sleep records (linked to user, not used for tracking)
- **Contact Info**: email address (account creation, linked to user)
- **Name**: display name from Google/Apple OAuth (linked to user, app functionality)
- **Identifiers**: user ID (app functionality)
- **Other User Content**: journal entries, diary notes, crisis plan text (linked to user)
- **Usage Data**: app interactions (anonymous, via Vercel Analytics only --- no GA/Clarity/Pixel in iOS app)
- **Diagnostics**: crash reports (Sentry, PII scrubbed, not linked to user)
- **Phone Number**: emergency contacts in SOS/crisis plan (not linked to user)
- **Other Financial Info**: medication costs via Mobills import (linked to user)
- **Other Health Data**: heart rate variability from wearable integration (linked to user)

---

### Contact

- **Developer**: Julio Yamada
- **Email**: contato@suportebipolar.com
- **Website**: https://suportebipolar.com

---
---

## PORTUGUES (Resumo --- mesmas informacoes)

---

### Conta Demo

- **Email**: reviewer@suportebipolar.com
- **Senha**: Review2026!SB
- Pre-populada com 30 dias de dados de exemplo (humor, sono, avaliacoes semanais, diario, medicamentos, metricas corporais)

---

### Passo a Passo (5 minutos)

1. **Login** --- Use as credenciais acima. Face ID aparecera; toque "Cancelar" para pular.
2. **Dashboard (/hoje)** --- Score de estabilidade, radar de risco, estado do dia, grafico 7 dias, metricas corporais.
3. **Check-in (/checkin)** --- Registre humor (1-5), energia, ansiedade, irritabilidade. Feedback haptico ao salvar.
4. **Sono (/sono)** --- Historico de sono com barras coloridas. Toque "+" para registro manual.
5. **Insights (/insights)** --- Narrativa IA, termometro de humor, padroes combinados, correlacoes, predicao de episodios.
6. **SOS (/sos)** --- Botao flutuante. Recursos de crise (CVV 188, SAMU 192), exercicio de ancoragem, chatbot com modo voz.
7. **Avaliacao Semanal** --- Menu > Avaliacao Semanal. Escalas ASRM + PHQ-9 + FAST em 4 etapas.
8. **Conta (/conta)** --- Menu > Conta. Face ID, tema, exportar dados (LGPD), excluir conta.
9. **Notificacoes** --- Permissao solicitada apos primeiro check-in. Lembretes locais as 9:00 e 22:00.

---

### 9 Pilares Nativos (Guideline 4.2)

1. **Autenticacao Biometrica** --- Face ID/Touch ID via Keychain nativo. Web nao oferece protecao biometrica confiavel no iOS.
2. **Push Nativo (APNs)** --- Lembretes diarios e de medicacao via APNs. iOS Safari nao suporta Web Push de forma confiavel.
3. **Notificacoes Locais** --- Alertas de medicacao offline. APIs web nao permitem agendamento em background.
4. **Recursos de Crise Offline** --- CVV 188, SAMU 192, exercicio de ancoragem, tudo disponivel sem internet.
5. **Feedback Haptico** --- Vibracoes tateis no SOS, check-in e biometria. Indisponivel em Safari/WebView.
6. **Deep Links** --- Esquema `suportebipolar://` e Universal Links para navegacao app-to-app.
7. **Compartilhamento Nativo** --- Share sheet iOS para contatos de crise e relatorios.
8. **Integracao com Status Bar** --- Estilo nativo da barra de status e teclado com barra acessoria.
9. **SOS por Voz** --- Modo voz no chatbot de crise. Speech-to-text nativo; nenhum audio armazenado.

---

### Saude e Seguranca

- **Este app NAO e um dispositivo medico regulamentado.**
- Nao faz diagnostico, nao prescreve tratamento, nao substitui avaliacao profissional.
- Disclaimers exibidos no onboarding, footer, narrativas IA, SOS, avaliacoes e chatbot.
- SafetyNudge com recursos em 3 niveis: SAMU 192 / CVV 188 / CAPS-UBS.

---

### Privacidade

- **Zero rastreamento no app iOS**: GA, Clarity e Meta Pixel carregam APENAS no site publico.
- Sem IDFA, sem iCloud, sem dados de saude para publicidade.
- Exportacao e exclusao de dados a qualquer momento pelo app.
- Privacy Manifest (`PrivacyInfo.xcprivacy`) incluido.
- LGPD-compliant.
- Politica de privacidade: https://suportebipolar.com/privacidade

---

### IA de Terceiros (Guideline 5.1.2)

1. **OpenAI (GPT)** --- Narrativas IA. `store:false`, sem retencao. Consentimento explicito nomeando "OpenAI".
2. **Anthropic (Claude)** --- Chatbot SOS. Banner de divulgacao sempre visivel. Sem gate de consentimento (crise, LGPD Art. 11 II e).

**Ambos os provedores: uso estritamente educacional, sem diagnostico, sem prescricao. Nenhum dado retido ou usado para treinamento.**

---

### Offline

Se a conectividade for perdida, o app exibe uma **tela de crise offline** com numeros de emergencia (CVV 188, SAMU 192, Bombeiros 193) e exercicio de ancoragem.

**Como testar**: Ative o Modo Aviao e reabra o app.

---

### Classificacao de Conteudo

- **Idade**: 17+ (dados de saude, contexto de saude mental)
- **NAO e um dispositivo medico regulamentado.**

---

### Contato

- **Desenvolvedor**: Julio Yamada
- **Email**: contato@suportebipolar.com
- **Website**: https://suportebipolar.com
