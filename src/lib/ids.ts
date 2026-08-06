/**
 * Opaque id generation.
 *
 * Scan ids appear in public URLs (/app/report/[scanId]) and gate access to a
 * report before the email is captured. Sequential ids would let anyone walk the
 * whole table, so these are random and long enough not to be guessable.
 */

const ALPHABET = "0123456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";

/** 22 chars from a 58-char alphabet ≈ 128 bits. Uses the Workers CSPRNG. */
export function newId(size = 22): string {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}

/** Hash an IP for coarse rate limiting. We never store the raw address. */
export async function hashIp(ip: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .slice(0, 16)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Constant-time string comparison, for the callback shared secret. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
