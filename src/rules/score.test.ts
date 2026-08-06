import { describe, expect, test } from "vitest";
import { RULES_BY_ID } from "./catalogue";
import { scoreScan, SEVERITY_WEIGHTS } from "./score";
import type { Issue } from "./types";

function issue(ruleId: string, nodeCount: number): Issue {
  const rule = RULES_BY_ID.get(ruleId)!;
  return {
    ruleId,
    rule,
    nodes: Array.from({ length: nodeCount }, (_, i) => ({ selector: `.n${i}` })),
    nodeCount,
    isCmsBound: false,
    hasWebflowSteps: true,
  };
}

describe("scoreScan", () => {
  test("a page with no issues scores 100", () => {
    expect(scoreScan([]).score).toBe(100);
  });

  test("never returns a score below 0, however bad the page", () => {
    const awful = [
      issue("contrast", 500),
      issue("alt", 500),
      issue("labels", 500),
      issue("keyboard", 500),
      issue("captions", 500),
    ];
    expect(scoreScan(awful).score).toBeGreaterThanOrEqual(0);
  });

  test("a critical issue costs more than a minor one", () => {
    const critical = scoreScan([issue("contrast", 1)]).score;
    const minor = scoreScan([issue("obscured", 1)]).score;
    expect(critical).toBeLessThan(minor);
  });

  test("severity weights are ordered Critical > Serious > Moderate > Minor", () => {
    expect(SEVERITY_WEIGHTS.Critical).toBeGreaterThan(SEVERITY_WEIGHTS.Serious);
    expect(SEVERITY_WEIGHTS.Serious).toBeGreaterThan(SEVERITY_WEIGHTS.Moderate);
    expect(SEVERITY_WEIGHTS.Moderate).toBeGreaterThan(SEVERITY_WEIGHTS.Minor);
  });

  test("more affected nodes costs more than fewer", () => {
    expect(scoreScan([issue("contrast", 20)]).score).toBeLessThan(
      scoreScan([issue("contrast", 1)]).score,
    );
  });

  test("node count has diminishing returns, so one rule cannot zero the score", () => {
    // 200 contrast failures is one fix applied in one place. It should hurt, but a
    // site with one bad class is not worse than a site broken in every dimension.
    const oneRuleManyNodes = scoreScan([issue("contrast", 200)]).score;
    expect(oneRuleManyNodes).toBeGreaterThan(0);

    const fiveRulesFewNodes = scoreScan([
      issue("contrast", 3),
      issue("alt", 3),
      issue("labels", 3),
      issue("keyboard", 3),
      issue("captions", 3),
    ]).score;
    expect(fiveRulesFewNodes).toBeLessThan(oneRuleManyNodes);
  });

  test("is deterministic — the same input always gives the same score", () => {
    const input = [issue("contrast", 14), issue("linkname", 11)];
    expect(scoreScan(input).score).toBe(scoreScan(input).score);
  });

  test("returns the severity breakdown the report displays", () => {
    const result = scoreScan([issue("contrast", 14), issue("obscured", 2)]);
    expect(result.bySeverity.Critical).toEqual({ issues: 14, rules: 1 });
    expect(result.bySeverity.Minor).toEqual({ issues: 2, rules: 1 });
    expect(result.bySeverity.Serious).toEqual({ issues: 0, rules: 0 });
    expect(result.totalIssues).toBe(16);
    expect(result.totalRules).toBe(2);
  });

  test("reports the automated coverage figure alongside the score", () => {
    // The report must never imply the score is a compliance percentage.
    const result = scoreScan([issue("contrast", 1)]);
    expect(result.coverage.automatedCriteria).toBeGreaterThan(0);
    expect(result.coverage.totalCriteria).toBeGreaterThan(result.coverage.automatedCriteria);
  });
});
