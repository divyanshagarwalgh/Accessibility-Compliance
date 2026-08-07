import Link from "next/link";
import { ScanForm } from "./ScanForm";
import styles from "@/styles/modules.module.css";

export const metadata = { title: "Accessibility workspace" };

/**
 * The app index.
 *
 * Surface A (/tools/*) carries the marketing and the SEO. This is the workspace
 * behind it: start a scan, then take the result into whichever module you need.
 * Copy for the module names and descriptions is quoted from
 * docs/design-inventory.md §4.1 rather than rewritten — it carries the honesty
 * constraints deliberately.
 */

const MODULES: Array<{ href: string; name: string; description: string; tag: string }> = [
  {
    href: "/statement",
    name: "Accessibility statement",
    description:
      "Generates the statement the EAA requires, populated from your own scan results.",
    tag: "Required by law in the EU",
  },
  {
    href: "/vpat",
    name: "VPAT and ACR draft",
    description:
      "Fills a Voluntary Product Accessibility Template so procurement stops blocking the deal.",
    tag: "Section 508 ready",
  },
  {
    href: "/alt-text",
    name: "Alt text auditor",
    description:
      "Finds missing and unhelpful alt text and drafts replacements for review.",
    tag: "Review every line",
  },
  {
    href: "/monitoring",
    name: "Continuous monitoring",
    description:
      "Scheduled re-scans with an alert the moment a publish breaks something that used to pass.",
    tag: "Retainer clients",
  },
];

export default function Page() {
  return (
    <div className={styles.wrap}>
      <header className={styles.head}>
        <p className={styles.eyebrow}>Accessibility &amp; compliance suite</p>
        <h1 className={styles.h1}>Scan a page, then take the result anywhere.</h1>
        <p className={styles.lede}>
          Scan any page against WCAG 2.1 and 2.2 AA, and get the exact fix for each
          issue in Webflow Designer. Every module below runs on the same scan, so the
          results carry across.
        </p>
      </header>

      <section className={styles.card} aria-labelledby="scan-h">
        <h2 className={styles.h3} id="scan-h">
          Run a scan
        </h2>
        <ScanForm />
      </section>

      <h2 className={styles.h2} id="modules-h">
        Modules
      </h2>
      <ul className={styles.moduleGrid} aria-labelledby="modules-h">
        {MODULES.map((m) => (
          <li key={m.href}>
            <Link className={styles.moduleCard} href={m.href}>
              <p className={styles.moduleName}>{m.name}</p>
              <p className={styles.note}>{m.description}</p>
              <span className={styles.chip} data-tone="neutral">
                {m.tag}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <p className={styles.note} style={{ marginTop: "var(--_spacing---space--3)" }}>
        The colour contrast checker needs no scan and no email — it lives on the main
        site at <code className={styles.mono}>/tools/color-contrast-checker</code>.
      </p>

      {/* Guardrail 5. Present on every surface, never softened. */}
      <section className={styles.caveat} aria-label="What automated scanning cannot do">
        <p className={styles.caveatTitle}>
          Automated scanning catches about a third of WCAG.
        </p>
        <p className={styles.caveatBody}>
          No scanner can confirm that a page is compliant, and any tool that says
          otherwise is selling you something. Roughly two thirds of the success criteria
          need a human to judge them: reading order, meaningful alt text, error recovery,
          and whether a keyboard user can actually finish the task. Every report here
          tells you which criteria were tested and which were not.
        </p>
      </section>
    </div>
  );
}
