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
    if (normalized) {
      // wa.me uses number without '+' prefix
      return `https://wa.me/${normalized.replace("+", "")}?${params.toString()}`;
    }
    // Fallback: strip non-digits (best effort for invalid numbers)
    const cleaned = phone.replace(/\D/g, "");
    return `https://wa.me/${cleaned}?${params.toString()}`;
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
  return `Meu relatório mensal de acompanhamento bipolar — ${monthName}. Gerado pelo Suporte Bipolar.`;
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
