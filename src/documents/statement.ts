/**
 * Accessibility statement generator.
 *
 * The European Accessibility Act requires a published statement with a working
 * feedback channel, and most sites do not have one — which is why this module
 * exists. The wording follows the template in `docs/design-inventory.md` §4.9,
 * which in turn follows the structure the EU model statement expects:
 * commitment, conformance status, known limitations, feedback channel,
 * assessment approach.
 *
 * ## The honesty rule that shapes the whole module
 *
 * A statement is the organisation's own legal claim about its site. This tool
 * scans roughly a fifth of the WCAG 2.2 A/AA criteria — the rest need a human.
 * So the generator **will not emit "fully conformant" off the back of a scan**.
 * A clean automated result means "we found nothing", not "there is nothing";
 * those are different sentences and only one of them is true.
 *
 * `full` is reachable, because some sites genuinely are conformant and are
 * entitled to say so — but only when the caller passes
 * `manualReviewCompleted: true`, which is a human attesting that the criteria
 * no scanner can reach were checked by hand. Ask for that attestation and the
 * claim belongs to the person who made it. Infer it from a green scan and the
 * claim belongs to us, and it would be false. The French court that rejected
 * Carrefour's 71% conformance score in June 2026 is the cautionary case:
 * partial compliance is not a legal position, and neither is an unearned
 * claim of a complete one.
 *
 * Guardrail 5 applies to every string in here.
 */

import type { Issue } from "@/rules/types";
import type { ScanScore } from "@/rules/score";
import { CRITERIA_BY_SC } from "./wcag-criteria";

export type ConformanceStatus = "full" | "partial" | "none";

export type KnownLimitation = {
  /** Success criterion the limitation sits under, e.g. "1.4.3". */
  sc: string;
  /** One sentence, in the organisation's voice. */
  text: string;
  /** Optional commitment, e.g. "20 August 2026". Omitted when not supplied. */
  plannedFixDate?: string;
};

export type StatementInput = {
  /** Legal entity name, e.g. "Cascade Ops Inc." */
  organisation: string;
  /** Bare domain the statement covers, e.g. "cascadeops.com". */
  domain: string;
  /** Working feedback address. The EAA requires the channel to be real. */
  contactEmail: string;
  /** Milliseconds since epoch. Rendered as "Last reviewed ...". */
  reviewedAt: number;
  /** Defaults to "five working days". */
  responseTime?: string;
  /** WCAG version the organisation is working towards. */
  wcagVersion?: "2.1" | "2.2";
  /** Conformance level claimed. AA is the only level any regime requires. */
  wcagLevel?: "A" | "AA";
  /**
   * Human attestation that the criteria automated testing cannot reach were
   * reviewed by hand. Required before `full` can be claimed.
   */
  manualReviewCompleted?: boolean;
  /** Caller's claim. Validated against the evidence, never taken on trust. */
  claimedStatus?: ConformanceStatus;
  /** Overrides the limitations derived from the scan. */
  limitations?: KnownLimitation[];
};

export type Statement = {
  title: string;
  reviewedOn: string;
  status: ConformanceStatus;
  /** Populated when the caller asked for a stronger claim than the evidence supports. */
  warnings: string[];
  sections: Array<{ heading: string; paragraphs: string[]; list?: string[] }>;
  html: string;
  text: string;
};

const STATUS_SENTENCE: Record<ConformanceStatus, (v: string, l: string) => string> = {
  full: (v, l) =>
    `This website is fully conformant with WCAG ${v} level ${l}. Fully conformant means that the content fully conforms to the standard without any exceptions.`,
  partial: (v, l) =>
    `This website is partially conformant with WCAG ${v} level ${l}. Partially conformant means that some parts of the content do not fully conform to the standard.`,
  none: (v, l) =>
    `This website is not conformant with WCAG ${v} level ${l}. Not conformant means that the content fails to meet the standard in ways that are known and unresolved.`,
};

/** Escapes text destined for an HTML attribute or text node. */
function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** "6 August 2026" — the format the design uses, locale-independent. */
export function formatReviewDate(ms: number): string {
  const d = new Date(ms);
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/**
 * Turns scan findings into limitation sentences.
 *
 * One line per failing criterion rather than per issue: a statement is read by
 * people, and thirty near-identical contrast lines help nobody. Ordered by
 * severity so the most serious admission comes first.
 */
export function limitationsFromScan(issues: Issue[]): KnownLimitation[] {
  const order = { Critical: 0, Serious: 1, Moderate: 2, Minor: 3 } as const;
  return [...issues]
    .sort(
      (a, b) =>
        order[a.rule.severity] - order[b.rule.severity] || b.nodeCount - a.nodeCount,
    )
    .map((issue) => {
      const criterion = CRITERIA_BY_SC.get(issue.rule.sc);
      const where = issue.isCmsBound ? ", including items bound to a CMS collection" : "";
      const count =
        issue.nodeCount === 1 ? "One element" : `${issue.nodeCount} elements`;
      return {
        sc: issue.rule.sc,
        text:
          `${issue.rule.name}. ${count} on the page ${issue.nodeCount === 1 ? "is" : "are"} ` +
          `affected${where}, against WCAG ${issue.rule.sc} ` +
          `${criterion?.name ?? ""}`.trimEnd() + ".",
      };
    });
}

/**
 * Decides the status the evidence actually supports.
 *
 * Returns the claim plus any warning the caller needs to see. A caller asking
 * for `full` without a manual review is downgraded rather than refused — the
 * document still generates, but it tells the truth and says why.
 */
export function resolveStatus(input: StatementInput, hasFindings: boolean): {
  status: ConformanceStatus;
  warnings: string[];
} {
  const warnings: string[] = [];
  const claimed = input.claimedStatus ?? (hasFindings ? "partial" : "partial");

  if (claimed === "full" && hasFindings) {
    warnings.push(
      "Full conformance cannot be claimed while the scan still reports failures. " +
        "The status has been set to partially conformant.",
    );
    return { status: "partial", warnings };
  }

  if (claimed === "full" && !input.manualReviewCompleted) {
    warnings.push(
      "Full conformance needs a manual review on record. Automated testing reaches " +
        "roughly a fifth of the WCAG 2.2 A and AA criteria, so a clean scan means no " +
        "failures were found, not that none exist. The status has been set to " +
        "partially conformant.",
    );
    return { status: "partial", warnings };
  }

  if (!hasFindings && claimed === "partial" && !input.manualReviewCompleted) {
    warnings.push(
      "This scan found no failures, but it only evaluates the criteria a machine can " +
        "check. Partially conformant is the honest status until a manual review is done.",
    );
  }

  return { status: claimed, warnings };
}

export function generateStatement(
  input: StatementInput,
  scan?: { issues: Issue[]; score: ScanScore },
): Statement {
  const version = input.wcagVersion ?? "2.2";
  const level = input.wcagLevel ?? "AA";
  const responseTime = input.responseTime ?? "five working days";
  const org = input.organisation.trim();
  const domain = input.domain.trim();

  const limitations =
    input.limitations ?? (scan ? limitationsFromScan(scan.issues) : []);
  const { status, warnings } = resolveStatus(input, limitations.length > 0);

  const coverageSentence = scan
    ? `Automated testing covered ${scan.score.coverage.automatedCriteria} of the ` +
      `${scan.score.coverage.totalCriteria} WCAG ${version} level A and AA success criteria, ` +
      `about ${scan.score.coverage.percent}%. The remaining criteria require human review.`
    : "Automated testing covers only part of the WCAG success criteria; the remainder " +
      "require human review.";

  const sections: Statement["sections"] = [
    {
      heading: "",
      paragraphs: [
        `${org} is committed to making ${domain} accessible to everyone, including ` +
          `people with disabilities. We are working towards conformance with the Web ` +
          `Content Accessibility Guidelines version ${version}, level ${level}.`,
      ],
    },
    {
      heading: "Conformance status",
      paragraphs: [STATUS_SENTENCE[status](version, level)],
    },
    {
      heading: "Known limitations",
      paragraphs:
        limitations.length > 0
          ? ["The following issues are known and are being worked on."]
          : [
              "No failures were recorded at the last review. This is not a statement " +
                "that the site is free of barriers — if you find one, please tell us " +
                "using the feedback channel below.",
            ],
      list: limitations.map((l) =>
        l.plannedFixDate ? `${l.text} Fix scheduled for ${l.plannedFixDate}.` : l.text,
      ),
    },
    {
      heading: "Feedback",
      paragraphs: [
        `If you encounter a barrier on this site, email ${input.contactEmail}. ` +
          `We aim to respond within ${responseTime}.`,
      ],
    },
    {
      heading: "Assessment approach",
      paragraphs: [
        `${org} assessed the accessibility of ${domain} by a combination of automated ` +
          `scanning and manual review. ${coverageSentence}`,
      ],
    },
  ];

  const title = `Accessibility statement for ${org}`;
  const reviewedOn = formatReviewDate(input.reviewedAt);

  const html = [
    `<section class="a11y-statement">`,
    `  <h2>${esc(title)}</h2>`,
    `  <p class="a11y-statement__reviewed">Last reviewed ${esc(reviewedOn)}</p>`,
    ...sections.flatMap((s) => {
      const out: string[] = [];
      if (s.heading) out.push(`  <h3>${esc(s.heading)}</h3>`);
      for (const p of s.paragraphs) out.push(`  <p>${esc(p)}</p>`);
      if (s.list && s.list.length > 0) {
        out.push(`  <ul>`);
        for (const item of s.list) out.push(`    <li>${esc(item)}</li>`);
        out.push(`  </ul>`);
      }
      return out;
    }),
    `</section>`,
  ].join("\n");

  const text = [
    title,
    `Last reviewed ${reviewedOn}`,
    "",
    ...sections.flatMap((s) => {
      const out: string[] = [];
      if (s.heading) out.push(s.heading, "");
      out.push(...s.paragraphs);
      if (s.list) out.push(...s.list.map((i) => `- ${i}`));
      out.push("");
      return out;
    }),
  ]
    .join("\n")
    .trimEnd();

  return { title, reviewedOn, status, warnings, sections, html, text };
}
