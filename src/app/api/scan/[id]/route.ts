import { getIssues, getScan } from "@/lib/db";
import { coverageCaveat, scoreScan } from "@/rules/score";
import { RULES_BY_ID } from "@/rules/catalogue";
import type { Issue } from "@/rules/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/scan/[id] — the report.
 *
 * Gated: the summary (score, severity counts, rule names) is always public, so the
 * result is shareable and linkable. The detail — selectors, affected nodes and the
 * Webflow fix steps — needs an email. Gating the answer entirely would waste the
 * SEO surface; gating the remediation is where the value actually is.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const scan = await getScan(id);

  if (!scan) return Response.json({ error: "not_found" }, { status: 404 });

  if (scan.status !== "done") {
    return Response.json({
      scanId: scan.id,
      url: scan.url,
      status: scan.status,
      errorCode: scan.error_code,
      errorDetail: scan.error_detail,
    });
  }

  const rows = await getIssues(id);
  const unlocked = Boolean(scan.email);

  // Rebuild the score object so the caveat text is generated from one place.
  const issues: Issue[] = rows.map((r) => ({
    ruleId: r.rule_id,
    rule:
      RULES_BY_ID.get(r.rule_id) ??
      ({
        id: r.rule_id,
        name: r.rule_id,
        sc: r.wcag_sc,
        level: r.level as "A" | "AA",
        severity: r.severity as Issue["rule"]["severity"],
        introducedIn: "2.0",
        why: r.why,
        webflowSteps: JSON.parse(r.webflow_steps) as string[],
        fixSurface: "designer",
        effort: "Unknown",
        axeRuleIds: [],
        requiresLayout: false,
      } as Issue["rule"]),
    nodes: [],
    nodeCount: r.node_count,
    isCmsBound: r.is_cms_bound === 1,
    hasWebflowSteps: r.has_webflow_steps === 1,
  }));

  const score = scoreScan(issues);

  return Response.json({
    scanId: scan.id,
    url: scan.url,
    domain: scan.domain,
    status: scan.status,
    scannedAt: scan.completed_at,
    engineVersion: scan.engine_version,
    rulesetVersion: scan.ruleset_version,

    score: scan.score,
    totalIssues: scan.issue_count,
    totalRules: scan.rule_count,
    bySeverity: score.bySeverity,

    // Guardrail 5: this ships with every report, gated or not.
    coverage: {
      ...score.coverage,
      caveat: coverageCaveat(score),
    },

    unlocked,
    issues: rows.map((r) => ({
      ruleId: r.rule_id,
      name: RULES_BY_ID.get(r.rule_id)?.name ?? r.rule_id,
      wcagSc: r.wcag_sc,
      level: r.level,
      severity: r.severity,
      nodeCount: r.node_count,
      isCmsBound: r.is_cms_bound === 1,
      hasWebflowSteps: r.has_webflow_steps === 1,

      // Summary is public. Everything below needs the email.
      ...(unlocked
        ? {
            why: r.why,
            webflowSteps: JSON.parse(r.webflow_steps) as string[],
            nodes: JSON.parse(r.selectors) as unknown[],
            cmsHint: r.cms_hint,
          }
        : {}),
    })),
  });
}
