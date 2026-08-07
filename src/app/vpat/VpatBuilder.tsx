"use client";

import { useId, useMemo, useState } from "react";
import { apiPath } from "@/lib/api-path";
import type { Conformance, Vpat, VpatEdition } from "@/documents/vpat";
import { DownloadActions } from "@/app/components/DownloadActions";
import styles from "@/styles/modules.module.css";

type Result = Vpat & { documentId: string; scanId: string | null };

const EDITIONS: Array<{ id: VpatEdition; label: string }> = [
  { id: "wcag", label: "WCAG edition" },
  { id: "508", label: "Section 508 edition" },
  { id: "eu", label: "EU edition (EN 301 549)" },
];

/** Red for a failure, amber for a partial, green for a pass, grey for untested. */
const TONE: Record<Conformance, string> = {
  Supports: "pass",
  "Partially supports": "warn",
  "Does not support": "fail",
  "Not evaluated": "neutral",
};

type Filter = "all" | "prefilled" | "not-evaluated" | "failures";

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "All criteria" },
  { id: "prefilled", label: "Pre-filled" },
  { id: "not-evaluated", label: "Not evaluated" },
  { id: "failures", label: "Failures only" },
];

/**
 * The VPAT screen.
 *
 * The filter defaults to "All criteria" and that default is deliberate. A
 * procurement team reads this against their own checklist, so the 43 rows no
 * scanner can reach have to be visible by default — hiding them behind a filter
 * reproduces exactly the problem the generator exists to avoid, where absent
 * rows read as rows that passed.
 */
export function VpatBuilder({ initialScanId }: { initialScanId: string }) {
  const uid = useId();

  const [productName, setProductName] = useState("");
  const [scanId, setScanId] = useState(initialScanId);
  const [edition, setEdition] = useState<VpatEdition>("wcag");
  const [filter, setFilter] = useState<Filter>("all");

  const [state, setState] = useState<"idle" | "working" | "error">("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    setState("working");
    setError("");

    try {
      const res = await fetch(apiPath("documents/vpat"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          productName: productName.trim() || undefined,
          scanId: scanId.trim() || undefined,
          edition,
        }),
      });
      const data = (await res.json()) as Result & { error?: string; message?: string };

      if (!res.ok) {
        setState("error");
        setError(data.message ?? "The VPAT could not be generated.");
        return;
      }

      setResult(data);
      setState("idle");
    } catch {
      setState("error");
      setError("Could not reach the server. Try again.");
    }
  }

  const rows = useMemo(() => {
    if (!result) return [];
    switch (filter) {
      case "prefilled":
        return result.rows.filter((r) => r.conformance !== "Not evaluated");
      case "not-evaluated":
        return result.rows.filter((r) => r.conformance === "Not evaluated");
      case "failures":
        return result.rows.filter(
          (r) => r.conformance === "Does not support" || r.conformance === "Partially supports",
        );
      default:
        return result.rows;
    }
  }, [result, filter]);

  return (
    <>
      <form className={`${styles.card} ${styles.form}`} onSubmit={generate}>
        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor={`${uid}-product`}>
              Product name
            </label>
            <input
              id={`${uid}-product`}
              className={styles.input}
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              aria-describedby={`${uid}-product-hint`}
            />
            <span className={styles.hint} id={`${uid}-product-hint`}>
              What procurement will see in the header. Filled from the scan domain if
              you leave it blank.
            </span>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor={`${uid}-scan`}>
              Scan ID (optional)
            </label>
            <input
              id={`${uid}-scan`}
              className={styles.input}
              value={scanId}
              onChange={(e) => setScanId(e.target.value)}
              aria-describedby={`${uid}-scan-hint`}
            />
            <span className={styles.hint} id={`${uid}-scan-hint`}>
              Without a scan you get the blank template with the untestable criteria
              already marked, which is still a day of work saved.
            </span>
          </div>
        </div>

        <fieldset className={styles.fieldset}>
          <legend className={styles.label}>Edition</legend>
          <div className={`${styles.segmented} ${styles.spaceTop2}`}>
            {EDITIONS.map((ed) => (
              <button
                key={ed.id}
                type="button"
                className={styles.segment}
                aria-pressed={edition === ed.id}
                onClick={() => setEdition(ed.id)}
              >
                {ed.label}
              </button>
            ))}
          </div>
          <p className={`${styles.hint} ${styles.spaceTop2}`}>
            All three carry the same criteria table — 508 and EN 301 549 both
            incorporate WCAG by reference — and differ in the scope note. The INT
            edition is not generated here: it covers non-web software and hardware
            chapters this tool never sees.
          </p>
        </fieldset>

        <div className={styles.btnRow}>
          <button
            className={styles.btn}
            type="submit"
            disabled={state === "working"}
            aria-busy={state === "working"}
          >
            {state === "working" ? "Generating…" : "Generate VPAT draft"}
          </button>
        </div>

        {state === "error" ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
      </form>

      {result ? (
        <section aria-labelledby="vpat-result-h" className={styles.spaceTop5}>
          <h2 className={styles.h2} id="vpat-result-h">
            {result.title}
          </h2>
          <p className={styles.meta}>
            {result.productName} · evaluated {result.evaluatedOn}
          </p>

          <ul className={`${styles.statGrid} ${styles.spaceTop4}`}>
            <li className={styles.stat}>
              <span className={styles.statValue} data-tone="neutral">
                {result.prefilledCount}
              </span>
              <span className={styles.statLabel}>criteria pre-filled</span>
            </li>
            <li className={styles.stat}>
              <span className={styles.statValue} data-tone="warn">
                {result.notEvaluatedCount}
              </span>
              <span className={styles.statLabel}>remaining need review</span>
            </li>
            <li className={styles.stat}>
              <span className={styles.statValue} data-tone="fail">
                {result.rows.filter((r) => r.conformance === "Does not support").length}
              </span>
              <span className={styles.statLabel}>do not support</span>
            </li>
            <li className={styles.stat}>
              <span className={styles.statValue} data-tone="info">
                {result.rows.length}
              </span>
              <span className={styles.statLabel}>criteria in total</span>
            </li>
          </ul>

          <p className={styles.greyNote}>{result.scopeNote}</p>

          <div className={`${styles.btnRowCentred} ${styles.spaceTop4}`}>
            <div className={styles.segmented} role="group" aria-label="Filter criteria">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={styles.segment}
                  aria-pressed={filter === f.id}
                  onClick={() => setFilter(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <DownloadActions
              documentId={result.documentId}
              docxLabel="Export .docx"
              files={[
                {
                  label: "Export .csv",
                  filename: `vpat-${result.edition}-${slug(result.productName)}.csv`,
                  type: "text/csv",
                  contents: () => toCsv(result),
                },
              ]}
            />
          </div>

          <p
            className={`${styles.meta} ${styles.spaceTop2} ${styles.spaceBottom2}`}
            role="status"
          >
            Showing {rows.length} of {result.rows.length} criteria
          </p>

          <div className={styles.tableScroll} tabIndex={0} role="region" aria-label="VPAT criteria">
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Criterion</th>
                  <th scope="col">Name</th>
                  <th scope="col">Conformance level</th>
                  <th scope="col">Remarks and explanations</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.sc}>
                    <td className={styles.num}>
                      {row.sc}
                      <br />
                      <span className={styles.hint}>Level {row.level}</span>
                    </td>
                    <td>{row.name}</td>
                    <td>
                      <span className={styles.chip} data-tone={TONE[row.conformance]}>
                        {row.conformance}
                      </span>
                    </td>
                    <td>{row.remarks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className={`${styles.warnNote} ${styles.spaceTop3}`}>
            {result.footerNote}
          </p>

          {/* Guardrail 5, in the place it matters most: this document is sent to
              someone who will make a purchasing decision from it. */}
          <section className={styles.caveat} aria-label="Status of this draft">
            <p className={styles.caveatTitle}>Every row still needs a human.</p>
            <p className={styles.caveatBody}>{result.disclaimer}</p>
          </section>
        </section>
      ) : null}
    </>
  );
}

function slug(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "draft"
  );
}

/** Excel treats a leading `=`, `+`, `-` or `@` as a formula, so cells are prefixed. */
function csvCell(value: string): string {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

function toCsv(vpat: Vpat): string {
  const header = ["Criterion", "Name", "Level", "Conformance level", "Remarks and explanations"];
  const lines = [header.map(csvCell).join(",")];
  for (const row of vpat.rows) {
    lines.push(
      [row.sc, row.name, row.level, row.conformance, row.remarks].map(csvCell).join(","),
    );
  }
  lines.push("");
  lines.push(csvCell(vpat.footerNote));
  lines.push(csvCell(vpat.disclaimer));
  // BOM so Excel opens it as UTF-8 rather than the system codepage.
  return `﻿${lines.join("\r\n")}`;
}
