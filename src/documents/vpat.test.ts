import { describe, expect, test } from "vitest";
import { evaluableCriteria, generateVpat, VPAT_DISCLAIMER } from "./vpat";
import { CRITERIA } from "./wcag-criteria";
import { RULES_BY_ID } from "@/rules/catalogue";
import type { Issue } from "@/rules/types";

function issue(ruleId: string, nodeCount: number, isCmsBound = false): Issue {
  const rule = RULES_BY_ID.get(ruleId);
  if (!rule) throw new Error(`test fixture references unknown rule ${ruleId}`);
  return {
    ruleId,
    rule,
    nodes: Array.from({ length: nodeCount }, (_, i) => ({ selector: `.n${i}` })),
    nodeCount,
    isCmsBound,
    hasWebflowSteps: true,
  };
}

const META = {
  productName: "cascadeops.com",
  evaluatedAt: Date.UTC(2026, 7, 6),
  evaluatedOn: "6 August 2026",
};

describe("generateVpat", () => {
  test("emits a row for every WCAG 2.2 A and AA criterion", () => {
    // Absent rows read as "no issues found" to a procurement officer. They have
    // to be present and explicitly marked instead.
    const vpat = generateVpat(META, { issues: [] });
    expect(vpat.rows).toHaveLength(55);
    expect(vpat.rows.map((r) => r.sc)).toEqual(CRITERIA.map((c) => c.sc));
  });

  test("marks criteria outside the catalogue as Not evaluated", () => {
    const vpat = generateVpat(META, { issues: [] });
    const untestable = vpat.rows.filter((r) => !evaluableCriteria().has(r.sc));
    expect(untestable.length).toBeGreaterThan(0);
    for (const row of untestable) {
      expect(row.conformance, row.sc).toBe("Not evaluated");
      expect(row.remarks, row.sc).toMatch(/reviewed by hand/i);
    }
  });

  test("counts pre-filled against not-evaluated, and they sum to the whole table", () => {
    const vpat = generateVpat(META, { issues: [] });
    expect(vpat.prefilledCount + vpat.notEvaluatedCount).toBe(vpat.rows.length);
    // 12 distinct criteria are reachable by the current catalogue.
    expect(vpat.prefilledCount).toBe(evaluableCriteria().size);
    expect(vpat.notEvaluatedCount).toBe(55 - evaluableCriteria().size);
  });

  test("reports element-level findings as Partially supports", () => {
    // VPAT reserves 'Does not support' for when the majority fails. We only ever
    // see violations, never passes, so we cannot measure a majority.
    const vpat = generateVpat(META, { issues: [issue("contrast", 14)] });
    const row = vpat.rows.find((r) => r.sc === "1.4.3");
    expect(row?.conformance).toBe("Partially supports");
    expect(row?.remarks).toContain("14 elements affected");
  });

  test("reports page-level findings as Does not support", () => {
    // A missing lang attribute is not partially missing.
    const vpat = generateVpat(META, { issues: [issue("lang", 1)] });
    expect(vpat.rows.find((r) => r.sc === "3.1.1")?.conformance).toBe("Does not support");
  });

  test("qualifies a clean result rather than presenting it as conformance", () => {
    const vpat = generateVpat(META, { issues: [] });
    const row = vpat.rows.find((r) => r.sc === "1.4.3");
    expect(row?.conformance).toBe("Supports");
    expect(row?.remarks).toMatch(/does not cover every aspect/i);
    expect(row?.remarks).toMatch(/confirm by hand/i);
  });

  test("merges several rules that share one criterion into a single row", () => {
    // Heading order and the missing main landmark are both 1.3.1.
    const vpat = generateVpat(META, {
      issues: [issue("headings", 3), issue("landmark", 1)],
    });
    const rows = vpat.rows.filter((r) => r.sc === "1.3.1");
    expect(rows).toHaveLength(1);
    expect(rows[0].remarks).toContain("Heading levels are skipped");
    expect(rows[0].remarks).toContain("Page has no main landmark");
  });

  test("does not call a mixed criterion page-level", () => {
    // 1.3.1 carries both a page-level rule and an element-level one; the
    // presence of the element-level finding decides it.
    const vpat = generateVpat(META, {
      issues: [issue("headings", 3), issue("landmark", 1)],
    });
    expect(vpat.rows.find((r) => r.sc === "1.3.1")?.conformance).toBe("Partially supports");
  });

  test("flags CMS-bound findings so the fix lands on the field", () => {
    const vpat = generateVpat(META, { issues: [issue("alt", 9, true)] });
    expect(vpat.rows.find((r) => r.sc === "1.1.1")?.remarks).toMatch(/CMS collection/);
  });

  test("marks every row as needing human review", () => {
    const vpat = generateVpat(META, { issues: [issue("contrast", 2)] });
    expect(vpat.rows.every((r) => r.needsHumanReview)).toBe(true);
  });

  test("states the gap count in the footer", () => {
    const vpat = generateVpat(META, { issues: [] });
    expect(vpat.footerNote).toContain(String(vpat.notEvaluatedCount));
    expect(vpat.footerNote).toMatch(/bigger risk than sending one that admits gaps/);
  });

  test("carries the draft disclaimer", () => {
    expect(generateVpat(META).disclaimer).toBe(VPAT_DISCLAIMER);
    expect(VPAT_DISCLAIMER).toMatch(/never establishes conformance on its own/i);
  });

  test("scopes the Section 508 edition to what it actually covers", () => {
    const vpat = generateVpat({ ...META, edition: "508" }, { issues: [] });
    expect(vpat.title).toContain("Section 508");
    expect(vpat.scopeNote).toMatch(/does not cover the hardware, software/i);
  });

  test("scopes the EU edition away from the non-web clauses", () => {
    const vpat = generateVpat({ ...META, edition: "eu" }, { issues: [] });
    expect(vpat.title).toContain("EN 301 549");
    expect(vpat.scopeNote).toMatch(/non-web clauses/i);
  });

  test("works with no scan at all, marking everything unevaluated", () => {
    const vpat = generateVpat(META);
    expect(vpat.rows).toHaveLength(55);
    expect(vpat.rows.filter((r) => r.conformance === "Supports")).toHaveLength(
      evaluableCriteria().size,
    );
  });

  test("never emits a conformance value outside the VPAT vocabulary", () => {
    const vpat = generateVpat(META, {
      issues: [issue("contrast", 5), issue("lang", 1), issue("alt", 2)],
    });
    const allowed = new Set(["Supports", "Partially supports", "Does not support", "Not evaluated"]);
    for (const row of vpat.rows) expect(allowed.has(row.conformance), row.conformance).toBe(true);
  });
});
