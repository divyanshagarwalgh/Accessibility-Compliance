import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { ContrastChecker, type ContrastCheckerProps } from "./ContrastChecker";

/**
 * These are characterisation tests written after the markup, unlike the contrast
 * maths which was fully test-driven. They exist because this component must pass
 * the audit the product itself performs: every assertion below maps to a rule in
 * docs/rules-extracted.md.
 *
 * Server-rendered markup is the right surface to assert on — code components have
 * SSR enabled, so this is exactly what a crawler and a scanner see first.
 */
const BASE: ContrastCheckerProps = {
  foreground: "#FF7A45",
  background: "#FFFFFF",
  mode: "Single pair",
  neutral: "#1A1A1A",
  palette: ["Ink #1A1A1A", "White #FFFFFF", "Grey 300 #ABABAB"].join("\n"),
};

const render = (overrides: Partial<ContrastCheckerProps> = {}) =>
  renderToStaticMarkup(<ContrastChecker {...BASE} {...overrides} />);

describe("ContrastChecker markup", () => {
  test("server-renders the real ratio, not an empty shell", () => {
    // The page targets 12,100 searches a month. If SSR produced a placeholder,
    // the content a crawler sees would be worthless.
    expect(render()).toContain("2.59:1");
  });

  test("every input has an associated label — rule 3, WCAG 3.3.2", () => {
    const html = render();
    expect(html).toContain('for="wy-fg-hex"');
    expect(html).toContain('id="wy-fg-hex"');
    expect(html).toContain('for="wy-bg-hex"');
    expect(html).toContain('id="wy-bg-hex"');
  });

  test("the colour pickers carry accessible names", () => {
    const html = render();
    expect(html).toContain('aria-label="Foreground colour picker"');
    expect(html).toContain('aria-label="Background colour picker"');
  });

  test("announces the changing ratio to screen readers", () => {
    expect(render()).toContain('aria-live="polite"');
  });

  test("states pass or fail in words, never colour alone — WCAG 1.4.1", () => {
    const html = render({ foreground: "#000000", background: "#FFFFFF" });
    expect(html).toContain(">Pass<");
    const failing = render({ foreground: "#FF7A45", background: "#FFFFFF" });
    expect(failing).toContain(">Fail<");
  });

  test("marks invalid input with aria-invalid and a described error", () => {
    const html = render({ foreground: "not-a-colour" });
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('aria-describedby="wy-fg-error"');
    expect(html).toContain('id="wy-fg-error"');
    expect(html).toContain("Not a valid hex colour");
  });

  test("does not report a ratio for invalid input", () => {
    // Reporting a confident number for a colour the user never typed is the one
    // failure mode a contrast checker cannot have.
    const html = render({ foreground: "#12" });
    expect(html).not.toMatch(/\d\.\d\d:1/);
  });

  test("the swap control has a text name despite being icon-only", () => {
    expect(render()).toContain("Swap foreground and background");
  });

  test("decorative icons are hidden from assistive technology", () => {
    expect(render()).toContain('aria-hidden="true"');
  });

  test("mode buttons expose their state with aria-pressed", () => {
    const html = render();
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('aria-pressed="false"');
  });
});

describe("ContrastChecker palette mode", () => {
  test("renders a real table with scoped headers, not a div grid", () => {
    const html = render({ mode: "Whole palette" });
    expect(html).toContain("<table");
    expect(html).toContain('scope="col"');
    expect(html).toContain('scope="row"');
    expect(html).toContain("<caption>");
  });

  test("each cell states its grade in text for screen reader users", () => {
    const html = render({ mode: "Whole palette" });
    expect(html).toContain("passes AA");
    expect(html).toContain("fails");
  });

  test("reports the computed failing-pair count, not a hardcoded one", () => {
    // Ink/White passes, Ink/Grey300 passes, White/Grey300 fails => 1 of 3.
    const html = render({ mode: "Whole palette" });
    expect(html).toContain("of 3 pairs below 4.5:1");
  });

  test("prompts for input rather than rendering an empty table", () => {
    const html = render({ mode: "Whole palette", palette: "" });
    expect(html).toContain("Add colours to the palette");
  });

  test("ignores unparseable palette lines instead of throwing", () => {
    expect(() =>
      render({ mode: "Whole palette", palette: "Good #000000\ngarbage line\n" }),
    ).not.toThrow();
  });
});
