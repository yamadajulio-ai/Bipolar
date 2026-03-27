"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface AppleSignInButtonProps {
  className?: string;
}

/**
 * Sign in with Apple button.
 * - On native iOS: uses Capacitor plugin (native Apple dialog)
 * - On web: redirects to Apple OAuth (when configured)
 */
export function AppleSignInButton({ className }: AppleSignInButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleClick() {
    setError("");
    setLoading(true);

    try {
      // Try native first (Capacitor iOS)
      const { isAppleSignInAvailable, performAppleSignIn } = await import(
        "@/lib/capacitor/apple-sign-in"
      );

      if (isAppleSignInAvailable()) {
        const result = await performAppleSignIn();

        const res = await fetch("/api/auth/apple-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            identityToken: result.identityToken,
            authorizationCode: result.authorizationCode,
            nonce: result.nonce,
            fullName: result.fullName,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "apple_login_failed");
        }

        const data = await res.json();
        router.push(data.redirect || "/hoje");
        return;
      }

      // Apple Sign In only available on native iOS — no web fallback
      throw new Error("apple_not_available");
    } catch (err) {
      const msg = (err as Error).message;
      // User cancelled — not an error
      if (msg?.includes("cancelled") || msg?.includes("canceled") || msg?.includes("1001")) {
        setLoading(false);
        return;
      }
      setError("Não foi possível entrar com Apple. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {/* Apple HIG compliant button: black bg in light mode, white bg in dark mode.
          Uses Apple's official logo path from their Sign in with Apple guidelines. */}
      <button
        onClick={handleClick}
        disabled={loading}
        className={`flex w-full items-center justify-center gap-2 rounded-[var(--radius-card)] bg-black px-4 py-2 text-[15px] font-medium text-white hover:bg-[#1a1a1a] disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-[#f0f0f0] ${className || ""}`}
        style={{ minHeight: "44px", fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', sans-serif" }}
      >
        {/* Apple logo — official glyph from Apple's HIG resources */}
        <svg className="h-[18px] w-[18px]" viewBox="0 0 17 17" fill="currentColor" aria-hidden="true">
          <path d="M12.2 4.2c-.7.8-1.8 1.4-2.8 1.3-.1-1.1.4-2.3 1.1-3 .7-.8 1.9-1.4 2.9-1.4.1 1.2-.4 2.3-1.2 3.1zm1.2 1.6c-1.6-.1-3 .9-3.8.9-.8 0-2-.9-3.3-.9-1.7 0-3.3 1-4.1 2.5-1.8 3.1-.5 7.7 1.3 10.2.8 1.2 1.9 2.6 3.2 2.5 1.3-.1 1.8-.8 3.3-.8 1.5 0 2 .8 3.3.8 1.4 0 2.3-1.2 3.2-2.4 1-1.4 1.4-2.7 1.4-2.8-.1 0-2.7-1-2.7-4 0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2.1h-.3z" />
        </svg>
        {loading ? "Entrando..." : "Continuar com Apple"}
      </button>
      {error && (
        <p className="mt-2 text-center text-xs text-red-500">{error}</p>
      )}
    </div>
  );
}
