# App Store Review Notes — Suporte Bipolar

## Demo Account
- Email: reviewer@suportebipolar.com
- Password: Review2026!SB
- Pre-populated with 30 days of sample data (mood, sleep, weekly assessments, journal entries)

## Reviewer Walkthrough (5 minutes)

1. **Login** → Use demo credentials above. Face ID prompt will appear (tap "Cancel" to skip during review).
2. **Dashboard (/hoje)** → See today's mood card, medication card with dose progress, sleep summary, and quick theme toggle (sun/moon icon).
3. **Check-in (/checkin)** → Tap BottomNav "Check-in". Register mood (1-5), energy, anxiety, irritability. Haptic feedback on save.
4. **Sleep (/sono)** → Tap "Sono" in BottomNav. View sleep history with color-coded cards. Tap "+" to add a sleep record.
5. **Insights (/insights)** → Tap "Insights". View AI narrative ("Resumo inteligente"), stability score ring, calendar heatmap, mood thermometer, and cycling analysis.
6. **SOS Mode (/sos)** → Tap "SOS" floating button (above BottomNav). See crisis resources (CVV 188, SAMU 192), grounding exercise, and chatbot. Voice mode available (microphone icon).
7. **Weekly Assessment (/avaliacao-semanal)** → Menu > Avaliação Semanal. Complete ASRM + PHQ-9 + FAST scales.
8. **Account (/conta)** → Menu > Conta. Toggle Face ID/Touch ID, change theme, export data (LGPD), delete account.
9. **Push Notifications** → The app requests push permission contextually when you first complete a check-in. Local notifications are scheduled for 9:00 and 22:00.

## App Description (pt-BR)
Suporte Bipolar é um app gratuito de monitoramento e autogestão para pessoas com transtorno bipolar. Permite registrar humor, sono, rotina e gerar insights sobre padrões ao longo do tempo.

**O app NÃO faz diagnóstico, NÃO prescreve tratamento e NÃO substitui acompanhamento profissional.** É uma ferramenta de suporte ao autocuidado.

## Native Functionality (Guideline 4.2 Compliance)

This app provides significant native value beyond what a website can offer:

### 1. Biometric Authentication (Face ID / Touch ID)
- Health data is protected behind biometric authentication on launch AND app resume
- Users can enable/disable in Settings > Conta
- Uses iOS Keychain via NativeBiometric plugin
- **Not achievable via web**: Web API biometric support is experimental and unreliable on iOS Safari

### 2. Native Push Notifications (APNs)
- Daily reminders for check-in (9:00) and sleep logging (22:00)
- Medication reminders at user-configured times
- Weekly assessment reminders
- Permission requested contextually after first check-in, not on app launch
- Uses Apple Push Notification service directly, NOT Web Push
- **Privacy**: Notifications never display sensitive health data on lock screen. Generic titles like "Bom dia!" and "Hora de registrar o sono" are used. Users with privacyMode enabled see only "Suporte Bipolar — Você tem um lembrete pendente."
- **Not achievable via web**: iOS Safari does not support Web Push reliably for health reminders

### 3. Local Notifications
- Scheduled routines and reminders work without internet connectivity
- Medication timing alerts
- **Not achievable via web**: Background local notification scheduling requires native APIs

### 4. Offline Crisis Resources
- Emergency contacts (CVV 188, SAMU 192, Bombeiros 193) with direct tel: links
- Grounding exercise (5-4-3-2-1 sensory technique)
- Safety messages cached locally via native Preferences API
- Dedicated offline fallback page with full crisis resources
- **Critical for user safety**: Mental health crisis can occur without internet access

### 5. Haptic Feedback
- Tactile responses for SOS activation (heavy), check-in completion (success notification), biometric unlock (medium)
- Enhances accessibility and provides sensory confirmation for health data entry
- **Not achievable via web**: Haptics API not available in iOS WebView/Safari

### 6. Deep Links / Universal Links
- Custom URL scheme (suportebipolar://) for app-to-app navigation
- Push notification taps navigate directly to relevant screens
- Universal Links (applinks:suportebipolar.com) configuration in progress — custom scheme fully functional

### 7. Native Share Sheet
- Share crisis contacts with trusted contacts
- Share weekly reports with healthcare professionals
- Invite friends to the app

### 8. Status Bar Integration
- Native status bar styling that matches the app theme
- Keyboard accessory bar for better text input

### 9. Voice-Assisted SOS (Microphone + Speech Recognition)
- Hands-free voice mode in SOS chatbot for crisis moments
- Speech-to-text transcription (no audio stored or transmitted)
- Text-to-speech for assistant responses
- Explicit consent shown before activating voice features
- **Not achievable via web**: Reliable STT in background/lock scenarios requires native permissions

## Health & Safety Disclaimers
- Displayed during onboarding (Steps 6-7: consent and final reminders)
- Persistent in footer: "Conteúdo educacional — não substitui tratamento médico ou psicológico"
- AI-generated summaries include: "Esta análise é apenas educacional — não é um diagnóstico médico e não substitui avaliação profissional."
- SOS page: "Em caso de crise imediata, ligue para o CVV 188"
- SOS chatbot: persistent banner with CVV 188 and SAMU 192 links always visible
- All safety nudges (SafetyNudge component) include tiered resources: SAMU 192 / CVV 188 / CAPS-UBS
- Weekly assessment results: "Estes resultados são indicadores de rastreio, não um diagnóstico."
- Chatbot: "Você está conversando com uma IA. Não substitui atendimento profissional."
- Report button available in chatbot to flag concerning AI responses

## Privacy
- **No tracking in the iOS app**: Google Analytics, Microsoft Clarity, and Meta Pixel load ONLY on the public marketing website (suportebipolar.com public pages). They do NOT load inside the authenticated app experience that iOS users interact with.
- Vercel Analytics (anonymous performance metrics only, no PII) loads globally for infrastructure monitoring.
- No health data is used for advertising or marketing
- No data stored in iCloud
- No IDFA/tracking (NSPrivacyTracking: false)
- User can delete account and all data in-app (Settings > Excluir Conta)
- Privacy policy: https://suportebipolar.com/privacidade
- Terms of use: https://suportebipolar.com/termos
- LGPD-compliant (Brazilian data protection law)
- Privacy Manifest (PrivacyInfo.xcprivacy) included

## Privacy Nutrition Label Categories
- **Health & Fitness**: mood logs, sleep records (linked to user, not used for tracking)
- **Contact Info**: email address (account creation, linked to user)
- **Name**: display name from Google OAuth (linked to user, app functionality)
- **Identifiers**: user ID (app functionality)
- **Other User Content**: journal entries, diary notes, crisis plan text (linked to user)
- **Usage Data**: app interactions (anonymous, via Vercel Analytics only — no GA/Clarity/Pixel in iOS app)
- **Diagnostics**: crash reports (Sentry, PII scrubbed, not linked to user)
- **Phone Number**: emergency contacts in SOS/crisis plan (not linked to user)
- **Other Financial Info**: medication costs via Mobills import (linked to user)
- **Other Health Data**: heart rate variability from wearable integration (linked to user)

## Content Rating
- Medical/Treatment Information: Yes (self-monitoring, not treatment)
- Unrestricted Web Access: No
- Age Rating: 17+ (health data, mental health context)

## Regulated Medical Device
- **No** — This app is a self-monitoring and self-care support tool. It does not diagnose conditions, recommend treatments, or replace professional medical evaluation. All clinical disclaimers are prominently displayed throughout the app.

## Third-Party AI Disclosure (Guideline 5.1.2)
- **AI Narratives** (Insights page): Generated by **OpenAI GPT** (store:false, no data retention by OpenAI). Users see explicit consent screen naming "OpenAI" as the data processor before first use. Consent is versioned and revocable.
- **SOS Chatbot** (Crisis mode): Powered by **Anthropic Claude**. Disclosure banner: "Suas mensagens são processadas pela Anthropic (IA)." No consent gate (crisis feature, LGPD Art. 11 II e — vital interest override).
- Both providers receive only the minimum data required. No PII is sent to either provider beyond what's clinically necessary for the feature.

## Technical Architecture
Capacitor 8 native iOS app backed by a web service (suportebipolar.com). Native plugins provide biometric authentication, APNs push, local notifications, haptic feedback, deep links, offline crisis resources, voice-assisted SOS, and native share. The web layer delivers the core monitoring features (mood, sleep, assessments, insights, AI narratives). The app's `out/` directory contains an offline fallback page with crisis resources, ensuring users can access emergency contacts even without internet.

## Contact
- Developer: Julio Yamada
- Email: contato@suportebipolar.com
- Website: https://suportebipolar.com
