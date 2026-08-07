import { getArtifacts, getEnv } from "@/lib/bindings";
import { completeScan, failScan, getScan } from "@/lib/db";
import { timingSafeEqual } from "@/lib/ids";
import { setStatus, pctForStep, type ScanStep } from "@/lib/scan-status";
import { mapAxeResults, type AxeViolation } from "@/rules/map-axe";
import { scoreScan } from "@/rules/score";
import { compareRuns, snapshotFromIssues, type RuleSnapshot } from "@/rules/regression";
import { getLastRun, getMonitor, recordRun, snapshotOf } from "@/lib/monitors";
import { composeRegressionAlert, sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

/**
 * Compares a monitored scan against the monitor's previous run, records the
 * result, and emails only when something actually regressed.
 */
async function recordMonitorRun(params: {
  monitorId: string;
  scanId: string;
  siteUrl: string;
  score: number;
  snapshot: RuleSnapshot[];
  reportUrl: string;
}): Promise<{ compared: boolean; alerted: boolean }> {
  const monitor = await getMonitor(params.monitorId);
  if (!monitor) return { compared: false, alerted: false };

  const last = await getLastRun(params.monitorId);
  const previous =
    last && last.score !== null
      ? { score: last.score, rules: snapshotOf(last) }
      : null;

  const comparison = compareRuns(
    previous,
    { score: params.score, rules: params.snapshot },
    JSON.parse(monitor.thresholds),
  );

  let alerted = false;
  if (comparison.shouldAlert) {
    const recipients = [
      monitor.owner_email,
      ...(JSON.parse(monitor.recipients) as string[]),
    ].filter((v, i, a) => a.indexOf(v) === i);

    const mail = composeRegressionAlert({
      siteUrl: params.siteUrl,
      comparison,
      reportUrl: params.reportUrl,
    });
    const result = await sendEmail({ to: recipients, ...mail });
    alerted = result.sent;
  }

  await recordRun({
    monitorId: params.monitorId,
    scanId: params.scanId,
    score: params.score,
    delta: comparison.delta,
    regressions: comparison.regressions,
    snapshot: params.snapshot,
    alertSent: alerted,
  });

  return { compared: !comparison.isFirstRun, alerted };
}

type CallbackBody = {
  scanId: string;
  /** Progress ping, or the final result. */
  step?: ScanStep;
  status?: "running" | "done" | "failed";
  engineVersion?: string;
  violations?: AxeViolation[];
  errorCode?: string;
  errorDetail?: string;
};

/**
 * POST /api/scan/callback — the scan service reports back here.
 *
 * Authenticated with a shared secret compared in constant time. Anyone who could
 * post here unauthenticated could write arbitrary findings into a customer's
 * report, so this is the most security-sensitive route in the app.
 */
export async function POST(request: Request): Promise<Response> {
  const env = await getEnv();
  const secret = env.SCAN_CALLBACK_SECRET;

  if (!secret) {
    return Response.json({ error: "not_configured" }, { status: 503 });
  }

  const presented = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!timingSafeEqual(presented, secret)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: CallbackBody;
  try {
    body = (await request.json()) as CallbackBody;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!body.scanId) {
    return Response.json({ error: "missing_scan_id" }, { status: 400 });
  }

  const scan = await getScan(body.scanId);
  if (!scan) return Response.json({ error: "unknown_scan" }, { status: 404 });

  // --- progress ping ---------------------------------------------------------
  if (body.status === "running" || (body.step && !body.violations)) {
    const step = body.step ?? "running-axe";
    await setStatus(body.scanId, {
      status: "running",
      step,
      pct: pctForStep(step),
      url: scan.url,
      startedAt: scan.requested_at,
    });
    return Response.json({ ok: true });
  }

  // --- failure ---------------------------------------------------------------
  if (body.status === "failed") {
    await failScan(body.scanId, body.errorCode ?? "internal_error", body.errorDetail);
    await setStatus(body.scanId, {
      status: "failed",
      step: "failed",
      pct: 0,
      url: scan.url,
      startedAt: scan.requested_at,
      errorCode: body.errorCode ?? "internal_error",
      errorDetail: body.errorDetail,
    });
    return Response.json({ ok: true });
  }

  // --- completion ------------------------------------------------------------
  const violations = body.violations ?? [];
  const issues = mapAxeResults(violations);
  const score = scoreScan(issues);

  // Raw axe output goes to R2, not D1. It can be megabytes and nothing queries it.
  let rawKey: string | null = null;
  try {
    const artifacts = await getArtifacts();
    rawKey = `scans/${body.scanId}/axe.json`;
    await artifacts.put(rawKey, JSON.stringify(violations), {
      httpMetadata: { contentType: "application/json" },
    });
  } catch {
    rawKey = null; // Losing the archive must not lose the report.
  }

  await completeScan({
    id: body.scanId,
    score: score.score,
    issues,
    engineVersion: body.engineVersion ?? "axe-core@unknown",
    rulesetVersion: "wcag22aa",
    criteriaTested: score.coverage.automatedCriteria,
    criteriaTotal: score.coverage.totalCriteria,
    rawResultKey: rawKey,
  });

  await setStatus(body.scanId, {
    status: "done",
    step: "done",
    pct: 100,
    url: scan.url,
    startedAt: scan.requested_at,
  });

  // A monitored scan has one more job: say what changed since last time.
  // Wrapped because a monitoring failure must not discard a completed scan —
  // the report is already written and is the more valuable artefact.
  let monitoring: { compared: boolean; alerted: boolean } | undefined;
  if (scan.monitor_id) {
    try {
      monitoring = await recordMonitorRun({
        monitorId: scan.monitor_id,
        scanId: body.scanId,
        siteUrl: scan.url,
        score: score.score,
        snapshot: snapshotFromIssues(issues),
        reportUrl: `${new URL(request.url).origin}${env.BASE_URL ?? "/app"}/report/${body.scanId}`,
      });
    } catch {
      monitoring = { compared: false, alerted: false };
    }
  }

  return Response.json({
    ok: true,
    score: score.score,
    issues: issues.length,
    ...(monitoring ? { monitoring } : {}),
  });
}
