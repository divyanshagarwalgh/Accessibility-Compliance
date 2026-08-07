"use client";

import { useEffect, useState } from "react";
import { apiPath } from "@/lib/api-path";
import styles from "./report.module.css";

type StepState = { label: string; state: "done" | "active" | "idle" };

/**
 * The five-step progress screen.
 *
 * Polls every 2 seconds. The status region is aria-live="polite" so a screen
 * reader user hears progress without being interrupted mid-sentence — the tool
 * flags missing live regions on other people's sites, so it ships one here.
 */
export function ScanProgress({ scanId, url }: { scanId: string; url: string }) {
  const [steps, setSteps] = useState<StepState[]>([]);
  const [pct, setPct] = useState(2);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      try {
        const res = await fetch(apiPath(`scan/${scanId}/status`), {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as {
          status: string;
          pct: number;
          steps: StepState[];
          errorDetail?: string | null;
        };
        if (cancelled) return;

        setSteps(data.steps);
        setPct(data.pct);

        if (data.status === "done") {
          window.location.reload();
          return;
        }
        if (data.status === "failed") {
          setFailed(data.errorDetail ?? "The scan failed.");
          return;
        }
      } catch {
        // A transient failure is not a failed scan. Keep polling.
      }
      if (!cancelled) timer = setTimeout(poll, 2000);
    }

    void poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [scanId]);

  if (failed) {
    return (
      <div className={styles.wrap}>
        <h1 className={styles.h1}>The scan stopped</h1>
        <p className={styles.lede}>{failed}</p>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <h1 className={styles.h1}>Scanning {url}</h1>
      <p className={styles.note}>Usually finishes in under 30 seconds</p>

      <div
        className={styles.bar}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Scan progress"
      >
        <div className={styles.barFill} style={{ width: `${pct}%` }} />
      </div>

      <ol className={styles.progressList} aria-live="polite">
        {steps.map((s) => (
          <li key={s.label} className={styles.progressStep} data-state={s.state}>
            <span aria-hidden="true">
              {s.state === "done" ? "✓" : s.state === "active" ? "→" : "·"}
            </span>
            {s.label}
            <span className={styles.srOnly}>
              {s.state === "done" ? " complete" : s.state === "active" ? " in progress" : " waiting"}
            </span>
          </li>
        ))}
      </ol>

      <p className={styles.caveatBody}>
        <strong>While you wait.</strong> Automated rules cover roughly a third of WCAG.
        The report will tell you exactly which criteria were tested and which still need
        a person.
      </p>
    </div>
  );
}
