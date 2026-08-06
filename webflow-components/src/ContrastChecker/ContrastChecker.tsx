import * as React from "react";
import {
  buildPaletteMatrix,
  contrastRatio,
  gradeContrast,
  parseHex,
  suggestTiered,
  toHex,
  type PaletteColor,
} from "../lib/contrast";
import { STYLES } from "./styles";

export type ContrastCheckerProps = {
  foreground: string;
  background: string;
  mode: "Single pair" | "Whole palette";
  neutral: string;
  /** One colour per line, "Name #HEX". */
  palette: string;
};

const CHECKS = [
  { key: "aaNormal", label: "AA · Normal text", needs: "4.5:1" },
  { key: "aaLarge", label: "AA · Large text (18.66px bold, 24px)", needs: "3:1" },
  { key: "aaaNormal", label: "AAA · Normal text", needs: "7:1" },
  { key: "aaaLarge", label: "AAA · Large text", needs: "4.5:1" },
  { key: "uiComponents", label: "UI components and graphics", needs: "3:1" },
] as const;

function parsePalette(raw: string): PaletteColor[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(.*?)[\s,]*(#?[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?)$/);
      if (!match) return null;
      const [, name, hex] = match;
      const rgb = parseHex(hex!);
      if (!rgb) return null;
      return { name: (name ?? "").trim() || toHex(rgb), hex: toHex(rgb) };
    })
    .filter((c): c is PaletteColor => c !== null);
}

/** Icons are inline so the component has no network dependency of any kind. */
function Tick() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" focusable="false">
      <path d="M2.5 8.5l3.5 3.5 7.5-8" fill="none" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function Cross() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" focusable="false">
      <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" fill="none" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" />
    </svg>
  );
}
function Swap() {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true" focusable="false">
      <path d="M5 2v12M5 2L2.5 4.5M5 2l2.5 2.5M11 14V2M11 14l2.5-2.5M11 14l-2.5-2.5"
        fill="none" stroke="currentColor" strokeWidth="1.75"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ContrastChecker({
  foreground,
  background,
  mode,
  neutral,
  palette,
}: ContrastCheckerProps) {
  const [fg, setFg] = React.useState(foreground);
  const [bg, setBg] = React.useState(background);
  const [activeMode, setActiveMode] = React.useState(mode);

  // Designer prop edits must be reflected on the canvas.
  React.useEffect(() => setFg(foreground), [foreground]);
  React.useEffect(() => setBg(background), [background]);
  React.useEffect(() => setActiveMode(mode), [mode]);

  const fgRgb = parseHex(fg);
  const bgRgb = parseHex(bg);
  const valid = fgRgb !== null && bgRgb !== null;

  const ratio = valid ? contrastRatio(fgRgb, bgRgb) : Number.NaN;
  const grade = gradeContrast(ratio);
  const rounded = valid ? (Math.round(ratio * 100) / 100).toFixed(2) : "—";

  const verdict = !valid
    ? { tone: "fail" as const, text: "Enter two valid hex colours" }
    : grade.aaNormal
      ? { tone: "pass" as const, text: "Passes AA for body text" }
      : grade.aaLarge
        ? { tone: "warn" as const, text: "Fails AA for body text" }
        : { tone: "fail" as const, text: "Fails AA and AAA" };

  const suggestions = valid ? suggestTiered(fg, bg, neutral) : [];
  const paletteColors = React.useMemo(() => parsePalette(palette), [palette]);
  const matrix = React.useMemo(() => buildPaletteMatrix(paletteColors), [paletteColors]);

  const fgSafe = fgRgb ? toHex(fgRgb) : "#000000";
  const bgSafe = bgRgb ? toHex(bgRgb) : "#FFFFFF";

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />

      <div className="modes" role="group" aria-label="Checker mode">
        {(["Single pair", "Whole palette"] as const).map((m) => (
          <button
            key={m}
            type="button"
            className="mode"
            aria-pressed={activeMode === m}
            onClick={() => setActiveMode(m)}
          >
            {m}
          </button>
        ))}
      </div>

      {activeMode === "Single pair" ? (
        <div className="layout">
          <div className="card">
            <div className="stack">
              <ColorField
                id="wy-fg"
                label="Foreground"
                value={fg}
                onChange={setFg}
                invalid={fgRgb === null}
                safe={fgSafe}
              />

              <div className="swapRow">
                <button
                  type="button"
                  className="swap"
                  onClick={() => {
                    setFg(bg);
                    setBg(fg);
                  }}
                >
                  <Swap />
                  <span className="srOnly">Swap foreground and background</span>
                </button>
              </div>

              <ColorField
                id="wy-bg"
                label="Background"
                value={bg}
                onChange={setBg}
                invalid={bgRgb === null}
                safe={bgSafe}
              />
            </div>

            {/* The ratio changes as the user types, so screen readers need to hear it.
                aria-live="polite" waits for a pause rather than interrupting. */}
            <div className="resultRow" aria-live="polite">
              <div>
                <div className="label">Contrast ratio</div>
                <div className="ratio">
                  {rounded}
                  {valid ? ":1" : ""}
                </div>
              </div>
              <div className="verdict" data-tone={verdict.tone}>
                {verdict.text}
              </div>
            </div>

            <ul className="checks">
              {CHECKS.map((c) => {
                const pass = valid && grade[c.key];
                return (
                  <li className="check" key={c.key}>
                    <span className="checkName">
                      <span className="dot" data-pass={pass}>
                        {pass ? <Tick /> : <Cross />}
                      </span>
                      <span>{c.label}</span>
                    </span>
                    <span className="checkMeta">
                      <span className="needs">needs {c.needs}</span>
                      {/* The word, not just the colour — 1.4.1 Use of Colour. */}
                      <span className="state" data-pass={pass}>
                        {pass ? "Pass" : "Fail"}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="stack">
            <div className="previewCard">
              <div className="previewHead">
                <span>Live preview</span>
                <span className="previewMeta">
                  {fgSafe} on {bgSafe}
                </span>
              </div>
              <div className="previewBody" style={{ background: bgSafe, color: fgSafe }}>
                <p className="previewTitle">Route freight in real time</p>
                <p className="previewText">
                  Body copy at 16 pixels. This is the size that has to clear 4.5 to 1,
                  and it is the size most brand palettes quietly fail on.
                </p>
                <p className="previewSmall">
                  Small print at 13 pixels, the size used for form hints, table captions
                  and footnotes.
                </p>
                <div className="previewActions">
                  <span className="previewBtn" style={{ borderColor: fgSafe }}>
                    Secondary button
                  </span>
                  <span className="previewLink">A text link</span>
                </div>
              </div>
            </div>

            <div className="card">
              <p className="sectionTitle">Nearest passing alternatives</p>
              {suggestions.length > 0 ? (
                <ul className="suggestions">
                  {suggestions.map((s) => (
                    <li className="suggestion" key={s.tier}>
                      <span className="suggestionSwatch" style={{ background: s.hex }} />
                      <span className="suggestionText">
                        <span className="suggestionHex">{s.hex}</span>
                        <span className="suggestionLabel"> — {s.label}</span>
                      </span>
                      <span className="suggestionRatio">{s.ratio.toFixed(2)}:1</span>
                      <button type="button" className="useBtn" onClick={() => setFg(s.hex)}>
                        Use
                        <span className="srOnly"> {s.hex} as the foreground colour</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="suggestionLabel">
                  {valid && grade.aaNormal
                    ? "This pair already passes AA for body text."
                    : "No colour of this hue reaches the target on this background. Change the background instead."}
                </p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <PaletteSweep matrix={matrix} />
      )}
    </>
  );
}

function ColorField({
  id,
  label,
  value,
  onChange,
  invalid,
  safe,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  invalid: boolean;
  safe: string;
}) {
  const errorId = `${id}-error`;
  return (
    <div className="field">
      {/* Rule 3 (3.3.2): a real <label for>, never a placeholder standing in for one. */}
      <label className="label" htmlFor={`${id}-hex`}>
        {label}
      </label>
      <div className="inputRow" data-invalid={invalid}>
        <input
          type="color"
          className="swatchInput"
          value={safe}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          aria-label={`${label} colour picker`}
        />
        <input
          id={`${id}-hex`}
          className="hexInput"
          value={value}
          spellCheck={false}
          autoComplete="off"
          inputMode="text"
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={invalid}
          aria-describedby={invalid ? errorId : undefined}
        />
      </div>
      {invalid ? (
        <p className="error" id={errorId}>
          Not a valid hex colour. Use a format like #1A1A1A or #ABC.
        </p>
      ) : null}
    </div>
  );
}

function PaletteSweep({ matrix }: { matrix: ReturnType<typeof buildPaletteMatrix> }) {
  const { rows, failingPairs, totalPairs, worstOffender } = matrix;

  if (rows.length === 0) {
    return (
      <div className="card">
        <p className="suggestionLabel">
          Add colours to the palette, one per line, as &ldquo;Name #HEX&rdquo;.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="stats">
        <div className="stat">
          <div className="statFigure">{failingPairs}</div>
          <div className="statLabel">
            of {totalPairs} pairs below 4.5:1
          </div>
        </div>
        <div className="stat">
          <div className="statFigure">{rows.length}</div>
          <div className="statLabel">colours in the palette</div>
        </div>
        {worstOffender ? (
          <div className="stat">
            <div className="statFigure" style={{ fontSize: "1.125rem" }}>
              {worstOffender.color.name}
            </div>
            <div className="statLabel">
              worst offender, fails against {worstOffender.failCount} of {rows.length - 1}
            </div>
          </div>
        ) : null}
        <div className="stat">
          <div className="legend">
            <span className="legendItem">
              <span
                className="legendChip"
                style={{ background: "var(--wy-pass-bg)", borderColor: "var(--wy-pass-border)" }}
              />
              AA
            </span>
            <span className="legendItem">
              <span
                className="legendChip"
                style={{ background: "var(--wy-warn-bg)", borderColor: "var(--wy-warn-border)" }}
              />
              Large only
            </span>
            <span className="legendItem">
              <span
                className="legendChip"
                style={{ background: "var(--wy-fail-bg)", borderColor: "var(--wy-fail-border)" }}
              />
              Fail
            </span>
          </div>
        </div>
      </div>

      <div className="card">
        {/* A real <table> with scoped headers, so the matrix is navigable by screen
            reader rather than being a grid of unlabelled numbers. */}
        <div className="matrixScroll">
          <table className="matrix">
            <caption>
              Contrast ratio of each text colour on each background colour. Every cell
              states its own pass level, so the result never depends on colour alone.
            </caption>
            <thead>
              <tr>
                <th scope="col">
                  <span className="srOnly">Text colour</span>
                </th>
                {rows.map((r) => (
                  <th scope="col" key={r.color.hex}>
                    <span
                      className="swatchLine"
                      style={{ background: r.color.hex, display: "block" }}
                    />
                    {r.color.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.color.hex}>
                  <th scope="row">
                    <span className="rowSwatch" style={{ background: row.color.hex }} />
                    {row.color.name}
                  </th>
                  {row.cells.map((cell, i) => (
                    <td key={rows[i]!.color.hex}>
                      <div className="cell" data-grade={cell.grade} data-same={cell.isSame}>
                        {cell.isSame ? (
                          <>
                            —<span className="srOnly">same colour, not applicable</span>
                          </>
                        ) : (
                          <>
                            {cell.ratio.toFixed(1)}
                            <span className="srOnly">
                              {" to 1, "}
                              {cell.grade === "aa"
                                ? "passes AA"
                                : cell.grade === "large"
                                  ? "passes for large text only"
                                  : "fails"}
                            </span>
                          </>
                        )}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
