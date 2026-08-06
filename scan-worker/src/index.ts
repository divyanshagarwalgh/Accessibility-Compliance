import puppeteer from "@cloudflare/puppeteer";
import { runScan } from "./scan";

export type Env = {
  BROWSER: Fetcher;
  /** Shared with the Webflow Cloud app. Set via `wrangler secret put SHARED_SECRET`. */
  SHARED_SECRET: string;
};

type ScanRequest = {
  scanId: string;
  url: string;
  callbackUrl: string;
};

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * The external scan service.
 *
 * Lives here rather than in the Webflow Cloud app for three reasons:
 *   1. Webflow Cloud kills a request at 20 seconds; a render plus an axe pass is
 *      routinely longer.
 *   2. Webflow Cloud provisions only D1, KV and R2 — there is no way to attach a
 *      Browser Rendering binding to it.
 *   3. axe-core is ~700KB. Keeping it out of the app's bundle protects the 10MB
 *      worker ceiling.
 *
 * The request is acknowledged immediately and the work continues in waitUntil, so
 * the caller is never blocked. Results arrive at the app's callback.
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const presented = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
    if (!env.SHARED_SECRET || !timingSafeEqual(presented, env.SHARED_SECRET)) {
      return new Response("Unauthorized", { status: 401 });
    }

    let body: ScanRequest;
    try {
      body = (await request.json()) as ScanRequest;
    } catch {
      return Response.json({ error: "invalid_json" }, { status: 400 });
    }

    if (!body.scanId || !body.url || !body.callbackUrl) {
      return Response.json({ error: "missing_fields" }, { status: 400 });
    }

    // Acknowledge now; the scan continues after the response is sent.
    ctx.waitUntil(runScan(puppeteer, env, body));

    return Response.json({ accepted: true, scanId: body.scanId }, { status: 202 });
  },
};
