// Validates the four page bodies against the constraints Webflow's HTML paste
// and data_whtml_builder enforce, plus the contrast rules the project set.
// A failure here means the manual paste would break or produce inaccessible
// markup — which is exactly what we do not want a human discovering by hand.
import { readFileSync, readdirSync } from "node:fs";

const DIR = "D:/Claude desktop/Accessibility & Compliance Tool/webflow-pages";
const files = readdirSync(DIR).filter((f) => f.endsWith(".html"));
let failures = 0;
const fail = (f, msg) => { console.log(`  FAIL ${f}: ${msg}`); failures++; };
const ok = (f, msg) => console.log(`  ok   ${f}: ${msg}`);

// --- well-formedness + single root -----------------------------------------
const VOID = new Set(["area","base","br","col","embed","hr","img","input","link","meta","param","source","track","wbr"]);

function parse(html, f) {
  const stack = [];
  const roots = [];
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf("<", i);
    if (lt === -1) break;
    if (html.startsWith("<!--", lt)) { i = html.indexOf("-->", lt) + 3; continue; }
    const gt = html.indexOf(">", lt);
    if (gt === -1) { fail(f, `unterminated tag at ${lt}`); return { roots }; }
    const raw = html.slice(lt + 1, gt);
    if (raw.includes("<")) { fail(f, `nested "<" inside a tag: ${raw.slice(0, 60)}`); return { roots }; }
    i = gt + 1;
    if (raw.startsWith("!") || raw.startsWith("?")) continue;
    if (raw.startsWith("/")) {
      const name = raw.slice(1).trim().toLowerCase();
      const open = stack.pop();
      if (open !== name) fail(f, `closing </${name}> does not match open <${open}>`);
      if (stack.length === 0) roots.push(name);
      continue;
    }
    const name = raw.split(/[\s/>]/)[0].toLowerCase();
    if (raw.endsWith("/") || VOID.has(name)) { if (stack.length === 0) roots.push(name); continue; }
    stack.push(name);
  }
  if (stack.length) fail(f, `unclosed elements: ${stack.join(", ")}`);
  return { roots };
}

console.log("=== HTML bodies ===");
for (const f of files) {
  const html = readFileSync(`${DIR}/${f}`, "utf8").trim();
  const { roots } = parse(html, f);
  if (roots.length === 1) ok(f, `single root element <${roots[0]}>`);
  else fail(f, `must have exactly one root element, found ${roots.length} (${roots.join(", ")})`);

  if (/<style[\s>]/i.test(html)) fail(f, "contains a <style> tag — CSS must go in the css field");
  else ok(f, "no <style> tags");

  // Contrast rules the project committed to.
  if (/#ABABAB/i.test(html)) fail(f, "uses #ABABAB (2.12–2.30:1) — never for text");
  if (/color:\s*#FF4D00/i.test(html)) fail(f, "uses brand orange for text (3.08–3.33:1)");

  // Heading order.
  const levels = [...html.matchAll(/<h([1-6])[\s>]/gi)].map((m) => Number(m[1]));
  let skips = 0;
  for (let k = 1; k < levels.length; k++) if (levels[k] - levels[k - 1] > 1) skips++;
  if (skips) fail(f, `${skips} heading-level skip(s): ${levels.join(">")}`);
  else ok(f, `heading order clean (${levels.join(">") || "none"})`);

  const h1s = levels.filter((l) => l === 1).length;
  if (h1s !== 1) fail(f, `expected exactly one h1, found ${h1s}`);
}

// --- shared.css -------------------------------------------------------------
console.log("=== shared.css ===");
const cssRaw = readFileSync(`${DIR}/shared.css`, "utf8");
// Comments must go before selectors are parsed, or a comment sitting above a
// rule is read as part of that rule's selector.
const css = cssRaw.replace(/\/\*[\s\S]*?\*\//g, "");

if (/@keyframes/i.test(css)) fail("shared.css", "@keyframes are not allowed");
else ok("shared.css", "no @keyframes");

const media = [...css.matchAll(/@media([^{]+)\{/g)].map((m) => m[1].trim());
const ALLOWED = [
  "screen and (max-width: 991px)",
  "screen and (max-width: 767px)",
  "screen and (max-width: 479px)",
];
const badMedia = media.filter((m) => !ALLOWED.includes(m));
if (badMedia.length) fail("shared.css", `non-Webflow breakpoints: ${badMedia.join(" | ")}`);
else ok("shared.css", `${media.length} media queries, all Webflow breakpoints`);

// Descendant selectors: data_whtml_builder rejects them outright.
const selectors = [...css.matchAll(/(^|\})\s*([^{}@]+)\{/g)].map((m) => m[2].trim()).filter(Boolean);
const nested = selectors.filter((s) =>
  s.split(",").some((part) => /\S\s+\S/.test(part.trim().replace(/\s*[>+~]\s*/g, "~"))),
);
if (nested.length) fail("shared.css", `descendant selectors rejected by Webflow: ${nested.slice(0, 5).join(" | ")}`);
else ok("shared.css", `${selectors.length} selectors, none descendant`);

// --_spacing---* does not resolve in Webflow's variable registry.
const spacingVars = [...css.matchAll(/var\(--_spacing[^)]*\)/g)].map((m) => m[0]);
if (spacingVars.length) fail("shared.css", `--_spacing---* does not resolve in Webflow: ${[...new Set(spacingVars)].slice(0,4).join(", ")}`);
else ok("shared.css", "no --_spacing---* variables");

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
