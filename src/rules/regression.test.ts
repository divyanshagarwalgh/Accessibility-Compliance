import { describe, expect, test } from "vitest";
import { compareRuns, snapshotFromIssues, type RuleSnapshot } from "./regression";
import { RULES_BY_ID } from "./catalogue";

const snap = (ruleId: string, nodeCount: number): RuleSnapshot => {
  const rule = RULES_BY_ID.get(ruleId);
  if (!rule) throw new Error(`test fixture references unknown rule ${ruleId}`);
  return { ruleId, severity: rule.severity, nodeCount };
};

describe("first run", () => {
  test("establishes a baseline and never alerts", () => {
    // "We started watching your site" is not news, however bad the site is.
    const c = compareRuns(null, { score: 12, rules: [snap("contrast", 40), snap("alt", 9)] });
    expect(c.isFirstRun).toBe(true);
    expect(c.shouldAlert).toBe(false);
    expect(c.delta).toBeNull();
    expect(c.previousScore).toBeNull();
    expect(c.regressions).toHaveLength(0);
  });
});

describe("no change", () => {
  test("stays silent when nothing moved", () => {
    // A monitor that emails regardless is a monitor people mute.
    const rules = [snap("contrast", 4), snap("alt", 2)];
    const c = compareRuns({ score: 80, rules }, { score: 80, rules });
    expect(c.shouldAlert).toBe(false);
    expect(c.regressions).toHaveLength(0);
    expect(c.delta).toBe(0);
  });

  test("stays silent when the site improved", () => {
    const c = compareRuns(
      { score: 60, rules: [snap("contrast", 10), snap("alt", 4)] },
      { score: 85, rules: [snap("contrast", 2)] },
    );
    expect(c.shouldAlert).toBe(false);
    expect(c.delta).toBe(25);
    expect(c.fixed.map((f) => f.ruleId)).toEqual(["alt"]);
  });
});

describe("new failures", () => {
  test("flags a rule that passed before and fails now", () => {
    const c = compareRuns(
      { score: 90, rules: [snap("lang", 1)] },
      { score: 70, rules: [snap("lang", 1), snap("contrast", 14)] },
    );
    const reg = c.regressions.find((r) => r.ruleId === "contrast");
    expect(reg?.kind).toBe("new");
    expect(reg?.previousNodeCount).toBe(0);
    expect(reg?.nodeCount).toBe(14);
  });

  test("alerts on a new critical by default", () => {
    const c = compareRuns(
      { score: 95, rules: [] },
      { score: 88, rules: [snap("contrast", 3)] },
    );
    expect(c.shouldAlert).toBe(true);
    expect(c.alertReasons[0]).toMatch(/critical issue appeared/i);
    expect(c.alertReasons[0]).toContain("colour contrast");
  });

  test("pluralises when several criticals appear", () => {
    const c = compareRuns(
      { score: 95, rules: [] },
      { score: 50, rules: [snap("contrast", 3), snap("alt", 9), snap("labels", 2)] },
    );
    expect(c.alertReasons[0]).toMatch(/^3 critical issues appeared/);
  });

  test("does not alert on a new non-critical under default thresholds", () => {
    // Default is newCritical only — a new Minor rule with a small score move
    // is not worth an email.
    const c = compareRuns(
      { score: 90, rules: [] },
      { score: 89, rules: [snap("obscured", 1)] },
    );
    expect(c.regressions).toHaveLength(1);
    expect(c.shouldAlert).toBe(false);
  });
});

describe("worsened failures", () => {
  test("flags a rule whose node count grew", () => {
    // 2 -> 40 usually means a broken class was applied across a template.
    const c = compareRuns(
      { score: 80, rules: [snap("contrast", 2)] },
      { score: 62, rules: [snap("contrast", 40)] },
    );
    const reg = c.regressions[0];
    expect(reg.kind).toBe("worse");
    expect(reg.previousNodeCount).toBe(2);
    expect(reg.nodeCount).toBe(40);
  });

  test("does not flag a rule whose node count shrank", () => {
    const c = compareRuns(
      { score: 62, rules: [snap("contrast", 40)] },
      { score: 80, rules: [snap("contrast", 2)] },
    );
    expect(c.regressions).toHaveLength(0);
  });

  test("a worsened critical is not treated as a new critical", () => {
    // newCritical means "appeared", not "got bigger" — otherwise every small
    // content change on an already-failing rule pages someone.
    const c = compareRuns(
      { score: 80, rules: [snap("contrast", 2)] },
      { score: 78, rules: [snap("contrast", 5)] },
    );
    expect(c.regressions[0].kind).toBe("worse");
    expect(c.shouldAlert).toBe(false);
  });
});

describe("score threshold", () => {
  test("alerts when the score falls by the threshold or more", () => {
    const c = compareRuns(
      { score: 90, rules: [snap("headings", 2)] },
      { score: 85, rules: [snap("headings", 9)] },
      { newCritical: false, scoreDropPoints: 5 },
    );
    expect(c.shouldAlert).toBe(true);
    expect(c.alertReasons[0]).toMatch(/fell 5 points, from 90 to 85/);
  });

  test("stays silent one point under the threshold", () => {
    const c = compareRuns(
      { score: 90, rules: [snap("headings", 2)] },
      { score: 86, rules: [snap("headings", 9)] },
      { newCritical: false, scoreDropPoints: 5 },
    );
    expect(c.shouldAlert).toBe(false);
  });

  test("says point, singular, for a one-point drop", () => {
    const c = compareRuns(
      { score: 90, rules: [] },
      { score: 89, rules: [] },
      { newCritical: false, scoreDropPoints: 1 },
    );
    expect(c.alertReasons[0]).toMatch(/fell 1 point, /);
  });

  test("never treats an improvement as a drop", () => {
    const c = compareRuns(
      { score: 60, rules: [] },
      { score: 90, rules: [] },
      { newCritical: false, scoreDropPoints: 1 },
    );
    expect(c.shouldAlert).toBe(false);
  });
});

describe("anyRegression threshold", () => {
  test("alerts on a minor regression when opted in", () => {
    const c = compareRuns(
      { score: 90, rules: [] },
      { score: 89, rules: [snap("obscured", 1)] },
      { newCritical: false, scoreDropPoints: 99, anyRegression: true },
    );
    expect(c.shouldAlert).toBe(true);
    expect(c.alertReasons[0]).toMatch(/^1 rule regressed/);
  });

  test("does not duplicate a reason already given", () => {
    // A new critical already explains itself; adding "1 rule regressed" too
    // makes the email read like it was assembled by a machine.
    const c = compareRuns(
      { score: 95, rules: [] },
      { score: 88, rules: [snap("contrast", 3)] },
      { newCritical: true, scoreDropPoints: 99, anyRegression: true },
    );
    expect(c.alertReasons).toHaveLength(1);
    expect(c.alertReasons[0]).toMatch(/critical issue appeared/i);
  });
});

describe("ordering", () => {
  test("puts the most serious regression first, then the widest", () => {
    const c = compareRuns(
      { score: 90, rules: [] },
      {
        score: 30,
        rules: [snap("obscured", 1), snap("contrast", 3), snap("linkname", 7), snap("alt", 30)],
      },
    );
    expect(c.regressions.map((r) => r.severity)).toEqual([
      "Critical", "Critical", "Serious", "Minor",
    ]);
    // Within Critical, 30 nodes outranks 3.
    expect(c.regressions[0].ruleId).toBe("alt");
  });
});

describe("fixed rules", () => {
  test("reports what stopped failing, so the email carries good news too", () => {
    const c = compareRuns(
      { score: 50, rules: [snap("contrast", 10), snap("lang", 1)] },
      { score: 70, rules: [snap("contrast", 10)] },
    );
    expect(c.fixed).toHaveLength(1);
    expect(c.fixed[0].ruleId).toBe("lang");
    expect(c.fixed[0].previousNodeCount).toBe(1);
  });
});

describe("snapshotFromIssues", () => {
  test("reduces issues to the fields a comparison needs", () => {
    const rule = RULES_BY_ID.get("contrast")!;
    const snapshot = snapshotFromIssues([
      { ruleId: "contrast", rule: { severity: rule.severity }, nodeCount: 14 },
    ]);
    expect(snapshot).toEqual([{ ruleId: "contrast", severity: "Critical", nodeCount: 14 }]);
  });
});
