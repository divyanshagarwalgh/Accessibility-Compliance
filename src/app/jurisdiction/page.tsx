import Link from "next/link";
import { JurisdictionMapper } from "./JurisdictionMapper";
import styles from "@/styles/modules.module.css";

export const metadata = {
  title: "Which laws apply to you",
  robots: { index: false, follow: false },
};

/**
 * Jurisdiction mapper. Spec: docs/design-inventory.md §4.8.
 *
 * The design puts this surface on the native `/tools/accessibility-laws` page,
 * which cannot be applied from here (see docs/STATUS.md). That left the one
 * module in the suite with no reachable surface at all, so it gets an app screen
 * like the other four. When the native page lands, this stays as the signed-in
 * version of the same thing.
 */
export default function JurisdictionPage() {
  return (
    <div className={styles.wrap}>
      <header className={styles.head}>
        <p className={styles.breadcrumb}>
          <Link href="/">Accessibility workspace</Link> · Jurisdiction
        </p>
        <h1 className={styles.h1}>Which laws apply to you</h1>
        <p className={styles.lede}>
          Tell us where you sell and who you sell to. This is a starting point for a
          conversation with counsel, not legal advice.
        </p>
      </header>

      <JurisdictionMapper />
    </div>
  );
}
