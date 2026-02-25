const attempts = new Map<string, number[]>();

export function checkRateLimit(
  key: string,
  limit: number = 5,
  windowMs: number = 15 * 60 * 1000,
): boolean {
  const now = Date.now();
  const windowStart = now - windowMs;
  const timestamps = (attempts.get(key) || []).filter((t) => t > windowStart);

  if (timestamps.length >= limit) {
    return false; // bloqueado
  }

  timestamps.push(now);
  attempts.set(key, timestamps);
  return true; // permitido
}

export function sanitizeInput(input: string): string {
  return input
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .trim();
}
