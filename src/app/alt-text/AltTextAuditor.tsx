"use client";

import { useId, useMemo, useState } from "react";
import { apiPath } from "@/lib/api-path";
import type { AltAudit, AltFinding, AltStatus, ImageRecord } from "@/documents/alt-text";
import type { AltDraft } from "@/lib/anthropic";
import styles from "@/styles/modules.module.css";

type Draft = AltDraft & { src?: string };

type Result = AltAudit & {
  drafted: boolean;
  drafts?: Draft[];
  draftError?: "not_configured" | "refused";
  draftMessage?: string;
};

const STATUS_LABEL: Record<AltStatus, string> = {
  missing: "Missing",
  unhelpful: "Unhelpful",
  decorative: "Should be empty",
  good: "Good",
};

const STATUS_TONE: Record<AltStatus, string> = {
  missing: "fail",
  unhelpful: "warn",
  decorative: "info",
  good: "pass",
};

/**
 * The alt-text auditor screen.
 *
 * Classification is deterministic and always runs; drafting needs a model and is
 * opt-in. The two halves are shown as two different kinds of claim, because they
 * are: "this alt attribute is missing" is a fact, and "this is what it should
 * say" is a suggestion that can be confidently wrong. Nothing here applies
 * anything automatically, and the draft column is editable so the text a person
 * copies is the text they approved.
 */
export function AltTextAuditor({ initialScanId }: { initialScanId: string }) {
  const uid = useId();

  const [source, setSource] = useState<"scan" | "manual">(initialScanId ? "scan" : "manual");
  const [scanId, setScanId] = useState(initialScanId);
  const [imageList, setImageList] = useState("");
  const [wantsDraft, setWantsDraft] = useState(false);

  const [state, setState] = useState<"idle" | "working" | "error">("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  /** Row edits, keyed by the finding's index. */
  const [edits, setEdits] = useState<Record<number, string>>({});

  async function run(e: React.FormEvent) {
    e.preventDefault();
    setState("working");
    setError("");
    setEdits({});

    const body =
      source === "scan"
        ? { scanId: scanId.trim(), draft: wantsDraft }
        : { images: parseImageList(imageList), draft: wantsDraft };

    if (source === "manual" && (body as { images: ImageRecord[] }).images.length === 0) {
      setState("error");
      setError("Add at least one image URL, one per line.");
      return;
    }

    try {
      const res = await fetch(apiPath("alt-text"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as Result & { error?: string; message?: string };

      if (!res.ok) {
        setState("error");
        setError(data.message ?? "The audit could not run.");
        return;
      }

      setResult(data);
      setState("idle");
    } catch {
      setState("error");
      setError("Could not reach the server. Try again.");
    }
  }

  /**
   * Lines the drafts up with the findings.
   *
   * The route drafts only for findings that need action, and `AltDraft.index` is
   * an index into that filtered list. Rebuilding the same filter here — rather
   * than matching on `src`, which is not unique when the same file appears
   * twice — keeps the two sides in step.
   */
  const draftFor = useMemo(() => {
    const map = new Map<number, Draft>();
    if (!result?.drafts) return map;

    const needsAction: number[] = [];
    result.findings.forEach((f, i) => {
      if (f.status !== "good") needsAction.push(i);
    });

    for (const draft of result.drafts) {
      const findingIndex = needsAction[draft.index];
      if (findingIndex !== undefined) map.set(findingIndex, draft);
    }
    return map;
  }, [result]);

  return (
    <>
      <form className={`${styles.card} ${styles.form}`} onSubmit={run}>
        <fieldset className={styles.fieldset}>
          <legend className={styles.label}>Where the images come from</legend>
          <div className={`${styles.segmented} ${styles.spaceTop2}`}>
            <button
              type="button"
              className={styles.segment}
              aria-pressed={source === "scan"}
              onClick={() => setSource("scan")}
            >
              From a scan
            </button>
            <button
              type="button"
              className={styles.segment}
              aria-pressed={source === "manual"}
              onClick={() => setSource("manual")}
            >
              Paste image URLs
            </button>
          </div>
        </fieldset>

        {source === "scan" ? (
          <div className={styles.field}>
            <label className={styles.label} htmlFor={`${uid}-scan`}>
              Scan ID
            </label>
            <input
              id={`${uid}-scan`}
              className={styles.input}
              required
              value={scanId}
              onChange={(e) => setScanId(e.target.value)}
              aria-describedby={`${uid}-scan-hint`}
            />
            <span className={styles.hint} id={`${uid}-scan-hint`}>
              Uses the images the scan already found failing. If the scan reported no
              alt-text failures there is nothing here to audit.
            </span>
          </div>
        ) : (
          <div className={styles.field}>
            <label className={styles.label} htmlFor={`${uid}-images`}>
              Image URLs
            </label>
            <textarea
              id={`${uid}-images`}
              className={styles.textarea}
              rows={6}
              value={imageList}
              onChange={(e) => setImageList(e.target.value)}
              aria-describedby={`${uid}-images-hint`}
              placeholder={"https://example.com/hero.avif\nhttps://example.com/logo.svg | image"}
            />
            <span className={styles.hint} id={`${uid}-images-hint`}>
              One per line. Add the current alt text after a vertical bar to have it
              judged as well — a line with no bar is treated as having no alt
              attribute at all.
            </span>
          </div>
        )}

        <div className={styles.checkRow}>
          <input
            id={`${uid}-draft`}
            type="checkbox"
            checked={wantsDraft}
            onChange={(e) => setWantsDraft(e.target.checked)}
          />
          <label htmlFor={`${uid}-draft`}>
            Draft replacement text as well. This is the one part of the tool that
            looks at the image with a model, so it needs the images to be reachable
            at a public URL.
          </label>
        </div>

        <div className={styles.btnRow}>
          <button
            className={styles.btn}
            type="submit"
            disabled={state === "working"}
            aria-busy={state === "working"}
          >
            {state === "working" ? "Auditing…" : "Audit alt text"}
          </button>
        </div>

        {state === "error" ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
      </form>

      {result ? (
        <section aria-labelledby="alt-result-h" className={styles.spaceTop5}>
          <h2 className={styles.h2} id="alt-result-h">
            {result.needsActionCount === 0
              ? "Nothing here needs changing"
              : `${result.needsActionCount} ${result.needsActionCount === 1 ? "image needs" : "images need"} attention`}
          </h2>

          <ul className={`${styles.statGrid} ${styles.spaceTop4}`}>
            <li className={styles.stat}>
              <span className={styles.statValue} data-tone="fail">
                {result.counts.missing}
              </span>
              <span className={styles.statLabel}>missing entirely</span>
            </li>
            <li className={styles.stat}>
              <span className={styles.statValue} data-tone="warn">
                {result.counts.unhelpful}
              </span>
              <span className={styles.statLabel}>unhelpful, such as &ldquo;image&rdquo;</span>
            </li>
            <li className={styles.stat}>
              <span className={styles.statValue} data-tone="info">
                {result.counts.decorative}
              </span>
              <span className={styles.statLabel}>decorative, should be empty</span>
            </li>
            <li className={styles.stat}>
              <span className={styles.statValue} data-tone="pass">
                {result.counts.good}
              </span>
              <span className={styles.statLabel}>already good</span>
            </li>
          </ul>

          {result.draftError === "not_configured" ? (
            <p className={`${styles.infoNote} ${styles.spaceBottom2}`}>
              Drafting is not available in this environment, so the table below is
              classification only. Knowing which images are wrong is most of the value
              and needs no model.
            </p>
          ) : null}

          {result.draftError === "refused" ? (
            <p className={`${styles.warnNote} ${styles.spaceBottom2}`}>
              {result.draftMessage ??
                "The model declined to draft text for this batch. The classification below still stands."}
            </p>
          ) : null}

          <div className={styles.tableScroll} tabIndex={0} role="region" aria-label="Alt text findings">
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Image</th>
                  <th scope="col">File and location</th>
                  <th scope="col">Status</th>
                  <th scope="col">{result.drafted ? "Drafted alt text" : "Why"}</th>
                </tr>
              </thead>
              <tbody>
                {result.findings.map((finding, i) => (
                  <Row
                    key={`${finding.image.src}-${i}`}
                    rowId={`${uid}-row-${i}`}
                    finding={finding}
                    draft={draftFor.get(i)}
                    drafted={result.drafted}
                    value={edits[i]}
                    onChange={(v) => setEdits((prev) => ({ ...prev, [i]: v }))}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <p className={`${styles.greyNote} ${styles.spaceTop3}`}>{result.guidance}</p>
        </section>
      ) : null}
    </>
  );
}

function Row({
  rowId,
  finding,
  draft,
  drafted,
  value,
  onChange,
}: {
  /** Unique per row — two rows can hold the same file, and duplicate ids break
      the label association this tool flags on other people's sites. */
  rowId: string;
  finding: AltFinding;
  draft?: Draft;
  drafted: boolean;
  value?: string;
  onChange: (value: string) => void;
}) {
  const { image, status } = finding;
  const file = image.src.split(/[?#]/)[0]?.split("/").pop() ?? image.src;
  const where = image.inCms
    ? `CMS${image.collectionName ? `, ${image.collectionName}` : ""}${image.fieldHint ? `, ${image.fieldHint}` : ""}`
    : "Static";

  // The draft is the starting value; an edit replaces it. `??` rather than `||`
  // so deliberately clearing the field to an empty alt is preserved.
  const draftValue = value ?? draft?.alt ?? "";
  const isEmptyDraft = draft !== undefined && draftValue === "";

  return (
    <tr>
      <td>
        {/* Decorative here: the file name in the next cell is the accessible name
            for this row, and describing a thumbnail whose alt text is the thing
            under review would be circular. */}
        <img
          className={styles.thumb}
          src={image.src}
          alt=""
          width={56}
          height={56}
          loading="lazy"
        />
      </td>
      <td>
        <span className={styles.mono}>{file}</span>
        <br />
        <span className={styles.hint}>{where}</span>
        {image.alt ? (
          <>
            <br />
            <span className={styles.hint}>current: &ldquo;{image.alt}&rdquo;</span>
          </>
        ) : null}
      </td>
      <td>
        <span className={styles.chip} data-tone={STATUS_TONE[status]}>
          {STATUS_LABEL[status]}
        </span>
        {draft && !draft.confident ? (
          <>
            <br />
            <span className={`${styles.chip} ${styles.spaceTop2}`} data-tone="warn">
              Low confidence
            </span>
          </>
        ) : null}
      </td>
      <td>
        {drafted && draft ? (
          <>
            <label className={styles.srOnly} htmlFor={rowId}>
              Drafted alt text for {file}
            </label>
            <textarea
              id={rowId}
              className={styles.textarea}
              rows={2}
              value={draftValue}
              onChange={(e) => onChange(e.target.value)}
            />
            {isEmptyDraft ? (
              <span className={styles.hint}>
                <em>(empty alt, decorative)</em>
              </span>
            ) : null}
          </>
        ) : (
          <span className={styles.hint}>{finding.reason}</span>
        )}
      </td>
    </tr>
  );
}

/**
 * Parses the pasted list.
 *
 * `url` alone means no alt attribute; `url | text` means that alt attribute is
 * present. The distinction matters — a missing alt and an empty alt are
 * different states and the classifier treats them differently.
 */
export function parseImageList(raw: string): ImageRecord[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const bar = line.indexOf("|");
      if (bar === -1) return { src: line };
      return {
        src: line.slice(0, bar).trim(),
        alt: line.slice(bar + 1).trim(),
      };
    })
    .filter((image) => image.src.length > 0);
}
