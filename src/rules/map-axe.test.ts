import { describe, expect, test } from "vitest";
import { mapAxeResults, type AxeViolation } from "./map-axe";

const violation = (id: string, nodes: Partial<AxeViolation["nodes"][number]>[]): AxeViolation => ({
  id,
  impact: "serious",
  help: `axe help for ${id}`,
  helpUrl: `https://dequeuniversity.com/rules/axe/4.10/${id}`,
  description: `axe description for ${id}`,
  nodes: nodes.map((n) => ({ target: [".x"], html: "<div></div>", ...n })),
});

describe("mapAxeResults", () => {
  test("maps a known axe rule onto our rule with Webflow steps", () => {
    const [issue] = mapAxeResults([violation("color-contrast", [{ target: [".btn"] }])]);
    expect(issue!.ruleId).toBe("contrast");
    expect(issue!.hasWebflowSteps).toBe(true);
    expect(issue!.rule.webflowSteps.length).toBeGreaterThan(0);
    expect(issue!.rule.sc).toBe("1.4.3");
  });

  test("merges several axe rules that map onto the same rule of ours", () => {
    // image-alt and role-img-alt are both our "alt" rule. Reporting them
    // separately would double-count one fix.
    const issues = mapAxeResults([
      violation("image-alt", [{ target: ["img.a"] }]),
      violation("role-img-alt", [{ target: ["svg.b"] }]),
    ]);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.ruleId).toBe("alt");
    expect(issues[0]!.nodeCount).toBe(2);
  });

  test("keeps an unknown axe rule instead of dropping it", () => {
    // Silently discarding findings we have no copy for would under-report.
    const [issue] = mapAxeResults([violation("some-future-axe-rule", [{ target: [".z"] }])]);
    expect(issue).toBeDefined();
    expect(issue!.ruleId).toBe("axe:some-future-axe-rule");
  });

  test("marks an unmapped rule as having no Webflow steps, so the UI can say so", () => {
    const [issue] = mapAxeResults([violation("some-future-axe-rule", [{ target: [".z"] }])]);
    expect(issue!.hasWebflowSteps).toBe(false);
    expect(issue!.rule.webflowSteps).toEqual([]);
  });

  test("carries axe's own help text through for unmapped rules", () => {
    const [issue] = mapAxeResults([violation("some-future-axe-rule", [{ target: [".z"] }])]);
    expect(issue!.rule.why).toContain("axe description for some-future-axe-rule");
  });

  test("detects a node inside a Collection List as CMS-bound", () => {
    const [issue] = mapAxeResults([
      violation("image-alt", [{ target: [".w-dyn-item > img"] }]),
    ]);
    expect(issue!.isCmsBound).toBe(true);
    expect(issue!.nodes[0]!.inCollectionList).toBe(true);
  });

  test("does not mark a static node as CMS-bound", () => {
    const [issue] = mapAxeResults([violation("image-alt", [{ target: ["header img"] }])]);
    expect(issue!.isCmsBound).toBe(false);
  });

  test("marks the whole issue CMS-bound when only some nodes are", () => {
    // The fix instructions differ, so the user needs to know a CMS field is involved
    // even if most instances are static.
    const [issue] = mapAxeResults([
      violation("image-alt", [{ target: ["header img"] }, { target: [".w-dyn-item img"] }]),
    ]);
    expect(issue!.isCmsBound).toBe(true);
    expect(issue!.nodes.filter((n) => n.inCollectionList)).toHaveLength(1);
  });

  test("extracts contrast data from axe's failure summary", () => {
    const [issue] = mapAxeResults([
      {
        ...violation("color-contrast", []),
        nodes: [
          {
            target: [".btn"],
            html: "<a>x</a>",
            any: [
              {
                id: "color-contrast",
                data: { fgColor: "#ff7a45", bgColor: "#ffffff", contrastRatio: 2.59 },
              },
            ],
          },
        ],
      },
    ]);
    expect(issue!.nodes[0]!.fgHex).toBe("#ff7a45");
    expect(issue!.nodes[0]!.bgHex).toBe("#ffffff");
    expect(issue!.nodes[0]!.ratio).toBe(2.59);
  });

  test("orders issues by severity, worst first", () => {
    const issues = mapAxeResults([
      violation("target-size", [{ target: [".a"] }]),
      violation("html-has-lang", [{ target: ["html"] }]),
      violation("color-contrast", [{ target: [".b"] }]),
    ]);
    expect(issues.map((i) => i.rule.severity)).toEqual(["Critical", "Serious", "Moderate"]);
  });

  test("returns nothing for a clean scan", () => {
    expect(mapAxeResults([])).toEqual([]);
  });

  test("ignores a violation that reports no nodes", () => {
    expect(mapAxeResults([violation("color-contrast", [])])).toEqual([]);
  });
});
