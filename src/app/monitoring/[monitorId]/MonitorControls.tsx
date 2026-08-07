"use client";

import { useId, useState } from "react";
import { apiPath, appPath } from "@/lib/api-path";
import styles from "@/styles/modules.module.css";

/**
 * Pause, resume and delete.
 *
 * Deleting asks for the owner email rather than a "are you sure" dialog. A
 * confirm dialog only proves you clicked twice; retyping the address the monitor
 * was created with proves you are the person who created it — which matters
 * because the monitor id in the URL is the only other credential involved.
 */
export function MonitorControls({
  monitorId,
  isActive,
}: {
  monitorId: string;
  isActive: boolean;
}) {
  const uid = useId();
  const [active, setActive] = useState(isActive);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"note" | "error">("note");
  const [confirming, setConfirming] = useState(false);
  const [ownerEmail, setOwnerEmail] = useState("");

  async function toggle() {
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch(apiPath("monitors"), {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ monitorId, isActive: !active }),
      });
      const data = (await res.json()) as { message?: string; isActive?: boolean };
      if (!res.ok) {
        setTone("error");
        setMessage(data.message ?? "That did not work.");
        return;
      }
      setActive(Boolean(data.isActive));
      setTone("note");
      setMessage(
        data.isActive
          ? "Resumed. The next run is scheduled."
          : "Paused. Nothing will run until you resume it.",
      );
    } catch {
      setTone("error");
      setMessage("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const url =
        apiPath("monitors") +
        `?id=${encodeURIComponent(monitorId)}&ownerEmail=${encodeURIComponent(ownerEmail)}`;
      const res = await fetch(url, { method: "DELETE" });
      const data = (await res.json()) as { message?: string };
      if (!res.ok) {
        setTone("error");
        setMessage(data.message ?? "That did not work.");
        return;
      }
      window.location.assign(appPath("monitoring"));
    } catch {
      setTone("error");
      setMessage("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.stackTight}>
      <div className={styles.btnRow}>
        <button
          type="button"
          className={styles.btnGhost}
          onClick={toggle}
          disabled={busy}
          aria-busy={busy}
        >
          {active ? "Pause monitoring" : "Resume monitoring"}
        </button>
        <button
          type="button"
          className={styles.btnGhost}
          onClick={() => setConfirming((c) => !c)}
          aria-expanded={confirming}
        >
          Delete
        </button>
      </div>

      {confirming ? (
        <form className={styles.form} onSubmit={remove}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor={`${uid}-owner`}>
              Confirm the owner email to delete
            </label>
            <input
              id={`${uid}-owner`}
              className={styles.input}
              type="email"
              required
              value={ownerEmail}
              onChange={(e) => setOwnerEmail(e.target.value)}
              aria-describedby={`${uid}-owner-hint`}
            />
            <span className={styles.hint} id={`${uid}-owner-hint`}>
              This removes the monitor and its whole run history. It cannot be undone.
            </span>
          </div>
          <div className={styles.btnRow}>
            <button className={styles.btn} type="submit" disabled={busy} aria-busy={busy}>
              Delete permanently
            </button>
          </div>
        </form>
      ) : null}

      {message ? (
        <p
          className={tone === "error" ? styles.error : styles.note}
          role={tone === "error" ? "alert" : "status"}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
