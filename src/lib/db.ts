import { getDb } from "./bindings";
import type { Issue } from "@/rules/types";
import { newId } from "./ids";

/**
 * D1 access.
 *
 * Every statement is parameterised — user-supplied URLs and emails go nowhere
 * near string concatenation.
 */

export type ScanRow = {
  id: string;
  url: string;
  url_normalised: string;
  domain: string;
  status: "queued" | "running" | "done" | "failed";
  error_code: string | null;
  error_detail: string | null;
  score: number | null;
  issue_count: number;
  rule_count: number;
  requested_at: number;
  started_at: number | null;
  completed_at: number | null;
  email: string | null;
  engine_version: string;
  ruleset_version: string;
  criteria_tested: number | null;
  criteria_total: number | null;
  raw_result_key: string | null;
  /** Set when the scan was fired by a monitor rather than by a person. */
  monitor_id: string | null;
};

export async function createScan(params: {
  id: string;
  url: string;
  urlNormalised: string;
  domain: string;
  requesterIpHash: string;
  sourceTool: string;
  /** Links the scan back to the monitor that scheduled it. */
  monitorId?: string | null;
}): Promise<void> {
  const db = await getDb();
  await db
    .prepare(
      `insert into scans (id, url, url_normalised, domain, status, requested_at, requester_ip_hash, source_tool, monitor_id)
       values (?, ?, ?, ?, 'queued', ?, ?, ?, ?)`,
    )
    .bind(
      params.id,
      params.url,
      params.urlNormalised,
      params.domain,
      Date.now(),
      params.requesterIpHash,
      params.sourceTool,
      params.monitorId ?? null,
    )
    .run();
}

export async function getScan(id: string): Promise<ScanRow | null> {
  const db = await getDb();
  return db.prepare("select * from scans where id = ?").bind(id).first<ScanRow>();
}

export async function failScan(
  id: string,
  errorCode: string,
  detail?: string,
): Promise<void> {
  const db = await getDb();
  await db
    .prepare(
      `update scans set status = 'failed', error_code = ?, error_detail = ?, completed_at = ?
       where id = ?`,
    )
    .bind(errorCode, detail ?? null, Date.now(), id)
    .run();
}

export async function completeScan(params: {
  id: string;
  score: number;
  issues: Issue[];
  engineVersion: string;
  rulesetVersion: string;
  criteriaTested: number;
  criteriaTotal: number;
  rawResultKey: string | null;
}): Promise<void> {
  const db = await getDb();
  const now = Date.now();

  const statements = [
    db
      .prepare(
        `update scans
         set status = 'done', score = ?, issue_count = ?, rule_count = ?, completed_at = ?,
             engine_version = ?, ruleset_version = ?, criteria_tested = ?, criteria_total = ?,
             raw_result_key = ?
         where id = ?`,
      )
      .bind(
        params.score,
        params.issues.reduce((sum, i) => sum + i.nodeCount, 0),
        params.issues.length,
        now,
        params.engineVersion,
        params.rulesetVersion,
        params.criteriaTested,
        params.criteriaTotal,
        params.rawResultKey,
        params.id,
      ),
    // A re-run of the same scan id replaces its issues rather than appending.
    db.prepare("delete from issues where scan_id = ?").bind(params.id),
    ...params.issues.map((issue) =>
      db
        .prepare(
          `insert into issues
             (id, scan_id, rule_id, axe_rule_id, wcag_sc, level, severity, node_count,
              selectors, why, webflow_steps, has_webflow_steps, is_cms_bound, cms_hint, created_at)
           values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          newId(),
          params.id,
          issue.ruleId,
          issue.axeRuleId ?? null,
          issue.rule.sc,
          issue.rule.level === "AAA" ? "AA" : issue.rule.level,
          issue.rule.severity,
          issue.nodeCount,
          // Cap stored nodes: a page can have thousands and the report shows a sample.
          JSON.stringify(issue.nodes.slice(0, 50)),
          issue.rule.why,
          JSON.stringify(issue.rule.webflowSteps),
          issue.hasWebflowSteps ? 1 : 0,
          issue.isCmsBound ? 1 : 0,
          issue.nodes.find((n) => n.fieldHint)?.fieldHint ?? null,
          now,
        ),
    ),
  ];

  await db.batch(statements);
}

export type IssueRow = {
  id: string;
  rule_id: string;
  axe_rule_id: string | null;
  wcag_sc: string;
  level: string;
  severity: string;
  node_count: number;
  selectors: string;
  why: string;
  webflow_steps: string;
  has_webflow_steps: number;
  is_cms_bound: number;
  cms_hint: string | null;
};

export async function getIssues(scanId: string): Promise<IssueRow[]> {
  const db = await getDb();
  const { results } = await db
    .prepare(
      `select * from issues where scan_id = ?
       order by case severity
         when 'Critical' then 0 when 'Serious' then 1
         when 'Moderate' then 2 else 3 end, node_count desc`,
    )
    .bind(scanId)
    .all<IssueRow>();
  return results ?? [];
}

export async function attachEmail(scanId: string, email: string): Promise<void> {
  const db = await getDb();
  await db.prepare("update scans set email = ? where id = ?").bind(email, scanId).run();
}

export async function createLead(params: {
  email: string;
  scanId: string | null;
  sourceTool: string;
  domain: string | null;
  score: number | null;
  wantsRescan: boolean;
}): Promise<string> {
  const db = await getDb();
  const id = newId();
  await db
    .prepare(
      `insert into leads (id, email, scan_id, source_tool, domain, score, wants_rescan, created_at)
       values (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      params.email,
      params.scanId,
      params.sourceTool,
      params.domain,
      params.score,
      params.wantsRescan ? 1 : 0,
      Date.now(),
    )
    .run();
  return id;
}

export type DocumentRow = {
  id: string;
  type: "statement" | "vpat";
  scan_id: string | null;
  payload: string;
  export_key: string | null;
  created_at: number;
  updated_at: number;
};

/**
 * Stores a generated statement or VPAT.
 *
 * Kept because these documents are edited over time — a customer revises the
 * planned fix dates on a statement, or confirms VPAT rows by hand — and because
 * a document that was published on a customer's site needs to stay retrievable
 * at the URL it was issued from, whatever the catalogue does later.
 */
export async function saveDocument(params: {
  type: DocumentRow["type"];
  scanId: string | null;
  payload: unknown;
}): Promise<string> {
  const db = await getDb();
  const id = newId();
  const now = Date.now();
  await db
    .prepare(
      `insert into documents (id, type, scan_id, payload, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, params.type, params.scanId, JSON.stringify(params.payload), now, now)
    .run();
  return id;
}

export async function getDocument(id: string): Promise<DocumentRow | null> {
  const db = await getDb();
  return db.prepare("select * from documents where id = ?").bind(id).first<DocumentRow>();
}

export async function markLeadSynced(id: string, error?: string): Promise<void> {
  const db = await getDb();
  await db
    .prepare("update leads set brevo_synced = ?, brevo_error = ? where id = ?")
    .bind(error ? 0 : 1, error ?? null, id)
    .run();
}
