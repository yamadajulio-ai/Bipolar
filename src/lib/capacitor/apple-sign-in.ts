/**
 * Native Sign in with Apple via Capacitor.
 * Uses the iOS native Sign in with Apple dialog.
 * Includes nonce generation for replay-attack prevention (Apple security requirement).
 */
import { isNative, isIOS } from "./platform";

interface AppleSignInResult {
  identityToken: string;
  authorizationCode: string;
  nonce: string;
  fullName?: {
    givenName: string | null;
    familyName: string | null;
  };
}

/**
 * Check if native Sign in with Apple is available (iOS only).
 */
export function isAppleSignInAvailable(): boolean {
  return isNative() && isIOS();
}

/**
 * Generate a cryptographic nonce for Apple Sign In.
 * Returns both the raw nonce (sent to Apple) and SHA-256 hash (verified in JWT).
 */
async function generateNonce(): Promise<{ raw: string; hashed: string }> {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const raw = Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");

  const encoder = new TextEncoder();
  const data = encoder.encode(raw);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = new Uint8Array(hashBuffer);
  const hashed = Array.from(hashArray, (b) => b.toString(16).padStart(2, "0")).join("");

  return { raw, hashed };
}

/**
 * Perform native Sign in with Apple.
 * Returns the identity token, authorization code, nonce, and optional name.
 * Throws if the user cancels or an error occurs.
 */
export async function performAppleSignIn(): Promise<AppleSignInResult> {
  const { SignInWithApple } = await import("@capacitor-community/apple-sign-in");

  const { raw: nonce, hashed: hashedNonce } = await generateNonce();

  const result = await SignInWithApple.authorize({
    clientId: "com.suportebipolar.app",
    // redirectURI is required by plugin type but NOT used in native iOS flow
    // (Apple handles the callback natively, never hits this URL)
    redirectURI: "https://suportebipolar.com",
    scopes: "name email",
    nonce: hashedNonce,
  });

  if (!result.response?.identityToken) {
    throw new Error("No identity token received from Apple");
  }

  return {
    identityToken: result.response.identityToken,
    authorizationCode: result.response.authorizationCode || "",
    nonce: nonce,
    fullName: result.response.givenName || result.response.familyName
      ? {
          givenName: result.response.givenName || null,
          familyName: result.response.familyName || null,
        }
      : undefined,
  };
}
