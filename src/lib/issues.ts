import type { IssueRow } from "./db";
import { RULES_BY_ID } from "@/rules/catalogue";
import type { Issue } from "@/rules/types";

/**
 * Rehydrates stored issue rows into the shape the rule engine works in.
 *
 * The report route, the statement generator and the VPAT generator all need
 * this, and they must agree — a scan that produces a "Partially supports" row
 * in the VPAT has to produce the matching limitation in the statement. Two
 * copies of this mapping would drift, and the drift would only show up in a
 * customer's compliance document.
 *
 * Rows whose rule id is no longer in the catalogue are kept, not dropped. A
 * stored report stays readable after a catalogue change, and the synthesised
 * rule carries `hasWebflowSteps` from the row so the UI can still say the
 * Webflow guidance is missing rather than pretending it exists.
 */
export function issuesFromRows(rows: IssueRow[]): Issue[] {
  return rows.map((row) => ({
    ruleId: row.rule_id,
    axeRuleId: row.axe_rule_id ?? undefined,
    rule:
      RULES_BY_ID.get(row.rule_id) ??
      ({
        id: row.rule_id,
        name: row.rule_id,
        sc: row.wcag_sc,
        level: row.level as Issue["rule"]["level"],
        severity: row.severity as Issue["rule"]["severity"],
        introducedIn: "2.0",
        why: row.why,
        webflowSteps: JSON.parse(row.webflow_steps) as string[],
        fixSurface: "designer",
        effort: "Unknown",
        axeRuleIds: [],
        requiresLayout: false,
      } satisfies Issue["rule"]),
    nodes: JSON.parse(row.selectors) as Issue["nodes"],
    nodeCount: row.node_count,
    isCmsBound: row.is_cms_bound === 1,
    hasWebflowSteps: row.has_webflow_steps === 1,
  }));
}
