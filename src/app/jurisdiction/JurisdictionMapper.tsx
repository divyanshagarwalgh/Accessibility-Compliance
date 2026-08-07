"use client";

import { useId, useState } from "react";
import { apiPath } from "@/lib/api-path";
import type { BusinessTrait, JurisdictionResult, Market } from "@/lib/jurisdiction";
import styles from "@/styles/modules.module.css";

const MARKETS: Array<{ id: Market; label: string }> = [
  { id: "us", label: "United States" },
  { id: "eu", label: "European Union" },
  { id: "uk", label: "United Kingdom" },
  { id: "ca-on", label: "Canada (Ontario)" },
  { id: "au", label: "Australia" },
];

const TRAITS: Array<{ id: BusinessTrait; label: string }> = [
  { id: "private-business", label: "Private business" },
  { id: "public-sector", label: "Public sector body" },
  { id: "sells-to-us-federal", label: "Sells to US federal government" },
  { id: "banking-ecommerce-transport", label: "Banking, e-commerce or transport" },
];

const TONE: Record<"red" | "amber" | "grey", string> = {
  red: "fail",
  amber: "warn",
  grey: "neutral",
};

/**
 * The jurisdiction mapper.
 *
 * The mapping is pure logic with no database and no network cost, so the result
 * recomputes on every change rather than sitting behind a submit button — the
 * point of the screen is watching the obligations appear as you tick a market.
 *
 * Regimes that do NOT apply are still listed, greyed. A business that sells only
 * inside the EU benefits from seeing that ADA Title III was considered and
 * excluded; a table containing only what binds you reads as a table that might
 * have missed something.
 */
export function JurisdictionMapper() {
  const uid = useId();

  const [markets, setMarkets] = useState<Set<Market>>(new Set());
  const [traits, setTraits] = useState<Set<BusinessTrait>>(new Set(["private-business"]));
  const [result, setResult] = useState<JurisdictionResult | null>(null);
  const [error, setError] = useState("");

  async function recompute(nextMarkets: Set<Market>, nextTraits: Set<BusinessTrait>) {
    setError("");
    try {
      const res = await fetch(apiPath("jurisdiction"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          markets: [...nextMarkets],
          traits: [...nextTraits],
        }),
      });
      if (!res.ok) {
        setError("The mapping could not be produced. Try again.");
        return;
      }
      setResult((await res.json()) as JurisdictionResult);
    } catch {
      setError("Could not reach the server. Try again.");
    }
  }

  function toggleMarket(id: Market, on: boolean) {
    const next = new Set(markets);
    if (on) next.add(id);
    else next.delete(id);
    setMarkets(next);
    void recompute(next, traits);
  }

  function toggleTrait(id: BusinessTrait, on: boolean) {
    const next = new Set(traits);
    if (on) next.add(id);
    else next.delete(id);
    setTraits(next);
    void recompute(markets, next);
  }

  return (
    <div className={styles.split}>
      <div className={styles.sticky}>
        <div className={`${styles.card} ${styles.form}`}>
          <fieldset className={styles.fieldset}>
            <legend className={styles.h3}>Markets served</legend>
            <div className={styles.stackTight}>
              {MARKETS.map((m) => (
                <div key={m.id} className={styles.checkRow}>
                  <input
                    id={`${uid}-m-${m.id}`}
                    type="checkbox"
                    checked={markets.has(m.id)}
                    onChange={(e) => toggleMarket(m.id, e.target.checked)}
                  />
                  <label htmlFor={`${uid}-m-${m.id}`}>{m.label}</label>
                </div>
              ))}
            </div>
          </fieldset>

          <fieldset className={styles.fieldset}>
            <legend className={styles.h3}>About the business</legend>
            <div className={styles.stackTight}>
              {TRAITS.map((t) => (
                <div key={t.id} className={styles.checkRow}>
                  <input
                    id={`${uid}-t-${t.id}`}
                    type="checkbox"
                    checked={traits.has(t.id)}
                    onChange={(e) => toggleTrait(t.id, e.target.checked)}
                  />
                  <label htmlFor={`${uid}-t-${t.id}`}>{t.label}</label>
                </div>
              ))}
            </div>
          </fieldset>

          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </div>

      <div className={styles.stack}>
        {result ? (
          <>
            <ul className={styles.statGrid}>
              <li className={styles.stat}>
                <span
                  className={styles.statValue}
                  data-tone={result.applicableCount > 0 ? "fail" : "neutral"}
                >
                  {result.applicableCount}
                </span>
                <span className={styles.statLabel}>
                  {result.applicableCount === 1 ? "regime binds you today" : "regimes bind you today"}
                </span>
              </li>
              <li className={styles.stat}>
                <span className={styles.statValue} data-tone="neutral">
                  {result.strictestBaseline}
                </span>
                <span className={styles.statLabel}>the strictest common baseline</span>
              </li>
              <li className={styles.stat}>
                <span
                  className={styles.statValue}
                  data-tone={result.statementMandatory ? "warn" : "neutral"}
                >
                  {result.statementMandatory ? "Yes" : "No"}
                </span>
                <span className={styles.statLabel}>a public statement is mandatory</span>
              </li>
            </ul>

            <div
              className={styles.tableScroll}
              tabIndex={0}
              role="region"
              aria-label="Applicable regimes"
            >
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Regime</th>
                    <th scope="col">What it means for you</th>
                    <th scope="col">Standard</th>
                    <th scope="col">Deadline</th>
                  </tr>
                </thead>
                <tbody>
                  {result.regimes.map((regime) => (
                    <tr key={regime.id}>
                      <td>
                        <strong>{regime.law}</strong>
                        <br />
                        <span className={styles.hint}>{regime.region}</span>
                        <br />
                        <span className={styles.chip} data-tone={TONE[regime.tone]}>
                          {regime.status}
                        </span>
                      </td>
                      <td>{regime.note}</td>
                      <td>{regime.standard}</td>
                      <td className={styles.num}>{regime.deadline}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* The case note is the whole argument against treating a score as a
                defence, so it gets the dark slab rather than a footnote. */}
            <section className={styles.caveat} aria-label="Case law">
              <p className={styles.caveatTitle}>Partial compliance is not a legal position</p>
              <p className={styles.caveatBody}>{result.caseNote}</p>
            </section>

            <p className={styles.warnNote}>{result.disclaimer}</p>
          </>
        ) : (
          <div className={styles.empty}>
            <p className={styles.lede}>
              Tick the markets you sell into. The regimes that bind you appear here,
              along with the ones that do not and why.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
