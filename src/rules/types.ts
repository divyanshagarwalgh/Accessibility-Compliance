/**
 * Rule engine types.
 *
 * The Webflow Designer fix steps are the product's entire differentiator — generic
 * axe-core output is free everywhere. Everything here exists to carry those steps
 * reliably from the rule catalogue to the report.
 */

export type WcagLevel = "A" | "AA" | "AAA";
export type Severity = "Critical" | "Serious" | "Moderate" | "Minor";

/** Where a fix belongs. CMS-bound issues are fixed on the field, not the element. */
export type FixSurface = "designer" | "cms" | "project-settings" | "custom-code";

export type Rule = {
  /** Our stable id. Survives axe-core upgrades and rule-mapping changes. */
  id: string;
  /** Human-readable rule name, shown as the issue title. */
  name: string;
  /** WCAG success criterion, e.g. "1.4.3". */
  sc: string;
  level: WcagLevel;
  severity: Severity;
  /** WCAG version the criterion was introduced in. 2.2 rules are called out in the UI. */
  introducedIn: "2.0" | "2.1" | "2.2";
  /** Plain-English explanation of what is broken and who it affects. */
  why: string;
  /** Ordered Webflow Designer steps. THE differentiator. */
  webflowSteps: string[];
  /** Which surface the fix lives on. Drives the "Fixable in Designer" chip. */
  fixSurface: FixSurface;
  /** Rough effort, shown in the "Fix these three first" panel. */
  effort: string;
  /** axe-core rule ids that map onto this rule. */
  axeRuleIds: string[];
  /**
   * True when the criterion cannot be evaluated from static HTML and needs a
   * rendered page with computed styles and layout.
   */
  requiresLayout: boolean;
  /**
   * True when axe-core has no equivalent and we run a custom check.
   * Surfaced in the methodology page so the coverage claim stays honest.
   */
  customCheck?: boolean;
  /** Optional deeper note shown in the issue sidebar. */
  note?: string;
};

export type IssueNode = {
  selector: string;
  html?: string;
  text?: string;
  /** Contrast rules only. */
  fgHex?: string;
  bgHex?: string;
  ratio?: number;
  /** True when this node sits inside a Collection List. */
  inCollectionList?: boolean;
  collectionName?: string;
  fieldHint?: string;
};

export type Issue = {
  ruleId: string;
  axeRuleId?: string;
  rule: Rule;
  nodes: IssueNode[];
  nodeCount: number;
  /** True when any node is CMS-bound. Changes the fix instructions shown. */
  isCmsBound: boolean;
  /** False when we are falling back to generic axe guidance. Shown to the user. */
  hasWebflowSteps: boolean;
};
