import { getEnv } from "@/lib/bindings";
import { createScan } from "@/lib/db";
import { hashIp, newId } from "@/lib/ids";
import { rateLimit, tooManyRequests } from "@/lib/ratelimit";
import { setStatus } from "@/lib/scan-status";
import { validateScanUrl } from "@/lib/url";

export const dynamic = "force-dynamic";

/**
 * POST /api/scan — enqueue a scan.
 *
 * Must return in under 2 seconds. Webflow Cloud kills a request at 20s and a real
 * scan takes longer than that, so nothing here waits for the browser. We write a
 * queued row, hand the job to the scan service, and return the id; the client
 * polls status from KV.
 *
 * The dispatch is deliberately fire-and-forget with a short timeout: if the scan
 * service is slow to acknowledge, that must not turn into a failed enqueue for the
 * user. The callback is the source of truth for completion.
 */
export async function POST(request: Request): Promise<Response> {
  const limit = await rateLimit(request, "scan", 10, 60 * 60);
  if (!limit.allowed) return tooManyRequests(limit);

  let body: { url?: string; source?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const check = validateScanUrl(body.url ?? "");
  if (!check.ok) {
    return Response.json({ error: "invalid_url", message: check.reason }, { status: 400 });
  }

  const env = await getEnv();
  const scanId = newId();
  const ip =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";

  await createScan({
    id: scanId,
    url: check.url.toString(),
    urlNormalised: check.normalised,
    domain: check.domain,
    requesterIpHash: await hashIp(ip, "scan"),
    sourceTool: body.source ?? "scanner",
  });

  await setStatus(scanId, {
    status: "queued",
    step: "queued",
    pct: 2,
    url: check.url.toString(),
    startedAt: Date.now(),
  });

  if (!env.SCAN_SERVICE_URL || !env.SCAN_CALLBACK_SECRET) {
    await setStatus(scanId, {
      status: "failed",
      step: "failed",
      pct: 0,
      url: check.url.toString(),
      startedAt: Date.now(),
      errorCode: "internal_error",
      errorDetail: "Scan service is not configured.",
    });
    return Response.json(
      { error: "scan_service_unconfigured", scanId },
      { status: 503 },
    );
  }

  const origin = new URL(request.url).origin;
  const basePath = env.BASE_URL ?? "/app";

  try {
    await fetch(env.SCAN_SERVICE_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${env.SCAN_CALLBACK_SECRET}`,
      },
      body: JSON.stringify({
        scanId,
        url: check.url.toString(),
        callbackUrl: `${origin}${basePath}/api/scan/callback`,
      }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // Dispatch failed. Say so now rather than leaving the client polling a job
    // that was never handed over.
    await setStatus(scanId, {
      status: "failed",
      step: "failed",
      pct: 0,
      url: check.url.toString(),
      startedAt: Date.now(),
      errorCode: "internal_error",
      errorDetail: "Could not reach the scan service.",
    });
    return Response.json({ error: "dispatch_failed", scanId }, { status: 502 });
  }

  return Response.json({ scanId, url: check.url.toString() }, { status: 202 });
}
