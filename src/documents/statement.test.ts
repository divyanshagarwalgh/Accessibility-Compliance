import { describe, expect, test } from "vitest";
import {
  formatReviewDate,
  generateStatement,
  limitationsFromScan,
  resolveStatus,
  type StatementInput,
} from "./statement";
import { RULES_BY_ID } from "@/rules/catalogue";
import { scoreScan } from "@/rules/score";
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

const BASE: StatementInput = {
  organisation: "Cascade Ops Inc.",
  domain: "cascadeops.com",
  contactEmail: "access@cascadeops.com",
  reviewedAt: Date.UTC(2026, 7, 6),
};

describe("formatReviewDate", () => {
  test("renders the design's date format in UTC", () => {
    expect(formatReviewDate(Date.UTC(2026, 7, 6))).toBe("6 August 2026");
    expect(formatReviewDate(Date.UTC(2026, 0, 1))).toBe("1 January 2026");
  });
});

describe("conformance status honesty", () => {
  // This is the part of the module that carries legal weight. A statement is
  // the organisation's own claim, and the tool must not manufacture a stronger
  // one than the evidence supports.

  test("never claims full conformance while findings remain", () => {
    const { status, warnings } = resolveStatus({ ...BASE, claimedStatus: "full" }, true);
    expect(status).toBe("partial");
    expect(warnings.join(" ")).toMatch(/cannot be claimed/i);
  });

  test("never claims full conformance off a clean scan alone", () => {
    // A clean automated result means "we found nothing", not "there is nothing".
    const { status, warnings } = resolveStatus({ ...BASE, claimedStatus: "full" }, false);
    expect(status).toBe("partial");
    expect(warnings.join(" ")).toMatch(/manual review/i);
  });

  test("allows full conformance once a human attests to a manual review", () => {
    const { status, warnings } = resolveStatus(
      { ...BASE, claimedStatus: "full", manualReviewCompleted: true },
      false,
    );
    expect(status).toBe("full");
    expect(warnings).toHaveLength(0);
  });

  test("warns that a clean scan is not evidence of conformance", () => {
    const { warnings } = resolveStatus(BASE, false);
    expect(warnings.join(" ")).toMatch(/only evaluates the criteria a machine can check/i);
  });

  test("defaults to partially conformant", () => {
    expect(resolveStatus(BASE, true).status).toBe("partial");
  });
});

describe("limitationsFromScan", () => {
  test("emits one line per failing criterion, most serious first", () => {
    const limitations = limitationsFromScan([
      issue("lang", 1),
      issue("contrast", 14),
      issue("linkname", 11),
    ]);
    expect(limitations.map((l) => l.sc)).toEqual(["1.4.3", "2.4.4", "3.1.1"]);
  });

  test("agrees in number with singular and plural elements", () => {
    const [one] = limitationsFromScan([issue("lang", 1)]);
    expect(one.text).toContain("One element");
    expect(one.text).toContain("is affected");

    const [many] = limitationsFromScan([issue("contrast", 14)]);
    expect(many.text).toContain("14 elements");
    expect(many.text).toContain("are affected");
  });

  test("says so when a limitation is bound to a CMS collection", () => {
    const [l] = limitationsFromScan([issue("alt", 9, true)]);
    expect(l.text).toMatch(/CMS collection/);
  });

  test("names the criterion, so a reader can look it up", () => {
    const [l] = limitationsFromScan([issue("contrast", 2)]);
    expect(l.text).toContain("1.4.3");
    expect(l.text).toContain("Contrast (Minimum)");
  });
});

describe("generateStatement", () => {
  const issues = [issue("contrast", 14), issue("alt", 9, true), issue("lang", 1)];
  const scan = { issues, score: scoreScan(issues) };

  test("produces every section the EU model statement expects", () => {
    const s = generateStatement(BASE, scan);
    const headings = s.sections.map((x) => x.heading).filter(Boolean);
    expect(headings).toEqual([
      "Conformance status",
      "Known limitations",
      "Feedback",
      "Assessment approach",
    ]);
  });

  test("titles and dates the document", () => {
    const s = generateStatement(BASE, scan);
    expect(s.title).toBe("Accessibility statement for Cascade Ops Inc.");
    expect(s.reviewedOn).toBe("6 August 2026");
    expect(s.html).toContain("Last reviewed 6 August 2026");
  });

  test("carries a working feedback channel and a response commitment", () => {
    // The EAA requires the channel to be real, not decorative.
    const s = generateStatement(BASE, scan);
    expect(s.text).toContain("access@cascadeops.com");
    expect(s.text).toContain("five working days");
  });

  test("states the automated coverage honestly in the assessment section", () => {
    const s = generateStatement(BASE, scan);
    expect(s.text).toMatch(/Automated testing covered 12 of the 55/);
    expect(s.text).toMatch(/require human review/);
  });

  test("lists each known limitation", () => {
    const s = generateStatement(BASE, scan);
    const known = s.sections.find((x) => x.heading === "Known limitations");
    expect(known?.list).toHaveLength(3);
  });

  test("appends a planned fix date only when one is supplied", () => {
    const withDate = generateStatement({
      ...BASE,
      limitations: [
        { sc: "1.4.3", text: "Contrast is too low.", plannedFixDate: "20 August 2026" },
        { sc: "3.1.1", text: "The page has no lang attribute." },
      ],
    });
    const list = withDate.sections.find((x) => x.heading === "Known limitations")?.list ?? [];
    expect(list[0]).toContain("Fix scheduled for 20 August 2026.");
    expect(list[1]).not.toContain("Fix scheduled");
  });

  test("does not present a clean scan as an absence of barriers", () => {
    const s = generateStatement(BASE, { issues: [], score: scoreScan([]) });
    const known = s.sections.find((x) => x.heading === "Known limitations");
    expect(known?.paragraphs.join(" ")).toMatch(/not a statement that the site is free of barriers/i);
    expect(s.status).toBe("partial");
  });

  test("escapes markup in organisation-supplied values", () => {
    // Organisation and contact go straight into a page the customer publishes.
    const s = generateStatement({
      ...BASE,
      organisation: '<script>alert("x")</script>Acme & Co',
    });
    expect(s.html).not.toContain("<script>");
    expect(s.html).toContain("&lt;script&gt;");
    expect(s.html).toContain("Acme &amp; Co");
  });

  test("emits HTML and plain text carrying the same claims", () => {
    const s = generateStatement(BASE, scan);
    expect(s.html).toContain("<h2>");
    expect(s.html).toContain("partially conformant");
    expect(s.text).toContain("partially conformant");
    expect(s.text).not.toContain("<h2>");
  });

  test("honours a WCAG 2.1 statement when that is what the regime requires", () => {
    // AODA and Section 508 are measured against older baselines than 2.2.
    const s = generateStatement({ ...BASE, wcagVersion: "2.1" }, scan);
    expect(s.text).toContain("version 2.1");
    expect(s.text).toContain("WCAG 2.1 level AA");
  });

  test("surfaces the downgrade warning on the returned document", () => {
    const s = generateStatement({ ...BASE, claimedStatus: "full" }, scan);
    expect(s.status).toBe("partial");
    expect(s.warnings).not.toHaveLength(0);
  });
});
