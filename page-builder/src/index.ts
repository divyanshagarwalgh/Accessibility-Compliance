// The ".js" is deliberate. TypeScript does not rewrite import specifiers, and
// the compiled file is loaded straight by the browser as a module — where an
// extensionless specifier is a hard error.
import { PAGE_BODIES, STYLE_RULES, type PageBody } from "./pages-data.js";

/**
 * Builds the four /tools/* page bodies inside the Webflow Designer.
 *
 * ## Why this exists
 *
 * The four bodies could not be applied from outside the Designer. The Webflow
 * MCP advertises an empty input schema for its page-building tools, so the
 * client serialises the required `actions` array as a string and the server
 * rejects its own request. The Data API has no create-element endpoint at all —
 * only static-content rewriting of nodes that already exist. Manual pasting is
 * the documented fallback and it was not working either.
 *
 * The Designer API can do it: `insertElementFromWHTML` parses HTML into native
 * Webflow elements, which is the same capability the MCP wraps, reached from
 * inside the Designer where the array-marshalling problem does not exist.
 *
 * ## What it produces
 *
 * Real Webflow elements with real classes, editable afterwards in the Designer —
 * not an HTML embed. That was the point of building these as native pages: they
 * carry the SEO and the site's own nav and footer.
 *
 * ## Order matters
 *
 * Styles are created before any markup is inserted. `insertElementFromWHTML`
 * creates elements carrying the class names in the HTML; if a style of that name
 * already exists it binds to it, so creating them first is what makes the pages
 * arrive styled rather than as a stack of unstyled divs.
 */

type Logger = (message: string, tone?: "ok" | "warn" | "fail") => void;

const log: Logger = (message, tone) => {
  const list = document.getElementById("log");
  if (!list) return;
  const li = document.createElement("li");
  li.textContent = message;
  if (tone) li.dataset.tone = tone;
  list.appendChild(li);
  li.scrollIntoView({ block: "nearest" });
};

/**
 * Creates every class shared.css defines, then sets its properties.
 *
 * Reuses a style of the same name when one already exists rather than failing,
 * so running the extension twice is safe and so a class the site already has is
 * never duplicated. Properties are applied per breakpoint and pseudo state,
 * which is how the media query and the :hover / :focus-visible rules survive.
 */
async function ensureStyles(): Promise<void> {
  const cache = new Map<string, Awaited<ReturnType<typeof webflow.createStyle>>>();
  let created = 0;
  let reused = 0;
  let applied = 0;

  for (const rule of STYLE_RULES) {
    let style = cache.get(rule.className) ?? null;

    if (!style) {
      style = await webflow.getStyleByName(rule.className);
      if (style) {
        reused++;
      } else {
        style = await webflow.createStyle(rule.className);
        created++;
      }
      cache.set(rule.className, style);
    }

    // Base styles take no options at all — passing `pseudo: 'noPseudo'` or a
    // breakpoint of 'main' is not the same thing as omitting them.
    const options: { breakpoint?: string; pseudo?: string } = {};
    if (rule.breakpoint !== "main") options.breakpoint = rule.breakpoint;
    if (rule.pseudo) options.pseudo = rule.pseudo;

    await style.setProperties(
      rule.props as Parameters<typeof style.setProperties>[0],
      Object.keys(options).length
        ? (options as Parameters<typeof style.setProperties>[1])
        : undefined,
    );
    applied++;
  }

  log(
    `Styles ready: ${created} created, ${reused} already existed, ${applied} rule sets applied.`,
    "ok",
  );
}

/** Finds the page whose slug matches, e.g. "tools/accessibility-laws". */
async function findPage(slug: string) {
  const items = await webflow.getAllPagesAndFolders();
  for (const item of items) {
    if (item.type !== "Page") continue;
    const page = item as Extract<typeof item, { type: "Page" }>;
    const pageSlug = await page.getSlug();
    // getSlug returns the last path segment; match on that.
    if (pageSlug === slug.split("/").pop()) return page;
  }
  return null;
}

/** Finds `main.page_main` on the current page. */
async function findPageMain() {
  const elements = await webflow.getAllElements();
  for (const el of elements) {
    if (!("getStyles" in el)) continue;
    const styles = await (el as { getStyles: () => Promise<Array<{ getName(): Promise<string> } | null> | null> }).getStyles();
    if (!styles) continue;
    for (const style of styles) {
      if (!style) continue;
      if ((await style.getName()) === "page_main") return el;
    }
  }
  return null;
}

async function buildPage(body: PageBody): Promise<boolean> {
  log(`— ${body.slug}`);

  const page = await findPage(body.slug);
  if (!page) {
    log(`  No page with slug "${body.slug}". Skipped.`, "fail");
    return false;
  }

  await webflow.switchPage(page);

  const main = await findPageMain();
  if (!main) {
    log(`  No element with the page_main class. Skipped.`, "fail");
    return false;
  }

  // Never append into a page that already has content: running this twice would
  // otherwise silently produce the body twice, and there is no undo here.
  const children = await (main as { getChildren: () => Promise<unknown[]> }).getChildren();
  if (children.length > 0) {
    log(
      `  page_main already has ${children.length} child element(s). Skipped — clear it first if you meant to rebuild.`,
      "warn",
    );
    return false;
  }

  if (typeof webflow.insertElementFromWHTML !== "function") {
    log(
      "  This Designer build has no insertElementFromWHTML. Update the Webflow Designer and retry.",
      "fail",
    );
    return false;
  }

  await webflow.insertElementFromWHTML(body.html, main as never, "append");
  const after = await (main as { getChildren: () => Promise<unknown[]> }).getChildren();
  log(`  Inserted. page_main now has ${after.length} child element(s).`, "ok");
  return true;
}

async function run(only?: string) {
  const button = document.getElementById("build") as HTMLButtonElement | null;
  if (button) button.disabled = true;

  try {
    await ensureStyles();
    const targets = only ? PAGE_BODIES.filter((p) => p.slug === only) : PAGE_BODIES;
    let done = 0;
    for (const body of targets) {
      if (await buildPage(body)) done++;
    }
    log(
      `Finished: ${done} of ${targets.length} page${targets.length === 1 ? "" : "s"} built.`,
      done === targets.length ? "ok" : "warn",
    );
    log("Check each page, then publish to staging.", "ok");
  } catch (err) {
    log(`Stopped: ${err instanceof Error ? err.message : String(err)}`, "fail");
  } finally {
    if (button) button.disabled = false;
  }
}

// --- wire up the UI ---------------------------------------------------------

const list = document.getElementById("pages");
if (list) {
  for (const body of PAGE_BODIES) {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "secondary";
    btn.textContent = body.slug;
    btn.onclick = () => void run(body.slug);
    li.appendChild(btn);
    list.appendChild(li);
  }
}

const buildAll = document.getElementById("build");
if (buildAll) buildAll.onclick = () => void run();
