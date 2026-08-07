"use client";

import { useId, useState } from "react";
import { apiPath, appPath } from "@/lib/api-path";
import styles from "@/styles/modules.module.css";

/**
 * Creates a monitor, or opens an existing one.
 *
 * There is deliberately no "my monitors" list: nothing here is behind an
 * account, so the monitor id is the capability. Anyone with the id can read the
 * dashboard, which is why the id is the only way in and why the URL is worth
 * keeping.
 */
export function MonitorSetup() {
  const uid = useId();

  const [siteUrl, setSiteUrl] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [schedule, setSchedule] = useState<"daily" | "weekly">("weekly");
  const [state, setState] = useState<"idle" | "working" | "error">("idle");
  const [error, setError] = useState("");

  const [lookupId, setLookupId] = useState("");

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setState("working");
    setError("");

    try {
      const res = await fetch(apiPath("monitors"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ siteUrl, ownerEmail, schedule, recipients: [ownerEmail] }),
      });
      const data = (await res.json()) as {
        monitorId?: string;
        error?: string;
        message?: string;
      };

      if (!res.ok || !data.monitorId) {
        setState("error");
        setError(data.message ?? "The monitor could not be created.");
        return;
      }

      window.location.assign(appPath(`monitoring/${data.monitorId}`));
    } catch {
      setState("error");
      setError("Could not reach the server. Try again.");
    }
  }

  function open(e: React.FormEvent) {
    e.preventDefault();
    const id = lookupId.trim();
    if (id) window.location.assign(appPath(`monitoring/${encodeURIComponent(id)}`));
  }

  return (
    <div className={styles.split}>
      <form className={`${styles.card} ${styles.form}`} onSubmit={create}>
        <h2 className={styles.h3}>Watch a page</h2>

        <div className={styles.field}>
          <label className={styles.label} htmlFor={`${uid}-url`}>
            Page to monitor
          </label>
          <input
            id={`${uid}-url`}
            className={styles.input}
            type="url"
            required
            inputMode="url"
            placeholder="https://example.com/pricing"
            value={siteUrl}
            onChange={(e) => setSiteUrl(e.target.value)}
          />
          <span className={styles.hint}>
            The first scan runs immediately and becomes the baseline. It never
            alerts — there is nothing yet to compare it against.
          </span>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor={`${uid}-email`}>
            Alert to
          </label>
          <input
            id={`${uid}-email`}
            className={styles.input}
            type="email"
            required
            autoComplete="email"
            value={ownerEmail}
            onChange={(e) => setOwnerEmail(e.target.value)}
          />
          <span className={styles.hint}>
            You will only hear from us when something that used to pass stops
            passing. A monitor that emails every week is a monitor people mute.
          </span>
        </div>

        <fieldset className={styles.fieldset}>
          <legend className={styles.label}>Frequency</legend>
          <div className={`${styles.segmented} ${styles.spaceTop2}`}>
            <button
              type="button"
              className={styles.segment}
              aria-pressed={schedule === "weekly"}
              onClick={() => setSchedule("weekly")}
            >
              Weekly
            </button>
            <button
              type="button"
              className={styles.segment}
              aria-pressed={schedule === "daily"}
              onClick={() => setSchedule("daily")}
            >
              Daily
            </button>
          </div>
        </fieldset>

        <div className={styles.btnRow}>
          <button
            className={styles.btn}
            type="submit"
            disabled={state === "working"}
            aria-busy={state === "working"}
          >
            {state === "working" ? "Starting…" : "Start monitoring"}
          </button>
        </div>

        {state === "error" ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
      </form>

      <form className={`${styles.card} ${styles.form}`} onSubmit={open}>
        <h2 className={styles.h3}>Open an existing monitor</h2>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={`${uid}-lookup`}>
            Monitor ID
          </label>
          <input
            id={`${uid}-lookup`}
            className={styles.input}
            value={lookupId}
            onChange={(e) => setLookupId(e.target.value)}
          />
          <span className={styles.hint}>
            The id is in the dashboard URL. Keep it — it is the only way back in.
          </span>
        </div>
        <div className={styles.btnRow}>
          <button className={styles.btnGhost} type="submit">
            Open dashboard
          </button>
        </div>
      </form>
    </div>
  );
}
