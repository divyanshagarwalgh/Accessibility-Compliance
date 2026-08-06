import Link from "next/link";
import styles from "./page.module.css";

export const metadata = { title: "Foundation check" };

/**
 * Phase 1 hello-world.
 *
 * Its only job is to prove the app renders at the Webflow Cloud mount path, inherits
 * the Lumos token bridge, and that the GitHub → Webflow Cloud build fires on push.
 * Replaced by real surfaces in Phase 4.
 */
export default function Page() {
  return (
    <div className={styles.wrap}>
      <section className={styles.card} aria-labelledby="status-heading">
        <p className={styles.eyebrow}>Webyansh · Accessibility &amp; Compliance Suite</p>

        <h1 id="status-heading" className={styles.h1}>
          Foundation is live.
        </h1>

        <p className={styles.lede}>
          This page exists to prove three things: the app is mounted at{" "}
          <code className={styles.code}>/app</code>, it inherits the site&rsquo;s Lumos
          design tokens, and a push to GitHub rebuilds it. Nothing here ships to users.
        </p>

        <h2 className={styles.h2}>Checks</h2>
        <ul className={styles.list}>
          <li>
            <strong>Mount path</strong> — you are reading this at{" "}
            <code className={styles.code}>/app</code>, so{" "}
            <code className={styles.code}>basePath</code> and{" "}
            <code className={styles.code}>assetPrefix</code> resolve correctly.
          </li>
          <li>
            <strong>Design tokens</strong> — the heading above scales fluidly with the
            viewport. That spacing comes from the live site&rsquo;s{" "}
            <code className={styles.code}>clamp()</code> scale, replicated in{" "}
            <code className={styles.code}>src/styles/lumos-tokens.css</code> because
            DevLink cannot export site-wide custom code.
          </li>
          <li>
            {/* next/link applies basePath automatically, so the mount path is
                configured in exactly one place. */}
            <strong>Storage bindings</strong> — D1, KV and R2 reachability is reported by{" "}
            <Link href="/api/health">the health endpoint</Link>.
          </li>
        </ul>

        <h2 className={styles.h2}>Severity scale</h2>
        <p className={styles.note}>
          The only new tokens this build introduces. Every pairing below clears 4.5:1.
        </p>
        <ul className={styles.chips}>
          {(
            [
              ["Critical", "critical"],
              ["Serious", "serious"],
              ["Moderate", "moderate"],
              ["Minor", "minor"],
              ["Pass", "pass"],
            ] as const
          ).map(([label, tone]) => (
            <li key={tone} className={styles.chip} data-tone={tone}>
              {label}
            </li>
          ))}
        </ul>

        <p className={styles.caveat}>
          Automated scanning catches roughly a third of WCAG success criteria. No scanner
          can confirm that a page is compliant, and this tool will never claim otherwise.
        </p>
      </section>
    </div>
  );
}
