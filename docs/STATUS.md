# Build status

Last updated 7 August 2026.

An honest account of what is finished, what is scaffolded, and what is blocked.
Written so the next session — or the next person — does not have to guess.

---

## Complete and verified

| Phase | What | Evidence |
|---|---|---|
| 0 | Discovery: design inventory, Lumos variables, Lumos audit, rule extraction | 4 docs in `docs/` |
| 1 | Webflow Cloud app at `/app`, D1 + KV + R2 bound | `GET /app/api/health` returns `ok` with all three reachable, live on staging |
| 2 | Contrast maths + `ContrastChecker` code component | 56 tests; published to Workspace, installed on site, placed on the page |
| 2 | `/tools/color-contrast-checker` native page | Verified on staging: SSR emits the real `2.59:1`, heading order has 0 skips |
| 3 | Rule engine: 13 rules, axe mapping, CMS detection, scoring | 96 app tests |
| 3 | Scan worker deployed and running | Live at `webyansh-a11y-scan.divyanshgraphic.workers.dev`, startup 43 ms |
| 3 | **End-to-end scan, verified live** | See below |
| 3 | SSRF protection on the scan endpoint | 15 tests covering loopback, RFC1918, link-local, cloud metadata |
| 4 | `/report/[scanId]`: progress, gate, all error states | Builds clean; worker 901.91 KiB gzipped (9% of the 10 MB ceiling) |
| 5 | Accessibility statement generator | 21 tests; verified live against a real scan |
| 5 | VPAT 2.5 / ACR generator, all 55 criteria | 16 tests; verified live against a real scan |

**Test totals:** 157 — 96 app + 56 component + 5 scan worker. Typecheck clean in
all three packages. `npm audit`: 0 in the app, 0 in the scan worker, 6 low in
`webflow-components` (`elliptic`, which has no patched release at any version).

### The end-to-end scan now passes

It never had until 7 August. Every scan died with
`render_crash: ReferenceError: __name is not defined`.

Wrangler bundles the scan worker with esbuild and `keepNames` enabled, and
exposes no way to turn it off. axe-core's dist is itself an esbuild build, so our
bundler re-prints it rather than passing it through, wrapping every named
function with esbuild's `__name` helper. `axe.source` — the string injected into
the scanned page — therefore carried 1,815 calls to a helper declared only in the
worker's module scope. Fixed in `scan-worker/src/inject.ts` by shipping esbuild's
helper alongside the code that expects it; five regression tests pin it.

Verified live:

| URL | Result |
|---|---|
| `example.com` | score 100, 0 issues, `axe-core@4.13.0` |
| W3C's inaccessible demo | 62 issues across 8 rules — 36 critical, 23 serious, 3 moderate |

The custom checks fire (`wy-focus-visible` found 14 nodes), several axe rules
merge into one of ours (33 nodes under a single `alt`), every rule carries
Webflow steps, and gating holds: score, severity and rule names are public while
remediation stays behind the email.

---

## Blocked — needs a credential I do not have

### 1. Brevo list id

`BREVO_API_KEY` and `BREVO_LIST_ID` are read from the environment. The roadmap
requires a **new** list for accessibility leads, not the existing list 3. Lead
capture works without them — the lead is stored in D1 with `brevo_synced = 0` and
can be replayed — but nothing reaches Brevo until they are set.

### 2. Anthropic API key

`ANTHROPIC_API_KEY` is needed for the alt-text auditor (Phase 5). Detection is
already covered by the `alt` rule in the scanner; what needs the key is drafting
the replacement text, which is the module's entire value.

### 3. Transactional email

Needed for Phase 6 monitoring alerts. No provider chosen yet.

### 4. Applying the `/tools/*` page bodies

The four bodies are written and verified in `webflow-pages/`. They could not be
applied from Claude Code: every page-building Webflow MCP tool takes an
`actions[]` array while the server advertises an empty input schema, so the
client sends a string and the call is rejected — `expected array, received
string`, and even `actions: []` fails. The Data API is not a fallback; the local
CLI token has no `pages` scope, and its static-content endpoint only rewrites
existing text nodes rather than creating elements.

Apply them from an interactive session or the Designer extension. Full
instructions, including the load-bearing page skeleton and the staging-publish
dance for draft pages, are in [`webflow-pages/README.md`](../webflow-pages/README.md).

### Browser Rendering throughput

Not blocking, but load-bearing at launch. The account is on **Workers Free**,
which allows **3 concurrent browsers** against Paid's 120. Three is survivable
for launch and will throttle immediately under the traffic
`/tools/color-contrast-checker` is aimed at.

---

## Scaffolded, not finished

| Item | State |
|---|---|
| `/tools/accessibility` | Full content, chrome, JSON-LD. **Draft.** |
| `/tools/wcag-compliance-checker` | Body **written** in `webflow-pages/`, not yet applied. |
| `/tools/vpat-generator` | Body **written** in `webflow-pages/`, not yet applied. |
| `/tools/accessibility-statement-generator` | Body **written** in `webflow-pages/`, not yet applied. |
| `/tools/accessibility-laws` | Body **written** in `webflow-pages/`, not yet applied. |
| Statement / VPAT UI | Generators and API routes exist; no screen yet. Documents are returned as HTML + text and stored in `documents`. |
| `.docx` export | Not written. The roadmap gates the export, never the answer. |
| Alt-text auditor (Phase 5) | Not written. Needs the Anthropic key. |
| Monitoring (Phase 6) | Schema exists (`monitors`, `monitor_runs`). No cron, no dashboard, no alerting. |

---

## Known API limitation

**The Webflow REST API cannot see code components installed from a library.** With
`Contrast Checker` visible in the Designer, the API returned 204 site components and
zero matches for `isCodeComponent`, `isLibrary`, and an exact name lookup.

Placing one instance by hand exposes the id, after which
`insert_component_instance` should work. Recorded in
[`lumos-audit.md`](lumos-audit.md) §7a:

| Code component | Id |
|---|---|
| Contrast Checker | `f0ded0fc-d582-657b-ec83-bb23d10f525d` |

---

## Guardrails

All seven held.

- No existing page, class, component, variable or CMS collection was modified.
- Everything created is additive, and every new page is a **draft**.
- Published to `.webflow.io` only, `customDomains: []`. **Production untouched.**
- No secrets committed. `.gitignore` covers `.env*`, `.dev.vars`, `.wrangler/`.
- The coverage caveat is generated by one function (`coverageCaveat`) and renders
  on every report, gated or not, including a zero-issue result. The statement
  generator will not emit "fully conformant" from a scan, and the VPAT marks all
  43 criteria it cannot reach as `Not evaluated` rather than omitting them.
- No overlay widget, and the hub page says explicitly that we will not build one.
- Facts about Webflow Cloud, DevLink and Lumos were read from current docs and
  verified against the live site rather than recalled. The WCAG 2.2 criteria list
  was verified the same way — the first list fetched wrongly had 2.5.5 Target Size
  (Enhanced) at Level AA when it is AAA, which a test now pins.
