# Lumos Variables — webyansh.com (live)

Parsed 6 Aug 2026 from the published site.

**Sources**
1. Shared stylesheet — `https://cdn.prod.website-files.com/67fb46459daf80597440ed56/css/webyansh-webflow-agency.shared.0026d52a9.min.css` (181,389 bytes). Contains the `:root` block with **184 declarations**.
2. Three additional `:root` blocks (column maths, fluid `clamp()` overrides, nav component tokens). Verified present on `/`, `/pricing`, `/contact`, `/tools/website-score`.
   **Corrected 7 Aug 2026:** these render in `<body>`, not `<head>`. They are delivered by the **"Custom Code"** Webflow component (`89894b6d-cf3f-dfb6-51d8-63b0d19309e1`), which is placed on each page — not by Project Settings custom code. A new page that omits that component loses the fluid scale entirely. See [`lumos-audit.md`](lumos-audit.md) §2.

**Webflow Site ID (read from `data-wf-site`): `67fb46459daf80597440ed56`** — needs your confirmation.

Naming grammar: `--namespace--token` for public tokens, `--_namespace---token` (leading underscore,
triple dash) for internal/derived tokens that other tokens resolve through. Component tokens use
`--component--token` (e.g. `--nav_2--height`).

---

## 1. Swatches — raw colour primitives

| Variable | Value | Purpose |
|---|---|---|
| `--swatch--brand` | `#ff4d00` | Brand orange. **Identical to the prototype accent.** |
| `--swatch--brand-text` | `var(--swatch--dark)` | Text colour to place *on* brand fills |
| `--swatch--dark` | `#1a1a1a` | Ink. **Identical to prototype `#1A1A1A`.** |
| `--swatch--light` | `#f6f6f6` | Light surface. **Identical to prototype sunken `#F6F6F6`.** |
| `--swatch--white` | `white` | Pure white |
| `--swatch--gray-25` | `#fcfcfc` | **Identical to prototype page `#FCFCFC`.** |
| `--swatch--gray-50` | `#f7f7f7` | Faintest grey |
| `--swatch--gray-100` | `whitesmoke` (`#f5f5f5`) | Very light grey |
| `--swatch--gray-200` | `#e5e5e5` | Border grey |
| `--swatch--gray-300` | `#8f8f8f` | Mid grey |
| `--swatch--gray-500` | `#737373` | Secondary text grey |
| `--swatch--gray-600` | `#525252` | Strong secondary text |
| `--swatch--dark-faded` | `#1a1a1a26` | Ink @ 15% — default border on light |
| `--swatch--light-faded` | `#e9eaeb26` | Light @ 15% — default border on dark |
| `--swatch--transparent` | `transparent` | — |

> There is **no green, red, amber or blue swatch** in the live system. All five severity/tone
> families from the prototype are new. See [`lumos-audit.md`](lumos-audit.md) §4.2.

## 2. Theme tokens — resolved through `.u-theme-light` / `.u-theme-dark`

`:root` defaults to the light theme. Both theme classes set `background-color` and `color` and then
re-point every token below, so **any subtree can flip theme by class**.

| Variable | Light | Dark |
|---|---|---|
| `--_theme---background` | `var(--swatch--light)` | `var(--swatch--dark)` |
| `--_theme---text` | `var(--swatch--dark)` | `var(--swatch--light)` |
| `--_theme---border` | `var(--swatch--dark-faded)` | `var(--swatch--light-faded)` |
| `--_theme---white` | `white` | `var(--swatch--dark)` |
| `--_theme---button-primary--background` | `var(--swatch--brand)` | `var(--swatch--brand)` |
| `--_theme---button-primary--background-hover` | `var(--swatch--dark)` | — |
| `--_theme---button-primary--border` | `var(--swatch--brand)` | `var(--swatch--brand)` |
| `--_theme---button-primary--border-hover` | `var(--swatch--dark)` | — |
| `--_theme---button-primary--text` | `var(--swatch--light)` | `var(--swatch--light)` |
| `--_theme---button-primary--text-hover` | `var(--swatch--light)` | — |
| `--_theme---button-primary--white` | `white` | — |
| `--_theme---button-secondary--background` | `var(--swatch--light)` | — |
| `--_theme---button-secondary--background-hover` | `var(--swatch--dark)` | — |
| `--_theme---button-secondary--border` | `var(--swatch--dark-faded)` | — |
| `--_theme---button-secondary--border-hover` | `var(--swatch--dark)` | `var(--swatch--light)` |
| `--_theme---button-secondary--text` | `var(--swatch--dark)` | — |
| `--_theme---button-secondary--text-hover` | `var(--swatch--light)` | — |
| `--_theme---button-secondary--white` | `white` | — |

Button style tokens (`--_button-style---background|border|text|*-hover|white`) alias the
`button-primary` set at `:root` and are re-pointed per button variant.

## 3. Size scale — the fluid engine

`--size--*` are declared as fixed rems in the stylesheet, then **25 of them are overridden with
`clamp()` in site-wide custom code**. That override is what makes the site fluid.

### 3.1 Fixed (never fluid) — small end

| Variable | Value |
|---|---|
| `--size--0rem` | `0rem` |
| `--size--0-125rem` | `.125rem` (2px) |
| `--size--0-25rem` | `.25rem` (4px) |
| `--size--0-375rem` | `.375rem` (6px) |
| `--size--0-5rem` | `.5rem` (8px) |
| `--size--0-6875rem` | `.6875rem` (11px) |
| `--size--0-75rem` | `.75rem` (12px) |
| `--size--0-875rem` | `.875rem` (14px) |
| `--size--0-9375rem` | `.9375rem` (15px) |
| `--size--1rem` | `1rem` (16px) |
| `--size--1-125rem` | `1.125rem` (18px) |
| `--size--1-5rem` | `1.5rem` (24px) |
| `--size--1-75rem` | `1.75rem` (28px) |

### 3.2 Fluid — overridden with `clamp()` site-wide

Formula shape: `clamp(min, base + slope·vw, max)`. Interpolation band is **~768px → ~1440px**
(slope `2.142857vw` ≈ 1.5rem gain over 672px). Max always equals the nominal token name.

| Variable | Fluid value | Renders |
|---|---|---|
| `--site--margin` | `clamp(1rem, 0.5714286rem + 2.1428571vw, 2.5rem)` | 16px → 40px |
| `--size--1-25rem` | `clamp(1.125rem, 1.0892857rem + 0.1785714vw, 1.25rem)` | 18px → 20px |
| `--size--2rem` | `clamp(1.75rem, 1.6785714rem + 0.3571429vw, 2rem)` | 28px → 32px |
| `--size--2-5rem` | `clamp(2rem, 1.8571429rem + 0.7142857vw, 2.5rem)` | 32px → 40px |
| `--size--3rem` | `clamp(2.25rem, 2.0357143rem + 1.0714286vw, 3rem)` | 36px → 48px |
| `--size--3-5rem` | `clamp(2.375rem, 2.0535714rem + 1.6071429vw, 3.5rem)` | 38px → 56px |
| `--size--4rem` | `clamp(2.5rem, 2.0714286rem + 2.1428571vw, 4rem)` | 40px → 64px |
| `--size--4-5rem` | `clamp(2.75rem, 2.25rem + 2.5vw, 4.5rem)` | 44px → 72px |
| `--size--5rem` | `clamp(3rem, 2.4285714rem + 2.8571429vw, 5rem)` | 48px → 80px |
| `--size--5-5rem` | `clamp(3.25rem, 2.6071429rem + 3.2142857vw, 5.5rem)` | 52px → 88px |
| `--size--6rem` | `clamp(3.5rem, 2.7857143rem + 3.5714286vw, 6rem)` | 56px → 96px |
| `--size--6-5rem` | `clamp(3.75rem, 2.9642857rem + 3.9285714vw, 6.5rem)` | 60px → 104px |
| `--size--7rem` | `clamp(4rem, 3.1428571rem + 4.2857143vw, 7rem)` | 64px → 112px |
| `--size--7-5rem` | `clamp(4.25rem, 3.3214286rem + 4.6428571vw, 7.5rem)` | 68px → 120px |
| `--size--8rem` | `clamp(4.5rem, 3.5rem + 5vw, 8rem)` | 72px → 128px |
| `--size--8-5rem` | `clamp(5rem, 4rem + 5vw, 8.5rem)` | 80px → 136px |
| `--size--9rem` | `clamp(5.25rem, 4.1785714rem + 5.3571429vw, 9rem)` | 84px → 144px |
| `--size--9-5rem` | `clamp(5.5rem, 4.3571429rem + 5.7142857vw, 9.5rem)` | 88px → 152px |
| `--size--10rem` | `clamp(6.375rem, 5.3392857rem + 5.1785714vw, 10rem)` | 102px → 160px |
| `--size--11rem` | `clamp(7rem, 5.8571429rem + 5.7142857vw, 11rem)` | 112px → 176px |
| `--size--12rem` | `clamp(7.5rem, 6.2142857rem + 6.4285714vw, 12rem)` | 120px → 192px |
| `--size--13rem` | `clamp(8.125rem, 6.7321429rem + 6.9642857vw, 13rem)` | 130px → 208px |
| `--size--14rem` | `clamp(8.625rem, 7.0892857rem + 7.6785714vw, 14rem)` | 138px → 224px |
| `--size--15rem` | `clamp(9.125rem, 7.4464286rem + 8.3928571vw, 15rem)` | 146px → 240px |
| `--size--16rem` | `clamp(8rem, 6.4941176rem + 7.5294118vw, 16rem)` | 128px → 256px |

## 4. Spacing

| Variable | Resolves to | Renders (min → max) |
|---|---|---|
| `--_spacing---space--0-125` | `--size--0-125rem` | 2px |
| `--_spacing---space--0-25` | `--size--0-25rem` | 4px |
| `--_spacing---space--1` | `--size--0-5rem` | 8px |
| `--_spacing---space--2` | `--size--0-75rem` | 12px |
| `--_spacing---space--3` | `--size--1rem` | 16px |
| `--_spacing---space--4` | `--size--1-5rem` | 24px |
| `--_spacing---space--5` | `--size--2rem` | 28 → 32px |
| `--_spacing---space--6` | `--size--2-5rem` | 32 → 40px |
| `--_spacing---space--7` | `--size--3rem` | 36 → 48px |
| `--_spacing---space--8` | `--size--4rem` | 40 → 64px |
| `--_spacing---space--10` | `--size--5rem` | 48 → 80px |
| `--_spacing---space--12` | `--size--6rem` | 56 → 96px |

**Section spacing** (applied via `.g_section_space` variants):

| Variable | Resolves to | Renders |
|---|---|---|
| `--_spacing---section-space--none` | `--size--0rem` | 0 |
| `--_spacing---section-space--small` | `--size--5rem` | 48 → 80px |
| `--_spacing---section-space--main` | `--size--7rem` | 64 → 112px |
| `--_spacing---section-space--large` | `--size--10rem` | 102 → 160px |
| `--_spacing---section-space--page-top` | `--size--12rem` | 120 → 192px |

## 5. Layout / grid

| Variable | Value | Notes |
|---|---|---|
| `--site--width` | `90rem` (1440px) | Design width — matches the prototype's 1440 |
| `--site--max-width` | `min(var(--site--width), 100vw)` | Custom code |
| `--site--margin` | fluid 16 → 40px | Page gutter |
| `--site--gutter` | `1rem` (16px) | Column gutter |
| `--site--column-count` | `12` | — |
| `--site--gutter-total` | `calc(gutter × (count − 1))` | Custom code |
| `--container--full` | `calc(100vw − margin × 2)` | Custom code |
| `--container--main` | `calc(max-width − margin × 2)` | Custom code; stylesheet fallback `72rem` |
| `--container--small` | `calc(col+gutter × 10 − gutter)` | Custom code; fallback `62.5rem` |
| `--container--xsmall` | `52rem` (832px) | — |
| `--column-width--1…12` | `calc(...)` | Custom code; `0px` placeholder in stylesheet |
| `--column-margin--0…12` | `calc(...)` | Custom code |
| `--_column-count---value` | `1` | Overridden per breakpoint by `.u-grid-*` |
| `--breakout-start` / `--breakout-end` / `--grid-breakout-single` | grid line names | Full-bleed breakout grid |
| `--align--start` / `--align--center` / `--align--end` | `0px` sentinels | Consumed by `--_alignment---direction` |

## 6. Typography

| Variable | Value |
|---|---|
| `--_typography---font--primary-family` | `"Inter Variable Latin", Arial, sans-serif` |
| `--_typography---font--secondary-family` | `"Inter tight Variable Latin", Arial, sans-serif` |
| `--_typography---font--primary-regular` | `400` |
| `--_typography---font--primary-medium` | `500` |
| `--_typography---font--primary-semibold` | `600` |
| `--_typography---font--primary-bold` | `700` |
| `--_typography---font--secondary-semibold` | `600` |
| `--_typography---font--primary-trim-top` / `-bottom` | `.37em` / `.38em` |
| `--_typography---font--secondary-trim-top` / `-bottom` | `.37em` / `.38em` |
| `--_typography---line-height--1` / `1-1` / `1-3` / `1-5` | `1` / `1.1` / `1.3` / `1.5` |
| `--_typography---letter-spacing--0em` / `0-02em` | `0em` / `-.02em` |
| `--_typography---text-transform--none/uppercase/capitalize/lowercase` | `0px` sentinels |

**Type scale** (all resolve through the fluid `--size--*` layer):

| Variable | Resolves to | Renders |
|---|---|---|
| `--_typography---font-size--display` | `--size--7rem` | 64 → 112px |
| `--_typography---font-size--h1` | `--size--5rem` | 48 → 80px |
| `--_typography---font-size--h2` | `--size--4rem` | 40 → 64px |
| `--_typography---font-size--h3` | `--size--3rem` | 36 → 48px |
| `--_typography---font-size--h4` | `--size--2rem` | 28 → 32px |
| `--_typography---font-size--h5` | `--size--1-5rem` | 24px |
| `--_typography---font-size--h6` | `--size--1-25rem` | 18 → 20px |
| `--_typography---font-size--text-large` | `--size--1-125rem` | 18px |
| `--_typography---font-size--text-main` | `--size--0-9375rem` | **15px** |
| `--_typography---font-size--text-small` | `--size--0-875rem` | 14px |
| `--_typography---font-size--text-xsmall` | `--size--0-6875rem` | 11px |

> Body text is **15px**, which matches the prototype's root `font-size:15px` exactly.

**Text-style channel** — `--_text-style---{font-family,font-size,line-height,font-weight,letter-spacing,margin-top,margin-bottom,text-transform,trim-top,trim-bottom}`. `.u-text-style-*` classes work by re-pointing these, so the same declaration block serves every size.

## 7. Radii, borders, focus

| Variable | Value |
|---|---|
| `--radius--xsmall` | `.25rem` (4px) |
| `--radius--small` | `.5rem` (8px) |
| `--radius--medium` | `.75rem` (12px) |
| `--radius--main` | `1rem` (16px) |
| `--radius--large` | `1.25rem` (20px) |
| `--radius--round` | `100vw` (pill) |
| `--border-width--main` | `.08rem` (~1.28px) |
| `--focus--width` | `.125rem` (2px) |
| `--focus--offset-outer` | `.1875rem` (3px) |
| `--focus--offset-inner` | `-.125rem` (−2px) |

## 8. Nav component tokens (site-wide custom code)

| Variable | Value |
|---|---|
| `--nav_2--height` | `4rem` (64px) |
| `--nav_2--height-total` | `var(--nav_2--height)` |
| `--nav_2--banner-height` | `2.4rem` |
| `--nav_2--radius` | `var(--radius--medium)` |
| `--nav_2--spacing-outer-vertical` | `var(--site--margin)` |
| `--nav_2--spacing-inner-horizontal` | `var(--_spacing---space--3)` |
| `--nav_2--container` | `var(--container--small, …)` |
| `--nav_2--icon-thickness` | `var(--border-width--main)` |
| `--nav_2--hamburger-thickness` | `var(--nav_2--icon-thickness)` |
| `--nav_2--hamburger-gap` | `var(--_spacing---space--2)` |
| `--nav_2--hamburger-rotate` | `45` |
| `--nav_2--menu-open-duration` / `--menu-close-duration` | `300ms` |
| `--nav_2--dropdown-duration` / `--dropdown-open-duration` | `300ms` |
| `--nav_2--dropdown-delay` | `0ms` |

Nav is **container-query driven**: `@container (min-width: 65em)` swaps `.nav_2_wrap.is-desktop`
and `.is-mobile`. Not a Webflow breakpoint.

---

## 9. Shadow-DOM availability (for code components)

Custom properties inherit through shadow boundaries, and every variable above is declared on
`:root`. **All of them are readable from inside a code component** via
`var(--name, fallback)` — confirmed against Webflow's own styling docs.

Exception to watch: `--_theme---*` are re-declared on `.u-theme-light` / `.u-theme-dark`. A code
component reads whichever value is in scope **at its host element**, so a component placed inside a
`.u-theme-dark` section automatically picks up dark values. That is the mechanism to use for the
dark slabs in the design rather than hardcoding `#1A1A1A`.
