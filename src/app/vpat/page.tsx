import Link from "next/link";
import { VpatBuilder } from "./VpatBuilder";
import styles from "@/styles/modules.module.css";

export const metadata = {
  title: "VPAT 2.5 draft",
  robots: { index: false, follow: false },
};

/**
 * VPAT / ACR generator. Spec: docs/design-inventory.md §4.10.
 *
 * The document a procurement team asks for. Filling one in by hand takes a day;
 * filling one in wrongly costs a contract — which is why every row this produces
 * is marked as needing a human, in the document as well as on this screen.
 */
export default async function VpatPage({
  searchParams,
}: {
  searchParams: Promise<{ scanId?: string }>;
}) {
  const { scanId } = await searchParams;

  return (
    <div className={styles.wrap}>
      <header className={styles.head}>
        <p className={styles.breadcrumb}>
          <Link href="/">Accessibility workspace</Link> · VPAT
        </p>
        <h1 className={styles.h1}>VPAT 2.5 draft</h1>
        <p className={styles.lede}>
          Pre-filled from the scan. Every row still needs a human to confirm it before
          you send this to a procurement team.
        </p>
      </header>

      <VpatBuilder initialScanId={scanId ?? ""} />
    </div>
  );
}
