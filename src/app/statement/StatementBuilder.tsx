"use client";

import { useId, useState } from "react";
import { apiPath } from "@/lib/api-path";
import type { Statement } from "@/documents/statement";
import { DownloadActions } from "@/app/components/DownloadActions";
import styles from "@/styles/modules.module.css";

type Result = Statement & { documentId: string; scanId: string | null };

/**
 * The statement generator screen.
 *
 * Two things here are load-bearing rather than decorative.
 *
 * The first is that `warnings` renders above the document and cannot be
 * dismissed. The generator refuses to emit "fully conformant" off the back of a
 * scan, and when a caller asks for it anyway the document is downgraded — the
 * warning is the only place that says so. Hiding it would turn an honest
 * document into a confusing one.
 *
 * The second is that the rendered preview is built from `sections`, not from
 * `html`. The generator escapes everything it interpolates, so injecting the
 * HTML string would be safe today; building from the structure means it stays
 * safe if that ever changes.
 */
export function StatementBuilder({ initialScanId }: { initialScanId: string }) {
  const uid = useId();
  const today = new Date().toISOString().slice(0, 10);

  const [organisation, setOrganisation] = useState("");
  const [domain, setDomain] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [reviewedOn, setReviewedOn] = useState(today);
  const [wcagVersion, setWcagVersion] = useState<"2.1" | "2.2">("2.2");
  const [wcagLevel, setWcagLevel] = useState<"A" | "AA">("AA");
  const [manualReviewCompleted, setManualReviewCompleted] = useState(false);
  const [claimedStatus, setClaimedStatus] = useState<"partial" | "full" | "none">("partial");
  const [scanId, setScanId] = useState(initialScanId);

  const [mode, setMode] = useState<"rendered" | "html">("rendered");
  const [state, setState] = useState<"idle" | "working" | "error">("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [copied, setCopied] = useState(false);

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    setState("working");
    setError("");

    try {
      const res = await fetch(apiPath("documents/statement"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          organisation,
          domain: domain.trim() || undefined,
          contactEmail,
          // A date input gives a local calendar day; the generator formats in UTC,
          // so midday avoids the document dating itself a day early west of GMT.
          reviewedAt: new Date(`${reviewedOn}T12:00:00Z`).getTime(),
          wcagVersion,
          wcagLevel,
          manualReviewCompleted,
          claimedStatus,
          scanId: scanId.trim() || undefined,
        }),
      });
      const data = (await res.json()) as Result & { error?: string; message?: string };

      if (!res.ok) {
        setState("error");
        setError(data.message ?? "The statement could not be generated.");
        return;
      }

      setResult(data);
      setState("idle");
    } catch {
      setState("error");
      setError("Could not reach the server. Try again.");
    }
  }

  async function copyHtml() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.html);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className={styles.split}>
      <div className={styles.sticky}>
        <form className={`${styles.card} ${styles.form}`} onSubmit={generate}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor={`${uid}-org`}>
              Organisation
            </label>
            <input
              id={`${uid}-org`}
              className={styles.input}
              required
              autoComplete="organization"
              value={organisation}
              onChange={(e) => setOrganisation(e.target.value)}
              aria-describedby={`${uid}-org-hint`}
            />
            <span className={styles.hint} id={`${uid}-org-hint`}>
              Appears in the first line of the statement.
            </span>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor={`${uid}-domain`}>
              Domain
            </label>
            <input
              id={`${uid}-domain`}
              className={styles.input}
              placeholder="example.com"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              aria-describedby={`${uid}-domain-hint`}
            />
            <span className={styles.hint} id={`${uid}-domain-hint`}>
              The site the statement covers. Filled from the scan if you supply one.
            </span>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor={`${uid}-email`}>
              Contact for accessibility issues
            </label>
            <input
              id={`${uid}-email`}
              className={styles.input}
              type="email"
              required
              autoComplete="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              aria-describedby={`${uid}-email-hint`}
            />
            <span className={styles.hint} id={`${uid}-email-hint`}>
              The EAA requires a working feedback channel. This address has to be
              monitored by a person.
            </span>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor={`${uid}-version`}>
              Conformance target
            </label>
            <div className={styles.selectPair}>
              <select
                id={`${uid}-version`}
                className={styles.select}
                value={wcagVersion}
                onChange={(e) => setWcagVersion(e.target.value as "2.1" | "2.2")}
              >
                <option value="2.2">WCAG 2.2</option>
                <option value="2.1">WCAG 2.1</option>
              </select>
              <label className={styles.srOnly} htmlFor={`${uid}-level`}>
                Conformance level
              </label>
              <select
                id={`${uid}-level`}
                className={styles.select}
                value={wcagLevel}
                onChange={(e) => setWcagLevel(e.target.value as "A" | "AA")}
              >
                <option value="AA">Level AA</option>
                <option value="A">Level A</option>
              </select>
            </div>
            <span className={styles.hint}>
              AA is the level every regime actually requires.
            </span>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor={`${uid}-status`}>
              Conformance status you are claiming
            </label>
            <select
              id={`${uid}-status`}
              className={styles.select}
              value={claimedStatus}
              onChange={(e) =>
                setClaimedStatus(e.target.value as "partial" | "full" | "none")
              }
              aria-describedby={`${uid}-status-hint`}
            >
              <option value="partial">Partially conformant</option>
              <option value="full">Fully conformant</option>
              <option value="none">Not conformant</option>
            </select>
            <span className={styles.hint} id={`${uid}-status-hint`}>
              Checked against the evidence. A claim the scan does not support is
              downgraded and you will be told why.
            </span>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor={`${uid}-scan`}>
              Scan ID (optional)
            </label>
            <input
              id={`${uid}-scan`}
              className={styles.input}
              value={scanId}
              onChange={(e) => setScanId(e.target.value)}
              aria-describedby={`${uid}-scan-hint`}
            />
            <span className={styles.hint} id={`${uid}-scan-hint`}>
              With a scan, the known limitations section writes itself and stays
              honest. Without one, you still get the statement.
            </span>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor={`${uid}-reviewed`}>
              Last reviewed
            </label>
            <input
              id={`${uid}-reviewed`}
              className={styles.input}
              type="date"
              value={reviewedOn}
              onChange={(e) => setReviewedOn(e.target.value)}
              aria-describedby={`${uid}-reviewed-hint`}
            />
            <span className={styles.hint} id={`${uid}-reviewed-hint`}>
              Review at least once a year.
            </span>
          </div>

          <div className={styles.checkRow}>
            <input
              id={`${uid}-manual`}
              type="checkbox"
              checked={manualReviewCompleted}
              onChange={(e) => setManualReviewCompleted(e.target.checked)}
            />
            <label htmlFor={`${uid}-manual`}>
              A manual review of the criteria automated testing cannot reach has been
              completed. Only tick this if it is true — it is the attestation that
              lets the statement claim full conformance.
            </label>
          </div>

          <div className={styles.btnRow}>
            <button
              className={styles.btn}
              type="submit"
              disabled={state === "working"}
              aria-busy={state === "working"}
            >
              {state === "working" ? "Generating…" : "Generate statement"}
            </button>
          </div>

          {state === "error" ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}
        </form>
      </div>

      <div className={styles.stack}>
        {result ? (
          <>
            {result.warnings.length > 0 ? (
              <div role="alert" className={styles.stackTight}>
                {result.warnings.map((w) => (
                  <p key={w} className={styles.warnNote}>
                    {w}
                  </p>
                ))}
              </div>
            ) : null}

            <div className={styles.btnRow}>
              <div className={styles.segmented} role="group" aria-label="Preview mode">
                <button
                  type="button"
                  className={styles.segment}
                  aria-pressed={mode === "rendered"}
                  onClick={() => setMode("rendered")}
                >
                  Rendered
                </button>
                <button
                  type="button"
                  className={styles.segment}
                  aria-pressed={mode === "html"}
                  onClick={() => setMode("html")}
                >
                  HTML
                </button>
              </div>

              <button type="button" className={styles.btnGhost} onClick={copyHtml}>
                {copied ? "Copied" : "Copy HTML"}
              </button>

              <DownloadActions
                documentId={result.documentId}
                docxLabel="Download .docx"
                files={[
                  {
                    label: "Download .html",
                    filename: `accessibility-statement-${slug(organisation)}.html`,
                    type: "text/html",
                    contents: () => result.html,
                  },
                  {
                    label: "Download .txt",
                    filename: `accessibility-statement-${slug(organisation)}.txt`,
                    type: "text/plain",
                    contents: () => result.text,
                  },
                ]}
              />
            </div>

            {mode === "rendered" ? (
              <article className={`${styles.preview} ${styles.document}`}>
                <h2>{result.title}</h2>
                <p className={styles.meta}>Last reviewed {result.reviewedOn}</p>
                {result.sections.map((section, i) => (
                  <section key={section.heading || `intro-${i}`}>
                    {section.heading ? <h3>{section.heading}</h3> : null}
                    {section.paragraphs.map((p) => (
                      <p key={p}>{p}</p>
                    ))}
                    {section.list && section.list.length > 0 ? (
                      <ul>
                        {section.list.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    ) : null}
                  </section>
                ))}
              </article>
            ) : (
              // tabIndex makes the scroll region reachable without a mouse (2.1.1).
              <pre className={styles.codeBlock} tabIndex={0} aria-label="Statement HTML">
                {result.html}
              </pre>
            )}
          </>
        ) : (
          <div className={styles.empty}>
            <p className={styles.lede}>
              Fill in the form and the statement appears here, ready to paste into a
              Webflow rich text block.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function slug(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "webyansh"
  );
}
