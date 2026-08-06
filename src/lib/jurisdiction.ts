/**
 * Jurisdiction mapping — pure logic, no database, no network.
 *
 * IMPORTANT: this is a planning aid, not legal advice. Every surface that renders
 * it must carry the disclaimer below. The roadmap is explicit that jurisdiction
 * wording needs review by counsel before launch, and the data here is a starting
 * point for that review rather than a substitute for it.
 */

export const LEGAL_DISCLAIMER =
  "This mapping is generated from the markets you selected and is provided for planning. " +
  "It is not legal advice. Have the wording reviewed by counsel before you rely on it.";

export type Market = "us" | "eu" | "uk" | "ca-on" | "au";

export type BusinessTrait =
  | "private-business"
  | "public-sector"
  | "sells-to-us-federal"
  | "banking-ecommerce-transport";

export type Regime = {
  id: string;
  law: string;
  region: string;
  standard: string;
  /** What it means for this specific business, given what they selected. */
  note: string;
  deadline: string;
  status: "Applies now" | "Upcoming" | "Does not apply";
  tone: "red" | "amber" | "grey";
  /** WCAG version the regime is measured against, for the strictest-baseline calc. */
  baseline: "2.0 AA" | "2.1 AA" | "2.2 AA";
  requiresStatement: boolean;
};

type Predicate = (markets: Set<Market>, traits: Set<BusinessTrait>) => boolean;

const CATALOGUE: Array<{ build: (applies: boolean) => Regime; when: Predicate }> = [
  {
    when: (m, t) => m.has("us") && t.has("private-business"),
    build: (applies) => ({
      id: "ada-title-iii",
      law: "ADA Title III",
      region: "United States",
      standard: "WCAG 2.1 AA in practice",
      note: "Enforced through private litigation. There is no certification and no safe harbour.",
      deadline: "In force",
      status: applies ? "Applies now" : "Does not apply",
      tone: applies ? "red" : "grey",
      baseline: "2.1 AA",
      requiresStatement: false,
    }),
  },
  {
    when: (m, t) => m.has("us") && t.has("public-sector"),
    build: (applies) => ({
      id: "ada-title-ii",
      law: "ADA Title II",
      region: "United States",
      standard: "WCAG 2.1 AA",
      note: "Public entities. Large entities must comply by 26 April 2027, smaller ones by 26 April 2028.",
      deadline: "26 Apr 2027 / 26 Apr 2028",
      status: applies ? "Applies now" : "Does not apply",
      tone: applies ? "red" : "grey",
      baseline: "2.1 AA",
      requiresStatement: false,
    }),
  },
  {
    when: (_m, t) => t.has("sells-to-us-federal"),
    build: (applies) => ({
      id: "section-508",
      law: "Section 508",
      region: "United States",
      standard: "Revised 508, WCAG 2.0 AA",
      note: "Triggered because you sell to a federal agency. Procurement will ask for a VPAT.",
      deadline: "In force",
      status: applies ? "Applies now" : "Does not apply",
      tone: applies ? "red" : "grey",
      baseline: "2.0 AA",
      requiresStatement: false,
    }),
  },
  {
    when: (m) => m.has("eu"),
    build: (applies) => ({
      id: "eaa",
      law: "European Accessibility Act",
      region: "European Union",
      standard: "EN 301 549, WCAG 2.1 AA",
      note: "Binds any business selling to EU consumers regardless of where it is based. An accessibility statement is mandatory.",
      deadline: "28 Jun 2025",
      status: applies ? "Applies now" : "Does not apply",
      tone: applies ? "red" : "grey",
      baseline: "2.1 AA",
      requiresStatement: true,
    }),
  },
  {
    when: (m) => m.has("eu"),
    build: (applies) => ({
      id: "en-301-549",
      law: "EN 301 549",
      region: "European Union",
      standard: "WCAG 2.1 AA baseline",
      note: "The harmonised standard the EAA is measured against.",
      deadline: "In force",
      status: applies ? "Applies now" : "Does not apply",
      tone: applies ? "red" : "grey",
      baseline: "2.1 AA",
      requiresStatement: false,
    }),
  },
  {
    when: (m) => m.has("uk"),
    build: (applies) => ({
      id: "equality-act",
      law: "Equality Act 2010",
      region: "United Kingdom",
      standard: "WCAG 2.1 AA in practice",
      note: "Requires reasonable adjustments for disabled users. No fixed technical standard, but WCAG 2.1 AA is the accepted benchmark.",
      deadline: "In force",
      status: applies ? "Applies now" : "Does not apply",
      tone: applies ? "amber" : "grey",
      baseline: "2.1 AA",
      requiresStatement: false,
    }),
  },
  {
    when: (m) => m.has("ca-on"),
    build: (applies) => ({
      id: "aoda",
      law: "AODA",
      region: "Ontario, Canada",
      standard: "WCAG 2.0 AA",
      note: "Organisations with 50 or more employees must also file a compliance report.",
      deadline: "In force since 1 Jan 2021",
      status: applies ? "Applies now" : "Does not apply",
      tone: applies ? "amber" : "grey",
      baseline: "2.0 AA",
      requiresStatement: false,
    }),
  },
  {
    when: (m) => m.has("au"),
    build: (applies) => ({
      id: "dda",
      law: "Disability Discrimination Act",
      region: "Australia",
      standard: "WCAG 2.1 AA (government mandate)",
      note: "Applies broadly to services offered to the public. Government services are held to WCAG 2.1 AA explicitly.",
      deadline: "In force",
      status: applies ? "Applies now" : "Does not apply",
      tone: applies ? "amber" : "grey",
      baseline: "2.1 AA",
      requiresStatement: false,
    }),
  },
];

const BASELINE_RANK: Record<Regime["baseline"], number> = {
  "2.0 AA": 0,
  "2.1 AA": 1,
  "2.2 AA": 2,
};

export type JurisdictionResult = {
  regimes: Regime[];
  applicableCount: number;
  /** The strictest common baseline across everything that applies. */
  strictestBaseline: string;
  statementMandatory: boolean;
  disclaimer: string;
  caseNote: string;
};

export function mapJurisdictions(
  markets: Market[],
  traits: BusinessTrait[],
): JurisdictionResult {
  const m = new Set(markets);
  const t = new Set(traits);

  const regimes = CATALOGUE.map(({ build, when }) => build(when(m, t)));
  const applicable = regimes.filter((r) => r.status === "Applies now");

  const strictest = applicable.reduce<Regime["baseline"]>(
    (worst, r) => (BASELINE_RANK[r.baseline] > BASELINE_RANK[worst] ? r.baseline : worst),
    "2.0 AA",
  );

  return {
    // Applicable regimes first, so the answer is at the top.
    regimes: [...applicable, ...regimes.filter((r) => r.status !== "Applies now")],
    applicableCount: applicable.length,
    strictestBaseline: applicable.length > 0 ? `WCAG ${strictest}` : "None selected",
    statementMandatory: applicable.some((r) => r.requiresStatement),
    disclaimer: LEGAL_DISCLAIMER,
    caseNote:
      "In June 2026 a French court ordered Carrefour to reach full compliance under a EUR 500 " +
      "per day penalty, explicitly rejecting a 71% conformance score as insufficient. " +
      "Partial compliance is not a legal position.",
  };
}
