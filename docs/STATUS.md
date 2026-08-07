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
| 7 | Module screens: statement, VPAT, alt text, monitoring dashboard, app index | `next build` emits all five routes; see below |
| 7 | `.docx` export for the statement and the VPAT | 25 tests; **both packages validated with a ZIP and OPC reader that is not ours** — see below |
| — | Lead capture → Brevo list 4 | Verified live: `sync: {attempted: true, synced: true}`, contact lands with `listIds: [4]` |
| — | Cloudflare **Workers Paid** | Confirmed by a deploy accepting `limits.cpu_ms`, which Free rejects. Browser Rendering now 120 concurrent, not 3 |

**Test totals:** 257 — 196 app + 56 component + 5 scan worker. Typecheck clean in
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

### The module screens

Five routes, all building on the same shared stylesheet
(`src/styles/modules.module.css`) and the Lumos token bridge:

| Route | What |
|---|---|
| `/` | App index: a scan form and the five modules. Replaces the Phase 1 hello-world |
| `/jurisdiction` | Markets and business traits in, regimes out; recomputes on every tick |
| `/statement` | Form → generated statement, Rendered / HTML preview, copy, `.html`, `.txt`, `.docx` |
| `/vpat` | Edition toggles, counts, the 55-row table with a filter, `.csv` and `.docx` |
| `/alt-text` | Audit from a scan or a pasted list, four stat cards, editable drafts |
| `/monitoring` + `/monitoring/[id]` | Create a monitor; trend chart, run history, activity, schedule |

The dashboard reads D1 directly rather than calling `GET /api/monitors` — it is a
server component in the same worker, so a fetch would be a round trip to itself.

`src/lib/api-path.ts` replaced the relative-path `fetch` calls in `EmailGate` and
`ScanProgress`. Those resolved correctly only from the depth their `..` count
assumed; the mount path is now inlined from `next.config.ts` at build time and
still lives in exactly one place.

### The `.docx` export is real OOXML, and was checked as such

`src/lib/zip.ts` is a hand-written store-only ZIP writer — the Workers runtime
has no `fs`, no `Buffer` and no `zlib`, and the alternative was tens of
kilobytes of dependency against a 10 MB ceiling. `src/documents/docx.ts` builds
the five package parts on top of it.

The verification is the point here. The unit tests substring-matched, passed,
and were **wrong**: the first version of the table emitted border attributes as
child elements — `<w:top w:val="single" <w:sz w:val="4"/>/>` — which is not XML.
Extracting the file with .NET's `ZipFile` and `System.IO.Packaging.Package`
caught it immediately. Both documents now parse in every part and the OPC
package opens; the VPAT is 56 rows in one table across 288 paragraphs. A
well-formedness check is now a test, so that class of bug fails here rather than
on a procurement team's desk.

### The tool now passes its own audit

Staging's `robots.txt` is `Disallow: /` and our scanner respects robots.txt, so
the app **cannot** audit itself there. axe-core 4.10.2 was run in-page against
every screen instead. It found three real failures, and writing the fix for one
surfaced a fourth:

| Failure | Where | Measured |
|---|---|---|
| White on brand orange | every primary button, incl. the report screen since Phase 4 | 3.32:1 |
| Caveat body on the dark slab | `--swatch--light-faded` is `#e9eaeb26`, a 15% alpha overlay meant for borders; over `--swatch--dark` it composites to `#393939` | 1.5:1 |
| Two region landmarks named "Run history" | monitoring dashboard: the section and the scroll region inside it | 1.3.1 |
| Focused anchor targets under the new header | `scroll-margin-top` was 64px against a 68px header | 2.4.11 |

All four are fixed, and two lessons are worth keeping:

- **The alpha overlay tokens (`--swatch--light-faded`, `--swatch--dark-faded`)
  are for borders, never text.** `--swatch--muted-on-dark` (`#a8a8a8`, 7.32:1)
  was added for body copy on a dark slab.
- **The whole Lumos size scale is fluid `clamp()`, so a token named `5rem` is
  not 5rem.** The first attempt at the scroll-margin fix used
  `--_spacing---space--10` on that assumption and measured **68.46px against a
  68.8px header** — still short, and 48px on a phone. `--app--header-height` is
  now a fixed variable and the scroll margin derives from it. Reading the
  computed value in the browser is what caught this; the token name did not.

Every screen reports **zero axe violations** at the wcag2a/2aa/21a/21aa/22aa and
best-practice tags, on desktop and at 375px. At mobile width the page never
scrolls horizontally and the 55-row VPAT table scrolls inside its own box and is
reachable by keyboard.

### Chrome and monitor controls

A sticky 68px header, per design-inventory §1.1 — and deliberately **no footer**,
which the same section specifies for report and module screens.

Monitors can be paused and deleted. Pausing takes only the monitor id, because
the id is already the capability for reading the dashboard; deleting also takes
the owner email, because it is the one action that destroys data. Pausing clears
`next_run_at` as well as the flag — leaving a stale timestamp would fire a
backlog of overdue runs on resume.

---

## Blocked — needs a credential I do not have

### 1. Brevo — working, but leads arrive without their attributes

**Resolved since the last update.** `BREVO_API_KEY` and `BREVO_LIST_ID` (= 4, "Claude Tools
Webyansh") are set in both `.env.local` and Webflow Cloud, and lead sync is verified live: the app
returns `sync: {attempted: true, synced: true}` and the contact lands with `listIds: [4]`.

Three things had to be untangled, all recorded in the `webyansh-brevo-integration` memory:
the Brevo **MCP** key is not a REST key (both it and the `xkeysib-` value it wraps 401);
Brevo's *"Blocking unauthorized IP addresses"* panel reads backwards, where `Activated` means the
block is on; and the actual cause of the empty list was a missing `BREVO_LIST_ID` in Webflow Cloud,
which made the app skip the sync entirely without erroring.

**What is still outstanding: the four contact attributes do not exist**, and Brevo silently
discards attributes it does not know. Leads therefore arrive bare — `attributes: {}` — and the list
is not segmentable, which the roadmap requires ("tagged with tool, module, input domain and
score"). Create at **Contacts → Settings → Contact attributes**: `SCAN_DOMAIN` (text),
`SCAN_SCORE` (number), `SOURCE_TOOL` (text), `WANTS_RESCAN` (boolean).

A test contact `a11y-verify-final@webyansh.com` sits in list 4 and can be deleted.

<details>
<summary>Superseded: the original "needs a REST API key" note</summary>

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

</details>

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

### 4. Applying the `/tools/*` page bodies — THE launch blocker

The four bodies are written, and now **validated**: `node webflow-pages/validate.mjs`
checks every constraint the Designer enforces and all four pass. They will paste
correctly.

Re-tested against Webflow MCP **2.0.1** on 7 August. Still blocked, and now
diagnosed precisely rather than guessed at:

- Scalar parameters marshal fine — `webflow_guide_tool` returns, and
  `data_pages_tool` with only `site_id` reaches the server and complains that
  `actions` is missing. **Arrays do not**: with no `properties` in the advertised
  schema the client has no type to marshal against, sends a string, and the
  server rejects its own request. Not fixable from the calling side.
- `ask_webflow_ai` takes a plain `message` string and *does* marshal — but the
  service behind it returns `Failed to fetch from FAI chat service`.
- `get_more_tools` reports no additional tools.
- The Data API token authenticates and reads the site (`GET /v2/sites/{id}` →
  200); it is the **`pages` scope** that 403s. Granting it would not help — the
  Data API has no create-element endpoint at all, only static-content rewriting
  of existing text nodes.

**This needs a human in the Webflow Designer**, and it is the only thing standing
between the build and a public surface. Instructions, the load-bearing page
skeleton and the staging-publish dance for draft pages are in
[`webflow-pages/README.md`](../webflow-pages/README.md).

Note also that of the six planned `/tools/*` pages only
`/tools/color-contrast-checker` is published on staging; `/tools/accessibility`
is still a **draft** and returns 404. Nothing is on the production domain.

### Browser Rendering throughput

Not blocking, but load-bearing at launch. The account is on **Workers Free**,
which allows **3 concurrent browsers** against Paid's 120. Three is survivable
for launch and will throttle immediately under the traffic
`/tools/color-contrast-checker` is aimed at.

---

## Where to pick up

Phases 0–7 are complete and the app passes its own audit. Everything left needs a
human, in this order:

1. **Apply the four `/tools/*` page bodies in the Designer**, then un-draft
   `/tools/accessibility` too. Run `node webflow-pages/validate.mjs` first — all
   four pass today. See item 4 under Blocked for why this cannot be automated.
   **This is the only thing between the build and a public surface, and it is
   where the SEO lives.**
2. **Publish.** Staging is fine to publish freely. Production needs an explicit
   go-ahead and has never been touched — `webyansh.com/tools/*` is 404 today.
3. **Have the jurisdiction copy reviewed by counsel.** `src/lib/jurisdiction.ts`
   says so in its own header; the module tells businesses which laws bind them.
4. **Create the four Brevo contact attributes**, item 1 under Blocked. Leads sync
   but arrive bare.
5. **PDF export.** `.docx` covers the procurement case, which was the one that
   mattered.

Diagnose credential problems with `GET /app/api/health`, which reports a `configured` object of
booleans for what the *running* worker can see. Webflow Cloud reads environment variables at deploy
time only, so "set in the dashboard" and "visible to the worker" are different facts.

---

## Scaffolded, not finished

| Item | State |
|---|---|
| `/tools/accessibility` | Full content, chrome, JSON-LD. **Draft.** |
| `/tools/wcag-compliance-checker` | Body **written** in `webflow-pages/`, not yet applied. |
| `/tools/vpat-generator` | Body **written** in `webflow-pages/`, not yet applied. |
| `/tools/accessibility-statement-generator` | Body **written** in `webflow-pages/`, not yet applied. |
| `/tools/accessibility-laws` | Body **written** in `webflow-pages/`, not yet applied. |
| PDF export | Not written. `.docx` and `.csv` cover the cases that were asked for. |
| Bulk "apply to Webflow CMS" from the alt-text screen | Not built, and deliberately not: the Data API writes a CMS field, but applying drafted alt text without a person reading each line is the failure mode that module exists to prevent. |

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
