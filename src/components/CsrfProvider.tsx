"use client";

import { useEffect } from "react";

const CSRF_COOKIE_NAME = "__Host-csrf";
const CSRF_HEADER_NAME = "x-csrf-token";

function getCsrfToken(): string {
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${CSRF_COOKIE_NAME}=`));
  return match ? match.split("=")[1] : "";
}

/**
 * CsrfProvider — installs a global fetch interceptor that automatically
 * adds the X-CSRF-Token header on all mutating requests (POST/PUT/PATCH/DELETE).
 * Reads the token from the __Host-csrf cookie (set by middleware).
 *
 * Mount once in the root layout. No children needed.
 */
export function CsrfProvider() {
  useEffect(() => {
    const originalFetch = window.fetch;

    window.fetch = function patchedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      const method = (init?.method ?? "GET").toUpperCase();
      const isMutating = method !== "GET" && method !== "HEAD" && method !== "OPTIONS";

      if (isMutating) {
        const headers = new Headers(init?.headers);
        if (!headers.has(CSRF_HEADER_NAME)) {
          const token = getCsrfToken();
          if (token) {
            headers.set(CSRF_HEADER_NAME, token);
          }
        }
        return originalFetch.call(window, input, { ...init, headers });
      }

      return originalFetch.call(window, input, init);
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  return null;
}
