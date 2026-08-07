/**
 * Builds one self-contained file per page for pasting into a Webflow HTML Embed.
 *
 * The four `.html` bodies and `shared.css` are split because that is the shape
 * `data_whtml_builder` wants: `html` and `css` as separate parameters. A human
 * pasting by hand has no such parameter, so this joins them into one artefact
 * with the CSS inline.
 *
 * Use these only for the Embed route. For the native-element route, paste the
 * plain `.html` file into the canvas and put `shared.css` in the page's custom
 * code — see README.md.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = dirname(fileURLToPath(import.meta.url));
const OUT = join(DIR, "embed");
mkdirSync(OUT, { recursive: true });

const css = readFileSync(join(DIR, "shared.css"), "utf8");
const pages = readdirSync(DIR).filter((f) => f.endsWith(".html"));

/** Webflow rejects an HTML Embed over this many characters. */
const EMBED_LIMIT = 50_000;

let worst = 0;
for (const page of pages) {
  const html = readFileSync(join(DIR, page), "utf8").trim();
  // The style block goes first so the rules are parsed before the markup they
  // apply to renders, which avoids a flash of unstyled content on first paint.
  const combined = `<style>\n${css.trim()}\n</style>\n\n${html}\n`;
  writeFileSync(join(OUT, page), combined, "utf8");

  const pct = Math.round((combined.length / EMBED_LIMIT) * 100);
  worst = Math.max(worst, combined.length);
  const flag = combined.length > EMBED_LIMIT ? "OVER LIMIT" : "ok";
  console.log(
    `  ${flag.padEnd(11)} embed/${page.padEnd(38)} ${String(combined.length).padStart(6)} chars (${pct}% of the 50,000 embed limit)`,
  );
}

console.log(
  worst > EMBED_LIMIT
    ? "\nAt least one file exceeds the embed limit — use the native-element route instead."
    : "\nAll files fit in a single HTML Embed.",
);
process.exit(worst > EMBED_LIMIT ? 1 : 0);
