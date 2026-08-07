import Link from "next/link";
import { StatementBuilder } from "./StatementBuilder";
import styles from "@/styles/modules.module.css";

export const metadata = {
  title: "Accessibility statement generator",
  robots: { index: false, follow: false },
};

/**
 * Statement generator. Spec: docs/design-inventory.md §4.9.
 *
 * Ungated on purpose — the roadmap's rule is to gate the export, never the
 * answer. A statement trapped behind a form helps nobody comply and generates
 * no search surface.
 */
export default async function StatementPage({
  searchParams,
}: {
  searchParams: Promise<{ scanId?: string }>;
}) {
  const { scanId } = await searchParams;

  return (
    <div className={styles.wrap}>
      <header className={styles.head}>
        <p className={styles.breadcrumb}>
          <Link href="/">Accessibility workspace</Link> · Statement
        </p>
        <h1 className={styles.h1}>Accessibility statement</h1>
        <p className={styles.lede}>
          The EAA requires a published statement with a working feedback channel. This
          one is populated from your latest scan, so the known issues section stays
          honest.
        </p>
      </header>

      <StatementBuilder initialScanId={scanId ?? ""} />

      {/* Guardrail 5. A statement is a legal claim the organisation is making about
          its own site, so the limits of the evidence behind it are stated here. */}
      <section className={styles.caveat} aria-label="What this statement is based on">
        <p className={styles.caveatTitle}>
          A statement is your claim, not our certificate.
        </p>
        <p className={styles.caveatBody}>
          Automated testing reaches roughly a fifth of the WCAG 2.2 Level A and AA
          success criteria. A clean scan means no failures were found, not that none
          exist — which is why this generator will not write &ldquo;fully
          conformant&rdquo; unless you confirm a manual review was done. Have the
          wording reviewed by counsel before you publish it.
        </p>
      </section>
    </div>
  );
}
