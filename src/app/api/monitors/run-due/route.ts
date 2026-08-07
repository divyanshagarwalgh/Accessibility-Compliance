import { getEnv } from "@/lib/bindings";
import { createScan } from "@/lib/db";
import { timingSafeEqual } from "@/lib/ids";
import { listDueMonitors, markDispatched } from "@/lib/monitors";
import { newId } from "@/lib/ids";
import { setStatus } from "@/lib/scan-status";
import { validateScanUrl } from "@/lib/url";

export const dynamic = "force-dynamic";

/**
 * POST /api/monitors/run-due — the cron target.
 *
 * Called by the scan worker's scheduled handler, not by a browser. Webflow
 * Cloud provisions D1, KV and R2 but exposes no cron trigger, and the scan
 * worker is a plain Cloudflare Worker we deploy ourselves — so the clock lives
 * there and the data lives here, joined by the shared secret that already
 * authenticates the scan callback.
 *
 * Authenticated with the same constant-time comparison as the callback: an
 * unauthenticated caller here could drain the Browser Rendering quota, which on
 * the current plan is three concurrent sessions.
 */
export async function POST(request: Request): Promise<Response> {
  const env = await getEnv();
  const secret = env.SCAN_CALLBACK_SECRET;
  if (!secret) return Response.json({ error: "not_configured" }, { status: 503 });

  const presented = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!timingSafeEqual(presented, secret)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!env.SCAN_SERVICE_URL) {
    return Response.json({ error: "scan_service_unconfigured" }, { status: 503 });
  }

  const due = await listDueMonitors();
  const origin = new URL(request.url).origin;
  const basePath = env.BASE_URL ?? "/app";

  const dispatched: string[] = [];
  const skipped: Array<{ monitorId: string; reason: string }> = [];

  for (const monitor of due) {
    // Re-validate on every run. A URL that was safe when the monitor was
    // created can resolve somewhere else later, and this fires unattended.
    const check = validateScanUrl(monitor.site_url);
    if (!check.ok) {
      skipped.push({ monitorId: monitor.id, reason: check.reason });
      // Still move the schedule on, or a bad URL is retried every tick forever.
      await markDispatched(monitor);
      continue;
    }

    const scanId = newId();
    await createScan({
      id: scanId,
      url: check.url.toString(),
      urlNormalised: check.normalised,
      domain: check.domain,
      requesterIpHash: "monitor",
      sourceTool: "monitor",
      monitorId: monitor.id,
    });

    await setStatus(scanId, {
      status: "queued",
      step: "fetching",
      pct: 0,
      url: check.url.toString(),
      startedAt: Date.now(),
    });

    try {
      await fetch(env.SCAN_SERVICE_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${secret}`,
        },
        body: JSON.stringify({
          scanId,
          url: check.url.toString(),
          callbackUrl: `${origin}${basePath}/api/scan/callback`,
        }),
        signal: AbortSignal.timeout(5000),
      });
      dispatched.push(scanId);
    } catch {
      skipped.push({ monitorId: monitor.id, reason: "dispatch_failed" });
    }

    // Advance the schedule on dispatch rather than on completion. Waiting for
    // completion means a hung scan is re-dispatched every tick and piles up
    // browser sessions against a three-concurrent limit.
    await markDispatched(monitor);
  }

  return Response.json({ due: due.length, dispatched: dispatched.length, skipped });
}
