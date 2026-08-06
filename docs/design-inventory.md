# Design Inventory — Webyansh Accessibility & Compliance Suite

Source: `_handoff/webyansh-accessibility-compliance-suite/project/`
- `Accessibility Suite.dc.html` (14.6 KB) — prototype shell / screen switcher
- `A11yScreen.dc.html` (148.7 KB) — all screens + all data
- `roadmap.txt` (26.1 KB) — strategic rationale and honesty constraints

Read in full 6 Aug 2026. Every value below is quoted from the prototype, not inferred.

> **These are the prototype's tokens, not the final ones.** The build maps them onto live Lumos
> variables — see [`lumos-audit.md`](lumos-audit.md) §4 for the mapping table.

---

## 1. Screen inventory

The shell (`Accessibility Suite.dc.html`) declares **22 screens across 5 groups**. All render from a
single `A11yScreen` component switched on a `screen` prop plus a `device` prop (`desktop` | `mobile`).

Device base widths: **desktop 1440px**, **mobile 390px**.

| # | Group | Screen id | Label | Note (from shell) |
|---|---|---|---|---|
| 01 | Public entry | `hub` | Tool hub landing | /tools/accessibility, full site chrome |
| 02 | Public entry | `contrast` | Contrast checker, failing | Open, no email. Working colour inputs |
| 03 | Public entry | `contrast-pass` | Contrast checker, passing | Same screen, pass state |
| 04 | Public entry | `contrast-palette` | Palette sweep | Every pair in the brand system |
| 05 | Scan flow | `scan` | Scanner, first run | Empty state with alternatives |
| 06 | Scan flow | `scan-progress` | Scanning | Five-step progress, honesty note |
| 07 | Scan flow | `gate` | Email gate | Blurred report behind one field |
| 08 | Scan flow | `report-skeleton` | Report loading | Skeleton while the report renders |
| 09 | Scan flow | `report-error` | Error states | 403, robots.txt, render timeout |
| 10 | Report | `report` | Report, failing site | Score 61, 62 issues, 13 rules |
| 11 | Report | `report-issue` | Issue detail | Before and after, Webflow steps |
| 12 | Report | `report-pass` | Report, passing site | Score 94, with the caveat intact |
| 13 | Modules | `jurisdiction` | Jurisdiction mapper | Markets in, regimes and deadlines out |
| 14 | Modules | `statement` | Statement generator | Form left, live document right |
| 15 | Modules | `vpat` | VPAT 2.5 draft | 11 criteria pre-filled, 51 flagged |
| 16 | Modules | `alt` | Alt text auditor | Drafts with bulk CMS apply |
| 17 | Modules | `monitor` | Monitoring | Trend, pages, activity, schedule |
| 18 | Modules | `monitor-alert` | Regression alert | A publish broke three checks |
| 19 | Mobile | `hub` @390 | Hub, mobile | 390 wide |
| 20 | Mobile | `contrast` @390 | Contrast checker, mobile | 390 wide |
| 21 | Mobile | `gate` @390 | Email gate, mobile | 390 wide |
| 22 | Mobile | `report` @390 | Report, mobile | 390 wide |

A `gate-sent` state is referenced in the logic (`is.gateSent`) but has no screen entry and no markup —
**dead branch, do not build it.**

### 1.1 Chrome rules

- **Desktop header** (`isDesktop`): sticky, `top:0`, `z-index:40`, `rgba(255,255,255,0.86)` +
  `backdrop-filter: blur(12px)`, `border-bottom:1px solid #EDEDED`, height **68px**,
  inner `max-width:1280px; padding:0 40px`.
- **Mobile header** (`isMobile`): sticky, solid `#fff`, height **60px**, padding `0 18px`.
- **Report toolbar** (`is.toolbar`): a second sticky bar at `top:68px`, `z-index:30`, height **64px**.
  Shown on `report`, `report-issue`, `report-pass`, `report-skeleton`, `report-error`, `jurisdiction`,
  `statement`, `vpat`, `alt`, `monitor`, `monitor-alert`.
- **Footer** (`showFooter`): desktop only, and only on `hub`, `contrast`, `contrast-pass`,
  `contrast-palette`, `scan`. Never on report/module screens.
- On mobile every `is.*` flag is forced false; only four `im.*` layouts exist
  (`hub` — also serves `scan`, `contrast` — also serves `contrast-pass`, `gate`, `report` — also
  serves `report-issue`). **The other 14 screens have no mobile design and must be designed.**

### 1.2 Per-screen layout

| Screen | Layout |
|---|---|
| `hub` | Centred hero (`max-width:900px`) on `radial-gradient(70% 100% at 50% 0%, #FFF6F2 0%, #FCFCFC 70%)` → 3-col stat band (`#fff`) → 4-col module grid on `#F6F6F6` → 2-col "what this does not do" split → 4-col deadline cards → dark CTA slab (`#1A1A1A`, `radius 24px`, `padding 64px`) |
| `contrast` / `contrast-pass` | Breadcrumb → h1 + mode toggle → 2-col `1fr 1fr` grid: left = inputs + ratio + 5 checks, right = live preview + nearest passing alternatives → dark upsell slab |
| `contrast-palette` | Breadcrumb → h1 + mode toggle → 4 stat cards + legend → matrix card, `grid-template-columns:180px repeat(7,1fr)`, 44px cells |
| `scan` | Centred `max-width:760px`, icon tile → h1 → URL field → engine strip → "Or start with one of these" 3-col |
| `scan-progress` | Centred `max-width:620px`, header row → 6px progress bar at 64% → 5-step list card → honesty note on `#F6F6F6` |
| `gate` | 2-col `1fr 1fr`, `max-width:1080px`: left = blurred report preview with white gradient veil + lock line, right = email form card |
| `report-skeleton` | Same skeleton of the `report` grid: `1fr 340px` |
| `report-error` | Centred `max-width:760px`: primary error card (`border:1px solid #F6CFCA`) → "Other ways a scan can stop" list of 3 |
| `report` | `1fr 340px`. Left: score card (`220px 1fr` split) → dark coverage slab → filter bar + rule rows. Right (sticky `top:148px`): "Fix these three first" → "Take it further" → founder CTA |
| `report-issue` | `1fr 360px`. Left: issue header + before/after 2-col → "Fix it in Webflow Designer" numbered steps + code block → affected elements list. Right (sticky): pager + actions → "Why 4.5:1" → quote CTA |
| `report-pass` | `1fr 340px`. Left: score card (green 94) + amber caveat → "What is left". Right: "You can now" → "Keep it this way" |
| `jurisdiction` | `320px 1fr`. Left (sticky): markets checklist + business checklist. Right: 3 stat cards → regime table (`200px 1fr 150px 130px`) → dark case-law slab → disclaimer |
| `statement` | `400px 1fr`. Left (sticky): 6 read-only fields + Copy HTML / Download. Right: rendered document preview (`padding:44px 56px; max-width:720px`) |
| `vpat` | Full width. Header + export actions → 4 edition toggles + counts → table (`90px 1fr 190px 1fr`) → amber footer note |
| `alt` | Full width. Header + bulk apply → 4 stat cards → table (`40px 68px 1fr 150px 1fr`) → grey guidance note |
| `monitor` / `monitor-alert` | `1fr 340px`. `monitor-alert` prepends a red banner. Left: 12-bar trend chart (140px tall) → pages table (`1fr 100px 100px 110px 110px`). Right: activity timeline → schedule list → retainer CTA |

---

## 2. Design tokens (prototype)

### 2.1 Colour

**Surfaces**

| Token | Hex | Use |
|---|---|---|
| Page | `#FCFCFC` | Root background |
| Card | `#FFFFFF` | Every card, header, table body |
| Sunken | `#F6F6F6` | Alternating sections, notes, mode-toggle track |
| Toggle track | `#F2F2F2` | Segmented controls, neutral chips |
| Hover | `#FCFCFC` | Row hover on white |
| Warm tint | `#FFF1EB` | Icon tiles, active tab background |
| Hero wash | `radial-gradient(70% 100% at 50% 0%, #FFF6F2 0%, #FCFCFC 70%)` | Hub / scan / gate hero |
| Inverse | `#1A1A1A` | Dark CTA slabs, code blocks |

**Text**

| Token | Hex | Use |
|---|---|---|
| Primary | `#1A1A1A` | Headings, body |
| Secondary | `#6B6B6B` | Supporting copy, labels |
| Tertiary | `#ABABAB` | Meta, hints, timestamps |
| Muted-on-dark | `#A8A8A8` | Body on `#1A1A1A` |
| Faint-on-dark | `#8A8A8A` | Meta on `#1A1A1A` |
| Nav | `#4A4A4A` | Header nav links |
| Document body | `#3A3A3A` | Statement preview prose |

**Brand**

| Token | Hex | Use |
|---|---|---|
| Accent | `#FF4D00` | Wordmark, primary buttons, active states, links |
| Accent hover | `#D93F00` | `a:hover` |
| Accent on dark | `#FF7A45` | Icons inside dark slabs |
| Selection | `#FFD9C7` | `::selection`; also VPAT active border |
| Accent tint | `#FFF8F5` | VPAT active edition background |

**Borders**

| Token | Hex | Use |
|---|---|---|
| Strong | `#E6E6E6` | Card borders, inputs, pills |
| Medium | `#EDEDED` | Header/footer rules, inner card borders |
| Light | `#F0F0F0` | Section dividers, internal splits |
| Hairline | `#F4F4F4` | List-row separators |
| Faintest | `#F6F6F6` | Step separators |
| Disabled | `#D4D4D4` | Unchecked checkbox, chevrons |
| Chevron | `#D4D4D4` | Row affordance chevrons |

**Severity** — the canonical set, from `sevMeta()`:

| Severity | Text (`fg`) | Background (`bg`) | Dot |
|---|---|---|---|
| Critical | `#B42318` | `#FDECEA` | `#D92D20` |
| Serious | `#93500B` | `#FEF3E6` | `#E07A1F` |
| Moderate | `#1049A8` | `#EAF1FE` | `#146EF5` |
| Minor | `#5A5A5A` | `#F2F2F2` | `#9A9A9A` |

**Semantic tones** — from `T()`, used by regimes, VPAT rows, alt rows, monitor deltas, events:

| Tone | Background | Text |
|---|---|---|
| `red` | `#FDECEA` | `#B42318` |
| `amber` | `#FEF3E6` | `#93500B` |
| `green` | `#E7F5F0` | `#0E6B4E` |
| `blue` | `#EAF1FE` | `#1049A8` |
| `grey` | `#F2F2F2` | `#5A5A5A` |

**Pass/fail chips** — from `chip()`:

| State | Label | bg | fg | border | icon |
|---|---|---|---|---|---|
| Pass | `Pass` | `#E7F5F0` | `#0E6B4E` | `#BFE5D6` | `check` |
| Fail | `Fail` | `#FDECEA` | `#B42318` | `#F6CFCA` | `x` |

**Contrast verdict band** (three-way, not two):

| Condition | Label | bg | fg | border |
|---|---|---|---|---|
| `r >= 4.5` | Passes AA for body text | `#E7F5F0` | `#0E6B4E` | `#BFE5D6` |
| `r >= 3` | Fails AA for body text | `#FEF3E6` | `#93500B` | `#F6DFC0` |
| else | Fails AA and AAA | `#FDECEA` | `#B42318` | `#F6CFCA` |

**Palette-matrix cell colours** (bg / fg): `>=4.5` → `#E7F5F0` / `#0E6B4E`; `>=3` → `#FEF3E6` /
`#93500B`; else `#FDECEA` / `#B42318`.

### 2.2 Type

Family: **Inter** (`opsz 14..32`, weights 400/500/600/700) via Google Fonts, fallback
`system-ui, sans-serif`. Mono: `'Roboto Mono', ui-monospace, monospace` — used for selectors,
timestamps, URLs, code, and the affected-element list.

Base: `font-size:15px; line-height:1.5` on the root wrapper.

| Role | Size | Weight | Line-height | Letter-spacing |
|---|---|---|---|---|
| Hero h1 (hub) | 56px | 600 | 1.06 | `-0.032em` |
| Scan h1 | 44px | 600 | 1.08 | `-0.03em` |
| Section h2 | 40px | 600 | 1.12 | `-0.028em` |
| Section h2 (alt) | 38px | 600 | 1.14 | `-0.028em` |
| Page h1 (module) | 32px | 600 | 1.14 | `-0.028em` |
| Issue h1 | 32px | 600 | 1.14 | `-0.028em` |
| Error h1 | 30px | 600 | 1.15 | `-0.025em` |
| Statement h2 | 28px | 600 | — | `-0.02em` |
| Card title | 22px / 19px / 16px | 600 | — | `-0.02em` / `-0.015em` / `-0.01em` |
| Statement h3 | 18px | 600 | — | — |
| Lead paragraph | 17px / 16.5px | 400 | 1.6 | — |
| Body | 16px / 15.5px | 400 | 1.6–1.65 | — |
| UI default | 15px / 14.5px | 400–600 | 1.5 | — |
| Small / meta | 13.5px / 13px | 400–600 | 1.5–1.6 | — |
| Micro | 12.5px / 12px / 11.5px | 500–600 | — | — |
| Eyebrow (uppercase) | 13px / 12px | 600 | — | `0.06em`–`0.08em` |

**Display numerals** (the score/ratio family — distinct treatment):

| Use | Size | Weight | Letter-spacing |
|---|---|---|---|
| Report score | 68px | 600 | `-0.04em` |
| Mobile score / gate score | 56px / 44px | 600 | `-0.03em` / `-0.04em` |
| Contrast ratio (desktop) | 52px | 600 | `-0.035em` |
| Contrast ratio (mobile) | 46px | 600 | `-0.035em` |
| Hero stat | 34px | 600 | `-0.02em` |
| Jurisdiction stat | 30px | 600 | `-0.025em` |
| Palette / alt stat | 28px / 26px | 600 | `-0.02em` |
| Severity count | 26px / 21px | 600 | `-0.02em` |

Wordmark: `WEBYANSH`, weight 700, `letter-spacing:0.14em` (mobile `0.13em`), colour `#FF4D00`,
19px desktop / 16px mobile.

### 2.3 Spacing

Section padding (desktop): `80px 40px` standard, `76px 40px 64px` hub hero, `90px 40px 120px`
progress, `70px 40px 100px` gate, `56px 40px 90px` error, `32px 40px 80px` report/modules,
`44px 40px 72px` contrast.
Mobile: `26px 18px 40px` / `36px 18px 40px`.

Container widths: **1280px** (site + report + modules), **1180px** (contrast + palette),
**1080px** (gate), **900px** (hub hero), **760px** (scan, error), **720px** (statement document),
**680px / 640px / 620px / 600px / 560px / 540px / 480px** (prose measures).

Grid gaps: `64px` (hub split), `32px`, `24px` (report/module columns), `20px`, `16px`, `14px`,
`12px`, `10px`, `8px`, `6px` (matrix cells).
Flex gaps: `40px, 32px, 26px, 24px, 22px, 20px, 18px, 16px, 14px, 12px, 11px, 10px, 9px, 8px, 7px, 6px, 5px, 3px, 2px`.

Sticky offsets: header `68px`; report toolbar `top:68px`; sidebars `top:148px` (68 + 64 + 16).

### 2.4 Radii

`999px` (pills, dots, progress, avatars) · `24px` (hub CTA slab) · `20px` (primary cards) ·
`18px` (sidebar cards) · `16px` (secondary cards, inputs group, mobile cards) · `14px` (small cards,
inner panels) · `12px` (inner tiles, buttons in cards) · `11px` (primary buttons, inputs) ·
`10px` (icon tiles, list buttons) · `9px` (colour swatch inputs, tabs) · `8px` (matrix cells) ·
`7px` (chips) · `6px` (small chips, skeleton bars) · `5px` (checkboxes) · `3px` (legend swatches).

### 2.5 Shadows

| Use | Value |
|---|---|
| Search / scan input | `0 8px 24px -12px rgba(26,26,26,0.14)` |
| Mobile input | `0 8px 24px -14px rgba(26,26,26,0.16)` |
| Active segmented tab | `0 1px 2px rgba(26,26,26,0.08)` |
| Prototype stage frame | `0 24px 60px -30px rgba(0,0,0,0.8)` (shell only — not product) |

Blur: gate preview `filter: blur(3px)` at `opacity:0.55` desktop / `0.5` mobile, veiled with
`linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.9) 55%, #fff 100%)`.

### 2.6 Icons

**Lucide**, `stroke-width:1.75`. Sizes 11–24px. Full inventory used:
`chevron-down`, `chevron-right`, `wrench`, `globe`, `arrow-right`, `arrow-up-down`, `menu`,
`scan-line`, `loader`, `check`, `x`, `search`, `download`, `info`, `map`, `file-text`,
`clipboard-check`, `activity`, `check-circle-2`, `clock`, `link`, `alert-circle`, `alert-triangle`,
`unplug`, `shield-off`, `timer-off`, `gavel`, `image`, `contrast`, `lock`, `plus`.

---

## 3. Repeating component patterns

These are the reusable units. Nine patterns cover ~90% of the surface area.

1. **Eyebrow pill** — `inline-flex`, `padding:6-7px 13-14px`, `border:1px solid #E6E6E6`,
   `background:#fff`, `radius:999px`, `font-size:13-13.5px`, `color:#6B6B6B`, `weight:500`,
   prefixed by a `✦` (`&#10022;`) in `#FF4D00` at 11–12px.
2. **Severity chip** — `padding:3px 8px` (row) or `5px 11px` (detail), `radius:6px`/`7px`,
   `font-size:11.5px`/`12.5px`, `weight:600`, colours from `sevMeta()`.
3. **Stat card** — `background:#fff`, `border:1px solid #E6E6E6`, `radius:14-16px`,
   `padding:18-20px`; big numeral (26–30px, 600, `-0.02em`) over a 13.5px `#6B6B6B` label.
   Hub variant adds a 12.5px `#ABABAB` source line.
4. **Issue row** — `padding:18px 22px`, `border-bottom:1px solid #F4F4F4`, flex with a 9px severity
   dot, title + chip, mono selector (ellipsised), right-aligned level + count, `chevron-right`.
   Hover `background:#FCFCFC`.
5. **Score block** — 220px column, `border-right:1px solid #F0F0F0`, uppercase 13px `#ABABAB`
   eyebrow, 68px numeral coloured by verdict (`#B42318` fail / `#0E6B4E` pass), "out of 100",
   then a delta pill. *No circular ring — the prototype uses a plain numeral. The brief's
   "score ring" does not exist in the design; build the numeral.*
6. **Dark slab** — `background:#1A1A1A`, `radius:16-24px`, `padding:20-64px`; white 15–38px title,
   `#A8A8A8` body, `#FF4D00` button. Used for coverage caveat, founder CTA, case-law note,
   retainer CTA, hub CTA.
7. **Data table** — header row `background:#FCFCFC`, `border-bottom:1px solid #EDEDED`,
   12px uppercase `#ABABAB` `letter-spacing:0.06em`; body rows `border-bottom:1px solid #F4F4F4`,
   `padding:14-18px 22px`, explicit `grid-template-columns` per table.
8. **Checkbox row** — 19px box, `radius:5px`; on = `#FF4D00` bg + `#FF4D00` border + white `check`;
   off = `#FFFFFF` bg + `#D4D4D4` border; label `#1A1A1A` when on, `#ABABAB` when off.
9. **Segmented toggle** — track `#F2F2F2`, `radius:10-12px`, `padding:4-5px`; active pill `#fff`,
   `radius:7-9px`, `weight:600`, `box-shadow:0 1px 2px rgba(26,26,26,0.08)`; inactive `#6B6B6B`, 500.

Secondary: numbered step row (24px `#F2F2F2` circle + 15px text), timeline event (26px tone-tinted
circle + 1px `#F0F0F0` connector), progress step (20px done/active/idle indicator), skeleton bar
(`#F0F0F0` / `#F4F4F4` / `#F6F6F6` at `radius:6px`).

---

## 4. Body copy

**The copy is deliberate and carries the honesty constraints. Do not paraphrase.**

### 4.1 Hub

- Eyebrow: `Accessibility & compliance suite | Free`
- H1: `Find every accessibility issue` / `then fix it in Webflow.` (second line `#ABABAB`)
- Sub: `Scan any page against WCAG 2.1 and 2.2 AA, see which laws apply to the markets you sell into, and get the exact fix for each issue in Webflow Designer.`
- Under-field: `Free, unlimited. Email required for the full report. The contrast checker needs nothing at all.`
- Modules eyebrow `Modules`; H2 `Eight tools, one compliance workflow` (second half `#ABABAB`);
  sub `Every module runs on the same scan. Start anywhere, and the results carry across.`
- Limits eyebrow: `What this tool does not do`
- Limits H2: `Automated scanning catches about a third of WCAG.`
- Limits body 1: `No scanner can confirm that a page is compliant, and any tool that says otherwise is selling you something. Roughly two thirds of the success criteria need a human to judge them: reading order, meaningful alt text, error recovery, and whether a keyboard user can actually finish the task.`
- Limits body 2: `We tell you exactly which criteria were tested, which were not, and what a manual audit would add.`
- Coverage card title: `Coverage of WCAG 2.2 AA criteria`
- Deadlines eyebrow `Deadlines`; H2 `The dates are already on the calendar`;
  sub `Which of these apply depends on where you sell and who you sell to. The jurisdiction mapper works it out from your markets.`
- CTA H2: `Finding the issues is the easy part`
- CTA body: `We are a Webflow design and development studio. If the scan turns up more than you want to handle, we will remediate the site, ship the fixes, and keep it compliant on a retainer.`
- Buttons: `Book a call`, `Request a quote`, `Run free scan`, `Free tools`

**Hero stats** (`heroStats`)

| Figure | Label | Source |
|---|---|---|
| `95.9%` | of the top million homepages fail automated ADA checks | WebAIM Million, 2026 |
| `56.1` | average WCAG failures found per homepage | WebAIM Million, 2026 |
| `26 Apr 2027` | ADA Title II deadline for large public entities | US Department of Justice |

**Coverage bars** (`coverage`)

| Label | % | Colour | Note |
|---|---|---|---|
| Detected automatically | 33% | `#FF4D00` | Contrast, alt attributes, labels, landmarks, ARIA validity, target size |
| Needs a human reviewer | 67% | `#1A1A1A` | Reading order, meaningful alt text, keyboard task completion, error recovery |
| Covered in a Webyansh manual audit | 100% | `#146EF5` | Screen reader passes on NVDA, VoiceOver and JAWS, plus keyboard-only walkthroughs |

**Modules** (`modules`) — name / description / tag / icon

| Name | Description | Tag | Icon |
|---|---|---|---|
| Colour contrast checker | Any pair against AA and AAA, plus a palette-wide sweep that flags every failing combination in a brand system. | No email needed | `contrast` |
| WCAG 2.1 and 2.2 scanner | Full page audit with severity, the success criterion at fault, and the element that broke it. | axe-core engine | `scan-line` |
| Webflow remediation steps | Each issue mapped to the panel, class and setting in Webflow Designer that fixes it. | Webflow-native | `wrench` |
| Jurisdiction mapper | Pick the markets you sell into and see which regimes bind you, with the deadline for each. | ADA, EAA, EN 301 549 | `map` |
| Accessibility statement | Generates the statement the EAA requires, populated from your own scan results. | Required by law in the EU | `file-text` |
| VPAT and ACR draft | Fills a Voluntary Product Accessibility Template so procurement stops blocking the deal. | Section 508 ready | `clipboard-check` |
| Alt text auditor | Finds missing and unhelpful alt text, drafts replacements, applies them to a CMS collection. | Bulk CMS apply | `image` |
| Continuous monitoring | Scheduled re-scans with an alert the moment a publish breaks something that used to pass. | Retainer clients | `activity` |

**Deadlines** (`deadlines`)

| Status chip | Date | Law | Who |
|---|---|---|---|
| In force (red) | 28 Jun 2025 | European Accessibility Act | Any business selling to EU consumers, wherever it is based. |
| In force (red) | Ongoing | ADA Title III | Private businesses open to the US public. Enforced through litigation. |
| 8 months (amber) | 26 Apr 2027 | ADA Title II | US public entities with 50,000 people or more. |
| 20 months (grey) | 26 Apr 2028 | ADA Title II | Smaller US public entities and special districts. |

### 4.2 Contrast checker

- H1 `Colour contrast checker`; sub `Check any foreground and background pair against WCAG 2.2 AA and AAA. Nothing to sign up for, no limit on how many you run.`
- Modes: `Single pair` / `Whole palette`
- Labels: `Foreground` (`Text`), `Background` (`Surface`), `Contrast ratio`, `Live preview`,
  `Nearest passing alternatives`
- Preview specimen: `Route freight in real time` / `Body copy at 16 pixels. This is the size that has to clear 4.5 to 1, and it is the size most brand palettes quietly fail on.` / `Small print at 13 pixels, the size used for form hints, table captions and footnotes.` / `Secondary button` / `A text link`
- Upsell: `One pair is a start. Your live site has 14 failing text nodes.` /
  `Run the full scan to find every one of them, with the Webflow fix for each.` / `Scan a page`
- Suggestion notes: `Closest darker tint that passes AA`, `Passes AAA for body text`,
  `Brand ink, safe at every size`

**The five checks** (`checks`) — label / threshold:

| Label | Needs |
|---|---|
| `AA · Normal text` | 4.5:1 |
| `AA · Large text (18.66px bold, 24px)` | 3:1 |
| `AAA · Normal text` | 7:1 |
| `AAA · Large text` | 4.5:1 |
| `UI components and graphics` | 3:1 |

**Palette sweep**: H1 `Palette sweep`; sub `Every colour in the system checked against every other. Cells show the ratio for normal text at AA.` Stats: `21` `pairs below 4.5:1`, `7` `colours in the palette`, `Orange 300` `worst offender, fails on 5 of 7`. Legend: `AA`, `Large only`, `Fail`. Row header `Text on →`.

Palette (`paletteColors`): `Orange 500 #FF4D00`, `Orange 300 #FF7A45`, `Ink 900 #1A1A1A`,
`Grey 500 #6B6B6B`, `Grey 300 #ABABAB`, `Surface #F6F6F6`, `White #FFFFFF`.

### 4.3 Scan + progress

- H1 `Scan a page for WCAG 2.2 issues`; sub `Paste any public URL. The scan takes about twenty seconds and checks 62 automated rules.`
- Engine strip: `WCAG 2.2 AA` · `axe-core 4.10` · `We respect robots.txt`
- Alternatives eyebrow `Or start with one of these`: `Contrast checker` / `One pair, instantly. No URL needed.`; `Jurisdiction mapper` / `Find out which laws bind you before you scan.`; `See a sample report` / `A real scan of a real site, no email.`
- Progress header: `Scanning cascadeops.com/pricing` / `Usually finishes in under 20 seconds`

**Five progress steps** (`progress`) — the async contract:

| # | Label | State | Note |
|---|---|---|---|
| 1 | Fetching page | done | 1.2s |
| 2 | Rendering with a headless browser | done | 3.4s |
| 3 | Running axe-core against WCAG 2.2 AA | active | 62 rules |
| 4 | Measuring contrast on every text node | idle | — |
| 5 | Mapping issues to Webflow fixes | idle | — |

- Honesty note: **`While you wait.`** `Automated rules cover roughly a third of WCAG. The report will tell you exactly which criteria were tested and which still need a person.`

### 4.4 Email gate

- Badge `Scan finished in 18.4s`; H2 `Your report is ready`
- Body: `We found **62 issues across 13 rules**, 31 of them critical. Tell us where to send it and the full report opens straight away.`
- Field `Work email`, placeholder `you@company.com`
- Opt-in: `Also send me a monthly re-scan of this page. Unsubscribe in one click.`
- Button `Open the full report`
- Footnote: `One email, no drip sequence, no reselling your address. The contrast checker stays free and ungated either way.`
- Blur overlay line: `62 issues across 13 rules are waiting behind this`

### 4.5 Report

- Eyebrow `Automated score`; `61` `out of 100`; delta pill `Below the 2026 median of 74`
- `62 issues across 13 rules`
- Body: `Every issue below is tied to the WCAG success criterion it breaks and the element that broke it. Nine of the thirteen are fixable in Webflow Designer without touching custom code.`
- **Coverage slab** (the legal caveat, verbatim): title `This scan covers about a third of WCAG 2.2 AA`; body `21 of the 62 criteria can be judged by software. The rest need a person: reading order, whether alt text is meaningful, whether a keyboard user can finish the task. We will not tell you that you are compliant, because no scanner can.`; figure `33%` / `automated coverage`
- Filters: `All 13 rules`, `Critical`, `Serious`, `Moderate`, `Minor`, `WCAG 2.2 only`; search placeholder `Filter issues`
- Sidebar `Fix these three first` / `Ranked by severity and how many people they affect.`
  (efforts `30 min`, `2 hours`, `45 min`)
- `Take it further`: `Which laws apply to us`, `Generate a statement`, `Draft a VPAT`, `Monitor this page weekly`
- Founder card: `Divyansh Agarwal` / `Founder, Webyansh` / `Twenty minutes on a call and I will tell you which of these 62 we can clear in a week, and what a full remediation would cost.` / `Book a call`
- Toolbar meta: `Scanned 6 Aug 2026, 14:32 · axe-core 4.10 · WCAG 2.2 AA`; tabs `Overview`,
  `Jurisdictions`, `Alt text`, `Statement`, `VPAT`, `Monitoring`; actions `PDF`, `Request a quote`, `Book a call`

**Passing report**: score `94`, pill `Up 33 points since June`, `3 issues across 2 rules`;
body `Every critical and serious issue from the June scan has been cleared. What is left is two moderate and minor findings that will not block a procurement review.`;
amber caveat **`A clean automated scan is not compliance.`** `Two thirds of WCAG still needs a manual audit before you can claim conformance in a statement or a VPAT.`;
`What is left`; footer `11 rules passed, including all 5 that were critical in June.`;
`You can now` / `A score in this range is enough to start the paperwork.` →
`Publish an accessibility statement` (`Required by the EAA`), `Draft the VPAT` (`For procurement reviews`), `Book a manual audit` (`The other two thirds`);
`Keep it this way` / `One careless publish undoes months of work. Weekly scans with an alert the moment something regresses.` / `Start monitoring`

### 4.6 Issue detail

- Chips: `Critical`, `WCAG 1.4.3 · Level AA`, `Fixable in Designer`
- H1 `Text has insufficient colour contrast`
- Body: `Foreground and background do not reach a 4.5:1 ratio for body text. The secondary button uses #FF7A45 on #FFFFFF, which measures 2.59:1. Low vision users, and anyone reading in sunlight, will lose the label entirely.`
- Before/after: `Now · 2.59:1` (border `#F6CFCA`, bg `#FFF8F7`) vs `Suggested · 6.14:1`
  (border `#BFE5D6`, bg `#F7FCFA`), specimen `Talk to sales`
- Fix card: `Fix it in Webflow Designer`, `About 30 minutes`; code block comment
  `/* If you prefer custom code */` then `.btn-secondary { color: #B23600; border-color: #B23600; }`
- `14 affected elements`
- Sidebar: `Issue 1 of 13`, `Previous` / `Next issue`, `Mark as fixed`, `Snooze until next scan`,
  `Copy link for a developer`
- `Why 4.5:1` / `The ratio approximates the contrast loss of 20/40 vision, roughly what a typical 80 year old sees. Large text gets a lower bar of 3:1 because size compensates.` / `Read the criterion →`
- `Want us to just do it?` / `We remediate Webflow sites and hand back a passing scan, usually inside two weeks.` / `Request a quote`

**Affected elements** (`affected`)

| Selector | Text | fg | Ratio |
|---|---|---|---|
| `section.pricing > .btn-secondary` | "Talk to sales" | `#FF7A45` | 2.71:1 |
| `.pricing-card__note` | "Billed annually, cancel any time" | `#ABABAB` | 2.32:1 |
| `footer .footer__link (10 instances)` | "Careers", "Press", "Status" and 7 more | `#9A9A9A` | 2.85:1 |
| `.faq__answer p em` | "Prices exclude local tax" | `#B8B8B8` | 1.98:1 |
| `.badge--beta` | "Beta" | `#FFB199` | 1.62:1 |

### 4.7 Error states (`errors`)

| Icon | Title | Body | Fix | CTA |
|---|---|---|---|---|
| `unplug` | We could not reach that URL | The server returned a 403 before the page rendered. This usually means a firewall or bot protection is blocking our crawler. | Allowlist WebyanshBot in Cloudflare, or paste the HTML directly. | Try another URL |
| `shield-off` | robots.txt blocks this path | cascadeops.com/robots.txt disallows /app/ for all user agents. We respect robots.txt and will not scan it. | Scan a public page instead, or add an allow rule for WebyanshBot. | Scan the homepage |
| `timer-off` | The page did not finish loading | Rendering timed out after 30 seconds. Heavy client-side apps sometimes need longer than a single-page scan allows. | We can queue a slow scan and email you when it is done. | Queue a slow scan |

Primary error card also shows: `GET https://cascadeops.com/pricing → 403 Forbidden`, buttons
`Try another URL` / `Paste HTML instead`, and `Or allowlist WebyanshBot in Cloudflare and run it again.`
Section heading: `Other ways a scan can stop`.

> **Crawler user-agent is named `WebyanshBot` in three places.** That string is a product commitment.

### 4.8 Jurisdiction mapper

- H1 `Which laws apply to you`; sub `Tell us where you sell and who you sell to. This is a starting point for a conversation with counsel, not legal advice.`
- Panels: `Markets served`, `About the business`
- Markets: `United States` ✓, `European Union` ✓, `United Kingdom`, `Canada (Ontario)` ✓, `Australia`
- Sectors: `Private business` ✓, `Public sector body`, `Sells to US federal government` ✓,
  `Banking, e-commerce or transport` ✓
- Stats: `5` `regimes bind you today` · `WCAG 2.1 AA` `the strictest common baseline` · `Yes` `a public statement is mandatory`
- Table columns: `Regime`, `What it means for you`, `Standard`, `Deadline`

**Regimes** (`regimes`)

| Law | Region | Status | Deadline | Standard | Note | Tone |
|---|---|---|---|---|---|---|
| ADA Title III | United States | Applies now | In force | WCAG 2.1 AA in practice | Enforced through private litigation. There is no certification and no safe harbour. | red |
| Section 508 | United States | Applies now | In force | Revised 508, WCAG 2.0 AA | Triggered because you sell to a federal agency. Procurement will ask for a VPAT. | red |
| European Accessibility Act | European Union | Applies now | 28 Jun 2025 | EN 301 549, WCAG 2.1 AA | Binds any business selling to EU consumers regardless of where it is based. An accessibility statement is mandatory. | red |
| EN 301 549 | European Union | Applies now | In force | WCAG 2.1 AA baseline | The harmonised standard the EAA is measured against. | red |
| AODA | Ontario, Canada | Applies now | In force since 1 Jan 2021 | WCAG 2.0 AA | Organisations with 50 or more employees must also file a compliance report. | amber |
| ADA Title II | United States | Does not apply | 26 Apr 2027 | WCAG 2.1 AA | Public entities only. Listed because it drives the wider US enforcement climate. | grey |

- Case-law slab: `Partial compliance is not a legal position` /
  `In June 2026 a French court ordered Carrefour to reach full compliance under a EUR 500 per day penalty, explicitly rejecting a 71% conformance score as insufficient. Partial compliance is not a legal position.`
- Disclaimer: `This mapping is generated from the markets you selected and is provided for planning. It is not legal advice. Have the wording reviewed by counsel before you rely on it.`

### 4.9 Statement generator

- H1 `Accessibility statement`; sub `The EAA requires a published statement with a working feedback channel. This one is populated from your latest scan, so the known issues section stays honest.`
- Actions `Copy HTML`, `Download`; preview modes `Rendered` / `HTML`

**Fields** (`statementFields`)

| Label | Value | Hint |
|---|---|---|
| Organisation | Cascade Ops Inc. | Appears in the first line of the statement |
| Conformance target | WCAG 2.2 level AA | The standard you are measuring against |
| Current status | Partially conformant | Set from your latest scan. Do not overstate this. |
| Contact for accessibility issues | access@cascadeops.com | The EAA requires a working feedback channel |
| Assessment method | Automated scan and manual audit | Self-assessment, third-party audit, or both |
| Last reviewed | 6 August 2026 | Review at least once a year |

**Document template** — H2 `Accessibility statement for {Organisation}`, `Last reviewed {date}`, then:

- Intro: `{Org} is committed to making {domain} accessible to everyone, including people with disabilities. We are working towards conformance with the Web Content Accessibility Guidelines version 2.2, level AA.`
- `Conformance status`: `This website is **partially conformant** with WCAG 2.2 level AA. Partially conformant means that some parts of the content do not fully conform to the standard.`
- `Known limitations` (from scan): e.g. `Colour contrast on secondary buttons and footer links falls below 4.5:1. Fix scheduled for 20 August 2026.` / `Nine blog thumbnails carry no alternative text. Being written now.` / `The testimonial video has no captions. A caption track is in production.`
- `Feedback`: `If you encounter a barrier on this site, email {contact}. We aim to respond within five working days.`
- `Assessment approach`: `{Org} assessed the accessibility of this website by a combination of automated scanning and manual review. Automated testing covers approximately one third of the WCAG success criteria; the remainder were reviewed by hand.`

### 4.10 VPAT

- H1 `VPAT 2.5 draft`; sub `Pre-filled from the scan. Every row still needs a human to confirm it before you send this to a procurement team.`
- Actions `Export .docx`, `Have Webyansh complete it`
- Editions: `WCAG edition` ✓, `Section 508 edition` ✓, `EU edition (EN 301 549)`, `INT edition`
- Counts: `11 criteria pre-filled` · `51 remaining need review`
- Columns: `Criterion`, `Name`, `Conformance level`, `Remarks and explanations`
- Footer: `51 criteria could not be evaluated automatically and are marked **Not evaluated**. Sending a VPAT with unverified rows is a bigger risk than sending one that admits gaps.`

**Rows** (`vpatRows`)

| SC | Name | Level | Conformance | Remark | Tone |
|---|---|---|---|---|---|
| 1.1.1 | Non-text Content | A | Partially supports | Nine images inside the blog collection have no alt attribute. Static images are covered. | amber |
| 1.2.2 | Captions (Prerecorded) | A | Does not support | The testimonial video has no caption track. | red |
| 1.3.1 | Info and Relationships | A | Partially supports | Heading levels skip from h2 to h4 in three sections. No main landmark. | amber |
| 1.4.3 | Contrast (Minimum) | AA | Does not support | 14 text nodes measure below 4.5:1, the lowest at 2.59:1. | red |
| 2.1.1 | Keyboard | A | Does not support | Three controls built as divs cannot be reached by keyboard. | red |
| 2.4.4 | Link Purpose (In Context) | A | Partially supports | Eleven links read as "Read more". | amber |
| 2.4.7 | Focus Visible | AA | Does not support | A global reset removes the focus indicator. | red |
| 2.5.8 | Target Size (Minimum) | AA | Partially supports | Footer social links measure 18 by 18 pixels. | amber |
| 3.1.1 | Language of Page | A | Does not support | The html element has no lang attribute. | red |
| 3.3.2 | Labels or Instructions | A | Does not support | Four inputs rely on placeholder text alone. | red |
| 4.1.2 | Name, Role, Value | A | Supports | No ARIA violations detected. | green |

Conformance vocabulary: `Supports`, `Partially supports`, `Does not support`, `Not evaluated`.

### 4.11 Alt text auditor

- H1 `Alt text auditor`; sub `Missing and unhelpful alt text, with a drafted replacement for each. Review every line before applying. A wrong description is worse than none.`
- `5 of 7 selected`; button `Apply to Webflow CMS`
- Stats: `3` missing entirely (red) · `2` unhelpful, such as "image" (amber) · `1` decorative, should be empty (blue) · `1` already good (green)
- Columns: `Image`, `File and location`, `Status`, `Drafted alt text`
- Statuses: `Missing`, `Unhelpful`, `Should be empty`, `Good`
- Empty draft renders as italic `#ABABAB` `(empty alt, decorative)`
- Guidance: `Drafts are generated from the image, the surrounding copy and the page title. They are a starting point. Alt text depends on why the image is there, and only you know that. Decorative images should carry an empty alt attribute rather than a description.`

**Rows** (`altRows`)

| File | Where | Status | Current | Draft |
|---|---|---|---|---|
| hero-dashboard-dark.avif | Static, homepage hero | Missing | — | The Cascade Ops dashboard showing live shipment routes across North America. |
| blog/warehouse-robotics.avif | CMS, Blog posts, Thumbnail | Missing | — | Robotic arms sorting parcels on a warehouse conveyor line. |
| blog/cold-chain.avif | CMS, Blog posts, Thumbnail | Missing | — | A refrigerated trailer being loaded at a distribution centre. |
| logo-acme.svg | Static, logo strip | Unhelpful | image | Acme Logistics |
| icon-arrow-right.svg | Static, button icon | Should be empty | arrow | *(empty)* |
| team-photo-2026.avif | Static, about section | Unhelpful | IMG_4821 | The Cascade Ops team of eleven standing outside the Denver office. |
| og-share-card.png | Static, decorative | Good | Cascade Ops brand card | Cascade Ops brand card |

### 4.12 Monitoring

- Chart title `Score across 5 monitored pages` / `Weekly scans since May 2026`; ranges `12 weeks` / `6 months`; axis `18 May` → `4 Aug`
- Trend series: `72, 74, 74, 76, 79, 81, 80, 83, 84, 84, 70, 68` — bars 11 and 12 in `#D92D20`, rest `#1A1A1A`, height = `value × 1.4` px
- Table columns: `Page`, `Score`, `Change`, `Issues`, `Last scan`

| Page | Score | Change | Issues | Last scan |
|---|---|---|---|---|
| `/` | 82 | +4 (green) | 6 | 2h ago |
| `/pricing` | 61 | -14 (red) | 24 | 2h ago |
| `/blog` | 74 | 0 (grey) | 11 | 2h ago |
| `/contact` | 88 | +1 (green) | 3 | 2h ago |
| `/product/routing` | 70 | -2 (amber) | 14 | 2h ago |

**Activity** (`events`)

| When | Title | Detail | Tone / icon |
|---|---|---|---|
| 4 Aug, 09:14 | Publish broke 3 checks that previously passed | Pricing page. Focus indicator removed globally, two inputs lost their labels. | red / `alert-triangle` |
| 28 Jul, 11:02 | Contrast fixed on 14 elements | Secondary button and footer links moved to #B23600. | green / `check` |
| 21 Jul, 08:00 | Weekly scan completed, no change | 5 pages, 58 issues, score held at 84. | grey / `activity` |
| 14 Jul, 08:00 | New page added to monitoring | /product/routing picked up from the sitemap. | grey / `plus` |

**Schedule**: `Frequency` `Weekly, Mondays` · `On publish` `Scan within 5 min` · `Alert to` `3 recipients` · `Digest` `Monday 09:00 IST`

**Regression banner**: `A publish on 4 August broke 3 checks that used to pass` /
`The pricing page lost its global focus indicator and two form inputs lost their labels. The score dropped 14 points in one deploy.` / `See the diff` / `Get it fixed`

**Retainer CTA**: `Monitoring is part of our support retainer` / `We watch the scans, and when a publish breaks something we fix it before you hear about it from a customer.` / `Book a call`

### 4.13 Footer (prototype)

Columns: brand + address + contact · `Free tools` (Contrast checker, WCAG scanner, Jurisdiction
mapper, Statement generator, VPAT draft, Alt text auditor) · `Services` · `Company`.
Legal row: `© 2026 Webyansh. All rights reserved.` · `Privacy policy` · `Terms and conditions` ·
`Accessibility statement`.

> The prototype footer is **not** the live footer. See [`lumos-audit.md`](lumos-audit.md) §5 — reuse
> the live `footer_1_*` component and add a `Free tools` column to it rather than rebuilding.

---

## 5. Behaviour extracted from the prototype logic

### 5.1 Contrast maths (correct as written — port verbatim)

```js
hex2rgb(h)  // handles #abc and #aabbcc, pads short/invalid to 6, NaN→0
lum(h)      // sRGB → linear: c <= 0.03928 ? c/12.92 : ((c+0.055)/1.055)^2.4
            // 0.2126 R + 0.7152 G + 0.0722 B
ratio(a,b)  // (max(L)+0.05) / (min(L)+0.05)
```

This is the WCAG 2.x relative-luminance definition and is correct. Display is
`Math.round(r*100)/100` then `.toFixed(2)` + `':1'`.

**Suggestion algorithm**: multiply the foreground RGB by `k = 1 - step/100` for `step` in
`0,4,8,…100`; take the first candidate reaching 4.5:1 (`Closest darker tint that passes AA`), then
the first reaching 7:1 (`Passes AAA for body text`); always append `#1A1A1A`
(`Brand ink, safe at every size`).

> Known limits to fix in the build: it only darkens (never lightens, so it fails on dark
> backgrounds), and the loop's `if` conditions can emit fewer than 2 suggestions. Rewrite to search
> both directions in a perceptual space and always return 3.

**Matrix**: `paletteColors × paletteColors`, cell shows `ratio.toFixed(1)` when `>= 1.02`, else `—`
(the identity diagonal). `failingPairs` is hardcoded to `21` — compute it in the build.

### 5.2 Score / severity derivation

`total = Σ rule.count` (= 62). `bySev` groups the 13 rules into the four severities, summing
`count` and counting distinct rules. Score `61` is presented, not computed — **the scoring formula
does not exist in the prototype and must be designed** (and published on a methodology page, per
the roadmap).

### 5.3 The 13 rules

Extracted verbatim to `docs/rules-extracted.md` and later `src/rules/`. Summary:

| # | id | SC | Level | Severity | Count | Selector |
|---|---|---|---|---|---|---|
| 1 | `contrast` | 1.4.3 | AA | Critical | 14 | `.btn-secondary, .footer__link, .pricing-card__note` |
| 2 | `alt` | 1.1.1 | A | Critical | 9 | Blog posts collection, thumbnail field |
| 3 | `labels` | 3.3.2 | A | Critical | 4 | `#newsletter-email, #contact-name, #contact-phone, #search` |
| 4 | `keyboard` | 2.1.1 | A | Critical | 3 | `.faq-toggle, .filter-chip, .video-play` |
| 5 | `captions` | 1.2.2 | A | Critical | 1 | `.testimonial-video` |
| 6 | `linkname` | 2.4.4 | A | Serious | 11 | `a.card__cta ("Read more")` |
| 7 | `target` | 2.5.8 | AA | Serious | 7 | `.footer__social a, .table__sort` |
| 8 | `headings` | 1.3.1 | A | Serious | 6 | h2 followed by h4 in three sections |
| 9 | `focus` | 2.4.7 | AA | Serious | 1 | `Global: *:focus { outline: none }` |
| 10 | `landmark` | 1.3.1 | A | Moderate | 1 | `body > div.page-wrapper` |
| 11 | `lang` | 3.1.1 | A | Moderate | 1 | `<html>` |
| 12 | `zoom` | 1.4.4 | AA | Moderate | 2 | `.hero__eyebrow, .nav__cta` |
| 13 | `obscured` | 2.4.11 | AA | Minor | 2 | `.section-anchor targets` |

Totals check out: Critical 31, Serious 25, Moderate 4, Minor 2 = **62**. Rules by severity:
Critical 5, Serious 4, Moderate 3, Minor 1 = **13**. Consistent with the copy.

Every rule carries a `why` (plain English) and `wf` (an ordered array of Webflow Designer steps).
**Rule 2 (`alt`) is the CMS-aware case** — its copy explicitly says "Six of them are inside a CMS
collection list, so the fix belongs on the field, not the element." That behaviour is a product
requirement, not a nicety.

---

## 6. Gaps the prototype does not answer

Carried to Checkpoint 0/1 rather than guessed:

1. **No score formula.** 61 and 94 are literals.
2. **No mobile design for 14 of 18 screens.**
3. **No focus-visible styles anywhere in the prototype.** The tool must ship them (it flags their
   absence as rule 9).
4. **No ARIA live region** on the progress screen, though the brief requires one.
5. **`gate-sent` is a dead state.**
6. **`failingPairs: 21` is hardcoded** and does not match a computed sweep of the 7 listed colours.
7. **No empty/zero-issue state for the alt auditor, VPAT, or jurisdiction mapper.**
8. **Score "ring"** referenced in the brief does not exist — the design uses a plain numeral.
