"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Sign in with Apple button.
 * - On native iOS (Capacitor): uses native Apple dialog via plugin
 * - On web: redirects to Apple OAuth (same pattern as Google button)
 */
export function AppleSignInButton({ className }: { className?: string }) {
  const router = useRouter();
  const [isNative, setIsNative] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // Check if ACTUALLY running inside a native Capacitor app (iOS/Android).
    // Just "Capacitor" in window is not enough — the JS SDK can be loaded in web too.
    const cap = typeof window !== "undefined" && (window as unknown as Record<string, unknown>).Capacitor;
    setIsNative(
      !!cap && typeof (cap as Record<string, unknown>).isNativePlatform === "function" &&
      (cap as { isNativePlatform: () => boolean }).isNativePlatform()
    );
  }, []);

  const buttonStyles = `flex w-full items-center justify-center gap-2 rounded-[var(--radius-card)] bg-black px-4 py-3 text-[15px] font-medium text-white hover:bg-[#1a1a1a] disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-[#f0f0f0] ${className || ""}`;
  const buttonStyle = { minHeight: "44px", fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', sans-serif" };

  const appleIcon = (
    <svg className="h-[18px] w-[18px]" viewBox="0 0 17 17" fill="currentColor" aria-hidden="true">
      <path d="M12.2 4.2c-.7.8-1.8 1.4-2.8 1.3-.1-1.1.4-2.3 1.1-3 .7-.8 1.9-1.4 2.9-1.4.1 1.2-.4 2.3-1.2 3.1zm1.2 1.6c-1.6-.1-3 .9-3.8.9-.8 0-2-.9-3.3-.9-1.7 0-3.3 1-4.1 2.5-1.8 3.1-.5 7.7 1.3 10.2.8 1.2 1.9 2.6 3.2 2.5 1.3-.1 1.8-.8 3.3-.8 1.5 0 2 .8 3.3.8 1.4 0 2.3-1.2 3.2-2.4 1-1.4 1.4-2.7 1.4-2.8-.1 0-2.7-1-2.7-4 0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2.1h-.3z" />
    </svg>
  );

  // Web: simple link redirect (same pattern as Google OAuth button)
  if (!isNative) {
    return (
      <div>
        <a
          href="/api/auth/apple-login"
          className={buttonStyles}
          style={buttonStyle}
        >
          {appleIcon}
          Continuar com Apple
        </a>
      </div>
    );
  }

  // Native iOS: use Capacitor plugin for native Apple dialog
  async function handleNativeClick() {
    setError("");
    setLoading(true);

    try {
      const { isAppleSignInAvailable, performAppleSignIn } = await import(
        "@/lib/capacitor/apple-sign-in"
      );

      if (!isAppleSignInAvailable()) {
        throw new Error("apple_not_available");
      }

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
      <button
        onClick={handleNativeClick}
        disabled={loading}
        className={buttonStyles}
        style={buttonStyle}
      >
        {appleIcon}
        {loading ? "Entrando..." : "Continuar com Apple"}
      </button>
      {error && (
        <p className="mt-2 text-center text-xs text-red-500">{error}</p>
      )}
    </div>
  );
}
