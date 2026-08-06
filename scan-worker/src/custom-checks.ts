/**
 * The criteria axe-core does not cover.
 *
 * Three of our thirteen rules have no axe equivalent (see docs/rules-extracted.md):
 *   - 2.4.7  Focus Visible          — no axe rule at all
 *   - 2.4.11 Focus Not Obscured     — no axe rule at all (WCAG 2.2)
 *   - 1.4.4  Resize Text            — axe only checks the viewport meta tag,
 *                                     not whether content actually clips
 *
 * All three need a rendered page with computed styles and layout, which is
 * precisely why the scan runs in a real browser rather than against static HTML.
 *
 * Output is shaped like an axe violation so the mapping layer treats it
 * identically and the report needs no special case.
 */

type PageLike = {
  evaluate: (fn: string) => Promise<unknown>;
  setViewport: (v: { width: number; height: number }) => Promise<void>;
};

type AxeShapedViolation = {
  id: string;
  impact: "minor" | "moderate" | "serious" | "critical";
  help: string;
  description: string;
  nodes: Array<{ target: string[]; html?: string }>;
};

export async function customChecks(page: PageLike): Promise<AxeShapedViolation[]> {
  const out: AxeShapedViolation[] = [];

  // --- 2.4.7 Focus Visible --------------------------------------------------
  // Focus each interactive element and read the computed outline. An element with
  // no outline, no visible box-shadow and no border change has no focus indicator.
  const focusFindings = (await page.evaluate(`(() => {
    const selector = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const els = Array.from(document.querySelectorAll(selector)).slice(0, 60);
    const bad = [];
    for (const el of els) {
      if (!(el instanceof HTMLElement)) continue;
      if (el.offsetParent === null && getComputedStyle(el).position !== 'fixed') continue;
      const before = getComputedStyle(el);
      const beforeShadow = before.boxShadow;
      const beforeBorder = before.borderColor;
      try { el.focus({ preventScroll: true }); } catch { continue; }
      const after = getComputedStyle(el);
      const outlineWidth = parseFloat(after.outlineWidth || '0');
      const hasOutline = outlineWidth > 0 && after.outlineStyle !== 'none';
      const shadowChanged = after.boxShadow !== beforeShadow && after.boxShadow !== 'none';
      const borderChanged = after.borderColor !== beforeBorder;
      if (!hasOutline && !shadowChanged && !borderChanged) {
        let sel = el.tagName.toLowerCase();
        if (el.id) sel += '#' + el.id;
        else if (el.className && typeof el.className === 'string') {
          sel += '.' + el.className.trim().split(/\\s+/).slice(0, 2).join('.');
        }
        bad.push({ selector: sel, html: el.outerHTML.slice(0, 200) });
      }
    }
    try { document.activeElement instanceof HTMLElement && document.activeElement.blur(); } catch {}
    return bad;
  })()`)) as Array<{ selector: string; html: string }>;

  if (focusFindings.length > 0) {
    out.push({
      id: "wy-focus-visible",
      impact: "serious",
      help: "Focus indicator has been removed",
      description:
        "Interactive elements show no visible change when focused, so keyboard users cannot see where they are.",
      nodes: focusFindings.map((f) => ({ target: [f.selector], html: f.html })),
    });
  }

  // --- 2.4.11 Focus Not Obscured (WCAG 2.2) ---------------------------------
  // Anchor targets sitting under a sticky or fixed header when focused.
  const obscuredFindings = (await page.evaluate(`(() => {
    const sticky = Array.from(document.querySelectorAll('*')).filter((el) => {
      const s = getComputedStyle(el);
      return (s.position === 'sticky' || s.position === 'fixed') && el.getBoundingClientRect().top <= 0.5;
    });
    if (sticky.length === 0) return [];
    const maxOverlay = Math.max(...sticky.map((el) => el.getBoundingClientRect().bottom));
    if (!(maxOverlay > 0)) return [];

    const targets = Array.from(document.querySelectorAll('[id]')).slice(0, 80);
    const bad = [];
    for (const el of targets) {
      if (!(el instanceof HTMLElement)) continue;
      const scrollMargin = parseFloat(getComputedStyle(el).scrollMarginTop || '0');
      if (scrollMargin >= maxOverlay) continue;
      const referenced = document.querySelector('a[href="#' + CSS.escape(el.id) + '"]');
      if (!referenced) continue;
      bad.push({ selector: '#' + el.id, html: el.outerHTML.slice(0, 150) });
    }
    return bad;
  })()`)) as Array<{ selector: string; html: string }>;

  if (obscuredFindings.length > 0) {
    out.push({
      id: "wy-focus-obscured",
      impact: "minor",
      help: "Focused element is hidden behind sticky header",
      description:
        "Anchor targets have less scroll-margin-top than the height of the sticky header above them, so tabbing to them hides them.",
      nodes: obscuredFindings.map((f) => ({ target: [f.selector], html: f.html })),
    });
  }

  // --- 1.4.4 Resize Text ----------------------------------------------------
  // Narrow the viewport to 640px, which is equivalent to 200% zoom at 1280px, and
  // look for elements whose content overflows a fixed height.
  try {
    await page.setViewport({ width: 640, height: 900 });
    const clipped = (await page.evaluate(`(() => {
      const bad = [];
      const els = Array.from(document.querySelectorAll('div,section,header,nav,li,p,h1,h2,h3,button,a')).slice(0, 400);
      for (const el of els) {
        if (!(el instanceof HTMLElement)) continue;
        const s = getComputedStyle(el);
        const fixedHeight = s.height !== 'auto' && !s.height.includes('%');
        const hidden = s.overflow === 'hidden' || s.overflowY === 'hidden';
        if (!fixedHeight || !hidden) continue;
        if (el.scrollHeight > el.clientHeight + 2 && el.clientHeight > 0) {
          let sel = el.tagName.toLowerCase();
          if (el.id) sel += '#' + el.id;
          else if (el.className && typeof el.className === 'string') {
            sel += '.' + el.className.trim().split(/\\s+/).slice(0, 2).join('.');
          }
          bad.push({ selector: sel, html: el.outerHTML.slice(0, 150) });
        }
      }
      return bad.slice(0, 25);
    })()`)) as Array<{ selector: string; html: string }>;

    if (clipped.length > 0) {
      out.push({
        id: "wy-resize-clipped",
        impact: "moderate",
        help: "Content is clipped at 200% zoom",
        description:
          "Containers with a fixed height and hidden overflow cut off their own content when text is enlarged.",
        nodes: clipped.map((f) => ({ target: [f.selector], html: f.html })),
      });
    }
  } finally {
    await page.setViewport({ width: 1440, height: 900 });
  }

  return out;
}
