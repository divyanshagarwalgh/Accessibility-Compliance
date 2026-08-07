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
| 5 | Alt-text auditor: classification + Claude drafting | 36 tests; classification verified live, drafting verified against the API |
| 6 | Monitoring: hourly cron, regression detection, Brevo alerts | 19 tests; **cron fired live and recorded a baseline run** — see below |

**Test totals:** 212 — 151 app + 56 component + 5 scan worker. Typecheck clean in
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

### Monitoring runs end to end

Verified on 7 August at 05:00 UTC. The scan worker's cron fired, the app
reported `{"due":1,"dispatched":1,"skipped":[]}`, the scan completed at score
100, and the run was recorded with `delta: null` and `alertSent: false` — the
designed behaviour, because a monitor's first run establishes the baseline and
never alerts. `next_run_at` advanced exactly one week.

The clock lives in the scan worker because Webflow Cloud provisions D1/KV/R2 but
exposes no cron trigger. The worker holds no monitor state; it is a doorbell
carrying the shared secret, and the app decides what is due. `run-due` rejects
both an absent and a wrong secret with 401 (verified).

---

## Blocked — needs a credential I do not have

### 1. Brevo — needs a REST API key, not the MCP key

The list exists: **"Claude Tools Webyansh", id 4**, created 7 August. That is the
value for `BREVO_LIST_ID` in `.env.local` (already set) and Webflow Cloud
(**still to add**).

`BREVO_API_KEY` is **not yet usable**. The key in `.env.local` is
`BREVO_MCP_API_KEY`, which Brevo issues for its MCP connector: a 140-character
base64 blob wrapping a REST-shaped value. Neither the wrapper nor the wrapped
value authenticates against `api.brevo.com/v3` — both return `401 Key not
found`. The MCP connector authenticates through its own server-side channel,
which a deployed Worker cannot use.

Generate a standard v3 key at **Brevo → SMTP & API → API Keys** and set it as
`BREVO_API_KEY` in `.env.local` and in Webflow Cloud.

Until then lead capture still records to D1 with `brevo_synced = 0` and is
replayable, and monitoring still records runs and regressions — only the alert
email is suppressed, recorded as `alert_sent = 0`.

### 2. Anthropic API key — set it in Webflow Cloud

The alt-text auditor is **built and deployed**. Classification runs today with
no key. Drafting needs `ANTHROPIC_API_KEY` set in **Webflow Cloud → environment
→ environment variables**, which is a dashboard action.

Until it is set, `POST /api/alt-text` with `draft: true` returns the full
classification plus `draftError: "not_configured"` rather than failing — knowing
which images are wrong is most of the value and needs no model.

Remember that Webflow Cloud reads environment variables **at deploy time only**.
Setting the variable does nothing until the environment redeploys; pushing to
`phase-1-foundation` triggers that.

The request shape is verified against the live API (`claude-opus-5`, structured
outputs, vision by URL).

### 3. Transactional email — resolved, uses Brevo

No separate provider needed. Brevo's SMTP relay is enabled on the account and the
free tier allows 300 sends a day, far more than a regression-only alert policy
uses. Blocked only by the same missing REST key as item 1.

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
| Alt-text UI | Auditor and API route exist; no screen yet. |
| Monitoring dashboard UI | Cron, regression detection and alerting all work; no screen yet. |

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
