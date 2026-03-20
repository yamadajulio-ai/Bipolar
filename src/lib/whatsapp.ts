/**
 * WhatsApp integration utilities.
 *
 * Two modes:
 * 1. **wa.me links** (immediate, no setup): Generate shareable links that open WhatsApp
 * 2. **Cloud API** (requires Meta Business setup): Send messages programmatically
 *
 * For Cloud API, set these env vars:
 * - WHATSAPP_TOKEN: permanent access token from Meta Business
 * - WHATSAPP_PHONE_NUMBER_ID: the phone number ID from Meta dashboard
 * - WHATSAPP_VERIFY_TOKEN: webhook verification token (you choose)
 * - WHATSAPP_APP_SECRET: Meta App Secret for webhook signature validation
 */

import { parsePhoneNumberFromString } from "libphonenumber-js";

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const WHATSAPP_API_URL = "https://graph.facebook.com/v21.0";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://suportebipolar.com";

export function isWhatsAppConfigured(): boolean {
  return !!(WHATSAPP_TOKEN && WHATSAPP_PHONE_NUMBER_ID);
}

/**
 * Normalize a phone number to E.164 format, defaulting to BR country code.
 * Returns null if the number is invalid.
 */
export function normalizePhone(phone: string, defaultCountry: "BR" = "BR"): string | null {
  const parsed = parsePhoneNumberFromString(phone, defaultCountry);
  if (!parsed?.isValid()) return null;
  return parsed.number; // E.164, e.g. "+5511999999999"
}

/**
 * Generate a wa.me link for sharing via WhatsApp.
 * Works without any API setup — just opens the user's WhatsApp app.
 */
export function generateWhatsAppLink(phone?: string, text?: string): string {
  const params = new URLSearchParams();
  if (text) params.set("text", text);

  if (phone) {
    const normalized = normalizePhone(phone);
    if (!normalized) {
      // Invalid phone — return base wa.me without number rather than
      // generating a potentially broken link with raw digits
      return `https://wa.me/?${params.toString()}`;
    }
    // wa.me uses number without '+' prefix
    return `https://wa.me/${normalized.replace("+", "")}?${params.toString()}`;
  }

  return `https://wa.me/?${params.toString()}`;
}

/**
 * Generate a check-in reminder text for WhatsApp sharing.
 */
export function generateCheckinReminderText(): string {
  return `Hora do check-in! Como está seu humor e energia hoje? Abra o Suporte Bipolar: ${APP_URL}/checkin`;
}

/**
 * Generate a monthly report share text.
 */
export function generateReportShareText(month: string): string {
  const monthName = new Date(month + "-15").toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  return `Meu relatório mensal de acompanhamento — ${monthName}. Gerado pelo Suporte Bipolar.`;
}

// ── Generic reminder templates (LGPD: no health content) ───────
// Per legal analysis: WhatsApp messages must NEVER contain health data,
// clinical scores, mood values, or AI narrative content.
// Only generic text that doesn't reveal the nature of the app.

export const WHATSAPP_REMINDER_TEMPLATES = {
  wakeReminder: {
    templateName: "lembrete_generico",
    fallbackText: "Bom dia! Você tem um lembrete pendente no Suporte Bipolar.",
    url: "/sono",
  },
  sleepReminder: {
    templateName: "lembrete_generico",
    fallbackText: "Boa noite! Você tem um lembrete pendente no Suporte Bipolar.",
    url: "/checkin",
  },
  diaryReminder: {
    templateName: "lembrete_generico",
    fallbackText: "Olá! Você tem um lembrete pendente no Suporte Bipolar.",
    url: "/checkin",
  },
  breathingReminder: {
    templateName: "lembrete_generico",
    fallbackText: "Olá! Você tem um lembrete pendente no Suporte Bipolar.",
    url: "/exercicios",
  },
} as const;

/**
 * Send a generic reminder via WhatsApp.
 * Uses template if approved by Meta, falls back to text within 24h window.
 * NEVER includes health data in the message body (LGPD Art. 11 compliance).
 */
export async function sendWhatsAppReminder(
  phone: string,
  reminderKey: keyof typeof WHATSAPP_REMINDER_TEMPLATES,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const template = WHATSAPP_REMINDER_TEMPLATES[reminderKey];

  // Try template first (works outside 24h window)
  const result = await sendWhatsAppTemplate(phone, template.templateName);
  if (result.success) return result;

  // Template not approved yet? Try free-form text (only within 24h window)
  return sendWhatsAppText({
    to: phone,
    text: `${template.fallbackText}\n\n${APP_URL}${template.url}`,
  });
}

// ── WhatsApp Cloud API (requires Meta Business setup) ──────────

interface WhatsAppMessage {
  to: string;          // Phone number with country code (e.g., "5511999999999")
  template?: string;   // Template name (must be pre-approved by Meta)
  text?: string;       // Free-form text (only for 24h conversation window)
  language?: string;
}

/**
 * Send a template message via WhatsApp Cloud API.
 * Templates must be pre-approved in Meta Business Manager.
 */
export async function sendWhatsAppTemplate(
  to: string,
  templateName: string,
  components?: Array<Record<string, unknown>>,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!isWhatsAppConfigured()) {
    return { success: false, error: "WhatsApp não configurado" };
  }

  const normalized = normalizePhone(to);
  if (!normalized) {
    return { success: false, error: "Número de telefone inválido" };
  }

  try {
    const res = await fetch(
      `${WHATSAPP_API_URL}/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: normalized.replace("+", ""),
          type: "template",
          template: {
            name: templateName,
            language: { code: "pt_BR" },
            components,
          },
        }),
      },
    );

    const data = await res.json();

    if (!res.ok) {
      console.error("WhatsApp API error:", data?.error?.message || "Unknown");
      return { success: false, error: data.error?.message || "Erro ao enviar" };
    }

    return { success: true, messageId: data.messages?.[0]?.id };
  } catch (err) {
    console.error("WhatsApp send error:", err instanceof Error ? err.message : "Unknown");
    return { success: false, error: "Erro de conexão" };
  }
}

/**
 * Send a text message (only works within 24h conversation window).
 */
export async function sendWhatsAppText(
  msg: WhatsAppMessage,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!isWhatsAppConfigured()) {
    return { success: false, error: "WhatsApp não configurado" };
  }

  if (!msg.text) {
    return { success: false, error: "Texto obrigatório" };
  }

  const normalized = normalizePhone(msg.to);
  if (!normalized) {
    return { success: false, error: "Número de telefone inválido" };
  }

  try {
    const res = await fetch(
      `${WHATSAPP_API_URL}/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: normalized.replace("+", ""),
          type: "text",
          text: { body: msg.text },
        }),
      },
    );

    const data = await res.json();

    if (!res.ok) {
      return { success: false, error: data.error?.message || "Erro ao enviar" };
    }

    return { success: true, messageId: data.messages?.[0]?.id };
  } catch (err) {
    console.error("WhatsApp send error:", err instanceof Error ? err.message : "Unknown");
    return { success: false, error: "Erro de conexão" };
  }
}
