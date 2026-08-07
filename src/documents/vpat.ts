/**
 * VPAT 2.5 / ACR draft generator.
 *
 * A Voluntary Product Accessibility Template is what procurement teams ask for,
 * constantly — 'vpat' runs 5,400 searches a month at a $29.92 CPC, and it is
 * the single highest-intent term in the accessibility cluster. Filling one in
 * by hand takes a day. Filling one in *wrongly* costs a contract.
 *
 * ## Why every criterion gets a row
 *
 * A VPAT is read against the reader's own checklist. A table containing only
 * the criteria we happen to test looks, to a procurement officer, like a table
 * where everything passed — the absent rows read as "no issues", not as "not
 * examined". So all 55 WCAG 2.2 A/AA criteria are emitted, and the 43 we cannot
 * reach are marked `Not evaluated` in the same column as everything else.
 *
 * The design brief puts it exactly right: sending a VPAT with unverified rows
 * is a bigger risk than sending one that admits gaps.
 *
 * ## How conformance is decided
 *
 * The scan reports violations only — we ask axe for `resultTypes: ['violations']`
 * — so we know what failed and never what passed. That asymmetry decides the
 * vocabulary:
 *
 *   - `Not evaluated`     the catalogue has no check for this criterion
 *   - `Does not support`  the criterion is page-level and its one condition failed
 *                         (a missing `lang` attribute is not partially missing)
 *   - `Partially supports` element-level findings exist. We know *some*
 *                         functionality fails; we have no evidence about the
 *                         rest, and VPAT reserves `Does not support` for when
 *                         the majority fails, which we cannot measure
 *   - `Supports`          we checked and found nothing, with the remark saying
 *                         precisely what was checked
 *
 * Every row is a draft. The document says so, the footer says so, and
 * `needsHumanReview` is true on every row that a machine filled in.
 *
 * Guardrail 5 applies throughout: this is a draft for a human to confirm, never
 * a certificate.
 */

import type { Issue } from "@/rules/types";
import { RULES } from "@/rules/catalogue";
import { CRITERIA, type Criterion } from "./wcag-criteria";

export type Conformance =
  | "Supports"
  | "Partially supports"
  | "Does not support"
  | "Not evaluated";

/**
 * Editions of the template. The criteria table is identical across them —
 * Section 508 and EN 301 549 both incorporate WCAG by reference — but each
 * carries a different scope note, because each covers ground this tool does not.
 */
export type VpatEdition = "wcag" | "508" | "eu";

/**
 * Criteria whose failure is page-wide rather than per-element. One missing
 * `lang` attribute is not a partial failure, and one missing `main` landmark is
 * not "some functionality". These are the only rules in the catalogue whose
 * subject is the page itself.
 */
const PAGE_LEVEL_RULE_IDS = new Set(["lang", "landmark"]);

const EDITION_SCOPE: Record<VpatEdition, { title: string; scopeNote: string }> = {
  wcag: {
    title: "VPAT 2.5 (WCAG edition) draft",
    scopeNote:
      "This draft covers the WCAG 2.2 Level A and AA success criteria only.",
  },
  508: {
    title: "VPAT 2.5 (Section 508 edition) draft",
    scopeNote:
      "This draft covers the WCAG 2.2 Level A and AA success criteria that Revised " +
      "Section 508 incorporates for web content. It does not cover the hardware, " +
      "software, support-documentation or authoring-tool chapters, which need to be " +
      "completed separately.",
  },
  eu: {
    title: "VPAT 2.5 (EU edition, EN 301 549) draft",
    scopeNote:
      "This draft covers the WCAG 2.2 Level A and AA success criteria that EN 301 549 " +
      "incorporates for web content. It does not cover the non-web clauses of " +
      "EN 301 549, including documents, software and hardware.",
  },
};

export type VpatRow = {
  sc: string;
  name: string;
  level: Criterion["level"];
  conformance: Conformance;
  remarks: string;
  /** True for every row a machine filled in, which is all of them. */
  needsHumanReview: boolean;
};

export type Vpat = {
  title: string;
  edition: VpatEdition;
  productName: string;
  evaluatedOn: string;
  rows: VpatRow[];
  /** Rows the scan could say something evidence-backed about. */
  prefilledCount: number;
  /** Rows marked `Not evaluated`. */
  notEvaluatedCount: number;
  scopeNote: string;
  footerNote: string;
  disclaimer: string;
};

export const VPAT_DISCLAIMER =
  "This is a draft produced by automated testing. Every row needs a human to confirm " +
  "it before this document is sent to a procurement team. Automated testing cannot " +
  "determine whether alternative text is meaningful, whether reading order makes " +
  "sense, or whether a keyboard user can complete a task, and it never establishes " +
  "conformance on its own.";

/** Criteria the rule catalogue can say something about, deduplicated. */
export function evaluableCriteria(): Set<string> {
  return new Set(RULES.map((r) => r.sc));
}

function remarkFor(issues: Issue[]): string {
  return issues
    .map((issue) => {
      const count = issue.nodeCount === 1 ? "1 element" : `${issue.nodeCount} elements`;
      const cms = issue.isCmsBound
        ? " Some affected elements are bound to a CMS collection, so the fix belongs on the field rather than the element."
        : "";
      return `${issue.rule.name}: ${count} affected.${cms}`;
    })
    .join(" ");
}

export function generateVpat(
  input: {
    productName: string;
    evaluatedAt: number;
    edition?: VpatEdition;
    /** Formatted date string; callers share `formatReviewDate` from statement.ts. */
    evaluatedOn: string;
  },
  scan?: { issues: Issue[] },
): Vpat {
  const edition = input.edition ?? "wcag";
  const evaluable = evaluableCriteria();

  // Group findings by criterion — several rules can share one criterion
  // (heading order and the missing main landmark are both 1.3.1).
  const bySc = new Map<string, Issue[]>();
  for (const issue of scan?.issues ?? []) {
    const list = bySc.get(issue.rule.sc);
    if (list) list.push(issue);
    else bySc.set(issue.rule.sc, [issue]);
  }

  const rows: VpatRow[] = CRITERIA.map((criterion) => {
    const findings = bySc.get(criterion.sc) ?? [];

    if (!evaluable.has(criterion.sc)) {
      return {
        sc: criterion.sc,
        name: criterion.name,
        level: criterion.level,
        conformance: "Not evaluated" as const,
        remarks:
          "Not covered by automated testing. This criterion needs to be reviewed by hand.",
        needsHumanReview: true,
      };
    }

    if (findings.length === 0) {
      const checkedBy = RULES.filter((r) => r.sc === criterion.sc)
        .map((r) => r.name.toLowerCase())
        .join("; ");
      return {
        sc: criterion.sc,
        name: criterion.name,
        level: criterion.level,
        conformance: "Supports" as const,
        remarks:
          `Automated testing found no failures. Checked for: ${checkedBy}. ` +
          "Automated testing does not cover every aspect of this criterion; confirm by hand.",
        needsHumanReview: true,
      };
    }

    const pageLevel = findings.every((f) => PAGE_LEVEL_RULE_IDS.has(f.rule.id));
    return {
      sc: criterion.sc,
      name: criterion.name,
      level: criterion.level,
      conformance: pageLevel
        ? ("Does not support" as const)
        : ("Partially supports" as const),
      remarks: remarkFor(findings),
      needsHumanReview: true,
    };
  });

  const notEvaluatedCount = rows.filter((r) => r.conformance === "Not evaluated").length;
  const prefilledCount = rows.length - notEvaluatedCount;

  return {
    title: EDITION_SCOPE[edition].title,
    edition,
    productName: input.productName,
    evaluatedOn: input.evaluatedOn,
    rows,
    prefilledCount,
    notEvaluatedCount,
    scopeNote: EDITION_SCOPE[edition].scopeNote,
    footerNote:
      `${notEvaluatedCount} of the ${rows.length} criteria could not be evaluated ` +
      "automatically and are marked Not evaluated. Sending a VPAT with unverified rows " +
      "is a bigger risk than sending one that admits gaps.",
    disclaimer: VPAT_DISCLAIMER,
  };
}
