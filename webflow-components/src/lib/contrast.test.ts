import { describe, expect, test } from "vitest";
import {
  contrastRatio,
  gradeContrast,
  hueOf,
  lightnessOf,
  parseHex,
  suggestAccessible,
  buildPaletteMatrix,
  suggestTiered,
} from "./contrast";

describe("contrastRatio", () => {
  test("black on white is 21:1, the maximum possible", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
  });
});

describe("parseHex", () => {
  test("expands three-digit shorthand", () => {
    expect(parseHex("#abc")).toEqual({ r: 0xaa, g: 0xbb, b: 0xcc });
  });

  test("accepts a hex with no leading hash", () => {
    expect(parseHex("1A1A1A")).toEqual({ r: 26, g: 26, b: 26 });
  });

  test("ignores surrounding whitespace and case", () => {
    expect(parseHex("  #Ff4D00  ")).toEqual({ r: 255, g: 77, b: 0 });
  });

  test("returns null for a non-hex string rather than guessing", () => {
    expect(parseHex("rebeccapurple")).toBeNull();
  });

  test("returns null for a partial hex rather than padding it", () => {
    // The prototype padded "#12" to "#120000" and reported a confident ratio for
    // a colour the user never typed. Refusing is the honest answer.
    expect(parseHex("#12")).toBeNull();
  });

  test("returns null for out-of-range hex digits", () => {
    expect(parseHex("#GGGGGG")).toBeNull();
  });

  test("returns null for empty input", () => {
    expect(parseHex("")).toBeNull();
  });
});

describe("gradeContrast", () => {
  // WCAG wording is "at least", so a ratio exactly on the threshold PASSES.
  // Getting this backwards would tell users a compliant pair had failed.
  test("exactly 4.5:1 passes AA for normal text", () => {
    expect(gradeContrast(4.5).aaNormal).toBe(true);
  });

  test("just below 4.5:1 fails AA for normal text", () => {
    expect(gradeContrast(4.49).aaNormal).toBe(false);
  });

  test("exactly 3:1 passes AA for large text", () => {
    expect(gradeContrast(3).aaLarge).toBe(true);
  });

  test("exactly 7:1 passes AAA for normal text", () => {
    expect(gradeContrast(7).aaaNormal).toBe(true);
  });

  test("AAA large text uses the same 4.5:1 bar as AA normal text", () => {
    expect(gradeContrast(4.5).aaaLarge).toBe(true);
    expect(gradeContrast(4.49).aaaLarge).toBe(false);
  });

  test("exactly 3:1 passes for UI components and graphics", () => {
    expect(gradeContrast(3).uiComponents).toBe(true);
  });

  test("a failing pair fails every check", () => {
    expect(gradeContrast(2.59)).toEqual({
      aaNormal: false,
      aaLarge: false,
      aaaNormal: false,
      aaaLarge: false,
      uiComponents: false,
    });
  });

  test("the maximum ratio passes every check", () => {
    expect(gradeContrast(21)).toEqual({
      aaNormal: true,
      aaLarge: true,
      aaaNormal: true,
      aaaLarge: true,
      uiComponents: true,
    });
  });
});

describe("agreement with the design bundle", () => {
  // These figures are stated independently in the prototype's own copy
  // (A11yScreen.dc.html). If the maths drifts, the product's screenshots and the
  // numbers it reports stop agreeing with each other.
  test.each([
    ["#FF7A45", "#FFFFFF", 2.59, 'issue detail: "measures 2.59:1"'],
    ["#B23600", "#FFFFFF", 6.14, 'fix step 3: "measures 6.14:1 on white"'],
  ])("%s on %s is %f:1 — %s", (fg, bg, expected) => {
    expect(contrastRatio(fg, bg)).toBeCloseTo(expected, 1);
  });

  test("identical colours give the spec minimum of 1:1", () => {
    expect(contrastRatio("#FFFFFF", "#FFFFFF")).toBeCloseTo(1, 5);
  });

  test("the ratio is symmetric — order of arguments cannot change it", () => {
    expect(contrastRatio("#FF4D00", "#F6F6F6")).toBeCloseTo(
      contrastRatio("#F6F6F6", "#FF4D00"),
      10,
    );
  });

  test("brand orange on white fails AA for body text, as the audit found", () => {
    const ratio = contrastRatio("#FF4D00", "#FFFFFF");
    expect(ratio).toBeLessThan(4.5);
    expect(gradeContrast(ratio).aaNormal).toBe(false);
    expect(gradeContrast(ratio).aaLarge).toBe(true);
  });
});

describe("suggestAccessible", () => {
  test("suggestions actually meet the target on a light background", () => {
    const out = suggestAccessible("#FF7A45", "#FFFFFF", 4.5);
    expect(out.length).toBeGreaterThan(0);
    for (const s of out) {
      expect(contrastRatio(s.hex, "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
    }
  });

  test("lightens instead of darkening on a dark background", () => {
    // The prototype only ever multiplied the foreground toward black. On a dark
    // background that moves AWAY from passing, so it returned nothing usable.
    const out = suggestAccessible("#93500B", "#1A1A1A", 4.5);
    expect(out.length).toBeGreaterThan(0);
    for (const s of out) {
      expect(contrastRatio(s.hex, "#1A1A1A")).toBeGreaterThanOrEqual(4.5);
    }
  });

  test("keeps the suggestion recognisably the same hue", () => {
    // A "nearest passing alternative" that changes the brand colour's hue is not
    // an alternative, it is a different colour.
    const [first] = suggestAccessible("#FF4D00", "#FFFFFF", 4.5);
    expect(first).toBeDefined();
    expect(hueOf(first!.hex)).toBeCloseTo(hueOf("#FF4D00"), 0);
  });

  test("returns the requested count when enough distinct options exist", () => {
    // The prototype's loop could emit fewer than it promised, leaving gaps in the UI.
    expect(suggestAccessible("#FF7A45", "#FFFFFF", 4.5, 3)).toHaveLength(3);
  });

  test("returns suggestions ordered by closeness to the original", () => {
    const out = suggestAccessible("#FF7A45", "#FFFFFF", 4.5, 3);
    const distances = out.map((s) => Math.abs(lightnessOf(s.hex) - lightnessOf("#FF7A45")));
    expect(distances).toEqual([...distances].sort((a, b) => a - b));
  });

  test("returns an empty list when no colour of that hue can hit the target", () => {
    // Mid-grey background: even black only reaches ~5.3:1, so AAA 7:1 is impossible.
    // Returning nothing is correct; inventing a passing colour would be a lie.
    expect(suggestAccessible("#808080", "#808080", 7)).toEqual([]);
  });

  test("suggests nothing when the pair already passes", () => {
    expect(suggestAccessible("#1A1A1A", "#FFFFFF", 4.5)).toEqual([]);
  });
});

describe("buildPaletteMatrix", () => {
  // The exact palette the prototype's sweep screen ships with.
  const PALETTE = [
    { name: "Orange 500", hex: "#FF4D00" },
    { name: "Orange 300", hex: "#FF7A45" },
    { name: "Ink 900", hex: "#1A1A1A" },
    { name: "Grey 500", hex: "#6B6B6B" },
    { name: "Grey 300", hex: "#ABABAB" },
    { name: "Surface", hex: "#F6F6F6" },
    { name: "White", hex: "#FFFFFF" },
  ];

  test("produces a square matrix, one row and cell per colour", () => {
    const { rows } = buildPaletteMatrix(PALETTE);
    expect(rows).toHaveLength(7);
    for (const row of rows) expect(row.cells).toHaveLength(7);
  });

  test("marks the diagonal as the same colour", () => {
    const { rows } = buildPaletteMatrix(PALETTE);
    rows.forEach((row, i) => {
      expect(row.cells[i]!.isSame).toBe(true);
      expect(row.cells[i]!.ratio).toBeCloseTo(1, 5);
    });
  });

  test("grades each cell against the AA thresholds", () => {
    const { rows } = buildPaletteMatrix(PALETTE);
    const inkOnWhite = rows[2]!.cells[6]!;
    expect(inkOnWhite.grade).toBe("aa");
    const orangeOnWhite = rows[0]!.cells[6]!;
    expect(orangeOnWhite.grade).toBe("large");
    const greyOnWhite = rows[4]!.cells[6]!;
    expect(greyOnWhite.grade).toBe("fail");
  });

  test("counts failing pairs once, not twice, and excludes the diagonal", () => {
    // Contrast is symmetric, so A-on-B and B-on-A are one pair. Seven colours give
    // 21 unordered pairs total. The prototype hardcoded failingPairs to exactly 21,
    // which would mean every pair fails — but Ink 900 on White is 17.4:1.
    const { failingPairs } = buildPaletteMatrix(PALETTE);
    expect(failingPairs).toBeGreaterThan(0);
    expect(failingPairs).toBeLessThan(21);
  });

  test("identifies the colour that fails against the most others", () => {
    const { worstOffender } = buildPaletteMatrix(PALETTE);
    expect(worstOffender).not.toBeNull();
    expect(worstOffender!.failCount).toBeGreaterThan(0);
  });

  test("an all-black-and-white palette has no failing pairs", () => {
    const { failingPairs } = buildPaletteMatrix([
      { name: "Black", hex: "#000000" },
      { name: "White", hex: "#FFFFFF" },
    ]);
    expect(failingPairs).toBe(0);
  });

  test("skips unparseable colours instead of throwing", () => {
    const { rows } = buildPaletteMatrix([
      { name: "Good", hex: "#000000" },
      { name: "Bad", hex: "not-a-colour" },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.color.name).toBe("Good");
  });
});

describe("suggestTiered", () => {
  // The design shows three labelled rows, not three near-identical colours:
  //   "Closest darker tint that passes AA" / "Passes AAA for body text"
  //   / "Brand ink, safe at every size"
  test("returns one suggestion per tier, each meeting its own target", () => {
    const out = suggestTiered("#FF7A45", "#FFFFFF", "#1A1A1A");
    const aa = out.find((s) => s.tier === "aa");
    const aaa = out.find((s) => s.tier === "aaa");
    expect(contrastRatio(aa!.hex, "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(aaa!.hex, "#FFFFFF")).toBeGreaterThanOrEqual(7);
  });

  test("tiers are visibly different from each other", () => {
    // Three colours a user cannot tell apart is not three options.
    const out = suggestTiered("#FF7A45", "#FFFFFF", "#1A1A1A");
    const hexes = out.map((s) => s.hex);
    expect(new Set(hexes).size).toBe(hexes.length);
    const aa = out.find((s) => s.tier === "aa")!;
    const aaa = out.find((s) => s.tier === "aaa")!;
    expect(Math.abs(lightnessOf(aa.hex) - lightnessOf(aaa.hex))).toBeGreaterThan(5);
  });

  test("always offers the neutral fallback, which passes at any size", () => {
    const out = suggestTiered("#FF7A45", "#FFFFFF", "#1A1A1A");
    const ink = out.find((s) => s.tier === "neutral");
    expect(ink!.hex).toBe("#1A1A1A");
    expect(contrastRatio(ink!.hex, "#FFFFFF")).toBeGreaterThanOrEqual(7);
  });

  test("omits a tier that is unreachable rather than faking it", () => {
    // On mid-grey nothing of any hue reaches AAA 7:1, so that tier must be absent.
    const out = suggestTiered("#808080", "#808080", "#1A1A1A");
    expect(out.find((s) => s.tier === "aaa")).toBeUndefined();
  });

  test("drops the neutral fallback when it does not pass either", () => {
    // Ink on a near-black background fails, so offering it would be wrong.
    const out = suggestTiered("#333333", "#1A1A1A", "#1A1A1A");
    expect(out.find((s) => s.tier === "neutral")).toBeUndefined();
  });

  test("carries a label for each tier so the UI needs no mapping table", () => {
    const out = suggestTiered("#FF7A45", "#FFFFFF", "#1A1A1A");
    for (const s of out) expect(s.label.length).toBeGreaterThan(0);
  });
});
