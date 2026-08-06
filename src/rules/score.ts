import { RULES } from "./catalogue";
import type { Issue, Severity } from "./types";

/**
 * Scoring.
 *
 * The prototype showed 61 and 94 as literals — there was no formula. This is it,
 * and it gets published on the methodology page, because a number nobody can
 * reproduce is not evidence.
 *
 * Design decisions, all deliberate:
 *
 * 1. Severity is weighted, because a missing label locks a user out of a form
 *    while a slightly-obscured anchor is an irritation.
 *
 * 2. Node count uses log10, not a straight multiplier. 200 contrast failures is
 *    usually ONE class fixed in ONE place — a site with one bad token is not
 *    forty times worse than a site with five. Straight multiplication would zero
 *    the score for any site with a repeated component, which tells the user
 *    nothing.
 *
 * 3. Breadth costs more than depth. Failing five rules at three nodes each scores
 *    worse than failing one rule at two hundred, because five separate defects
 *    means five separate fixes and a broader failure of process.
 *
 * 4. It is deterministic. The same scan always produces the same score.
 *
 * The score is a triage aid, NOT a compliance percentage. Every surface that
 * shows it also shows the automated-coverage figure.
 */

export const SEVERITY_WEIGHTS: Record<Severity, number> = {
  Critical: 12,
  Serious: 7,
  Moderate: 3,
  Minor: 1,
};

/** WCAG 2.2 Level A and AA combined. */
export const TOTAL_WCAG_AA_CRITERIA = 55;

export type SeverityBreakdown = Record<Severity, { issues: number; rules: number }>;

export type ScanScore = {
  /** 0-100. A triage aid, never a compliance claim. */
  score: number;
  totalIssues: number;
  totalRules: number;
  bySeverity: SeverityBreakdown;
  coverage: {
    /** Distinct WCAG success criteria this engine can evaluate. */
    automatedCriteria: number;
    /** Level A + AA criteria in WCAG 2.2. */
    totalCriteria: number;
    /** Rounded percentage, for display. */
    percent: number;
  };
  /** The raw penalty, exposed so the methodology page can show the working. */
  penalty: number;
};

function emptyBreakdown(): SeverityBreakdown {
  return {
    Critical: { issues: 0, rules: 0 },
    Serious: { issues: 0, rules: 0 },
    Moderate: { issues: 0, rules: 0 },
    Minor: { issues: 0, rules: 0 },
  };
}

/** Distinct success criteria the catalogue can evaluate. Computed, not asserted. */
export function automatedCriteriaCount(): number {
  return new Set(RULES.map((r) => r.sc)).size;
}

export function scoreScan(issues: Issue[]): ScanScore {
  const bySeverity = emptyBreakdown();
  let penalty = 0;
  let totalIssues = 0;

  for (const issue of issues) {
    const { severity } = issue.rule;
    const count = Math.max(0, issue.nodeCount);
    if (count === 0) continue;

    bySeverity[severity].issues += count;
    bySeverity[severity].rules += 1;
    totalIssues += count;

    // Diminishing returns: 1 node costs the full weight, 10 costs double,
    // 100 costs triple. Repeated instances of one defect are still one fix.
    penalty += SEVERITY_WEIGHTS[severity] * (1 + Math.log10(count));
  }

  const automated = automatedCriteriaCount();

  return {
    score: Math.max(0, Math.min(100, Math.round(100 - penalty))),
    totalIssues,
    totalRules: issues.filter((i) => i.nodeCount > 0).length,
    bySeverity,
    coverage: {
      automatedCriteria: automated,
      totalCriteria: TOTAL_WCAG_AA_CRITERIA,
      percent: Math.round((automated / TOTAL_WCAG_AA_CRITERIA) * 100),
    },
    penalty: Math.round(penalty * 100) / 100,
  };
}

/**
 * The caveat that must appear wherever a score does. Guardrail 5.
 * Exported as a constant so it cannot drift between surfaces.
 */
export function coverageCaveat(score: ScanScore): string {
  return (
    `This scan evaluates ${score.coverage.automatedCriteria} of the ${score.coverage.totalCriteria} ` +
    `WCAG 2.2 Level A and AA success criteria — about ${score.coverage.percent}%. ` +
    `The rest need a person: reading order, whether alt text is meaningful, whether a keyboard ` +
    `user can finish the task. We will not tell you that you are compliant, because no scanner can.`
  );
}
