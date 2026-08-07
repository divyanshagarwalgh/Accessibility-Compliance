import { getDb } from "./bindings";
import { newId } from "./ids";
import type { Regression, RuleSnapshot } from "@/rules/regression";

/**
 * Scheduled re-scans.
 *
 * The schema has been sitting in `0001_init.sql` since the first migration;
 * this is the code that finally uses it.
 *
 * `next_run_at` is stored rather than computed from `last_run_at` so a due
 * query is a single indexed range scan (`idx_monitors_due`) instead of a
 * per-row date calculation. It also means a schedule change takes effect on
 * the next run rather than retroactively.
 */

export type Schedule = "daily" | "weekly" | "on-publish";

export type MonitorRow = {
  id: string;
  site_url: string;
  owner_email: string;
  schedule: Schedule;
  thresholds: string;
  recipients: string;
  is_active: number;
  last_run_at: number | null;
  next_run_at: number | null;
  created_at: number;
};

const INTERVAL_MS: Record<Exclude<Schedule, "on-publish">, number> = {
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
};

/**
 * When the next run is due.
 *
 * `on-publish` monitors have no clock — they are triggered by a Webflow
 * publish webhook — so they get a null `next_run_at` and the due query skips
 * them rather than firing them on a timer they never asked for.
 */
export function nextRunAt(schedule: Schedule, from: number): number | null {
  if (schedule === "on-publish") return null;
  return from + INTERVAL_MS[schedule];
}

export async function createMonitor(params: {
  siteUrl: string;
  ownerEmail: string;
  schedule: Schedule;
  thresholds: unknown;
  recipients: string[];
}): Promise<MonitorRow> {
  const db = await getDb();
  const id = newId();
  const now = Date.now();

  await db
    .prepare(
      `insert into monitors
         (id, site_url, owner_email, schedule, thresholds, recipients, is_active, next_run_at, created_at)
       values (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    )
    .bind(
      id,
      params.siteUrl,
      params.ownerEmail,
      params.schedule,
      JSON.stringify(params.thresholds ?? {}),
      JSON.stringify(params.recipients ?? []),
      // First run is immediate — a monitor that waits a week to establish its
      // own baseline is a week of no cover.
      now,
      now,
    )
    .run();

  const row = await getMonitor(id);
  if (!row) throw new Error("monitor disappeared immediately after insert");
  return row;
}

export async function getMonitor(id: string): Promise<MonitorRow | null> {
  const db = await getDb();
  return db.prepare("select * from monitors where id = ?").bind(id).first<MonitorRow>();
}

/** Active monitors whose next run is in the past. */
export async function listDueMonitors(limit = 25): Promise<MonitorRow[]> {
  const db = await getDb();
  const { results } = await db
    .prepare(
      `select * from monitors
       where is_active = 1 and next_run_at is not null and next_run_at <= ?
       order by next_run_at asc
       limit ?`,
    )
    .bind(Date.now(), limit)
    .all<MonitorRow>();
  return results ?? [];
}

/**
 * Moves the schedule forward.
 *
 * Called when a run is *dispatched*, not when it completes. If it waited for
 * completion, a monitor whose scan hangs would be re-dispatched on every cron
 * tick and pile up browser sessions against a 3-concurrent limit.
 */
export async function markDispatched(monitor: MonitorRow): Promise<void> {
  const db = await getDb();
  const now = Date.now();
  await db
    .prepare("update monitors set last_run_at = ?, next_run_at = ? where id = ?")
    .bind(now, nextRunAt(monitor.schedule, now), monitor.id)
    .run();
}

/**
 * Pauses or resumes a monitor.
 *
 * Pausing clears `next_run_at` rather than only flipping `is_active`. The due
 * query filters on both, so leaving a stale timestamp behind would work today
 * and fire a backlog of overdue runs the moment someone resumed it.
 */
export async function setMonitorActive(id: string, isActive: boolean): Promise<void> {
  const db = await getDb();
  await db
    .prepare("update monitors set is_active = ?, next_run_at = ? where id = ?")
    .bind(isActive ? 1 : 0, isActive ? Date.now() : null, id)
    .run();
}

/** Deletes a monitor and its run history. */
export async function deleteMonitor(id: string): Promise<void> {
  const db = await getDb();
  // Runs first: orphaned rows in monitor_runs would keep the history reachable
  // by monitor_id after the monitor itself is gone.
  await db.batch([
    db.prepare("delete from monitor_runs where monitor_id = ?").bind(id),
    db.prepare("delete from monitors where id = ?").bind(id),
  ]);
}

export type MonitorRunRow = {
  id: string;
  monitor_id: string;
  scan_id: string | null;
  run_at: number;
  score: number | null;
  delta: number | null;
  regressions: string;
  alert_sent: number;
};

/** The previous completed run, which is what the next scan is compared against. */
export async function getLastRun(monitorId: string): Promise<MonitorRunRow | null> {
  const db = await getDb();
  return db
    .prepare(
      `select * from monitor_runs
       where monitor_id = ? and score is not null
       order by run_at desc limit 1`,
    )
    .bind(monitorId)
    .first<MonitorRunRow>();
}

export async function recordRun(params: {
  monitorId: string;
  scanId: string;
  score: number;
  delta: number | null;
  regressions: Regression[];
  /** Persisted so the next run can diff against it without re-reading issues. */
  snapshot: RuleSnapshot[];
  alertSent: boolean;
}): Promise<void> {
  const db = await getDb();
  await db
    .prepare(
      `insert into monitor_runs (id, monitor_id, scan_id, run_at, score, delta, regressions, alert_sent)
       values (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      newId(),
      params.monitorId,
      params.scanId,
      Date.now(),
      params.score,
      params.delta,
      JSON.stringify({ regressions: params.regressions, snapshot: params.snapshot }),
      params.alertSent ? 1 : 0,
    )
    .run();
}

/** Reads the rule snapshot back out of a stored run. */
export function snapshotOf(run: MonitorRunRow): RuleSnapshot[] {
  try {
    const parsed = JSON.parse(run.regressions) as { snapshot?: RuleSnapshot[] };
    return parsed.snapshot ?? [];
  } catch {
    return [];
  }
}

/**
 * Reads the regressions back out of a stored run.
 *
 * The column holds `{regressions, snapshot}` rather than a bare array, so
 * reading it straight as one yields `undefined` and a dashboard that silently
 * reports no regressions when there were several.
 */
export function regressionsOf(run: MonitorRunRow): Regression[] {
  try {
    const parsed = JSON.parse(run.regressions) as { regressions?: Regression[] };
    return parsed.regressions ?? [];
  } catch {
    return [];
  }
}

export async function listRuns(monitorId: string, limit = 30): Promise<MonitorRunRow[]> {
  const db = await getDb();
  const { results } = await db
    .prepare("select * from monitor_runs where monitor_id = ? order by run_at desc limit ?")
    .bind(monitorId, limit)
    .all<MonitorRunRow>();
  return results ?? [];
}
