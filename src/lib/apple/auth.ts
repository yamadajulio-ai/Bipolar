/**
 * Apple Sign In — JWT validation and user info extraction.
 *
 * Apple's identity token is a JWT signed with Apple's private key.
 * We verify it using Apple's public keys (JWKS endpoint).
 */

import { jwtVerify, importJWK, SignJWT, importPKCS8, type JWK } from "jose";

const APPLE_JWKS_URL = "https://appleid.apple.com/auth/keys";
const APPLE_ISSUER = "https://appleid.apple.com";
const APPLE_TOKEN_URL = "https://appleid.apple.com/auth/token";

/** Distinct error type for nonce failures — must NOT be caught by key rotation loop */
class NonceMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NonceMismatchError";
  }
}

let cachedKeys: { keys: JWK[]; fetchedAt: number } | null = null;

/** Fetch Apple's current public keys (cached for 1 hour) */
async function getApplePublicKeys(): Promise<JWK[]> {
  if (cachedKeys && Date.now() - cachedKeys.fetchedAt < 3600_000) {
    return cachedKeys.keys;
  }

  const res = await fetch(APPLE_JWKS_URL);
  if (!res.ok) throw new Error("Failed to fetch Apple JWKS");

  const data = await res.json();
  cachedKeys = { keys: data.keys, fetchedAt: Date.now() };
  return data.keys;
}

export interface AppleUserInfo {
  sub: string; // Apple's unique user ID
  email: string;
  emailVerified: boolean;
}

/**
 * Verify and decode an Apple identity token (JWT).
 * Returns the user's sub (unique Apple ID), email, and verification status.
 *
 * @param nonce - The raw nonce sent by the client. If provided, we verify the
 *   SHA-256 hash matches the `nonce` claim in the JWT (replay protection).
 */
export async function verifyAppleIdentityToken(
  identityToken: string,
  nonce?: string,
): Promise<AppleUserInfo> {
  const clientId = process.env.APPLE_CLIENT_ID;
  if (!clientId) throw new Error("APPLE_CLIENT_ID not configured");

  const keys = await getApplePublicKeys();

  // Pre-compute nonce hash if provided (replay protection)
  let expectedNonceHash: string | undefined;
  if (nonce) {
    const encoder = new TextEncoder();
    const data = encoder.encode(nonce);
    const hashBuffer = await globalThis.crypto.subtle.digest("SHA-256", data);
    const hashArray = new Uint8Array(hashBuffer);
    expectedNonceHash = Array.from(hashArray, (b) => b.toString(16).padStart(2, "0")).join("");
  }

  // Try each key until one works (Apple rotates keys)
  let lastError: Error | null = null;
  for (const jwk of keys) {
    try {
      const key = await importJWK(jwk, jwk.alg || "RS256");
      const { payload } = await jwtVerify(identityToken, key, {
        issuer: APPLE_ISSUER,
        audience: clientId,
      });

      // JWT verified successfully — now check nonce OUTSIDE the key loop
      // Nonce mismatch is NOT a key rotation issue, it's a security violation
      if (expectedNonceHash && payload.nonce !== expectedNonceHash) {
        throw new NonceMismatchError("Nonce mismatch — possible replay attack");
      }

      return {
        sub: payload.sub as string,
        email: payload.email as string,
        emailVerified: payload.email_verified === true || payload.email_verified === "true",
      };
    } catch (err) {
      // Nonce mismatch must propagate immediately — not a key issue
      if (err instanceof NonceMismatchError) throw err;
      lastError = err as Error;
      continue;
    }
  }

  throw lastError || new Error("No valid Apple key found");
}

/**
 * Generate Apple client secret (JWT signed with ES256) for authorization code exchange.
 * Required for the web-based OAuth flow.
 */
export async function generateAppleClientSecret(): Promise<string> {
  const teamId = process.env.APPLE_TEAM_ID;
  const clientId = process.env.APPLE_CLIENT_ID;
  const keyId = process.env.APPLE_KEY_ID;
  const privateKeyPem = process.env.APPLE_PRIVATE_KEY;

  if (!teamId || !clientId || !keyId || !privateKeyPem) {
    throw new Error("Apple OAuth env vars not configured (TEAM_ID, CLIENT_ID, KEY_ID, PRIVATE_KEY)");
  }

  const privateKey = await importPKCS8(privateKeyPem.replace(/\\n/g, "\n"), "ES256");

  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: keyId })
    .setIssuer(teamId)
    .setSubject(clientId)
    .setAudience(APPLE_ISSUER)
    .setIssuedAt()
    .setExpirationTime("180d")
    .sign(privateKey);
}

/**
 * Exchange authorization code for tokens (web flow).
 */
export async function exchangeAppleCode(code: string): Promise<{ id_token: string }> {
  const clientId = process.env.APPLE_CLIENT_ID;
  const redirectUri = process.env.APPLE_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    throw new Error("APPLE_CLIENT_ID or APPLE_REDIRECT_URI not configured");
  }

  const clientSecret = await generateAppleClientSecret();

  const res = await fetch(APPLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Apple token exchange failed: ${res.status} ${text}`);
  }

  return res.json();
}

/**
 * Exchange authorization code for tokens (native flow — no redirect URI).
 * Returns refresh_token for storage (needed for account deletion/token revocation).
 */
export async function exchangeAppleCodeForTokens(
  code: string,
  redirectUri?: string,
): Promise<{ refresh_token?: string }> {
  const clientId = process.env.APPLE_CLIENT_ID;
  if (!clientId) return {};

  try {
    const clientSecret = await generateAppleClientSecret();

    // Apple requires redirect_uri in token exchange when it was used in the
    // authorization request (web flow). For native iOS flow without redirect,
    // omit it — Apple rejects mismatched redirect_uri.
    const params: Record<string, string> = {
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
    };
    if (redirectUri) {
      params.redirect_uri = redirectUri;
    }

    const res = await fetch(APPLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(params),
    });

    if (!res.ok) {
      console.error(JSON.stringify({ event: "apple_token_exchange_failed", status: res.status }));
      return {};
    }

    const data = await res.json();
    return { refresh_token: data.refresh_token };
  } catch (err) {
    console.error(JSON.stringify({ event: "apple_token_exchange_error", message: (err as Error).message?.slice(0, 200) }));
    return {};
  }
}

const APPLE_REVOKE_URL = "https://appleid.apple.com/auth/revoke";

/**
 * Revoke an Apple refresh token (required on account deletion per Apple guidelines).
 * Best-effort: logs error but doesn't throw.
 */
export async function revokeAppleToken(refreshToken: string): Promise<boolean> {
  const clientId = process.env.APPLE_CLIENT_ID;
  if (!clientId) return false;

  try {
    const clientSecret = await generateAppleClientSecret();

    const res = await fetch(APPLE_REVOKE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        token: refreshToken,
        token_type_hint: "refresh_token",
      }),
    });

    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Get Apple OAuth authorization URL (web flow).
 */
export function getAppleAuthUrl(state: string): string {
  const clientId = process.env.APPLE_CLIENT_ID;
  const redirectUri = process.env.APPLE_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    throw new Error("APPLE_CLIENT_ID or APPLE_REDIRECT_URI not configured");
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code id_token",
    response_mode: "form_post",
    scope: "name email",
    state,
  });

  return `https://appleid.apple.com/auth/authorize?${params}`;
}
