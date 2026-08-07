import { createMonitor, listRuns, getMonitor, type Schedule } from "@/lib/monitors";
import { rateLimit, tooManyRequests } from "@/lib/ratelimit";
import { validateScanUrl } from "@/lib/url";
import { DEFAULT_THRESHOLDS } from "@/rules/regression";

export const dynamic = "force-dynamic";

const SCHEDULES: Schedule[] = ["daily", "weekly", "on-publish"];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/monitors — start watching a site.
 * GET  /api/monitors?id=... — the run history behind the dashboard.
 *
 * The URL goes through the same SSRF validation as a one-off scan. A monitor
 * is a scan that fires on a timer, so an unvalidated URL here would be the same
 * hole with a scheduler attached to it.
 */
export async function POST(request: Request): Promise<Response> {
  const limit = await rateLimit(request, "monitors", 20, 60 * 60);
  if (!limit.allowed) return tooManyRequests(limit);

  let body: {
    siteUrl?: string;
    ownerEmail?: string;
    schedule?: string;
    thresholds?: unknown;
    recipients?: string[];
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const check = validateScanUrl(String(body.siteUrl ?? ""));
  if (!check.ok) {
    return Response.json({ error: "invalid_url", message: check.reason }, { status: 400 });
  }

  const ownerEmail = String(body.ownerEmail ?? "").trim();
  if (!EMAIL.test(ownerEmail)) {
    return Response.json(
      { error: "invalid_owner_email", message: "A valid email address is required." },
      { status: 400 },
    );
  }

  const schedule = SCHEDULES.includes(body.schedule as Schedule)
    ? (body.schedule as Schedule)
    : "weekly";

  const recipients = (Array.isArray(body.recipients) ? body.recipients : [])
    .map((r) => String(r).trim())
    .filter((r) => EMAIL.test(r));

  const monitor = await createMonitor({
    siteUrl: check.url.toString(),
    ownerEmail,
    schedule,
    thresholds: { ...DEFAULT_THRESHOLDS, ...(body.thresholds as object) },
    recipients,
  });

  return Response.json({
    monitorId: monitor.id,
    siteUrl: monitor.site_url,
    schedule: monitor.schedule,
    nextRunAt: monitor.next_run_at,
    thresholds: JSON.parse(monitor.thresholds),
    // Said plainly, because a monitor is the surface where the coverage limit
    // matters most: it runs unattended, so nobody re-reads the caveat.
    caveat:
      "This watches the WCAG criteria a machine can evaluate — about a fifth of " +
      "WCAG 2.2 Level A and AA. It catches regressions; it does not certify compliance.",
  });
}

export async function GET(request: Request): Promise<Response> {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return Response.json({ error: "missing_id" }, { status: 400 });

  const monitor = await getMonitor(id);
  if (!monitor) return Response.json({ error: "not_found" }, { status: 404 });

  const runs = await listRuns(id);

  return Response.json({
    monitorId: monitor.id,
    siteUrl: monitor.site_url,
    schedule: monitor.schedule,
    isActive: monitor.is_active === 1,
    lastRunAt: monitor.last_run_at,
    nextRunAt: monitor.next_run_at,
    thresholds: JSON.parse(monitor.thresholds),
    runs: runs.map((r) => ({
      runAt: r.run_at,
      scanId: r.scan_id,
      score: r.score,
      delta: r.delta,
      alertSent: r.alert_sent === 1,
      regressions: (JSON.parse(r.regressions) as { regressions?: unknown[] }).regressions ?? [],
    })),
  });
}
