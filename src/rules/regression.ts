/**
 * Regression detection between two monitored scans.
 *
 * This is the module the retainer rests on. The scanner answers "what is wrong
 * today"; this answers "what did your last publish break", which is the only
 * question that justifies an email landing in someone's inbox on a Tuesday.
 *
 * ## What counts as a regression
 *
 * Two things, deliberately distinguished:
 *
 *   - **new**   — a rule that passed last time and fails now. Almost always a
 *                 publish that changed a component or a class.
 *   - **worse** — a rule that already failed and now affects more elements. A
 *                 contrast failure going from 2 nodes to 40 usually means a
 *                 broken class was applied across a template.
 *
 * They are separated because they warrant different urgency, and because
 * treating "worse" as equivalent to "new" makes the alert noisy enough that
 * people filter it — at which point the monitoring is worth nothing.
 *
 * ## Why a score drop is not the primary signal
 *
 * The score is severity-weighted with a logarithm on node count, so a genuinely
 * bad regression can move it only a few points. Alerting on score alone would
 * miss exactly the failure the product exists to catch. So the rule-level
 * comparison leads, and the score threshold is an additional trigger rather
 * than the trigger.
 *
 * ## Silence is a feature
 *
 * A monitor that emails every week regardless is a monitor people mute. Nothing
 * here alerts on an unchanged or improved site, and the first run of a new
 * monitor never alerts — there is nothing to compare against, and "we started
 * watching your site" is not news.
 */

import { RULES_BY_ID } from "./catalogue";
import type { Severity } from "./types";

/** The minimum we need to persist per run to compare the next one. */
export type RuleSnapshot = {
  ruleId: string;
  severity: Severity;
  nodeCount: number;
};

export type RegressionKind = "new" | "worse";

export type Regression = {
  ruleId: string;
  name: string;
  severity: Severity;
  kind: RegressionKind;
  /** 0 when the rule was passing before. */
  previousNodeCount: number;
  nodeCount: number;
};

export type FixedRule = {
  ruleId: string;
  name: string;
  severity: Severity;
  previousNodeCount: number;
};

export type MonitorThresholds = {
  /** Alert when the score falls by at least this many points. */
  scoreDropPoints?: number;
  /** Alert when a Critical rule starts failing that was not failing before. */
  newCritical?: boolean;
  /** Alert on any new or worsened rule, at any severity. */
  anyRegression?: boolean;
};

export const DEFAULT_THRESHOLDS: Required<MonitorThresholds> = {
  scoreDropPoints: 5,
  newCritical: true,
  anyRegression: false,
};

export type RunComparison = {
  /** Null on a monitor's first run. */
  previousScore: number | null;
  score: number;
  /** Signed. Negative means the site got worse. Null on a first run. */
  delta: number | null;
  regressions: Regression[];
  fixed: FixedRule[];
  isFirstRun: boolean;
  shouldAlert: boolean;
  /** Why we are emailing, in the order the alert should state them. */
  alertReasons: string[];
};

const SEVERITY_ORDER: Record<Severity, number> = {
  Critical: 0,
  Serious: 1,
  Moderate: 2,
  Minor: 3,
};

function nameOf(ruleId: string): string {
  return RULES_BY_ID.get(ruleId)?.name ?? ruleId;
}

export function compareRuns(
  previous: { score: number; rules: RuleSnapshot[] } | null,
  current: { score: number; rules: RuleSnapshot[] },
  thresholds: MonitorThresholds = {},
): RunComparison {
  const t = { ...DEFAULT_THRESHOLDS, ...thresholds };

  // A monitor's first run establishes the baseline. There is nothing to
  // regress from, so it never alerts however bad the site is — that is the
  // scan report's job, not the monitor's.
  if (!previous) {
    return {
      previousScore: null,
      score: current.score,
      delta: null,
      regressions: [],
      fixed: [],
      isFirstRun: true,
      shouldAlert: false,
      alertReasons: [],
    };
  }

  const before = new Map(previous.rules.map((r) => [r.ruleId, r]));
  const after = new Map(current.rules.map((r) => [r.ruleId, r]));

  const regressions: Regression[] = [];
  for (const [ruleId, now] of after) {
    const then = before.get(ruleId);
    if (!then) {
      regressions.push({
        ruleId,
        name: nameOf(ruleId),
        severity: now.severity,
        kind: "new",
        previousNodeCount: 0,
        nodeCount: now.nodeCount,
      });
    } else if (now.nodeCount > then.nodeCount) {
      regressions.push({
        ruleId,
        name: nameOf(ruleId),
        severity: now.severity,
        kind: "worse",
        previousNodeCount: then.nodeCount,
        nodeCount: now.nodeCount,
      });
    }
  }

  const fixed: FixedRule[] = [];
  for (const [ruleId, then] of before) {
    if (!after.has(ruleId)) {
      fixed.push({
        ruleId,
        name: nameOf(ruleId),
        severity: then.severity,
        previousNodeCount: then.nodeCount,
      });
    }
  }

  // Most serious first, then the widest blast radius within a severity.
  const bySeverity = (a: { severity: Severity }, b: { severity: Severity }) =>
    SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
  regressions.sort((a, b) => bySeverity(a, b) || b.nodeCount - a.nodeCount);
  fixed.sort(bySeverity);

  const delta = current.score - previous.score;
  const alertReasons: string[] = [];

  const newCriticals = regressions.filter(
    (r) => r.kind === "new" && r.severity === "Critical",
  );
  if (t.newCritical && newCriticals.length > 0) {
    alertReasons.push(
      newCriticals.length === 1
        ? `A critical issue appeared that was not there before: ${newCriticals[0].name.toLowerCase()}.`
        : `${newCriticals.length} critical issues appeared that were not there before.`,
    );
  }

  const drop = -delta;
  if (drop >= t.scoreDropPoints) {
    alertReasons.push(
      `The score fell ${drop} point${drop === 1 ? "" : "s"}, from ${previous.score} to ${current.score}.`,
    );
  }

  if (t.anyRegression && regressions.length > 0 && alertReasons.length === 0) {
    alertReasons.push(
      `${regressions.length} rule${regressions.length === 1 ? "" : "s"} regressed since the last check.`,
    );
  }

  return {
    previousScore: previous.score,
    score: current.score,
    delta,
    regressions,
    fixed,
    isFirstRun: false,
    shouldAlert: alertReasons.length > 0,
    alertReasons,
  };
}

/** Turns stored issue rows into the snapshot shape the comparison needs. */
export function snapshotFromIssues(
  issues: Array<{ ruleId: string; rule: { severity: Severity }; nodeCount: number }>,
): RuleSnapshot[] {
  return issues.map((i) => ({
    ruleId: i.ruleId,
    severity: i.rule.severity,
    nodeCount: i.nodeCount,
  }));
}
