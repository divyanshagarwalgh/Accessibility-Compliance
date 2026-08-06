import { notFound } from "next/navigation";
import { getIssues, getScan } from "@/lib/db";
import { RULES_BY_ID } from "@/rules/catalogue";
import { coverageCaveat, scoreScan } from "@/rules/score";
import type { Issue, IssueNode, Severity } from "@/rules/types";
import { EmailGate } from "./EmailGate";
import { ScanProgress } from "./ScanProgress";
import styles from "./report.module.css";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Accessibility report",
  robots: { index: false, follow: false },
};

const SEVERITY_ORDER: Severity[] = ["Critical", "Serious", "Moderate", "Minor"];

const ERROR_COPY: Record<string, { title: string; body: string; fix: string }> = {
  fetch_403: {
    title: "We could not reach that URL",
    body: "The server returned a 403 before the page rendered. This usually means a firewall or bot protection is blocking our crawler.",
    fix: "Allowlist WebyanshBot in Cloudflare, or scan a page that is not behind protection.",
  },
  fetch_404: {
    title: "That page does not exist",
    body: "The server returned a 404. Check the URL and try again.",
    fix: "Scan the homepage instead if you are unsure of the path.",
  },
  fetch_5xx: {
    title: "The site returned a server error",
    body: "We got a 5xx response before the page rendered, so there was nothing to scan.",
    fix: "Try again once the site is responding.",
  },
  robots_disallowed: {
    title: "robots.txt blocks this path",
    body: "The site's robots.txt disallows this path for our user agent. We respect robots.txt and will not scan it.",
    fix: "Scan a public page instead, or add an allow rule for WebyanshBot.",
  },
  render_timeout: {
    title: "The page did not finish loading",
    body: "Rendering timed out after 30 seconds. Heavy client-side apps sometimes need longer than a single-page scan allows.",
    fix: "Try a lighter page on the same site, or get in touch and we will run a slow scan by hand.",
  },
  not_html: {
    title: "That URL is not an HTML page",
    body: "The response was a file rather than a web page, so there is nothing to audit.",
    fix: "Point the scanner at a page rather than a PDF or an image.",
  },
  internal_error: {
    title: "Something went wrong on our side",
    body: "The scan failed for a reason that is our fault, not yours.",
    fix: "Try again. If it keeps happening, tell us and we will look at it.",
  },
};

export default async function ReportPage({
  params,
}: {
  params: Promise<{ scanId: string }>;
}) {
  const { scanId } = await params;
  const scan = await getScan(scanId);

  if (!scan) notFound();

  // --- still running -------------------------------------------------------
  if (scan.status === "queued" || scan.status === "running") {
    return <ScanProgress scanId={scanId} url={scan.url} />;
  }

  // --- failed --------------------------------------------------------------
  if (scan.status === "failed") {
    const copy = ERROR_COPY[scan.error_code ?? "internal_error"] ?? ERROR_COPY.internal_error!;
    return (
      <div className={styles.wrap}>
        <section className={styles.errorCard} aria-labelledby="err-title">
          <h1 id="err-title" className={styles.h1}>
            {copy.title}
          </h1>
          <p className={styles.lede}>{copy.body}</p>
          <p className={styles.mono}>{scan.error_detail ?? scan.url}</p>
          <p className={styles.note}>{copy.fix}</p>
        </section>
      </div>
    );
  }

  // --- done ----------------------------------------------------------------
  const rows = await getIssues(scanId);
  const unlocked = Boolean(scan.email);

  const issues: Issue[] = rows.map((r) => {
    const rule = RULES_BY_ID.get(r.rule_id);
    return {
      ruleId: r.rule_id,
      rule:
        rule ??
        ({
          id: r.rule_id,
          name: r.rule_id.replace(/^axe:/, ""),
          sc: r.wcag_sc,
          level: r.level,
          severity: r.severity,
          introducedIn: "2.0",
          why: r.why,
          webflowSteps: JSON.parse(r.webflow_steps),
          fixSurface: "designer",
          effort: "Unknown",
          axeRuleIds: [],
          requiresLayout: false,
        } as Issue["rule"]),
      nodes: JSON.parse(r.selectors) as IssueNode[],
      nodeCount: r.node_count,
      isCmsBound: r.is_cms_bound === 1,
      hasWebflowSteps: r.has_webflow_steps === 1,
    };
  });

  const score = scoreScan(issues);
  const scoreTone = (scan.score ?? 0) >= 90 ? "pass" : (scan.score ?? 0) >= 70 ? "warn" : "fail";

  return (
    <div className={styles.wrap}>
      <header className={styles.head}>
        <p className={styles.eyebrow}>Accessibility report</p>
        <h1 className={styles.h1}>{scan.url}</h1>
        <p className={styles.meta}>
          Scanned{" "}
          {scan.completed_at
            ? new Date(scan.completed_at).toISOString().replace("T", " ").slice(0, 16)
            : "—"}{" "}
          UTC · {scan.engine_version} · WCAG 2.2 AA
        </p>
      </header>

      <section className={styles.scoreCard} aria-labelledby="score-h">
        <div className={styles.scoreBlock}>
          <p className={styles.scoreLabel} id="score-h">
            Automated score
          </p>
          <p className={styles.scoreValue} data-tone={scoreTone}>
            {scan.score}
          </p>
          <p className={styles.note}>out of 100</p>
        </div>
        <div className={styles.scoreBody}>
          <p className={styles.summary}>
            {scan.issue_count} {scan.issue_count === 1 ? "issue" : "issues"} across{" "}
            {scan.rule_count} {scan.rule_count === 1 ? "rule" : "rules"}
          </p>
          <ul className={styles.sevGrid}>
            {SEVERITY_ORDER.map((sev) => (
              <li key={sev} className={styles.sevCard}>
                <span className={styles.sevLabel} data-sev={sev}>
                  {sev}
                </span>
                <span className={styles.sevCount}>{score.bySeverity[sev].issues}</span>
                <span className={styles.note}>
                  across {score.bySeverity[sev].rules}{" "}
                  {score.bySeverity[sev].rules === 1 ? "rule" : "rules"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Guardrail 5. This ships with every report, gated or not, and is never
          softened. It is a legal and credibility requirement. */}
      <section className={styles.caveat} aria-label="Scan coverage">
        <p className={styles.caveatTitle}>
          This scan covers {score.coverage.percent}% of WCAG 2.2 AA
        </p>
        <p className={styles.caveatBody}>{coverageCaveat(score)}</p>
      </section>

      <section aria-labelledby="issues-h">
        <h2 id="issues-h" className={styles.h2}>
          What we found
        </h2>

        {issues.length === 0 ? (
          <p className={styles.lede}>
            No automated failures. That is a genuinely good result — and it still is not
            compliance. Two thirds of WCAG needs a person before you can claim conformance
            in a statement or a VPAT.
          </p>
        ) : (
          <ol className={styles.issueList}>
            {issues.map((issue) => (
              <li key={issue.ruleId} className={styles.issue}>
                <div className={styles.issueHead}>
                  <span className={styles.dot} data-sev={issue.rule.severity} aria-hidden="true" />
                  <h3 className={styles.issueTitle}>{issue.rule.name}</h3>
                  <span className={styles.chip} data-sev={issue.rule.severity}>
                    {issue.rule.severity}
                  </span>
                </div>

                <p className={styles.issueMeta}>
                  {issue.rule.sc !== "—" ? `WCAG ${issue.rule.sc} (${issue.rule.level})` : "No mapped criterion"}
                  {" · "}
                  {issue.nodeCount} {issue.nodeCount === 1 ? "element" : "elements"}
                  {issue.rule.introducedIn === "2.2" ? " · New in WCAG 2.2" : ""}
                </p>

                {unlocked ? (
                  <>
                    <p className={styles.issueWhy}>{issue.rule.why}</p>

                    {issue.isCmsBound ? (
                      <p className={styles.cmsHint}>
                        Some of these sit inside a Collection List. The fix belongs on the
                        CMS field — editing the element only changes the first item, and the
                        next publish overwrites it.
                      </p>
                    ) : null}

                    {issue.hasWebflowSteps ? (
                      <>
                        <h4 className={styles.h4}>Fix it in Webflow Designer</h4>
                        <ol className={styles.steps}>
                          {issue.rule.webflowSteps.map((step, i) => (
                            <li key={i}>{step}</li>
                          ))}
                        </ol>
                      </>
                    ) : (
                      <p className={styles.gap}>
                        We have not written Webflow-specific steps for this rule yet, so the
                        guidance above is axe-core&rsquo;s own. Saying so is better than
                        pretending otherwise.
                      </p>
                    )}

                    {issue.nodes.length > 0 ? (
                      <details className={styles.details}>
                        <summary>
                          Affected elements ({Math.min(issue.nodes.length, 50)}
                          {issue.nodeCount > 50 ? ` of ${issue.nodeCount}` : ""})
                        </summary>
                        <ul className={styles.nodeList}>
                          {issue.nodes.map((n, i) => (
                            <li key={i}>
                              <code className={styles.mono}>{n.selector}</code>
                              {typeof n.ratio === "number" ? (
                                <span className={styles.ratio}> {n.ratio.toFixed(2)}:1</span>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      </details>
                    ) : null}
                  </>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </section>

      {!unlocked && issues.length > 0 ? (
        <EmailGate
          scanId={scanId}
          issueCount={scan.issue_count}
          ruleCount={scan.rule_count}
          criticalCount={score.bySeverity.Critical.issues}
        />
      ) : null}
    </div>
  );
}
