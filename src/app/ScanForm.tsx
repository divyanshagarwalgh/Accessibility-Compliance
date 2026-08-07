"use client";

import { useState } from "react";
import { apiPath, appPath } from "@/lib/api-path";
import styles from "@/styles/modules.module.css";

/**
 * Starts a scan from the app surface.
 *
 * The scan entry that carries the SEO is the native Webflow page at
 * /tools/wcag-compliance-checker (surface A). This is the same action without
 * the marketing, so the app is usable on its own and so every module that takes
 * a scan id has somewhere to get one.
 *
 * The enqueue returns in under two seconds and the report route owns the
 * progress display, so this hands off as soon as it has an id.
 */
export function ScanForm() {
  const [url, setUrl] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    setMessage("");

    try {
      const res = await fetch(apiPath("scan"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url, source: "app" }),
      });
      const data = (await res.json()) as {
        scanId?: string;
        error?: string;
        message?: string;
      };

      if (!res.ok || !data.scanId) {
        setState("error");
        setMessage(
          data.message ??
            (data.error === "rate_limited"
              ? "That is ten scans in an hour from this address. Try again shortly."
              : "The scan could not be started. Try again."),
        );
        return;
      }

      window.location.assign(appPath(`report/${data.scanId}`));
    } catch {
      setState("error");
      setMessage("Could not reach the server. Try again.");
    }
  }

  return (
    <form onSubmit={submit} className={styles.form}>
      <div className={styles.field}>
        {/* Rule 3 (3.3.2): a real label, never a placeholder standing in for one. */}
        <label className={styles.label} htmlFor="scan-url">
          Page to scan
        </label>
        <input
          id="scan-url"
          className={styles.input}
          type="url"
          required
          inputMode="url"
          autoComplete="url"
          placeholder="https://example.com/pricing"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          aria-describedby={state === "error" ? "scan-error" : "scan-hint"}
          aria-invalid={state === "error"}
        />
      </div>

      <div className={styles.btnRow}>
        <button
          className={styles.btn}
          type="submit"
          disabled={state === "sending"}
          aria-busy={state === "sending"}
        >
          {state === "sending" ? "Starting…" : "Run a scan"}
        </button>
      </div>

      {state === "error" ? (
        <p className={styles.error} id="scan-error" role="alert">
          {message}
        </p>
      ) : (
        <p className={styles.note} id="scan-hint">
          One page per scan, ten scans an hour. The score and the rule names are
          public; the Webflow fix steps are behind one email.
        </p>
      )}
    </form>
  );
}
