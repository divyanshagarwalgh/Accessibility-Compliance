import Link from "next/link";
import { AltTextAuditor } from "./AltTextAuditor";
import styles from "@/styles/modules.module.css";

export const metadata = {
  title: "Alt text auditor",
  robots: { index: false, follow: false },
};

/**
 * Alt-text auditor. Spec: docs/design-inventory.md §4.11.
 *
 * The one screen where a confident wrong answer is worse than no answer: a
 * screen reader user has no way to tell that a drafted description is wrong, and
 * they will act on it. Hence "review every line" in the standfirst rather than
 * buried in a footnote, and no bulk apply that skips the reading.
 */
export default async function AltTextPage({
  searchParams,
}: {
  searchParams: Promise<{ scanId?: string }>;
}) {
  const { scanId } = await searchParams;

  return (
    <div className={styles.wrap}>
      <header className={styles.head}>
        <p className={styles.breadcrumb}>
          <Link href="/">Accessibility workspace</Link> · Alt text
        </p>
        <h1 className={styles.h1}>Alt text auditor</h1>
        <p className={styles.lede}>
          Missing and unhelpful alt text, with a drafted replacement for each. Review
          every line before applying. A wrong description is worse than none.
        </p>
      </header>

      <AltTextAuditor initialScanId={scanId ?? ""} />
    </div>
  );
}
