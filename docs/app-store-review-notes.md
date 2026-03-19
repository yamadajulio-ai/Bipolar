# App Store Review Notes — Suporte Bipolar

## Demo Account
- Email: reviewer@suportebipolar.com
- Password: [criar antes da submissão]
- Pre-populated with 30 days of sample data (mood, sleep, routines)

## App Description (pt-BR)
Suporte Bipolar é um app gratuito de monitoramento e autogestão para pessoas com transtorno bipolar. Permite registrar humor, sono, rotina e gerar insights sobre padrões ao longo do tempo.

**O app NÃO faz diagnóstico, NÃO prescreve tratamento e NÃO substitui acompanhamento profissional.** É uma ferramenta de suporte ao autocuidado.

## Key Features (Native Value)
1. **Biometric Lock (Face ID / Touch ID)** — Health data is protected behind biometric authentication on launch and resume. Users can enable/disable in Settings.

2. **Native Push Notifications (APNs)** — Reminders for daily check-in (9:00), sleep logging (22:00), medication, and weekly assessment. Uses APNs, not Web Push.

3. **Local Notifications** — Scheduled routines and reminders work without internet connectivity.

4. **Offline Crisis Resources** — Emergency contacts (CVV 188, SAMU 192), grounding exercise (5-4-3-2-1), and safety messages are always available, even without internet.

5. **Deep Links / Universal Links** — Push notification taps navigate directly to the relevant screen (check-in, sleep, insights).

6. **Native Share Sheet** — Share crisis contacts, invite friends, or export weekly reports via iOS share sheet.

## Health & Safety Disclaimers
- Displayed at first launch and in Settings
- "Este app não substitui avaliação ou acompanhamento profissional de saúde."
- "Em caso de crise imediata, ligue para o CVV 188 (gratuito, 24h) ou procure ajuda presencial."
- "Os dados apresentados são para autoconhecimento e não têm finalidade diagnóstica."
- AI-generated summaries include: "Powered by IA — não substitui avaliação profissional"

## Privacy
- No health data is used for advertising or marketing
- No data stored in iCloud
- User can delete account and all data in-app (Settings → Excluir Conta)
- Privacy policy: https://suportebipolar.com/privacidade
- Terms of use: https://suportebipolar.com/termos

## Privacy Nutrition Label Categories
- Health & Fitness: mood logs, sleep records, daily routines (linked to user)
- Contact Info: email address (account creation)
- Identifiers: user ID
- Usage Data: app interactions (anonymous, via Vercel Analytics)
- Diagnostics: crash reports (Sentry, PII scrubbed)

## Content Rating
- Medical/Treatment Information: Yes (self-monitoring, not treatment)
- Unrestricted Web Access: No
- Age Rating: 17+ (health data, mental health context)

## Technical Architecture
The app uses Capacitor to deliver a native iOS experience backed by a web service (suportebipolar.com). Native plugins provide biometric authentication, APNs push, local notifications, deep links, and offline crisis resources. The web layer delivers the core monitoring features (mood, sleep, routines, insights).

## Contact
- Developer: Julio Yamada
- Email: contato@suportebipolar.com
- Website: https://suportebipolar.com
