import { RULE_BY_AXE_ID } from "./catalogue";
import { SEVERITY_WEIGHTS } from "./score";
import type { Issue, IssueNode, Rule, Severity } from "./types";

/** The subset of axe-core's result shape we rely on. */
export type AxeNode = {
  target: string[];
  html?: string;
  failureSummary?: string;
  any?: Array<{ id: string; data?: Record<string, unknown> }>;
};

export type AxeViolation = {
  id: string;
  impact?: "minor" | "moderate" | "serious" | "critical" | null;
  help?: string;
  helpUrl?: string;
  description?: string;
  nodes: AxeNode[];
};

/**
 * Webflow marks Collection List output with these classes. A failing node inside
 * one means the fix belongs on the CMS field, not the element — fixing the element
 * only fixes the first item, and the next publish overwrites it.
 */
const COLLECTION_MARKERS = ["w-dyn-item", "w-dyn-list", "w-dyn-bind-empty", "w-dyn-items"];

function isCollectionNode(selector: string): boolean {
  return COLLECTION_MARKERS.some((marker) => selector.includes(marker));
}

/** axe impact → our severity, for rules we have no catalogue entry for. */
const IMPACT_TO_SEVERITY: Record<string, Severity> = {
  critical: "Critical",
  serious: "Serious",
  moderate: "Moderate",
  minor: "Minor",
};

/**
 * A stand-in rule for anything axe reports that we have not written Webflow steps
 * for yet. It carries axe's own wording so the finding is still actionable, and is
 * flagged so the UI can say plainly that the Webflow-specific fix is missing.
 */
function fallbackRule(v: AxeViolation): Rule {
  return {
    id: `axe:${v.id}`,
    name: v.help ?? v.id,
    sc: "—",
    level: "AA",
    severity: IMPACT_TO_SEVERITY[v.impact ?? "moderate"] ?? "Moderate",
    introducedIn: "2.0",
    why: v.description ?? v.help ?? `axe-core reported ${v.id}.`,
    webflowSteps: [],
    fixSurface: "designer",
    effort: "Unknown",
    axeRuleIds: [v.id],
    requiresLayout: false,
    note: v.helpUrl,
  };
}

function toNode(n: AxeNode): IssueNode {
  const selector = n.target.join(" ");
  const contrast = n.any?.find((c) => c.id === "color-contrast")?.data as
    | { fgColor?: string; bgColor?: string; contrastRatio?: number }
    | undefined;

  const node: IssueNode = { selector };
  if (n.html) node.html = n.html;
  if (isCollectionNode(selector)) {
    node.inCollectionList = true;
    node.fieldHint =
      "This node is inside a Collection List. Bind the fix to a CMS field — editing the element only changes the first item.";
  }
  if (contrast?.fgColor) node.fgHex = contrast.fgColor;
  if (contrast?.bgColor) node.bgHex = contrast.bgColor;
  if (typeof contrast?.contrastRatio === "number") node.ratio = contrast.contrastRatio;
  return node;
}

/**
 * Turn raw axe-core violations into the issues the report renders.
 *
 * Several axe rules can map onto one of ours (image-alt, role-img-alt and
 * area-alt are all "images are missing alternative text"), so they are merged —
 * otherwise one fix is reported three times and the score is punished for it.
 */
export function mapAxeResults(violations: AxeViolation[]): Issue[] {
  const byRuleId = new Map<string, Issue>();

  for (const v of violations) {
    if (!v.nodes || v.nodes.length === 0) continue;

    const known = RULE_BY_AXE_ID.get(v.id);
    const rule = known ?? fallbackRule(v);
    const existing = byRuleId.get(rule.id);
    const nodes = v.nodes.map(toNode);

    if (existing) {
      existing.nodes.push(...nodes);
      existing.nodeCount = existing.nodes.length;
      existing.isCmsBound ||= nodes.some((n) => n.inCollectionList === true);
    } else {
      byRuleId.set(rule.id, {
        ruleId: rule.id,
        axeRuleId: v.id,
        rule,
        nodes,
        nodeCount: nodes.length,
        isCmsBound: nodes.some((n) => n.inCollectionList === true),
        hasWebflowSteps: rule.webflowSteps.length > 0,
      });
    }
  }

  // Worst first, then by breadth, so the report opens on what matters.
  return [...byRuleId.values()].sort((a, b) => {
    const bySeverity =
      SEVERITY_WEIGHTS[b.rule.severity] - SEVERITY_WEIGHTS[a.rule.severity];
    return bySeverity !== 0 ? bySeverity : b.nodeCount - a.nodeCount;
  });
}
