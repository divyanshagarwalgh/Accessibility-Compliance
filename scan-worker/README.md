# Scan worker

Renders a page with Cloudflare Browser Rendering, runs axe-core against it, and posts
the findings back to the Webflow Cloud app's callback.

Separate from the app for three reasons:

1. Webflow Cloud kills a request at 20 seconds. A render plus an axe pass is
   routinely longer.
2. Webflow Cloud provisions only D1, KV and R2 — there is no way to attach a
   Browser Rendering binding to it.
3. axe-core is ~700KB. Keeping it out of the app protects the 10MB worker ceiling.

## Config notes

`wrangler.json` is deliberately minimal. Two things that do NOT belong in it:

- **`limits.cpu_ms`** — rejected on the Workers Free plan with
  `CPU limits are not supported for the Free plan [code: 100328]`. It is not needed
  either: this worker spends its time waiting on the browser over I/O, not burning
  CPU, and I/O wait does not count toward the CPU limit.
- **`//`-prefixed keys as comments** — `wrangler.json` is strict JSON, not JSONC, and
  unknown top-level fields produce a warning on every deploy. Notes live here instead.

## Deploy

```bash
node ./node_modules/wrangler/bin/wrangler.js login
node ./node_modules/wrangler/bin/wrangler.js deploy
node ./node_modules/wrangler/bin/wrangler.js secret put SHARED_SECRET
```

Then set `SCAN_SERVICE_URL` (the deployed worker URL) and `SCAN_CALLBACK_SECRET`
(the same secret) in the Webflow Cloud environment, and redeploy that environment.

## Plan limits

Browser Rendering works on Free, but with **3 concurrent browsers** and a daily
browser-time budget. Workers Paid raises concurrency to **120**. Free is fine for
testing; it will throttle immediately under real traffic.

## Contract

`POST /` with `Authorization: Bearer <SHARED_SECRET>` and

```json
{ "scanId": "...", "url": "https://...", "callbackUrl": "https://.../app/api/scan/callback" }
```

Returns `202` immediately. Progress and results are posted to `callbackUrl` with the
same bearer secret. Failure modes reported back: `robots_disallowed`, `fetch_403`,
`fetch_404`, `fetch_5xx`, `not_html`, `render_timeout`, `render_crash`.
