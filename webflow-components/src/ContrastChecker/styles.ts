/**
 * Styles for the ContrastChecker.
 *
 * Code components render in Shadow DOM: site classes do NOT cross the boundary, so
 * none of Lumos's `u-*` utilities are available here. Custom properties DO inherit
 * through the boundary, so every value below reads a live Lumos variable with the
 * prototype hex as its fallback. That keeps the widget visually identical to the
 * rest of webyansh.com and makes it follow any future theme change automatically.
 *
 * Sizing uses the fluid --size--* scale, so the component breathes with the
 * viewport exactly like native sections and needs no breakpoints of its own.
 */
export const STYLES = `
:host {
  display: block;
  container-type: inline-size;

  font-family: var(--_typography---font--primary-family, "Inter", system-ui, sans-serif);
  font-size: var(--_typography---font-size--text-main, 0.9375rem);
  line-height: var(--_typography---line-height--1-5, 1.5);
  color: var(--swatch--dark, #1A1A1A);

  /* Local aliases so the rest of the sheet stays readable. */
  --wy-surface: var(--swatch--white, #FFFFFF);
  --wy-sunken: var(--swatch--light, #F6F6F6);
  --wy-page: var(--swatch--gray-25, #FCFCFC);
  --wy-ink: var(--swatch--dark, #1A1A1A);
  /* gray-500 clears 4.5:1 on white and gray-25. gray-300 does NOT — it is
     reserved for borders and icons, never for text. */
  --wy-muted: var(--swatch--gray-500, #737373);
  --wy-strong-muted: var(--swatch--gray-600, #525252);
  --wy-border: var(--swatch--gray-200, #E5E5E5);
  --wy-brand: var(--swatch--brand, #FF4D00);
  /* Brand orange is ~3.3:1 on white: fine for fills and borders, fails AA for
     body-size text. Text-sized brand elements use this instead. */
  --wy-brand-text: var(--swatch--brand-accessible, #B23600);

  --wy-pass: var(--swatch--pass, #0E6B4E);
  --wy-pass-bg: var(--swatch--pass-bg, #E7F5F0);
  --wy-pass-border: var(--swatch--pass-border, #BFE5D6);
  --wy-warn: var(--swatch--serious, #93500B);
  --wy-warn-bg: var(--swatch--serious-bg, #FEF3E6);
  --wy-warn-border: var(--swatch--serious-border, #F6DFC0);
  --wy-fail: var(--swatch--critical, #B42318);
  --wy-fail-bg: var(--swatch--critical-bg, #FDECEA);
  --wy-fail-border: var(--swatch--critical-border, #F6CFCA);

  --wy-r-sm: var(--radius--small, 0.5rem);
  --wy-r-md: var(--radius--medium, 0.75rem);
  --wy-r-lg: var(--radius--large, 1.25rem);
  --wy-r-pill: var(--radius--round, 100vw);

  --wy-s1: var(--_spacing---space--1, 0.5rem);
  --wy-s2: var(--_spacing---space--2, 0.75rem);
  --wy-s3: var(--_spacing---space--3, 1rem);
  --wy-s4: var(--_spacing---space--4, 1.5rem);
  --wy-s5: var(--_spacing---space--5, 2rem);
}

*, *::before, *::after { box-sizing: border-box; }

/* Rule 9 (2.4.7). No :focus-visible rule exists on the live site or in the
   prototype — the scanner flags exactly that, so this component ships one. */
:where(button, input, [tabindex]):focus-visible {
  outline: var(--focus--width, 2px) solid var(--wy-brand);
  outline-offset: var(--focus--offset-outer, 3px);
  border-radius: var(--wy-r-sm);
}

.layout { display: grid; gap: var(--wy-s4); grid-template-columns: 1fr; }
@container (min-width: 52rem) { .layout { grid-template-columns: 1fr 1fr; } }

.stack { display: flex; flex-direction: column; gap: var(--wy-s4); }

.card {
  background: var(--wy-surface);
  border: 1px solid var(--wy-border);
  border-radius: var(--wy-r-lg);
  padding: var(--wy-s4);
}

.modes {
  display: inline-flex; gap: 0.25rem; padding: 0.25rem;
  background: var(--wy-sunken); border-radius: var(--wy-r-md);
  margin-bottom: var(--wy-s4);
}
.mode {
  appearance: none; border: 0; cursor: pointer;
  padding: var(--wy-s1) var(--wy-s3);
  min-height: 2.25rem;
  border-radius: var(--wy-r-sm);
  background: transparent; color: var(--wy-strong-muted);
  font: inherit; font-weight: 500;
}
.mode[aria-pressed="true"] {
  background: var(--wy-surface); color: var(--wy-ink); font-weight: 600;
  box-shadow: 0 1px 2px rgba(26,26,26,0.08);
}

.field { display: flex; flex-direction: column; gap: var(--wy-s1); }
.label { font-size: 0.8125rem; font-weight: 600; color: var(--wy-strong-muted); }

.inputRow {
  display: flex; align-items: center; gap: var(--wy-s2);
  border: 1px solid var(--wy-border); border-radius: var(--wy-r-md);
  padding: var(--wy-s1) var(--wy-s2); background: var(--wy-page);
}
.inputRow:focus-within {
  outline: var(--focus--width, 2px) solid var(--wy-brand);
  outline-offset: var(--focus--offset-outer, 3px);
}
/* Rule 7 (2.5.8): interactive targets are at least 24x24 CSS px. */
.swatchInput {
  inline-size: 2.5rem; block-size: 2.5rem; min-inline-size: 24px; min-block-size: 24px;
  padding: 2px; cursor: pointer;
  border: 1px solid var(--wy-border); border-radius: var(--wy-r-sm);
  background: var(--wy-surface);
}
.hexInput {
  flex: 1; min-inline-size: 0; min-block-size: 24px;
  border: 0; outline: 0; background: transparent;
  font: inherit; font-size: 1.0625rem; font-weight: 500;
  font-family: ui-monospace, "Roboto Mono", monospace;
  color: var(--wy-ink);
  text-transform: uppercase;
}
.inputRow[data-invalid="true"] { border-color: var(--wy-fail); background: var(--wy-fail-bg); }

.swapRow { display: flex; justify-content: center; }
.swap {
  appearance: none; cursor: pointer;
  inline-size: 2.25rem; block-size: 2.25rem;
  display: grid; place-items: center;
  border: 1px solid var(--wy-border); border-radius: var(--wy-r-pill);
  background: var(--wy-surface); color: var(--wy-strong-muted);
}
.swap:hover { border-color: var(--wy-brand); color: var(--wy-brand-text); }

.error {
  display: flex; gap: var(--wy-s1); align-items: flex-start;
  font-size: 0.8125rem; color: var(--wy-fail); font-weight: 500;
}

.resultRow {
  display: flex; align-items: center; justify-content: space-between;
  flex-wrap: wrap; gap: var(--wy-s3);
  margin-top: var(--wy-s4); padding-top: var(--wy-s4);
  border-top: 1px solid var(--wy-border);
}
.ratio {
  font-family: var(--_typography---font--secondary-family, inherit);
  font-size: var(--size--3rem, 3rem);
  line-height: 1; font-weight: 600; letter-spacing: -0.035em;
  font-variant-numeric: tabular-nums;
}
.verdict {
  padding: var(--wy-s1) var(--wy-s3); border-radius: var(--wy-r-pill);
  font-weight: 600; font-size: 0.875rem; border: 1px solid;
}
.verdict[data-tone="pass"] { background: var(--wy-pass-bg); color: var(--wy-pass); border-color: var(--wy-pass-border); }
.verdict[data-tone="warn"] { background: var(--wy-warn-bg); color: var(--wy-warn); border-color: var(--wy-warn-border); }
.verdict[data-tone="fail"] { background: var(--wy-fail-bg); color: var(--wy-fail); border-color: var(--wy-fail-border); }

.checks { list-style: none; margin: var(--wy-s4) 0 0; padding: 0; }
.check {
  display: flex; align-items: center; justify-content: space-between; gap: var(--wy-s3);
  padding: var(--wy-s2) 0; border-bottom: 1px solid var(--wy-border);
}
.check:last-child { border-bottom: 0; }
.checkName { display: flex; align-items: center; gap: var(--wy-s2); min-width: 0; }
/* Pass/fail carries an icon AND a word, never colour alone — 1.4.1 Use of Colour. */
.dot {
  inline-size: 1.375rem; block-size: 1.375rem; flex-shrink: 0;
  border-radius: var(--wy-r-pill); display: grid; place-items: center;
  border: 1px solid;
}
.dot[data-pass="true"] { background: var(--wy-pass-bg); color: var(--wy-pass); border-color: var(--wy-pass-border); }
.dot[data-pass="false"] { background: var(--wy-fail-bg); color: var(--wy-fail); border-color: var(--wy-fail-border); }
.checkMeta { display: flex; align-items: center; gap: var(--wy-s2); flex-shrink: 0; }
.needs { font-size: 0.8125rem; color: var(--wy-muted); font-variant-numeric: tabular-nums; }
.state { font-size: 0.8125rem; font-weight: 600; min-inline-size: 2.5rem; text-align: right; }
.state[data-pass="true"] { color: var(--wy-pass); }
.state[data-pass="false"] { color: var(--wy-fail); }

.previewCard { border: 1px solid var(--wy-border); border-radius: var(--wy-r-lg); overflow: hidden; }
.previewHead {
  display: flex; justify-content: space-between; gap: var(--wy-s2); flex-wrap: wrap;
  padding: var(--wy-s2) var(--wy-s3);
  background: var(--wy-surface); border-bottom: 1px solid var(--wy-border);
  font-size: 0.8125rem; font-weight: 600; color: var(--wy-strong-muted);
}
.previewMeta { font-weight: 500; color: var(--wy-muted); font-family: ui-monospace, monospace; }
.previewBody { padding: var(--wy-s5) var(--wy-s4); display: flex; flex-direction: column; gap: var(--wy-s3); }
.previewTitle { font-size: 1.75rem; font-weight: 600; letter-spacing: -0.025em; margin: 0; }
.previewText { font-size: 1rem; line-height: 1.6; margin: 0; }
.previewSmall { font-size: 0.8125rem; line-height: 1.6; margin: 0; }
.previewActions { display: flex; align-items: center; gap: var(--wy-s3); flex-wrap: wrap; padding-top: var(--wy-s1); }
.previewBtn { border: 2px solid; padding: var(--wy-s1) var(--wy-s3); border-radius: var(--wy-r-pill); font-size: 0.9375rem; font-weight: 600; }
.previewLink { font-size: 0.9375rem; font-weight: 500; text-decoration: underline; text-underline-offset: 3px; }

.suggestions { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--wy-s2); }
.suggestion {
  display: flex; align-items: center; gap: var(--wy-s3);
  padding: var(--wy-s2); border: 1px solid var(--wy-border); border-radius: var(--wy-r-md);
}
.suggestionSwatch { inline-size: 2.25rem; block-size: 2.25rem; border-radius: var(--wy-r-sm); border: 1px solid rgba(26,26,26,0.1); flex-shrink: 0; }
.suggestionText { flex: 1; min-width: 0; }
.suggestionHex { font-weight: 600; font-family: ui-monospace, "Roboto Mono", monospace; }
.suggestionLabel { font-size: 0.8125rem; color: var(--wy-muted); }
.suggestionRatio { font-weight: 600; color: var(--wy-pass); font-variant-numeric: tabular-nums; }
.useBtn {
  appearance: none; border: 1px solid var(--wy-border); cursor: pointer;
  background: var(--wy-surface); color: var(--wy-brand-text);
  font: inherit; font-size: 0.8125rem; font-weight: 600;
  padding: var(--wy-s1) var(--wy-s2); min-height: 24px; border-radius: var(--wy-r-sm);
}
.useBtn:hover { border-color: var(--wy-brand); }

.sectionTitle { font-size: 0.8125rem; font-weight: 600; color: var(--wy-strong-muted); margin: 0 0 var(--wy-s2); }

/* --- palette sweep --- */
.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr)); gap: var(--wy-s2); margin-bottom: var(--wy-s3); }
.stat { background: var(--wy-surface); border: 1px solid var(--wy-border); border-radius: var(--wy-r-md); padding: var(--wy-s3); }
.statFigure { font-size: 1.625rem; font-weight: 600; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
.statLabel { font-size: 0.8125rem; color: var(--wy-strong-muted); margin-top: 0.25rem; }
.legend { display: flex; flex-wrap: wrap; gap: var(--wy-s3); align-items: center; font-size: 0.8125rem; color: var(--wy-strong-muted); }
.legendItem { display: inline-flex; align-items: center; gap: 0.375rem; }
.legendChip { inline-size: 0.75rem; block-size: 0.75rem; border-radius: 3px; border: 1px solid; display: inline-block; }

.matrixScroll { overflow-x: auto; }
.matrix { border-collapse: collapse; inline-size: 100%; min-inline-size: 34rem; }
.matrix caption { text-align: left; font-size: 0.8125rem; color: var(--wy-strong-muted); padding-bottom: var(--wy-s2); }
.matrix th, .matrix td { padding: 0.25rem; text-align: center; }
.matrix th[scope="row"] { text-align: left; white-space: nowrap; font-weight: 500; padding-right: var(--wy-s2); }
.matrix thead th { font-size: 0.75rem; font-weight: 600; color: var(--wy-strong-muted); }
.swatchLine { block-size: 0.5rem; border-radius: 3px; border: 1px solid rgba(26,26,26,0.1); margin-bottom: 0.375rem; }
.rowSwatch { inline-size: 1.25rem; block-size: 1.25rem; border-radius: 5px; border: 1px solid rgba(26,26,26,0.12); display: inline-block; vertical-align: middle; margin-right: var(--wy-s1); }
.cell { border-radius: var(--wy-r-sm); font-weight: 600; font-size: 0.8125rem; padding: 0.75rem 0.25rem; font-variant-numeric: tabular-nums; }
.cell[data-grade="aa"] { background: var(--wy-pass-bg); color: var(--wy-pass); }
.cell[data-grade="large"] { background: var(--wy-warn-bg); color: var(--wy-warn); }
.cell[data-grade="fail"] { background: var(--wy-fail-bg); color: var(--wy-fail); }
.cell[data-same="true"] { background: transparent; color: var(--wy-muted); }

.srOnly {
  position: absolute; inline-size: 1px; block-size: 1px;
  padding: 0; margin: 0; overflow: hidden;
  clip: rect(0,0,0,0); white-space: nowrap; border: 0;
}

@media (prefers-reduced-motion: reduce) {
  * { transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; }
}
`;
