import Link from "next/link";
import { notFound } from "next/navigation";
import { getMonitor, listRuns, regressionsOf, type MonitorRunRow } from "@/lib/monitors";
import { DEFAULT_THRESHOLDS, type MonitorThresholds } from "@/rules/regression";
import styles from "@/styles/modules.module.css";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Monitoring dashboard",
  robots: { index: false, follow: false },
};

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** UTC throughout, so the server render and the client hydration agree. */
function formatWhen(ms: number): string {
  const d = new Date(ms);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${hh}:${mm} UTC`;
}

function formatDay(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/**
 * The monitoring dashboard. Spec: docs/design-inventory.md §4.12.
 *
 * Reads D1 directly rather than going through `GET /api/monitors`: this is a
 * server component in the same worker as the route, so a fetch would be a
 * network round trip to itself.
 *
 * The dashboard leads on regressions, not on the score. The score is
 * severity-weighted with a logarithm on node count, so a genuinely bad
 * regression can move it by a couple of points — ranking by score would bury
 * exactly the failure the product exists to catch.
 */
export default async function MonitorDashboard({
  params,
}: {
  params: Promise<{ monitorId: string }>;
}) {
  const { monitorId } = await params;
  const monitor = await getMonitor(monitorId);
  if (!monitor) notFound();

  const runs = await listRuns(monitorId);
  const chronological = [...runs].reverse();
  const latest = runs[0];
  const latestRegressions = latest ? regressionsOf(latest) : [];
  const recipients = safeParse<string[]>(monitor.recipients, []);
  const thresholds: MonitorThresholds = {
    ...DEFAULT_THRESHOLDS,
    ...safeParse<MonitorThresholds>(monitor.thresholds, {}),
  };

  return (
    <div className={styles.wrap}>
      <header className={styles.head}>
        <p className={styles.breadcrumb}>
          <Link href="/">Accessibility workspace</Link> ·{" "}
          <Link href="/monitoring">Monitoring</Link>
        </p>
        <h1 className={styles.h1}>{monitor.site_url}</h1>
        <p className={styles.meta}>
          {monitor.schedule === "on-publish"
            ? "Scans on publish"
            : `Scans ${monitor.schedule}`}
          {" · "}
          {monitor.is_active === 1 ? "Active" : "Paused"}
          {monitor.next_run_at ? ` · next run ${formatWhen(monitor.next_run_at)}` : ""}
        </p>
      </header>

      {latestRegressions.length > 0 ? (
        <section className={`${styles.cardTight} ${styles.spaceBottom2}`} role="alert">
          <p className={styles.h3}>
            The last run broke {latestRegressions.length}{" "}
            {latestRegressions.length === 1 ? "check that" : "checks that"} used to pass
          </p>
          <ul className={styles.stackTight}>
            {latestRegressions.map((r) => (
              <li key={r.ruleId} className={styles.note}>
                <span className={styles.chip} data-tone={r.kind === "new" ? "fail" : "warn"}>
                  {r.kind === "new" ? "New" : "Worse"}
                </span>{" "}
                <strong>{r.name}</strong> — {r.previousNodeCount} →{" "}
                {r.nodeCount} {r.nodeCount === 1 ? "element" : "elements"} ({r.severity})
              </li>
            ))}
          </ul>
          {latest?.scan_id ? (
            <p className={styles.spaceTop3}>
              <Link className={styles.btnGhost} href={`/report/${latest.scan_id}`}>
                See the full report
              </Link>
            </p>
          ) : null}
        </section>
      ) : null}

      <div className={styles.split}>
        <div className={styles.stack}>
          <section className={styles.card} aria-labelledby="trend-h">
            <h2 className={styles.h3} id="trend-h">
              Score across {chronological.length}{" "}
              {chronological.length === 1 ? "run" : "runs"}
            </h2>

            {chronological.length === 0 ? (
              <p className={styles.note}>
                No runs recorded yet. The first scan runs as soon as the scheduler picks
                the monitor up, which is within the hour.
              </p>
            ) : (
              <>
                <ul className={`${styles.chart} ${styles.spaceTop4}`}>
                  {chronological.map((run) => {
                    const score = run.score ?? 0;
                    const regressed = regressionsOf(run).length > 0;
                    return (
                      <li key={run.id} className={styles.chartCol}>
                        <span className={styles.chartValue}>{run.score ?? "—"}</span>
                        <span
                          className={styles.chartBar}
                          data-tone={regressed ? "fail" : undefined}
                          style={{ blockSize: `${Math.max(score, 1)}%` }}
                        />
                      </li>
                    );
                  })}
                </ul>
                <p className={styles.chartAxis}>
                  <span>{formatDay(chronological[0]!.run_at)}</span>
                  <span>{formatDay(chronological[chronological.length - 1]!.run_at)}</span>
                </p>
              </>
            )}
          </section>

          <section aria-labelledby="runs-h">
            <h2 className={styles.h3} id="runs-h">
              Run history
            </h2>
            {runs.length === 0 ? (
              <p className={styles.note}>Nothing to show yet.</p>
            ) : (
              <div
                className={`${styles.tableScroll} ${styles.spaceTop2}`}
                tabIndex={0}
                role="region"
                aria-label="Run history"
              >
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">Run</th>
                      <th scope="col">Score</th>
                      <th scope="col">Change</th>
                      <th scope="col">Regressions</th>
                      <th scope="col">Report</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runs.map((run) => (
                      <tr key={run.id}>
                        <td className={styles.num}>{formatWhen(run.run_at)}</td>
                        <td className={styles.num}>{run.score ?? "—"}</td>
                        <td className={styles.num}>
                          <Delta delta={run.delta} />
                        </td>
                        <td>{describeRegressions(run)}</td>
                        <td>
                          {run.scan_id ? (
                            <Link href={`/report/${run.scan_id}`}>Open</Link>
                          ) : (
                            <span className={styles.hint}>—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <div className={styles.stack}>
          <section className={styles.cardTight} aria-labelledby="activity-h">
            <h2 className={styles.h3} id="activity-h">
              Activity
            </h2>
            {runs.length === 0 ? (
              <p className={styles.note}>Nothing has happened yet.</p>
            ) : (
              <ul className={styles.timeline}>
                {runs.map((run, i) => {
                  const regressions = regressionsOf(run);
                  const isFirst = i === runs.length - 1;
                  const tone = regressions.length > 0 ? "fail" : isFirst ? undefined : "pass";
                  return (
                    <li key={run.id} className={styles.event}>
                      <span className={styles.eventDot} data-tone={tone} aria-hidden="true" />
                      <div>
                        <p className={styles.eventTitle}>
                          {regressions.length > 0
                            ? `${regressions.length} ${regressions.length === 1 ? "check" : "checks"} regressed`
                            : isFirst
                              ? "Baseline recorded"
                              : "Scan completed, no regressions"}
                        </p>
                        <p className={styles.eventBody}>
                          {formatWhen(run.run_at)}
                          {run.score !== null ? ` · score ${run.score}` : ""}
                          {run.alert_sent === 1 ? " · alert sent" : ""}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className={styles.cardTight} aria-labelledby="schedule-h">
            <h2 className={styles.h3} id="schedule-h">
              Schedule
            </h2>
            <dl className={styles.stackTight}>
              <Row label="Frequency" value={monitor.schedule === "on-publish" ? "On publish" : monitor.schedule === "daily" ? "Daily" : "Weekly"} />
              <Row
                label="Alert to"
                value={`${recipients.length || 1} ${recipients.length === 1 || recipients.length === 0 ? "recipient" : "recipients"}`}
              />
              <Row
                label="Last run"
                value={monitor.last_run_at ? formatWhen(monitor.last_run_at) : "Not yet"}
              />
              <Row
                label="Next run"
                value={monitor.next_run_at ? formatWhen(monitor.next_run_at) : "On publish only"}
              />
              <Row
                label="Alerts when"
                value={[
                  thresholds.newCritical ? "a new critical appears" : null,
                  thresholds.scoreDropPoints
                    ? `the score falls ${thresholds.scoreDropPoints}+ points`
                    : null,
                  thresholds.anyRegression ? "any rule regresses" : null,
                ]
                  .filter(Boolean)
                  .join(", ") || "never"}
              />
            </dl>
            <p className={`${styles.hint} ${styles.spaceTop3}`}>
              Monitor ID <span className={styles.mono}>{monitor.id}</span>. Keep it — it
              is the only way back to this dashboard.
            </p>
          </section>
        </div>
      </div>

      <section className={styles.caveat} aria-label="What monitoring covers">
        <p className={styles.caveatTitle}>This catches regressions. It does not certify compliance.</p>
        <p className={styles.caveatBody}>
          Monitoring watches the WCAG criteria a machine can evaluate — about a fifth of
          WCAG 2.2 Level A and AA. A quiet week means nothing was detected in that fifth,
          not that the page is conformant.
        </p>
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className={styles.hint}>{label}</dt>
      <dd className={`${styles.note} ${styles.defValue}`}>{value}</dd>
    </div>
  );
}

function Delta({ delta }: { delta: number | null }) {
  if (delta === null) return <span className={styles.hint}>baseline</span>;
  const tone = delta > 0 ? "pass" : delta < 0 ? "fail" : "neutral";
  return (
    <span className={styles.chip} data-tone={tone}>
      {delta > 0 ? `+${delta}` : delta}
    </span>
  );
}

function describeRegressions(run: MonitorRunRow) {
  const regressions = regressionsOf(run);
  if (regressions.length === 0) return <span className={styles.hint}>None</span>;
  return (
    <>
      {regressions.map((r) => (
        <div key={r.ruleId}>
          {r.name} <span className={styles.hint}>({r.kind}, {r.severity})</span>
        </div>
      ))}
    </>
  );
}

function safeParse<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
