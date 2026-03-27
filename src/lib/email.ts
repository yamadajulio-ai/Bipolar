/**
 * Email sending via Postmark API.
 * Falls back to console.log in development if POSTMARK_API_TOKEN is not set.
 */

const POSTMARK_API = "https://api.postmarkapp.com/email";

interface SendEmailParams {
  to: string;
  subject: string;
  htmlBody: string;
  textBody: string;
}

export async function sendEmail({ to, subject, htmlBody, textBody }: SendEmailParams): Promise<boolean> {
  const token = process.env.POSTMARK_API_TOKEN;
  const from = process.env.EMAIL_FROM || "Suporte Bipolar <contato@suportebipolar.com>";

  if (!token || token === "PLACEHOLDER") {
    console.warn(JSON.stringify({
      event: "email_skipped",
      reason: "postmark_not_configured",
      to: to.replace(/(.{2}).*(@.*)/, "$1***$2"),
      subject,
    }));
    return false;
  }

  const res = await fetch(POSTMARK_API, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "X-Postmark-Server-Token": token,
    },
    body: JSON.stringify({
      From: from,
      To: to,
      Subject: subject,
      HtmlBody: htmlBody,
      TextBody: textBody,
      MessageStream: "outbound",
    }),
  });

  if (!res.ok) {
    console.error(JSON.stringify({
      event: "email_send_error",
      status: res.status,
      to: to.replace(/(.{2}).*(@.*)/, "$1***$2"),
    }));
    return false;
  }

  return true;
}
