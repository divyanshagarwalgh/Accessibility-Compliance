import Link from "next/link";
import { MonitorSetup } from "./MonitorSetup";
import styles from "@/styles/modules.module.css";

export const metadata = {
  title: "Continuous monitoring",
  robots: { index: false, follow: false },
};

/**
 * Monitoring entry point. Spec: docs/design-inventory.md §4.12.
 *
 * The clock lives in the scan worker because Webflow Cloud provisions D1, KV and
 * R2 but exposes no cron trigger; the worker is a doorbell and this app decides
 * what is due. See docs/STATUS.md.
 */
export default function MonitoringPage() {
  return (
    <div className={styles.wrap}>
      <header className={styles.head}>
        <p className={styles.breadcrumb}>
          <Link href="/">Accessibility workspace</Link> · Monitoring
        </p>
        <h1 className={styles.h1}>Continuous monitoring</h1>
        <p className={styles.lede}>
          Scheduled re-scans with an alert the moment a publish breaks something that
          used to pass. The report tells you what is wrong today; this tells you what
          your last publish broke.
        </p>
      </header>

      <MonitorSetup />

      {/* Guardrail 5. This surface matters most for the caveat because it runs
          unattended — nobody re-reads a limitation they were told once. */}
      <section className={styles.caveat} aria-label="What monitoring covers">
        <p className={styles.caveatTitle}>This catches regressions. It does not certify compliance.</p>
        <p className={styles.caveatBody}>
          Monitoring watches the WCAG criteria a machine can evaluate — about a fifth of
          WCAG 2.2 Level A and AA. A run that reports nothing means nothing was detected
          in that fifth, not that the page is conformant. Reading order, meaningful alt
          text and keyboard task completion still need a person.
        </p>
      </section>
    </div>
  );
}
