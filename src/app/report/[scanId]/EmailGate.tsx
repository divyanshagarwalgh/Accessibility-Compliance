"use client";

import { useState } from "react";
import styles from "./report.module.css";

/**
 * The email gate.
 *
 * Gates the DETAIL, never the answer. The score, the severity breakdown and the
 * rule names are already visible above this — a result trapped entirely behind a
 * form generates no search surface and no links, and the roadmap is explicit that
 * the contrast checker stays ungated regardless.
 */
export function EmailGate({
  scanId,
  issueCount,
  ruleCount,
  criticalCount,
}: {
  scanId: string;
  issueCount: number;
  ruleCount: number;
  criticalCount: number;
}) {
  const [email, setEmail] = useState("");
  const [wantsRescan, setWantsRescan] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    setMessage("");
    try {
      const res = await fetch("../../api/lead", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, scanId, source: "scanner", wantsRescan }),
      });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) {
        setState("error");
        setMessage(data.message ?? "That did not work. Try again.");
        return;
      }
      window.location.reload();
    } catch {
      setState("error");
      setMessage("Could not reach the server. Try again.");
    }
  }

  return (
    <section className={styles.gate} aria-labelledby="gate-h">
      <h2 id="gate-h" className={styles.h2}>
        See the fix for each issue
      </h2>
      <p className={styles.lede}>
        You can see <strong>what</strong> is wrong above. The Webflow Designer steps for{" "}
        {issueCount} {issueCount === 1 ? "issue" : "issues"} across {ruleCount}{" "}
        {ruleCount === 1 ? "rule" : "rules"}
        {criticalCount > 0 ? `, ${criticalCount} of them critical,` : ""} are behind one
        field.
      </p>

      <form onSubmit={submit} className={styles.gateForm}>
        <div className={styles.field}>
          {/* Rule 3 (3.3.2): a real label, not a placeholder. */}
          <label className={styles.label} htmlFor="gate-email">
            Work email
          </label>
          <input
            id="gate-email"
            className={styles.input}
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-describedby={state === "error" ? "gate-error" : "gate-hint"}
            aria-invalid={state === "error"}
          />
        </div>

        <div className={styles.checkRow}>
          <input
            id="gate-rescan"
            type="checkbox"
            checked={wantsRescan}
            onChange={(e) => setWantsRescan(e.target.checked)}
          />
          <label htmlFor="gate-rescan">
            Also send me a monthly re-scan of this page. Unsubscribe in one click.
          </label>
        </div>

        <button className={styles.submit} type="submit" disabled={state === "sending"}>
          {state === "sending" ? "Opening…" : "Open the full report"}
        </button>

        {state === "error" ? (
          <p className={styles.error} id="gate-error" role="alert">
            {message}
          </p>
        ) : (
          <p className={styles.note} id="gate-hint">
            One email, no drip sequence, no reselling your address. The contrast checker
            stays free and ungated either way.
          </p>
        )}
      </form>
    </section>
  );
}
