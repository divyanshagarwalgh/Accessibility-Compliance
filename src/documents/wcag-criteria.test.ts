import { describe, expect, it } from "vitest";
import { CRITERIA, CRITERIA_BY_SC, compareSc } from "./wcag-criteria";
import { TOTAL_WCAG_AA_CRITERIA } from "@/rules/score";
import { RULES } from "@/rules/catalogue";

/**
 * These tests exist because the criteria list is *data*, and wrong data in a
 * compliance document is the single most damaging thing this product could
 * ship. A procurement team reads a VPAT against their own checklist; an
 * invented criterion number, or a AAA criterion presented as AA, is caught
 * immediately and costs the credibility the whole tool trades on.
 */

describe("WCAG 2.2 criteria data", () => {
  it("has exactly 55 Level A and AA criteria, split 31 and 24", () => {
    // Cross-checks the published version deltas: WCAG 2.0 contributes 38
    // (25 A + 13 AA), 2.1 adds 12 at A/AA, 2.2 adds 6 and withdraws 4.1.1.
    const a = CRITERIA.filter((c) => c.level === "A");
    const aa = CRITERIA.filter((c) => c.level === "AA");
    expect(a).toHaveLength(31);
    expect(aa).toHaveLength(24);
    expect(CRITERIA).toHaveLength(55);
  });

  it("agrees with the coverage denominator the reports already publish", () => {
    // If these ever diverge, one of the two is lying to the user.
    expect(CRITERIA).toHaveLength(TOTAL_WCAG_AA_CRITERIA);
  });

  it("excludes 2.5.5 Target Size (Enhanced), which is Level AAA", () => {
    expect(CRITERIA_BY_SC.has("2.5.5")).toBe(false);
  });

  it("excludes 4.1.1 Parsing, removed in WCAG 2.2", () => {
    expect(CRITERIA_BY_SC.has("4.1.1")).toBe(false);
  });

  it("carries no Level AAA criteria at all", () => {
    expect(CRITERIA.filter((c) => c.level === "AAA")).toHaveLength(0);
  });

  it("includes every criterion WCAG 2.2 added at A or AA", () => {
    const added = ["2.4.11", "2.5.7", "2.5.8", "3.2.6", "3.3.7", "3.3.8"];
    for (const sc of added) {
      expect(CRITERIA_BY_SC.get(sc)?.introducedIn, sc).toBe("2.2");
    }
    expect(CRITERIA.filter((c) => c.introducedIn === "2.2")).toHaveLength(added.length);
  });

  it("has 12 criteria introduced by WCAG 2.1", () => {
    expect(CRITERIA.filter((c) => c.introducedIn === "2.1")).toHaveLength(12);
  });

  it("has no duplicate success criterion numbers", () => {
    expect(CRITERIA_BY_SC.size).toBe(CRITERIA.length);
  });

  it("numbers every criterion in the documented shape", () => {
    for (const c of CRITERIA) {
      expect(c.sc, c.sc).toMatch(/^\d+\.\d+\.\d+$/);
      expect(c.name.length, c.sc).toBeGreaterThan(2);
    }
  });

  it("is stored in ascending criterion order", () => {
    // The VPAT renders this list directly, and procurement expects it ordered.
    const sorted = [...CRITERIA].sort((x, y) => compareSc(x.sc, y.sc));
    expect(CRITERIA.map((c) => c.sc)).toEqual(sorted.map((c) => c.sc));
  });

  it("covers every criterion the rule catalogue claims to test", () => {
    // A rule pointing at a criterion that does not exist would silently drop
    // out of the VPAT and quietly deflate the coverage figure.
    for (const rule of RULES) {
      expect(CRITERIA_BY_SC.has(rule.sc), `${rule.id} -> ${rule.sc}`).toBe(true);
    }
  });
});

describe("compareSc", () => {
  it("orders by numeric segment, not lexically", () => {
    expect(compareSc("1.4.9", "1.4.10")).toBeLessThan(0);
    expect(compareSc("1.4.10", "1.4.9")).toBeGreaterThan(0);
    expect(compareSc("2.4.11", "2.5.1")).toBeLessThan(0);
    expect(compareSc("1.1.1", "1.1.1")).toBe(0);
  });
});
