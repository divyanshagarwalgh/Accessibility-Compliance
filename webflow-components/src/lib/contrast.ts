/**
 * WCAG 2.x contrast maths.
 * Spec: https://www.w3.org/TR/WCAG22/#dfn-contrast-ratio
 */

export type Rgb = { r: number; g: number; b: number };

const SHORTHAND = /^[0-9a-f]{3}$/;
const FULL = /^[0-9a-f]{6}$/;

/**
 * Parse a hex colour into RGB, or null if the input is not a valid hex colour.
 *
 * Returns null rather than coercing. The prototype padded partial input
 * ("#12" became "#120000") and reported a confident ratio for a colour the user
 * never typed — the one failure mode a contrast tool cannot afford.
 */
export function parseHex(input: string): Rgb | null {
  const s = String(input ?? "")
    .trim()
    .replace(/^#/, "")
    .toLowerCase();

  const expanded = SHORTHAND.test(s)
    ? s
        .split("")
        .map((c) => c + c)
        .join("")
    : s;

  if (!FULL.test(expanded)) return null;

  return {
    r: parseInt(expanded.slice(0, 2), 16),
    g: parseInt(expanded.slice(2, 4), 16),
    b: parseInt(expanded.slice(4, 6), 16),
  };
}

function channelToLinear(value8bit: number): number {
  const c = value8bit / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function relativeLuminance({ r, g, b }: Rgb): number {
  return (
    0.2126 * channelToLinear(r) +
    0.7152 * channelToLinear(g) +
    0.0722 * channelToLinear(b)
  );
}

/** The five checks the design surfaces, in display order. */
export type Grade = {
  aaNormal: boolean;
  aaLarge: boolean;
  aaaNormal: boolean;
  aaaLarge: boolean;
  uiComponents: boolean;
};

/**
 * WCAG thresholds. The spec says "at least", so a ratio sitting exactly on a
 * threshold passes — hence >= throughout, not >.
 *
 * 1.4.3 Contrast (Minimum), AA:  4.5:1 normal, 3:1 large
 * 1.4.6 Contrast (Enhanced), AAA: 7:1 normal, 4.5:1 large
 * 1.4.11 Non-text Contrast, AA:   3:1 UI components and graphics
 *
 * "Large" is >=18.66px bold or >=24px, per the spec.
 */
export function gradeContrast(ratio: number): Grade {
  return {
    aaNormal: ratio >= 4.5,
    aaLarge: ratio >= 3,
    aaaNormal: ratio >= 7,
    aaaLarge: ratio >= 4.5,
    uiComponents: ratio >= 3,
  };
}

export function contrastRatio(a: string | Rgb, b: string | Rgb): number {
  const rgbA = typeof a === "string" ? parseHex(a) : a;
  const rgbB = typeof b === "string" ? parseHex(b) : b;
  if (!rgbA || !rgbB) return Number.NaN;

  const la = relativeLuminance(rgbA);
  const lb = relativeLuminance(rgbB);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

// ---------------------------------------------------------------------------
// HSL conversion — used to vary lightness while holding hue and saturation, so
// a suggested colour stays recognisably the same colour.
// ---------------------------------------------------------------------------

export type Hsl = { h: number; s: number; l: number };

export function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  const l = (max + min) / 2;

  if (delta === 0) return { h: 0, s: 0, l: l * 100 };

  const s = delta / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === rn) h = ((gn - bn) / delta) % 6;
  else if (max === gn) h = (bn - rn) / delta + 2;
  else h = (rn - gn) / delta + 4;

  h *= 60;
  if (h < 0) h += 360;

  return { h, s: s * 100, l: l * 100 };
}

export function hslToRgb({ h, s, l }: Hsl): Rgb {
  const sn = s / 100;
  const ln = l / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = ln - c / 2;

  let rp = 0;
  let gp = 0;
  let bp = 0;
  if (h < 60) [rp, gp, bp] = [c, x, 0];
  else if (h < 120) [rp, gp, bp] = [x, c, 0];
  else if (h < 180) [rp, gp, bp] = [0, c, x];
  else if (h < 240) [rp, gp, bp] = [0, x, c];
  else if (h < 300) [rp, gp, bp] = [x, 0, c];
  else [rp, gp, bp] = [c, 0, x];

  return {
    r: Math.round((rp + m) * 255),
    g: Math.round((gp + m) * 255),
    b: Math.round((bp + m) * 255),
  };
}

export function toHex({ r, g, b }: Rgb): string {
  const pad = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${pad(r)}${pad(g)}${pad(b)}`.toUpperCase();
}

/** Hue in degrees, 0–360. Returns 0 for greys, which have no hue. */
export function hueOf(hex: string): number {
  const rgb = parseHex(hex);
  return rgb ? rgbToHsl(rgb).h : 0;
}

/** HSL lightness, 0–100. */
export function lightnessOf(hex: string): number {
  const rgb = parseHex(hex);
  return rgb ? rgbToHsl(rgb).l : 0;
}

// ---------------------------------------------------------------------------
// Palette sweep
// ---------------------------------------------------------------------------

export type PaletteColor = { name: string; hex: string };
export type CellGrade = "aa" | "large" | "fail";
export type MatrixCell = { ratio: number; grade: CellGrade; isSame: boolean };
export type MatrixRow = { color: PaletteColor; cells: MatrixCell[] };

export type PaletteMatrix = {
  rows: MatrixRow[];
  /** Distinct unordered pairs below 4.5:1, excluding a colour against itself. */
  failingPairs: number;
  /** Total distinct unordered pairs, so the UI can show "n of m". */
  totalPairs: number;
  worstOffender: { color: PaletteColor; failCount: number } | null;
};

export function gradeCell(ratio: number): CellGrade {
  if (ratio >= 4.5) return "aa";
  if (ratio >= 3) return "large";
  return "fail";
}

/**
 * Every colour checked against every other.
 *
 * Contrast is symmetric, so A-on-B and B-on-A are one pair. The prototype
 * hardcoded failingPairs to 21 for a seven-colour palette — which is the total
 * number of unordered pairs, i.e. it claimed every pair failed. Ink 900 on White
 * is 17.4:1. This computes the real figure.
 */
export function buildPaletteMatrix(palette: PaletteColor[]): PaletteMatrix {
  const valid = palette.filter((c) => parseHex(c.hex) !== null);

  const rows: MatrixRow[] = valid.map((rowColor) => ({
    color: rowColor,
    cells: valid.map((colColor) => {
      const ratio = contrastRatio(rowColor.hex, colColor.hex);
      return {
        ratio,
        grade: gradeCell(ratio),
        isSame: rowColor.hex.toLowerCase() === colColor.hex.toLowerCase(),
      };
    }),
  }));

  let failingPairs = 0;
  let totalPairs = 0;
  const failCounts = new Array<number>(valid.length).fill(0);

  for (let i = 0; i < valid.length; i++) {
    for (let j = i + 1; j < valid.length; j++) {
      totalPairs++;
      if (rows[i]!.cells[j]!.grade === "fail") {
        failingPairs++;
        failCounts[i]! += 1;
        failCounts[j]! += 1;
      }
    }
  }

  let worstOffender: PaletteMatrix["worstOffender"] = null;
  let worstIndex = -1;
  for (let i = 0; i < failCounts.length; i++) {
    if (failCounts[i]! > 0 && (worstIndex === -1 || failCounts[i]! > failCounts[worstIndex]!)) {
      worstIndex = i;
    }
  }
  if (worstIndex !== -1) {
    worstOffender = { color: valid[worstIndex]!, failCount: failCounts[worstIndex]! };
  }

  return { rows, failingPairs, totalPairs, worstOffender };
}

export type Suggestion = { hex: string; ratio: number };

/**
 * Nearest colours of the same hue that reach `target` against `background`.
 *
 * Sweeps lightness across the full 0–100 range, so it lightens on dark
 * backgrounds and darkens on light ones. The prototype only ever multiplied
 * toward black, which moves away from passing on a dark background and could
 * also return fewer suggestions than it promised.
 *
 * Returns [] when the pair already passes, and [] when no colour of that hue can
 * reach the target — inventing one would be worse than admitting it.
 */
export type Tier = "aa" | "aaa" | "neutral";
export type TieredSuggestion = Suggestion & { tier: Tier; label: string };

/**
 * The three labelled options the design shows, rather than three near-identical
 * colours.
 *
 * A tier is omitted when it cannot be reached — on a mid-grey background no
 * colour of any hue hits AAA, and offering one anyway would be a lie in a tool
 * whose entire value is not lying about contrast.
 */
export function suggestTiered(
  foreground: string,
  background: string,
  neutralHex: string,
): TieredSuggestion[] {
  const out: TieredSuggestion[] = [];

  const [aa] = suggestAccessible(foreground, background, 4.5, 1);
  if (aa) {
    out.push({
      ...aa,
      tier: "aa",
      label: "Closest tint that passes AA for body text",
    });
  }

  const [aaa] = suggestAccessible(foreground, background, 7, 1);
  if (aaa && aaa.hex !== aa?.hex) {
    out.push({ ...aaa, tier: "aaa", label: "Passes AAA for body text" });
  }

  const neutralRatio = contrastRatio(neutralHex, background);
  if (Number.isFinite(neutralRatio) && neutralRatio >= 4.5) {
    out.push({
      hex: parseHex(neutralHex) ? toHex(parseHex(neutralHex)!) : neutralHex,
      ratio: neutralRatio,
      tier: "neutral",
      label: "Neutral ink, safe at every size",
    });
  }

  return out;
}

export function suggestAccessible(
  foreground: string,
  background: string,
  target: number,
  count = 3,
): Suggestion[] {
  const fg = parseHex(foreground);
  const bg = parseHex(background);
  if (!fg || !bg) return [];

  if (contrastRatio(fg, bg) >= target) return [];

  const { h, s, l: originalL } = rgbToHsl(fg);

  const candidates = new Map<string, Suggestion>();
  const STEP = 0.5;
  for (let l = 0; l <= 100 + 1e-9; l += STEP) {
    const hex = toHex(hslToRgb({ h, s, l }));
    if (candidates.has(hex)) continue;
    const ratio = contrastRatio(hex, bg);
    if (ratio >= target) candidates.set(hex, { hex, ratio });
  }

  return [...candidates.values()]
    .sort(
      (a, b) =>
        Math.abs(lightnessOf(a.hex) - originalL) -
        Math.abs(lightnessOf(b.hex) - originalL),
    )
    .slice(0, count);
}
