# Lumos Implementation Audit — webyansh.com

Audited 6 Aug 2026 against the published site. Companion to
[`lumos-variables.md`](lumos-variables.md) (raw variable dump) and
[`design-inventory.md`](design-inventory.md) (prototype extraction).

---

## 1. What is actually running

This is a full, current **Lumos v2** build — not a partial or hand-rolled approximation. All the
framework's signatures are present: the `--_theme---*` channel, the `--_text-style---*` channel,
`u-` utilities, `g_` globals, the 12-column `--column-width--*` maths, and `.u-theme-light` /
`.u-theme-dark`.

| Fact | Value |
|---|---|
| Webflow Site ID | `67fb46459daf80597440ed56` *(read from `data-wf-site`; confirm)* |
| Stylesheet | `webyansh-webflow-agency.shared.0026d52a9.min.css`, 181 KB |
| `:root` declarations | 184 in the stylesheet + 3 more `:root` blocks in site-wide custom code |
| Design width | `--site--width: 90rem` = **1440px** — matches the prototype exactly |
| Body size | `--_typography---font-size--text-main` = **15px** — matches the prototype exactly |
| Brand | `--swatch--brand: #ff4d00` — **matches the prototype accent exactly** |
| Fonts | Inter Variable Latin (primary), Inter tight Variable Latin (secondary/headings) |
| `<html lang>` | `en` — present |
| Skip link | Present: `.nav_2_skip_wrap` → "Skip to main content" |
| `role="banner"` | Present on `.nav_2_wrap` |

The prototype was clearly drawn against this site. Three of its four core colours are already live
tokens. That removes most of the integration risk.

## 2. Breakpointless — with a correction to the brief

The brief states Lumos "is breakpointless: it uses fluid `clamp()`-based variables rather than
Webflow's native breakpoints." **That is right about the intent and slightly wrong about the
mechanism.** What is actually true:

1. **There is no `clamp()` in the shared stylesheet.** Zero occurrences. The `--size--*` tokens are
   declared there as fixed rems.
2. **The fluid layer lives in site-wide custom code** — a `<style>` block in `<head>` that
   re-declares 25 tokens (`--site--margin`, `--size--1-25rem`, and `--size--2rem` → `--size--16rem`)
   as `clamp()`. Verified byte-identical on `/`, `/pricing`, `/contact` and `/tools/website-score`,
   so it is site-wide, not per page. **New pages inherit it automatically.**
3. **Webflow's native breakpoints are still in use, narrowly.** The stylesheet contains
   `max-width: 991px`, `767px` and `479px` blocks. They do two things only:
   - At **767px**, `.u-text-style-h1…h6` step down one rung (h1 borrows the h2 size, h2 borrows h3,
     and so on) and their margins change.
   - At **991px / 479px**, `--_column-count---value` changes for the grid utilities.
   Nothing else is breakpoint-conditional.
4. **The nav uses container queries, not breakpoints** — `@container (min-width: 65em)` swaps
   `.nav_2_wrap.is-desktop` / `.is-mobile`.

**Consequence for the build:** honour the brief's instruction — do not add breakpoint-specific
styles. Size everything from the `--size--*` / `--_spacing---*` scale and it is fluid for free. The
two exceptions above are framework-internal; do not extend them.

**Consequence for code components:** the `clamp()` overrides are on `:root`, so they inherit
through the shadow boundary. A component that writes `padding: var(--_spacing---space--7, 3rem)`
gets the fluid 36→48px behaviour with no extra work.

## 3. Class conventions actually in use

Four naming systems coexist. Match the one that fits what you are building.

| System | Pattern | Examples | Use for |
|---|---|---|---|
| **Utilities** | `u-` + kebab | `u-container-small`, `u-text-style-h2`, `u-vflex-left-center`, `u-radius-large`, `u-theme-dark`, `u-sr-only` | Layout, type, spacing, theming on native pages |
| **Globals** | `g_` + snake | `g_section_wrap`, `g_section_space`, `g_content`, `g_eyebrow_wrap`, `g_clickable_wrap`, `g_visual_wrap` | Page skeleton and repeated shells |
| **Components** | `name_n_part` snake | `nav_2_component`, `footer_1_layout`, `btn_main_wrap`, `form_main_field_input`, `work_card`, `timeline_item` | New components — **this is the pattern for new work** |
| **Legacy/custom-code** | BEM `__` | `comparison-row__cell`, `whatsapp-modal__btn`, `bunny-player__interface` | Pre-existing custom-code widgets. Do not extend. |

Full `u-` inventory is large (200+ classes) and covers: alignment (`u-align-items-*`,
`u-align-self-*`, `u-alignment-*`), flex shorthands (`u-hflex-{x}-{y}`, `u-vflex-{x}-{y}`),
grid (`u-grid-autofit`, `u-grid-autofill`, `u-grid-breakout`, `u-grid-subgrid`, `u-grid-from-{small|medium|large}`,
`u-column-1…12`), gap (`u-gap-0…12`, `u-gap-row-*`, `u-gap-gutter`), margin (`u-mt-*`, `u-mb-*`,
`u-margin-inline-auto`), sizing (`u-width-full`, `u-height-full`, `u-min-height-screen`,
`u-max-width-{4…80}ch`, `u-ratio-*`), text (`u-text-style-*`, `u-weight-*`, `u-text-wrap-balance|pretty`,
`u-line-clamp-1…4`, `u-text-transform-*`), colour (`u-color-25|200|300|500|600|white|faded|inherit`),
position/overflow/z-index, and **`u-sr-only`**.

**`u-sr-only` already exists** and is implemented correctly (1×1px, `clip: rect(0,0,0,0)`,
`position:absolute`, `overflow:hidden`, `white-space:nowrap`). Use it for the visually-hidden labels
the design implies — it is exactly what rule 3 (`labels`) tells users to do.

### Naming for new work

Prefix everything new so a future audit can find it in one grep:

- Components: `a11y_*` — e.g. `a11y_hero_wrap`, `a11y_score_card`, `a11y_issue_row`,
  `a11y_faq_item`.
- Anything genuinely reusable beyond this tool: propose it, don't just add it.
- **No new `u-` utilities** unless a needed one truly does not exist. The set is comprehensive.

## 4. Prototype → Lumos token mapping

### 4.1 Direct matches — use the Lumos variable, prototype hex as fallback

| Prototype | Hex | Lumos variable | Lumos value | Match |
|---|---|---|---|---|
| Accent | `#FF4D00` | `--swatch--brand` | `#ff4d00` | **Exact** |
| Text primary | `#1A1A1A` | `--swatch--dark` | `#1a1a1a` | **Exact** |
| Surface sunken | `#F6F6F6` | `--swatch--light` | `#f6f6f6` | **Exact** |
| Surface page | `#FCFCFC` | `--swatch--gray-25` | `#fcfcfc` | **Exact** |
| Surface card | `#FFFFFF` | `--swatch--white` | `white` | **Exact** |
| Inverse slab bg | `#1A1A1A` | `--swatch--dark` | `#1a1a1a` | **Exact** |
| Body size | 15px | `--_typography---font-size--text-main` | 15px | **Exact** |
| Design width | 1440px | `--site--width` | `90rem` | **Exact** |
| Radius 20px | `20px` | `--radius--large` | `1.25rem` | **Exact** |
| Radius 16px | `16px` | `--radius--main` | `1rem` | **Exact** |
| Radius 12px | `12px` | `--radius--medium` | `.75rem` | **Exact** |
| Radius 8px | `8px` | `--radius--small` | `.5rem` | **Exact** |
| Radius 4px | `4px` | `--radius--xsmall` | `.25rem` | **Exact** |
| Radius 999px | `999px` | `--radius--round` | `100vw` | Equivalent |
| Font | Inter | `--_typography---font--primary-family` | Inter Variable Latin | Equivalent |

### 4.2 Near matches — snap to Lumos, accept the small shift

| Prototype | Hex | Nearest Lumos | Lumos value | Δ | Verdict |
|---|---|---|---|---|---|
| Text secondary | `#6B6B6B` | `--swatch--gray-500` | `#737373` | +8 lightness | **Snap.** 4.74:1 on white vs 5.33:1 — still AA on white/`gray-25`. See §4.5 warning for `--swatch--light`. |
| Border strong | `#E6E6E6` | `--swatch--gray-200` | `#e5e5e5` | −1 | **Snap.** Visually identical. |
| Border default | `#EDEDED`/`#F0F0F0` | `--_theme---border` | `#1a1a1a26` over surface | ≈`#e0e0e0` | **Snap.** Theme-aware, which the flat hex is not. |
| Faintest surface | `#F7F7F7` | `--swatch--gray-50` | `#f7f7f7` | 0 | **Exact**, use for hairlines. |
| Nav link | `#4A4A4A` | `--swatch--gray-600` | `#525252` | +8 | **Snap.** 7.81:1 on white. |
| Section pad 80px | `80px` | `--_spacing---section-space--main` | 64→112px fluid | fluid | **Snap.** Gains responsiveness. |
| Section pad 40px gutter | `40px` | `--site--margin` | 16→40px fluid | fluid | **Snap.** |
| Card pad 28px | `28px` | `--_spacing---space--5` | 28→32px | fluid | **Snap.** |
| Card pad 24px | `24px` | `--_spacing---space--4` | 24px | 0 | **Exact.** |
| Gap 16px | `16px` | `--_spacing---space--3` | 16px | 0 | **Exact.** |
| Gap 12px | `12px` | `--_spacing---space--2` | 12px | 0 | **Exact.** |
| Gap 8px | `8px` | `--_spacing---space--1` | 8px | 0 | **Exact.** |
| Container 1280px | `1280px` | `--container--main` | `min(1440,100vw) − 2×margin` = 1360 @1440 | +80 | **Use `--container--small`** (≈1136px) or accept `--container--main`. Decide at Checkpoint 1. |
| Container 832px | — | `--container--xsmall` | `52rem` | — | Use for prose/statement column. |

### 4.3 No Lumos equivalent — these are the **only** new variables to propose

The live system has **no semantic status colours at all**. Every severity and tone colour in the
design is new. This is the single real gap.

**Proposed new tokens** (13 pairs + 4 dots + support). Naming follows the Lumos grammar so they sit
naturally beside the existing swatches:

| Proposed variable | Value | Source | Note |
|---|---|---|---|
| `--swatch--critical` | `#B42318` | prototype `sevMeta` | Text/icon |
| `--swatch--critical-bg` | `#FDECEA` | prototype | 5.75:1 pairing ✅ |
| `--swatch--critical-border` | `#F6CFCA` | prototype | |
| `--swatch--critical-dot` | `#D92D20` | prototype | 4.83:1 on white ✅ |
| `--swatch--serious` | `#93500B` | prototype | |
| `--swatch--serious-bg` | `#FEF3E6` | prototype | 5.65:1 ✅ |
| `--swatch--serious-border` | `#F6DFC0` | prototype | |
| `--swatch--serious-dot` | `#E07A1F` | prototype | 3.01:1 on white — marginal |
| `--swatch--moderate` | `#1049A8` | prototype | |
| `--swatch--moderate-bg` | `#EAF1FE` | prototype | 7.29:1 ✅ |
| `--swatch--moderate-dot` | `#146EF5` | prototype | 4.59:1 ✅ |
| `--swatch--minor` | `#5A5A5A` | prototype | |
| `--swatch--minor-bg` | `#F2F2F2` | prototype | 6.16:1 ✅ |
| `--swatch--minor-dot` | `#9A9A9A` | prototype | **2.81:1 — fails 3:1.** Propose `#8A8A8A` (3.28:1) |
| `--swatch--pass` | `#0E6B4E` | prototype | |
| `--swatch--pass-bg` | `#E7F5F0` | prototype | 5.79:1 ✅ |
| `--swatch--pass-border` | `#BFE5D6` | prototype | |
| `--swatch--brand-accessible` | `#B23600` | prototype (§4.6 fix copy) | 6.14:1 on white — **body-size brand text** |
| `--swatch--brand-on-dark` | `#FF7A45` | prototype | 6.73:1 on `#1a1a1a` ✅ |
| `--swatch--critical-tint` | `#FFF8F7` | prototype | before/after panel |
| `--swatch--pass-tint` | `#F7FCFA` | prototype | before/after panel |
| `--swatch--brand-tint` | `#FFF1EB` | prototype | icon tiles, active tab |
| `--swatch--brand-wash` | `#FFF6F2` | prototype | hero radial gradient stop |

**Everything else in the design maps to an existing variable.** No new spacing, radius, type, or
layout tokens are needed.

> These would be created as Webflow **site variables** so code components can read them via
> `var(--swatch--critical, #B42318)`. That is additive — no existing variable is touched.
> **Awaiting your go-ahead before creating anything in the Webflow project.**

### 4.4 Tokens to drop

| Prototype token | Why |
|---|---|
| `#ABABAB` (tertiary text) | **Fails WCAG at 2.12–2.30:1.** See §4.5. |
| `#D93F00` (accent hover) | Use `--_theme---button-primary--background-hover` (`--swatch--dark`), the live hover convention. |
| `#F4F4F4`, `#EDEDED`, `#F0F0F0` (three near-identical borders) | Collapse to `--_theme---border` + `--swatch--gray-200`. Three tokens 3px apart is noise. |
| `#B8B8B8`, `#9A9A9A`, `#FFB199` in `affected` | Sample data, not tokens. |

## 5. Accessibility findings — the tool must pass its own audit

**This is the most important section.** The tool ships a WCAG scanner. If its own pages fail
rule 1 (1.4.3 Contrast), the product is unshippable. Two token families fail today.

### 5.1 Prototype tertiary `#ABABAB` fails everywhere — blocker

| On | Ratio | Verdict |
|---|---|---|
| `#FCFCFC` page | **2.24:1** | Fail (needs 4.5) |
| `#FFFFFF` card | **2.30:1** | Fail |
| `#F6F6F6` sunken | **2.12:1** | Fail |

`#ABABAB` is used for: table column headers, "out of 100", timestamps, hint text under statement
fields, hero stat sources, `countLabel`, breadcrumbs, chevrons, "needs 4.5:1" in the checks list,
the engine strip, and ~40 other places. **All of it is real text that must be readable.**

**Resolution:** map tertiary text to `--swatch--gray-500` (`#737373`, 4.62–4.74:1 on
`gray-25`/`white`). Where the design intends a genuine third tier below secondary, use
`--swatch--gray-600` for secondary and `--swatch--gray-500` for tertiary, keeping both above 4.5:1.
Reserve `--swatch--gray-300` (`#8f8f8f`) for **non-text only** — chevrons, dividers, disabled
checkbox borders — where 3:1 applies.

### 5.2 Brand orange fails for body-size text — constraint, not blocker

| Context | Ratio | Verdict |
|---|---|---|
| `#FF4D00` on `#FFFFFF` | 3.33:1 | Fail normal text · **passes large text and non-text** |
| `#FF4D00` on `#FCFCFC` | 3.24:1 | Same |
| `#FF4D00` on `#F6F6F6` | 3.08:1 | Same |
| `#FF4D00` on `#1A1A1A` | 5.23:1 | **Passes** |

The prototype sets `a { color:#FF4D00 }` globally and uses it for body-size links —
"Read the criterion →" (13.5px), "Use" (13px), the `access@cascadeops.com` line (15.5px).

**Resolution:** three rules.
1. Brand orange is allowed for **fills** (buttons — white text on orange is a different pairing),
   **borders**, **icons**, and **text ≥24px or ≥18.66px bold**.
2. Body-size brand text on light uses `--swatch--brand-accessible` (`#B23600`, 6.14:1) — which is
   *the exact colour the prototype's own fix copy recommends*.
3. Brand orange stays as-is on dark slabs.

This is not a compromise. It is the product demonstrating its own advice.

### 5.3 Live Lumos issue: `gray-500` on `light`

`--swatch--gray-500` (`#737373`) on `--swatch--light` (`#f6f6f6`) = **4.39:1**, just under 4.5:1.
Passes on `white` (4.74) and `gray-25` (4.62).

**This is a pre-existing condition on the live site.** Per guardrail 1, I am **not** changing it.
For the new pages: use `--swatch--gray-600` for secondary text on `--swatch--light` sections, and
`--swatch--gray-500` only on white / `gray-25`. I will flag it as a finding when the tool scans
webyansh.com, which is the honest outcome.

### 5.4 What already passes

Everything on dark slabs (`#A8A8A8` 7.32:1, `#8A8A8A` 5.04:1, `#FF7A45` 6.73:1), all five
severity/tone chip pairings (5.65–7.29:1), primary text everywhere (16.1–17.4:1), and secondary
`#6B6B6B` (4.93–5.33:1).

### 5.5 Missing from both prototype and live CSS

- **No `:focus-visible` rule anywhere.** The live stylesheet declares `--focus--width` (2px),
  `--focus--offset-outer` (3px) and `--focus--offset-inner` (−2px) but I found no `:focus-visible`
  selector consuming them. The prototype has none either. The tool flags exactly this as rule 9
  (2.4.7 Focus Visible) and its own fix copy prescribes
  `:focus-visible { outline: 2px solid #FF4D00; outline-offset: 2px; }`.
  **New pages and every code component must ship a visible focus ring**, built from the existing
  `--focus--*` variables. Whether the *existing* site needs one is a separate question — flagging,
  not fixing.
- **No ARIA live region** for the async scan status. Required by the brief; must be added.

## 6. Nav and footer — reuse, do not rebuild

### 6.1 Nav — `nav_2_*`

Structure: `.nav_2_component` → `.nav_2_skip_wrap` (skip link, "Skip to main content") →
`.nav_2_wrap.is-desktop` (`role="banner"`) with `.nav_2_contain` → `.nav_2_logo_wrap` (inline SVG
wordmark, `aria-label="Home Page"`) → `.nav_2_links_component` / `.nav_2_dropdown_component`
(mega-menu with `.nav_2_dropdown_mega_*`) → `.nav_2_actions_wrap` / `.nav_2_buttons_item`.
Mobile mirror: `.nav_2_wrap.is-mobile`, `.nav_2_menu_wrap`, `.nav_2_btn_wrap` (hamburger).

Dropdowns animate via `grid-template-rows: 0fr → 1fr` with `visibility`/`opacity`, guarded by
`html:not(.wf-design-mode)`. Container-query driven at `65em`.

**Live nav top-level:** Services (12 links under `/webflow-agency/*`), Industries (11 under
`/industry/*`), Portfolio (`/case-studies`), Resources (`/blog`, `/migrations`, `/integrations`,
`/press`, `/awards-and-recognition`, `/resources`), plus `/contact-us`.

> **Finding: there is no `/tools` link in the nav or the footer.** `/tools` returns 200 but is
> orphaned — nothing on the site links to it. This matches the roadmap's note that
> `/tools/website-score` "is not surfacing in search." Adding a `Free tools` entry (as the prototype
> shows) is a nav change to an existing component, so **it needs your explicit approval** under
> guardrail 1. Flagging now; not touching it.

### 6.2 Footer — `footer_1_*`

`.footer_1_contain` → `.footer_1_layout` → `.footer_1_logo_wrap`, `.footer_social_wrap` /
`.footer_social_list` / `.footer_social_link`, `.footer_1_nav` → `.footer_1_group_list` /
`.footer_1_group_item` / `.footer_1_link_wrap`; bottom bar `.footer_1_bottom_*`.

Live footer has 43 links: social (LinkedIn, Webflow, Instagram, X, Dribbble, Behance), contact
(`tel:+916377588843`, `mailto:divyansh@webyansh.com`), Clutch and Forbes India, all 12 service
pages, all industries, `/case-studies`.

The prototype footer shows a **`Free tools`** column that does not exist live. Same call as the nav
— additive change to an existing component, needs approval.

### 6.3 Page skeleton to copy

```
.g_section_wrap  (u-theme-light | u-theme-dark)
  .g_section_space      ← variant sets top padding
    .u-container-small | .u-container-main | .u-container-xsmall
      .g_content
  .g_section_space      ← variant sets bottom padding
```

Eyebrow pattern already exists as `.g_eyebrow_wrap` / `.g_eyebrow_layout` / `.g_eyebrow_marker` /
`.g_eyebrow_text` — that is the prototype's `✦ Modules` pill. **Reuse it; do not rebuild.**

## 7. Existing route map (collision check)

| Path | Status | Note |
|---|---|---|
| `/tools` | **200** | Exists, orphaned |
| `/tools/website-score` | **200** | The orphaned AI Design Scorer |
| `/tools/accessibility` | 404 | Free |
| `/tools/color-contrast-checker` | 404 | Free |
| `/tools/wcag-compliance-checker` | 404 | Free |
| `/tools/vpat-generator` | 404 | Free |
| `/tools/accessibility-statement-generator` | 404 | Free |
| `/tools/accessibility-laws` | 404 | Free |
| `/app` | **404** | **Free — chosen mount path** |
| `/a11y` | **404** | Free (considered, not used) |

All six proposed native slugs are unoccupied, and `/app` does not collide with anything. The mount
path is set in one place — `MOUNT_PATH` in `next.config.ts` — and internal links use `next/link`,
which applies `basePath` automatically.

## 8. Carried to Checkpoint 0/1

1. **Site ID confirmation** — I read `67fb46459daf80597440ed56`; confirm it is the right project.
2. **New status variables** — approve the ~23 tokens in §4.3 before I create anything in Webflow.
3. **Container choice** — prototype 1280px sits between `--container--small` (~1136px) and
   `--container--main` (~1360px). Recommend `--container--main` for report/module screens and
   `--container--xsmall` for prose.
4. **Nav/footer `Free tools` entry** — additive but touches existing components. Needs approval.
5. **`gray-500` on `light`** (§5.3) is a live 4.39:1 finding. Confirm: flag only, change nothing.
6. **Repo** — the working directory is empty and is not a git repo. The brief says the
   `Accessibility & Compliance` repo already exists on GitHub and is connected to Webflow Cloud.
   Do I clone it here, or initialise and push?
