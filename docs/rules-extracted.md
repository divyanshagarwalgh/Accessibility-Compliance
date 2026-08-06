# Rule Engine — verbatim extraction from the prototype

Source: `A11yScreen.dc.html`, method `rules()` (lines 1373–1415). All 13 rules, unedited.

This is the reference. It becomes `src/rules/` **after Checkpoint 1** — no application code before
then.

Severity metadata (`sevMeta`): Critical `#B42318`/`#FDECEA`/dot `#D92D20` · Serious
`#93500B`/`#FEF3E6`/dot `#E07A1F` · Moderate `#1049A8`/`#EAF1FE`/dot `#146EF5` · Minor
`#5A5A5A`/`#F2F2F2`/dot `#9A9A9A`.

Derived labels: `levelLabel = "WCAG " + sc + " (" + level + ")"`;
`countLabel = count === 1 ? "1 element" : count + " elements"`.

---

## 1. `contrast` — Text has insufficient colour contrast

- **WCAG** 1.4.3 · **Level** AA · **Severity** Critical · **Count** 14
- **Selector** `.btn-secondary, .footer__link, .pricing-card__note`
- **Why** Foreground and background do not reach a 4.5:1 ratio for body text. The secondary button uses #FF7A45 on #FFFFFF, which measures 2.59:1.
- **Webflow steps**
  1. Open Webflow Designer and select one instance of the Secondary button.
  2. In the Style panel, confirm the class is btn-secondary rather than a combo class.
  3. Under Typography, set Colour to #B23600. This measures 6.14:1 on white, comfortably clear of the 4.5:1 minimum.
  4. Repeat for footer__link and pricing-card__note, then publish to staging and re-scan.

## 2. `alt` — Images are missing alternative text

- **WCAG** 1.1.1 · **Level** A · **Severity** Critical · **Count** 9
- **Selector** `Blog posts collection, thumbnail field`
- **Why** Nine images render with an empty alt attribute. Six of them are inside a CMS collection list, so the fix belongs on the field, not the element.
- **Webflow steps**
  1. Go to CMS, then the Blog posts collection, and open the Thumbnail image field.
  2. Add an Alt text plain-text field to the collection if one does not exist.
  3. In Designer, select the collection item image and bind Alt text to the new field.
  4. Use the alt text auditor to draft the nine strings, then paste them into the CMS in bulk.
- **CMS-bound** ✅ — this is the canonical example of the CMS-aware behaviour the brief requires.

## 3. `labels` — Form inputs have no associated label

- **WCAG** 3.3.2 · **Level** A · **Severity** Critical · **Count** 4
- **Selector** `#newsletter-email, #contact-name, #contact-phone, #search`
- **Why** Placeholder text is being used instead of a label. Placeholders disappear on focus and are not announced reliably by screen readers.
- **Webflow steps**
  1. Select the input in Designer and check the Settings panel for its Name.
  2. Add a Label element above the input and set For to the same name.
  3. If the design needs no visible label, keep the label and apply a screen-reader-only class instead of display: none.
  4. Never delete the label to hide it. display: none removes it from the accessibility tree.
- **Note** Step 3 maps directly onto the live `u-sr-only` utility.

## 4. `keyboard` — Interactive element is not keyboard operable

- **WCAG** 2.1.1 · **Level** A · **Severity** Critical · **Count** 3
- **Selector** `.faq-toggle, .filter-chip, .video-play`
- **Why** A div carries the click interaction. Keyboard and switch users cannot reach or trigger it.
- **Webflow steps**
  1. Replace the div with a Link block or Button element, which are focusable by default.
  2. If the element must stay a div, add tabindex="0" and role="button" in Settings, then handle Enter and Space.
  3. Check the tab order in preview before publishing.

## 5. `captions` — Video has no captions

- **WCAG** 1.2.2 · **Level** A · **Severity** Critical · **Count** 1
- **Selector** `.testimonial-video`
- **Why** The embedded testimonial has no caption track. Prerecorded audio content needs synchronised captions.
- **Webflow steps**
  1. Upload a .vtt caption file to the hosting provider, or enable captions on the Vimeo or YouTube source.
  2. If the video is background-only and decorative, mark it aria-hidden and provide a text alternative nearby.

## 6. `linkname` — Link text does not describe its destination

- **WCAG** 2.4.4 · **Level** A · **Severity** Serious · **Count** 11
- **Selector** `a.card__cta ("Read more")`
- **Why** Eleven links read as "Read more" out of context. A screen reader user listing links hears the same phrase eleven times.
- **Webflow steps**
  1. Select the link inside the collection item and bind its text to the post title.
  2. If the visible label must stay short, add an aria-label in Settings that includes the title.
- **CMS-bound** ✅ (collection item)

## 7. `target` — Target size is below 24 by 24 CSS pixels

- **WCAG** 2.5.8 · **Level** AA · **Severity** Serious · **Count** 7 · **New in WCAG 2.2**
- **Selector** `.footer__social a, .table__sort`
- **Why** New in WCAG 2.2. The footer social icons measure 18 by 18 with no spacing offset.
- **Webflow steps**
  1. Select the social link and set a minimum height and width of 24px in the Style panel.
  2. Add 8px padding and keep the icon at 18px so the visual weight does not change.
- **Requires layout** — cannot be evaluated from static HTML. Drives the Surface D decision.

## 8. `headings` — Heading levels are skipped

- **WCAG** 1.3.1 · **Level** A · **Severity** Serious · **Count** 6
- **Selector** `h2 followed by h4 in three sections`
- **Why** The document outline jumps from h2 to h4, so assistive technology reports a missing level.
- **Webflow steps**
  1. Select the heading and change the tag in Settings rather than restyling a lower level.
  2. Create a text style class so an h3 can look like the current h4 without breaking the outline.
- **Note** Step 2 maps onto `u-text-style-h4` on an `h3` — the live utility does exactly this.

## 9. `focus` — Focus indicator has been removed

- **WCAG** 2.4.7 · **Level** AA · **Severity** Serious · **Count** 1
- **Selector** `Global: *:focus { outline: none }`
- **Why** A reset in the site-wide custom code removes the focus ring from every control.
- **Webflow steps**
  1. Open Project settings, then Custom code, and remove the outline: none reset.
  2. Replace it with a visible ring: `:focus-visible { outline: 2px solid #FF4D00; outline-offset: 2px; }`
  3. Tab through the page in preview to confirm every control shows the ring.

## 10. `landmark` — Page has no main landmark

- **WCAG** 1.3.1 · **Level** A · **Severity** Moderate · **Count** 1
- **Selector** `body > div.page-wrapper`
- **Why** There is no main region, so screen reader users cannot skip past the navigation.
- **Webflow steps**
  1. Select the page wrapper and set its tag to Main in the Settings panel.
  2. Add a skip link as the first focusable element pointing at the main region.

## 11. `lang` — html element has no lang attribute

- **WCAG** 3.1.1 · **Level** A · **Severity** Moderate · **Count** 1
- **Selector** `<html>`
- **Why** Without a language, screen readers guess the pronunciation rules.
- **Webflow steps**
  1. Open Project settings, then General, and set the site language to English (United States).

## 12. `zoom` — Content is clipped at 200% zoom

- **WCAG** 1.4.4 · **Level** AA · **Severity** Moderate · **Count** 2
- **Selector** `.hero__eyebrow, .nav__cta`
- **Why** Fixed pixel heights on two containers cut off text when the user enlarges type.
- **Webflow steps**
  1. Change the fixed Height on the container to Auto and set a Min height instead.
  2. Test at 200% in preview with browser zoom rather than device preview.
- **Requires layout** — needs a real viewport at 200%.

## 13. `obscured` — Focused element is hidden behind sticky header

- **WCAG** 2.4.11 · **Level** AA · **Severity** Minor · **Count** 2 · **New in WCAG 2.2**
- **Selector** `.section-anchor targets`
- **Why** New in WCAG 2.2. The sticky header covers the focused element when a user tabs to an anchor.
- **Webflow steps**
  1. Add scroll-margin-top equal to the header height on anchor targets via a custom class.
- **Requires layout**

---

## Totals (verified)

| Severity | Rules | Elements |
|---|---|---|
| Critical | 5 | 31 |
| Serious | 4 | 25 |
| Moderate | 3 | 4 |
| Minor | 1 | 2 |
| **Total** | **13** | **62** |

Matches every count in the copy ("62 issues across 13 rules", "31 of them critical").

## Rules requiring computed layout

`contrast` (1.4.3), `target` (2.5.8), `zoom` (1.4.4), `obscured` (2.4.11) — **4 of 13** — cannot be
evaluated from static HTML. Together they account for **25 of 62 elements (40%)**.

This is the empirical case for Surface D: a static-HTML DOM shim would silently under-report 40% of
the findings, including the entire contrast family, which is the product's headline capability.

## axe-core rule id mapping (to complete after Checkpoint 1)

| Prototype id | Likely axe rule id(s) |
|---|---|
| `contrast` | `color-contrast`, `color-contrast-enhanced` |
| `alt` | `image-alt`, `input-image-alt`, `area-alt`, `role-img-alt` |
| `labels` | `label`, `form-field-multiple-labels`, `select-name` |
| `keyboard` | `scrollable-region-focusable`, `focus-order-semantics` (partial — 2.1.1 is largely manual) |
| `captions` | `video-caption` |
| `linkname` | `link-name`, `identical-links-same-purpose` |
| `target` | `target-size` |
| `headings` | `heading-order`, `page-has-heading-one`, `empty-heading` |
| `focus` | *(no axe rule — needs a custom check)* |
| `landmark` | `landmark-one-main`, `region`, `bypass` |
| `lang` | `html-has-lang`, `html-lang-valid`, `valid-lang` |
| `zoom` | `meta-viewport` (partial — clipping needs a rendered check) |
| `obscured` | *(no axe rule — needs a custom check)* |

**Three rules (`focus`, `obscured`, and the clipping half of `zoom`) have no axe-core equivalent and
need custom checks written against the rendered page.** Per the brief, any axe finding without a
Webflow-specific fix written yet shows generic guidance, clearly marked.
