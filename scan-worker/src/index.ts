import puppeteer from "@cloudflare/puppeteer";
import { runScan } from "./scan";

export type Env = {
  BROWSER: Fetcher;
  /** Shared with the Webflow Cloud app. Set via `wrangler secret put SHARED_SECRET`. */
  SHARED_SECRET: string;
  /**
   * The app's monitor cron target. A plain `vars` entry in wrangler.json, not a
   * secret — it is a public staging URL, and burying it in `wrangler secret`
   * would mean nobody could see what it was pointed at. The shared secret that
   * authenticates the call is still a secret.
   */
  MONITOR_CRON_URL?: string;
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

  /**
   * Hourly cron. Asks the app which monitors are due and lets it do the work.
   *
   * This worker deliberately holds no monitor state: the monitors live in the
   * app's D1, which Webflow Cloud provisions and which this worker has no
   * binding to. So the cron is a doorbell, not a scheduler — it carries the
   * shared secret and nothing else, and the app decides what is due.
   */
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    if (!env.MONITOR_CRON_URL || !env.SHARED_SECRET) {
      console.error("monitor_cron_skipped", "MONITOR_CRON_URL or SHARED_SECRET is unset");
      return;
    }

    ctx.waitUntil(
      (async () => {
        try {
          const res = await fetch(env.MONITOR_CRON_URL!, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              authorization: `Bearer ${env.SHARED_SECRET}`,
            },
            body: "{}",
            signal: AbortSignal.timeout(30_000),
          });
          console.log(
            "monitor_cron",
            JSON.stringify({ status: res.status, body: (await res.text()).slice(0, 300) }),
          );
        } catch (err) {
          // Logged, not rethrown: a failed tick should not retry-storm, and the
          // next one is an hour away.
          console.error("monitor_cron_failed", String(err));
        }
      })(),
    );
  },
};
