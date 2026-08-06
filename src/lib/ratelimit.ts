import { getKv } from "./bindings";
import { hashIp } from "./ids";

/**
 * Fixed-window rate limiting per IP, in KV.
 *
 * Every public route is limited. The scan endpoint dispatches real browser work
 * on a metered service, so an unlimited endpoint is a bill someone else can run up.
 *
 * A fixed window can allow up to 2x the limit across a boundary. That is an
 * accepted trade: a sliding window needs a read-modify-write per request and KV is
 * eventually consistent, so it would be more machinery for a bound that only has
 * to be approximately right.
 *
 * The contrast checker is NOT rate limited — it never reaches the server.
 */

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

export async function rateLimit(
  request: Request,
  bucket: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const kv = await getKv();
  const ip =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";

  const id = await hashIp(ip, bucket);
  const now = Date.now();
  const window = Math.floor(now / (windowSeconds * 1000));
  const key = `rl:${bucket}:${window}:${id}`;

  const current = Number((await kv.get(key)) ?? 0);
  const resetAt = (window + 1) * windowSeconds * 1000;

  if (current >= limit) {
    return { allowed: false, remaining: 0, resetAt };
  }

  await kv.put(key, String(current + 1), {
    expirationTtl: windowSeconds + 60,
  });

  return { allowed: true, remaining: limit - current - 1, resetAt };
}

export function tooManyRequests(result: RateLimitResult): Response {
  const retryAfter = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
  return Response.json(
    {
      error: "rate_limited",
      message: "Too many requests. Try again shortly.",
      retryAfter,
    },
    { status: 429, headers: { "retry-after": String(retryAfter) } },
  );
}
