/**
 * Client-side CSRF helper — reads the __Host-csrf cookie and returns
 * headers to include in mutating fetch requests.
 */

const CSRF_COOKIE_NAME = process.env.NODE_ENV === "production" ? "__Host-csrf" : "csrf";
const CSRF_HEADER_NAME = "x-csrf-token";

/** Read CSRF token from cookie */
function getCsrfToken(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${CSRF_COOKIE_NAME}=`));
  return match ? match.split("=")[1] : "";
}

/** Get headers object with CSRF token included */
export function csrfHeaders(extraHeaders?: Record<string, string>): Record<string, string> {
  return {
    "Content-Type": "application/json",
    [CSRF_HEADER_NAME]: getCsrfToken(),
    ...extraHeaders,
  };
}

/**
 * Wrapper around fetch that automatically includes CSRF token
 * in the X-CSRF-Token header for mutating requests.
 */
export async function csrfFetch(url: string, init?: RequestInit): Promise<Response> {
  const method = init?.method?.toUpperCase() ?? "GET";
  const isMutating = method !== "GET" && method !== "HEAD" && method !== "OPTIONS";

  if (isMutating) {
    const headers = new Headers(init?.headers);
    if (!headers.has(CSRF_HEADER_NAME)) {
      headers.set(CSRF_HEADER_NAME, getCsrfToken());
    }
    return fetch(url, { ...init, headers });
  }

  return fetch(url, init);
}
