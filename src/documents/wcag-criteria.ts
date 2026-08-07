/**
 * The WCAG 2.2 Level A and AA success criteria, in full.
 *
 * A VPAT has a row for every criterion, not only the ones we can test, so this
 * list is the spine of the VPAT generator. It is also the denominator behind
 * every coverage claim the product makes, which is why `TOTAL_WCAG_AA_CRITERIA`
 * in `rules/score.ts` is asserted against `CRITERIA.length` in the tests rather
 * than the two being maintained apart.
 *
 * ## Provenance
 *
 * Taken from the W3C Recommendation at https://www.w3.org/TR/WCAG22/, verified
 * 7 August 2026. Two things are easy to get wrong here and both are checked by
 * `wcag-criteria.test.ts`:
 *
 *   - **2.5.5 Target Size (Enhanced) is Level AAA, not AA.** It is adjacent in
 *     numbering to 2.5.8 Target Size (Minimum), which *is* AA, and at least one
 *     widely-mirrored list has it wrong. Confirmed against
 *     https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html
 *   - **4.1.1 Parsing was removed in WCAG 2.2** and must not appear. It is
 *     still present in most WCAG 2.1 era lists.
 *
 * The counts cross-check against the published deltas: WCAG 2.0 contributes 38
 * criteria (25 A + 13 AA), WCAG 2.1 adds 12 at A/AA, WCAG 2.2 adds 6 at A/AA
 * and withdraws 4.1.1. 38 + 12 + 6 − 1 = 55, split 31 A and 24 AA.
 *
 * Shipping a VPAT with an invented criterion number, or with a AAA criterion
 * presented as AA, would be worse than shipping no VPAT at all — procurement
 * teams read these against their own checklists.
 */

import type { WcagLevel } from "@/rules/types";

export type Criterion = {
  /** Success criterion number, e.g. "1.4.3". */
  sc: string;
  /** Official title, exactly as the Recommendation words it. */
  name: string;
  level: WcagLevel;
  /** Which WCAG version introduced it. Drives the "New in 2.2" chip. */
  introducedIn: "2.0" | "2.1" | "2.2";
};

export const CRITERIA: readonly Criterion[] = [
  { sc: "1.1.1", name: "Non-text Content", level: "A", introducedIn: "2.0" },
  { sc: "1.2.1", name: "Audio-only and Video-only (Prerecorded)", level: "A", introducedIn: "2.0" },
  { sc: "1.2.2", name: "Captions (Prerecorded)", level: "A", introducedIn: "2.0" },
  {
    sc: "1.2.3",
    name: "Audio Description or Media Alternative (Prerecorded)",
    level: "A",
    introducedIn: "2.0",
  },
  { sc: "1.2.4", name: "Captions (Live)", level: "AA", introducedIn: "2.0" },
  { sc: "1.2.5", name: "Audio Description (Prerecorded)", level: "AA", introducedIn: "2.0" },
  { sc: "1.3.1", name: "Info and Relationships", level: "A", introducedIn: "2.0" },
  { sc: "1.3.2", name: "Meaningful Sequence", level: "A", introducedIn: "2.0" },
  { sc: "1.3.3", name: "Sensory Characteristics", level: "A", introducedIn: "2.0" },
  { sc: "1.3.4", name: "Orientation", level: "AA", introducedIn: "2.1" },
  { sc: "1.3.5", name: "Identify Input Purpose", level: "AA", introducedIn: "2.1" },
  { sc: "1.4.1", name: "Use of Color", level: "A", introducedIn: "2.0" },
  { sc: "1.4.2", name: "Audio Control", level: "A", introducedIn: "2.0" },
  { sc: "1.4.3", name: "Contrast (Minimum)", level: "AA", introducedIn: "2.0" },
  { sc: "1.4.4", name: "Resize Text", level: "AA", introducedIn: "2.0" },
  { sc: "1.4.5", name: "Images of Text", level: "AA", introducedIn: "2.0" },
  { sc: "1.4.10", name: "Reflow", level: "AA", introducedIn: "2.1" },
  { sc: "1.4.11", name: "Non-text Contrast", level: "AA", introducedIn: "2.1" },
  { sc: "1.4.12", name: "Text Spacing", level: "AA", introducedIn: "2.1" },
  { sc: "1.4.13", name: "Content on Hover or Focus", level: "AA", introducedIn: "2.1" },
  { sc: "2.1.1", name: "Keyboard", level: "A", introducedIn: "2.0" },
  { sc: "2.1.2", name: "No Keyboard Trap", level: "A", introducedIn: "2.0" },
  { sc: "2.1.4", name: "Character Key Shortcuts", level: "A", introducedIn: "2.1" },
  { sc: "2.2.1", name: "Timing Adjustable", level: "A", introducedIn: "2.0" },
  { sc: "2.2.2", name: "Pause, Stop, Hide", level: "A", introducedIn: "2.0" },
  { sc: "2.3.1", name: "Three Flashes or Below Threshold", level: "A", introducedIn: "2.0" },
  { sc: "2.4.1", name: "Bypass Blocks", level: "A", introducedIn: "2.0" },
  { sc: "2.4.2", name: "Page Titled", level: "A", introducedIn: "2.0" },
  { sc: "2.4.3", name: "Focus Order", level: "A", introducedIn: "2.0" },
  { sc: "2.4.4", name: "Link Purpose (In Context)", level: "A", introducedIn: "2.0" },
  { sc: "2.4.5", name: "Multiple Ways", level: "AA", introducedIn: "2.0" },
  { sc: "2.4.6", name: "Headings and Labels", level: "AA", introducedIn: "2.0" },
  { sc: "2.4.7", name: "Focus Visible", level: "AA", introducedIn: "2.0" },
  { sc: "2.4.11", name: "Focus Not Obscured (Minimum)", level: "AA", introducedIn: "2.2" },
  { sc: "2.5.1", name: "Pointer Gestures", level: "A", introducedIn: "2.1" },
  { sc: "2.5.2", name: "Pointer Cancellation", level: "A", introducedIn: "2.1" },
  { sc: "2.5.3", name: "Label in Name", level: "A", introducedIn: "2.1" },
  { sc: "2.5.4", name: "Motion Actuation", level: "A", introducedIn: "2.1" },
  // 2.5.5 Target Size (Enhanced) is Level AAA and is deliberately absent.
  { sc: "2.5.7", name: "Dragging Movements", level: "AA", introducedIn: "2.2" },
  { sc: "2.5.8", name: "Target Size (Minimum)", level: "AA", introducedIn: "2.2" },
  { sc: "3.1.1", name: "Language of Page", level: "A", introducedIn: "2.0" },
  { sc: "3.1.2", name: "Language of Parts", level: "AA", introducedIn: "2.0" },
  { sc: "3.2.1", name: "On Focus", level: "A", introducedIn: "2.0" },
  { sc: "3.2.2", name: "On Input", level: "A", introducedIn: "2.0" },
  { sc: "3.2.3", name: "Consistent Navigation", level: "AA", introducedIn: "2.0" },
  { sc: "3.2.4", name: "Consistent Identification", level: "AA", introducedIn: "2.0" },
  { sc: "3.2.6", name: "Consistent Help", level: "A", introducedIn: "2.2" },
  { sc: "3.3.1", name: "Error Identification", level: "A", introducedIn: "2.0" },
  { sc: "3.3.2", name: "Labels or Instructions", level: "A", introducedIn: "2.0" },
  { sc: "3.3.3", name: "Error Suggestion", level: "AA", introducedIn: "2.0" },
  {
    sc: "3.3.4",
    name: "Error Prevention (Legal, Financial, Data)",
    level: "AA",
    introducedIn: "2.0",
  },
  { sc: "3.3.7", name: "Redundant Entry", level: "A", introducedIn: "2.2" },
  { sc: "3.3.8", name: "Accessible Authentication (Minimum)", level: "AA", introducedIn: "2.2" },
  // 4.1.1 Parsing was removed in WCAG 2.2 and is deliberately absent.
  { sc: "4.1.2", name: "Name, Role, Value", level: "A", introducedIn: "2.0" },
  { sc: "4.1.3", name: "Status Messages", level: "AA", introducedIn: "2.1" },
];

export const CRITERIA_BY_SC: ReadonlyMap<string, Criterion> = new Map(
  CRITERIA.map((c) => [c.sc, c]),
);

/** Sorts "1.4.10" after "1.4.9" — string comparison would not. */
export function compareSc(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}
