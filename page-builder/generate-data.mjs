/**
 * Compiles webflow-pages/ into data the Designer Extension can apply.
 *
 * The extension cannot read the repo at runtime — it is served as static files
 * to an iframe inside the Designer — so the four page bodies and the whole of
 * shared.css are baked into a TypeScript module here.
 *
 * The CSS is parsed rather than passed through, because the Designer API has no
 * "apply this stylesheet" call. Styles are created one at a time with
 * `createStyle(name)` and `setProperties(props, {breakpoint, pseudo})`, so every
 * rule has to be reduced to that shape. This is only tractable because
 * shared.css was written under the constraint that every selector is a single
 * class — validate.mjs enforces it.
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGES = join(HERE, "..", "webflow-pages");

/** Webflow's breakpoints, keyed by the max-width the stylesheet uses. */
const BREAKPOINTS = { 991: "medium", 767: "small", 479: "tiny" };

/** Splits `.a11yp_cta:hover` into its class name and pseudo state. */
function parseSelector(raw) {
  const sel = raw.trim();
  const m = /^\.([A-Za-z0-9_-]+)(?::([a-z-]+))?$/.exec(sel);
  if (!m) return null;
  return { className: m[1], pseudo: m[2] ?? null };
}

function parseDeclarations(block) {
  const props = {};
  for (const decl of block.split(";")) {
    const i = decl.indexOf(":");
    if (i === -1) continue;
    const name = decl.slice(0, i).trim();
    const value = decl.slice(i + 1).trim();
    if (!name || !value) continue;
    props[name] = value;
  }
  return props;
}

/** Returns [{className, pseudo, breakpoint, props}], one entry per rule. */
function parseCss(css) {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const rules = [];
  const skipped = [];

  // Pull @media blocks out first so the remainder is flat.
  const mediaRe = /@media([^{]+)\{([\s\S]*?)\n\}/g;
  let rest = clean;
  let m;
  while ((m = mediaRe.exec(clean))) {
    const width = /max-width:\s*(\d+)px/.exec(m[1])?.[1];
    const breakpoint = BREAKPOINTS[Number(width)];
    if (!breakpoint) {
      skipped.push(`@media${m[1].trim()} — not a Webflow breakpoint`);
      continue;
    }
    for (const r of flatRules(m[2])) rules.push({ ...r, breakpoint });
    rest = rest.replace(m[0], "");
  }

  for (const r of flatRules(rest)) rules.push({ ...r, breakpoint: "main" });

  function* flatRules(source) {
    const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
    let r;
    while ((r = ruleRe.exec(source))) {
      const props = parseDeclarations(r[2]);
      if (Object.keys(props).length === 0) continue;
      // A comma-separated selector is several rules sharing a block.
      for (const part of r[1].split(",")) {
        const parsed = parseSelector(part);
        if (!parsed) {
          skipped.push(part.trim());
          continue;
        }
        yield { ...parsed, props };
      }
    }
  }

  return { rules, skipped };
}

const css = readFileSync(join(PAGES, "shared.css"), "utf8");
const { rules, skipped } = parseCss(css);

if (skipped.length) {
  console.error("Selectors this parser cannot express as a Webflow style:");
  for (const s of skipped) console.error("  " + s);
  console.error(
    "\nEvery selector must be a single class, optionally with one pseudo state.",
  );
  process.exit(1);
}

/* --- HTML -> element tree ---------------------------------------------------
 *
 * `insertElementFromWHTML` is optional in the Designer API and is not present in
 * every Designer build — it was missing from the one this was first run against.
 * The element builder (`elementBuilder`, `setTag`, `append`) is not optional, so
 * the markup is also compiled to a tree the extension can build node by node.
 *
 * Parsing happens here rather than in the extension so a malformed file fails at
 * the command line, where the error is readable, rather than inside a Designer
 * panel.
 */

const VOID_TAGS = new Set(["br", "hr", "img", "input", "meta", "link"]);

const ENTITIES = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'",
  nbsp: "\u00a0",
  rsquo: "\u2019", lsquo: "\u2018", rdquo: "\u201d", ldquo: "\u201c",
  mdash: "\u2014", ndash: "\u2013", hellip: "\u2026", times: "\u00d7",
  middot: "\u00b7", bull: "\u2022", deg: "\u00b0", pound: "\u00a3",
  euro: "\u20ac", copy: "\u00a9", reg: "\u00ae", trade: "\u2122",
  laquo: "\u00ab", raquo: "\u00bb", larr: "\u2190", rarr: "\u2192",
  ne: "\u2260", le: "\u2264", ge: "\u2265",
};

/**
 * setTextContent takes plain text, so entities must be resolved here.
 *
 * An unknown named entity is a hard error rather than a passthrough. The first
 * version left anything it did not recognise alone, and `&middot;` — used
 * seven times — was missing from the table, so the literal string "&middot;"
 * rendered on four live pages. Failing loudly is the point: this runs at the
 * command line, where the message is readable.
 */
function decodeEntities(text, where = "") {
  return text
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&([a-zA-Z][a-zA-Z0-9]*);/g, (m, name) => {
      const value = ENTITIES[name];
      if (value === undefined) {
        throw new Error(
          `${where}unknown HTML entity "${m}". Add it to ENTITIES in ` +
            `generate-data.mjs — leaving it undecoded renders it literally.`,
        );
      }
      return value;
    });
}

function parseHtml(html, file) {
  const root = { tag: "#root", classes: [], attrs: {}, children: [] };
  const stack = [root];
  let i = 0;

  const pushText = (raw) => {
    const text = decodeEntities(raw, `${file}: `).replace(/\s+/g, " ");
    if (!text.trim()) return;
    stack[stack.length - 1].children.push({ text });
  };

  while (i < html.length) {
    const lt = html.indexOf("<", i);
    if (lt === -1) {
      pushText(html.slice(i));
      break;
    }
    if (lt > i) pushText(html.slice(i, lt));

    if (html.startsWith("<!--", lt)) {
      i = html.indexOf("-->", lt) + 3;
      continue;
    }

    const gt = html.indexOf(">", lt);
    if (gt === -1) throw new Error(`${file}: unterminated tag at ${lt}`);
    const raw = html.slice(lt + 1, gt);
    i = gt + 1;

    if (raw.startsWith("/")) {
      const name = raw.slice(1).trim().toLowerCase();
      const open = stack.pop();
      if (!open || open.tag !== name) {
        throw new Error(`${file}: </${name}> does not close <${open?.tag}>`);
      }
      continue;
    }

    const tag = raw.split(/[\s/>]/)[0].toLowerCase();
    const node = { tag, classes: [], attrs: {}, children: [] };

    for (const m of raw.matchAll(/([a-zA-Z-]+)\s*=\s*"([^"]*)"/g)) {
      const [, name, value] = m;
      if (name === "class") node.classes = value.split(/\s+/).filter(Boolean);
      else node.attrs[name] = decodeEntities(value, `${file}: `);
    }

    stack[stack.length - 1].children.push(node);
    if (!raw.endsWith("/") && !VOID_TAGS.has(tag)) stack.push(node);
  }

  if (stack.length !== 1) {
    throw new Error(`${file}: unclosed <${stack[stack.length - 1].tag}>`);
  }
  if (root.children.length !== 1) {
    throw new Error(`${file}: expected exactly one root element`);
  }
  return root.children[0];
}

/**
 * Text sitting alongside element children cannot be expressed — a BuilderElement
 * has one `setTextContent`. Those runs become explicit <span> children so the
 * extension never has to decide.
 */
function normalise(node) {
  if (node.text) return node;
  const kids = node.children.map(normalise);
  const hasElements = kids.some((k) => !k.text);
  if (hasElements) {
    node.children = kids.map((k) =>
      k.text ? { tag: "span", classes: [], attrs: {}, children: [{ text: k.text }] } : k,
    );
  } else {
    node.children = kids;
  }
  return node;
}

const pages = readdirSync(PAGES)
  .filter((f) => f.endsWith(".html"))
  .map((f) => {
    const html = readFileSync(join(PAGES, f), "utf8").trim();
    return {
      slug: `tools/${f.replace(/\.html$/, "")}`,
      file: f,
      html,
      tree: normalise(parseHtml(html, f)),
    };
  });

const out = `// GENERATED by generate-data.mjs — do not edit.
// Source: webflow-pages/*.html and webflow-pages/shared.css
export type StyleRule = {
  className: string;
  pseudo: string | null;
  breakpoint: string;
  props: Record<string, string>;
};
export type TreeNode =
  | { text: string }
  | {
      tag: string;
      classes: string[];
      attrs: Record<string, string>;
      children: TreeNode[];
    };
export type PageBody = {
  slug: string;
  file: string;
  html: string;
  tree: TreeNode;
};

export const STYLE_RULES: StyleRule[] = ${JSON.stringify(rules, null, 2)};

export const PAGE_BODIES: PageBody[] = ${JSON.stringify(pages, null, 2)};
`;

writeFileSync(join(HERE, "src", "pages-data.ts"), out, "utf8");

const byBreakpoint = rules.reduce((acc, r) => {
  acc[r.breakpoint] = (acc[r.breakpoint] ?? 0) + 1;
  return acc;
}, {});
console.log(`  ${rules.length} style rules ${JSON.stringify(byBreakpoint)}`);
console.log(`  ${new Set(rules.map((r) => r.className)).size} distinct classes`);
console.log(`  ${rules.filter((r) => r.pseudo).length} with a pseudo state`);
const countNodes = (n) =>
  n.text ? 1 : 1 + n.children.reduce((sum, c) => sum + countNodes(c), 0);
for (const p of pages) {
  console.log(`  ${p.file.padEnd(40)} ${countNodes(p.tree)} nodes`);
}
console.log(`  ${pages.length} page bodies`);
