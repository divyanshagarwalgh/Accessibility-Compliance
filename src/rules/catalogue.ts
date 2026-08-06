import type { Rule } from "./types";

/**
 * The rule catalogue.
 *
 * The 13 rules below are extracted verbatim from the design prototype
 * (docs/rules-extracted.md). The `why` and `webflowSteps` text is the product —
 * it is what a user cannot get from running axe-core themselves — so it is quoted
 * exactly rather than paraphrased.
 *
 * Anything axe-core reports that is NOT in this catalogue still appears in the
 * report, with generic guidance and a visible "no Webflow steps written yet"
 * marker. Hiding the gap would be worse than showing it.
 */
export const RULES: Rule[] = [
  {
    id: "contrast",
    name: "Text has insufficient colour contrast",
    sc: "1.4.3",
    level: "AA",
    severity: "Critical",
    introducedIn: "2.0",
    why: "Foreground and background do not reach a 4.5:1 ratio for body text. Low vision users, and anyone reading in sunlight, will lose the text entirely.",
    webflowSteps: [
      "Open Webflow Designer and select one instance of the affected element.",
      "In the Style panel, confirm you are editing the base class rather than a combo class, or the fix will only apply in one place.",
      "Under Typography, set Colour to the suggested value. Our contrast checker gives you the nearest passing colour that keeps your hue.",
      "Repeat for the other affected classes, then publish to staging and re-scan.",
    ],
    fixSurface: "designer",
    effort: "30 min",
    axeRuleIds: ["color-contrast", "color-contrast-enhanced"],
    requiresLayout: true,
    note: "The 4.5:1 ratio approximates the contrast loss of 20/40 vision, roughly what a typical 80 year old sees. Large text gets a lower bar of 3:1 because size compensates.",
  },
  {
    id: "alt",
    name: "Images are missing alternative text",
    sc: "1.1.1",
    level: "A",
    severity: "Critical",
    introducedIn: "2.0",
    why: "Images render with an empty alt attribute. Screen reader users hear nothing where the image should be, or hear the file name read out.",
    webflowSteps: [
      "For static images: select the image in Designer and add Alt text in the Settings panel.",
      "For images inside a Collection List, the fix belongs on the CMS field, not the element. Go to CMS, open the collection, and add an Alt text plain-text field if one does not exist.",
      "In Designer, select the collection item image and bind Alt text to that field.",
      "Use the alt text auditor to draft the strings, then paste them into the CMS in bulk.",
      "Decorative images should carry an empty alt attribute rather than a description.",
    ],
    fixSurface: "cms",
    effort: "2 hours",
    axeRuleIds: ["image-alt", "input-image-alt", "area-alt", "role-img-alt", "object-alt"],
    requiresLayout: false,
  },
  {
    id: "labels",
    name: "Form inputs have no associated label",
    sc: "3.3.2",
    level: "A",
    severity: "Critical",
    introducedIn: "2.0",
    why: "Placeholder text is being used instead of a label. Placeholders disappear on focus and are not announced reliably by screen readers.",
    webflowSteps: [
      "Select the input in Designer and check the Settings panel for its Name.",
      "Add a Label element above the input and set For to the same name.",
      "If the design needs no visible label, keep the label and apply a screen-reader-only class instead of display: none. Lumos already ships u-sr-only for exactly this.",
      "Never delete the label to hide it. display: none removes it from the accessibility tree.",
    ],
    fixSurface: "designer",
    effort: "45 min",
    axeRuleIds: ["label", "form-field-multiple-labels", "select-name", "aria-input-field-name"],
    requiresLayout: false,
  },
  {
    id: "keyboard",
    name: "Interactive element is not keyboard operable",
    sc: "2.1.1",
    level: "A",
    severity: "Critical",
    introducedIn: "2.0",
    why: "A div carries the click interaction. Keyboard and switch users cannot reach or trigger it.",
    webflowSteps: [
      "Replace the div with a Link block or Button element, which are focusable by default.",
      'If the element must stay a div, add tabindex="0" and role="button" in Settings, then handle Enter and Space.',
      "Check the tab order in preview before publishing.",
    ],
    fixSurface: "designer",
    effort: "1 hour",
    axeRuleIds: ["scrollable-region-focusable", "focus-order-semantics", "nested-interactive"],
    requiresLayout: false,
    note: "2.1.1 is largely a manual criterion. Automated checks catch only the clearest cases, so a passing result here does not mean the page is keyboard operable.",
  },
  {
    id: "captions",
    name: "Video has no captions",
    sc: "1.2.2",
    level: "A",
    severity: "Critical",
    introducedIn: "2.0",
    why: "The embedded video has no caption track. Prerecorded audio content needs synchronised captions.",
    webflowSteps: [
      "Upload a .vtt caption file to the hosting provider, or enable captions on the Vimeo or YouTube source.",
      "If the video is background-only and decorative, mark it aria-hidden and provide a text alternative nearby.",
    ],
    fixSurface: "designer",
    effort: "Varies",
    axeRuleIds: ["video-caption"],
    requiresLayout: false,
  },
  {
    id: "linkname",
    name: "Link text does not describe its destination",
    sc: "2.4.4",
    level: "A",
    severity: "Serious",
    introducedIn: "2.0",
    why: 'Links read as "Read more" out of context. A screen reader user listing the links on the page hears the same phrase repeatedly with no way to tell them apart.',
    webflowSteps: [
      "Select the link inside the collection item and bind its text to the post title.",
      "If the visible label must stay short, add an aria-label in Settings that includes the title.",
    ],
    fixSurface: "designer",
    effort: "45 min",
    axeRuleIds: ["link-name", "identical-links-same-purpose", "empty-heading"],
    requiresLayout: false,
  },
  {
    id: "target",
    name: "Target size is below 24 by 24 CSS pixels",
    sc: "2.5.8",
    level: "AA",
    severity: "Serious",
    introducedIn: "2.2",
    why: "New in WCAG 2.2. Small tap targets are hard to hit for anyone with a motor impairment, and for everyone on a moving train.",
    webflowSteps: [
      "Select the link and set a minimum height and width of 24px in the Style panel.",
      "Add 8px padding and keep the icon at its original size so the visual weight does not change.",
    ],
    fixSurface: "designer",
    effort: "30 min",
    axeRuleIds: ["target-size"],
    requiresLayout: true,
  },
  {
    id: "headings",
    name: "Heading levels are skipped",
    sc: "1.3.1",
    level: "A",
    severity: "Serious",
    introducedIn: "2.0",
    why: "The document outline jumps a level, so assistive technology reports a missing heading and users navigating by heading lose the structure.",
    webflowSteps: [
      "Select the heading and change the tag in Settings rather than restyling a lower level.",
      "Create a text style class so an h3 can look like the current h4 without breaking the outline. Lumos already separates these: u-text-style-h4 on an h3 tag gives the look without the wrong level.",
    ],
    fixSurface: "designer",
    effort: "30 min",
    axeRuleIds: ["heading-order", "page-has-heading-one", "empty-heading"],
    requiresLayout: false,
  },
  {
    id: "focus",
    name: "Focus indicator has been removed",
    sc: "2.4.7",
    level: "AA",
    severity: "Serious",
    introducedIn: "2.0",
    why: "A reset in the site-wide custom code removes the focus ring from every control, so keyboard users cannot see where they are on the page.",
    webflowSteps: [
      "Open Project settings, then Custom code, and remove the outline: none reset.",
      "Replace it with a visible ring: :focus-visible { outline: 2px solid <your brand colour>; outline-offset: 2px; }",
      "Tab through the page in preview to confirm every control shows the ring.",
    ],
    fixSurface: "project-settings",
    effort: "15 min",
    // Emitted by scan-worker/src/custom-checks.ts, not by axe-core.
    axeRuleIds: ["wy-focus-visible"],
    requiresLayout: true,
    customCheck: true,
    note: "axe-core has no rule for this. We check it ourselves by reading the computed outline on focusable elements.",
  },
  {
    id: "landmark",
    name: "Page has no main landmark",
    sc: "1.3.1",
    level: "A",
    severity: "Moderate",
    introducedIn: "2.0",
    why: "There is no main region, so screen reader users cannot skip past the navigation to the content.",
    webflowSteps: [
      "Select the page wrapper and set its tag to Main in the Settings panel.",
      "Add a skip link as the first focusable element pointing at the main region.",
    ],
    fixSurface: "designer",
    effort: "15 min",
    axeRuleIds: ["landmark-one-main", "region", "bypass", "landmark-unique"],
    requiresLayout: false,
  },
  {
    id: "lang",
    name: "html element has no lang attribute",
    sc: "3.1.1",
    level: "A",
    severity: "Moderate",
    introducedIn: "2.0",
    why: "Without a language, screen readers guess the pronunciation rules and can read the page in the wrong accent, or unintelligibly.",
    webflowSteps: [
      "Open Project settings, then General, and set the site language.",
    ],
    fixSurface: "project-settings",
    effort: "2 min",
    axeRuleIds: ["html-has-lang", "html-lang-valid", "valid-lang"],
    requiresLayout: false,
  },
  {
    id: "zoom",
    name: "Content is clipped at 200% zoom",
    sc: "1.4.4",
    level: "AA",
    severity: "Moderate",
    introducedIn: "2.0",
    why: "Fixed pixel heights on containers cut off text when the user enlarges type, so the content becomes unreadable rather than merely bigger.",
    webflowSteps: [
      "Change the fixed Height on the container to Auto and set a Min height instead.",
      "Test at 200% in preview with browser zoom rather than device preview.",
    ],
    fixSurface: "designer",
    effort: "45 min",
    axeRuleIds: ["meta-viewport", "wy-resize-clipped"],
    requiresLayout: true,
    customCheck: true,
    note: "axe-core only checks that zoom is not disabled via the viewport meta tag. Detecting actual clipping needs a rendered page at 200%, which we do separately.",
  },
  {
    id: "obscured",
    name: "Focused element is hidden behind sticky header",
    sc: "2.4.11",
    level: "AA",
    severity: "Minor",
    introducedIn: "2.2",
    why: "New in WCAG 2.2. The sticky header covers the focused element when a user tabs to an anchor, so keyboard users lose their place.",
    webflowSteps: [
      "Add scroll-margin-top equal to the header height on anchor targets via a custom class.",
    ],
    fixSurface: "designer",
    effort: "20 min",
    // Emitted by scan-worker/src/custom-checks.ts, not by axe-core.
    axeRuleIds: ["wy-focus-obscured"],
    requiresLayout: true,
    customCheck: true,
    note: "axe-core has no rule for this. We measure the focused element's bounding box against any position: sticky or fixed element above it.",
  },
];

/** Lookup by our stable rule id. */
export const RULES_BY_ID: ReadonlyMap<string, Rule> = new Map(
  RULES.map((r) => [r.id, r]),
);

/** Reverse index: axe-core rule id → our rule. Built once at module load. */
export const RULE_BY_AXE_ID: ReadonlyMap<string, Rule> = new Map(
  RULES.flatMap((rule) => rule.axeRuleIds.map((axeId) => [axeId, rule] as const)),
);

/** Rules that cannot be judged from static HTML. Drives the scan-service requirement. */
export const LAYOUT_DEPENDENT_RULES = RULES.filter((r) => r.requiresLayout);

/** Rules we check ourselves because axe-core has no equivalent. */
export const CUSTOM_CHECK_RULES = RULES.filter((r) => r.customCheck);
