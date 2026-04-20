/**
 * OAuth → Capacitor bridge token.
 *
 * Problem: Google/Apple OAuth can't run inside the Capacitor WebView (Google blocks
 * embedded user agents). We open OAuth in SFSafariViewController, but its cookie jar
 * is isolated from the WebView — so the iron-session cookie set in Safari would not
 * reach the app.
 *
 * Bridge: after the OAuth callback identifies the user, we sign a short-lived HMAC
 * token and redirect to `suportebipolar://auth-success?token=<bridge>`. iOS closes
 * Safari and wakes the app, which posts the token back to `/api/auth/native-session`
 * from inside the WebView. That endpoint validates the HMAC and creates the real
 * iron-session cookie on the WebView's cookie store.
 *
 * Lifetime: 2 minutes. Single-use is enforced by flow (token only creates a
 * session — replay would just re-authenticate the same user). Signed with a subkey
 * derived from SESSION_SECRET to avoid cross-purpose collisions.
 */
import { createHmac, timingSafeEqual } from "crypto";

const BRIDGE_TTL_MS = 2 * 60 * 1000;
const BRIDGE_TYPE = "oauth-native-bridge-v1";

export interface BridgePayload {
  uid: string;
  onb: boolean;
  exp: number;
  typ: typeof BRIDGE_TYPE;
}

function getBridgeKey(): Buffer {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be set and at least 32 characters");
  }
  return createHmac("sha256", secret).update(BRIDGE_TYPE).digest();
}

export function signBridgeToken(userId: string, onboarded: boolean): string {
  const payload: BridgePayload = {
    uid: userId,
    onb: onboarded,
    exp: Date.now() + BRIDGE_TTL_MS,
    typ: BRIDGE_TYPE,
  };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", getBridgeKey()).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export function verifyBridgeToken(token: string): BridgePayload | null {
  try {
    if (typeof token !== "string" || token.length > 2000) return null;
    const dot = token.indexOf(".");
    if (dot === -1) return null;

    const data = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    const expected = createHmac("sha256", getBridgeKey()).update(data).digest("base64url");

    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length) return null;
    if (!timingSafeEqual(sigBuf, expBuf)) return null;

    const json = Buffer.from(data, "base64url").toString("utf8");
    const payload = JSON.parse(json) as BridgePayload;
    if (payload.typ !== BRIDGE_TYPE) return null;
    if (typeof payload.uid !== "string" || !payload.uid) return null;
    if (typeof payload.exp !== "number" || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}
