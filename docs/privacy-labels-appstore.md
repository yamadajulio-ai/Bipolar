# Privacy Labels — App Store Connect

Mapping from `PrivacyInfo.xcprivacy` to App Store Connect privacy labels.

## Privacy Labels Table

| Category | Subcategory | Linked to User? | Used for Tracking? | Purpose |
|---|---|---|---|---|
| Health & Fitness | Health | Yes | No | App Functionality |
| Health & Fitness | Other Health Data | Yes | No | App Functionality (HRV from wearables) |
| Contact Info | Email Address | Yes | No | App Functionality, Account Management |
| Contact Info | Name | Yes | No | Personalization, Account Management |
| Contact Info | Phone Number | No | No | App Functionality (emergency contacts) |
| Identifiers | User ID | Yes | No | App Functionality |
| User Content | Other User Content | Yes | No | App Functionality (journal, diary, crisis plan) |
| Usage Data | Product Interaction | Yes | No | Analytics (Vercel anonymous) |
| Diagnostics | Crash Data | No | No | App Functionality (Sentry, PII scrubbed) |
| Financial Info | Other Financial Info | Yes | No | App Functionality (hidden in v1.0 but declared for future) |

## Notes

- **All categories: Not Used for Tracking.**
- `NSPrivacyTracking`: `false`
- No IDFA collection (`NSPrivacyTrackingDomains` is empty).
- Third-party processors: OpenAI (AI narratives) and Anthropic (SOS chatbot) are disclosed in Review Notes. Neither receives IDFA or advertising identifiers.
- Sentry crash data is PII-scrubbed (no user-identifying information in crash reports).
- Vercel Analytics is anonymous (no cookies, no IP persistence).
- Financial Info is declared proactively for future spending tracking feature; hidden in v1.0.
- Phone Number is not linked to user identity — stored only as emergency contact numbers in the crisis plan.
