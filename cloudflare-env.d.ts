/**
 * Bindings and environment variables available to the Worker.
 *
 * Storage bindings mirror wrangler.json. Webflow Cloud reads those bindings at deploy
 * time and provisions the real resources per environment, replacing the placeholder ids.
 *
 * Regenerate with: npm run cf-typegen
 */
interface CloudflareEnv {
  /** D1 (SQLite) — durable records: scans, issues, pages, leads, monitors, documents. */
  DB: D1Database;

  /** KV — hot, short-lived scan status for 2s client polling. Never poll D1 for status. */
  KV: KVNamespace;

  /** R2 — generated PDFs and raw axe-core JSON. */
  ARTIFACTS: R2Bucket;

  // --- Environment variables (set in Webflow Cloud env settings, never committed) ---

  /** Base URL of the external scan service (Cloudflare Browser Rendering worker). */
  SCAN_SERVICE_URL?: string;
  /** Shared secret authenticating both scan dispatch and the result callback. */
  SCAN_CALLBACK_SECRET?: string;
  /** Brevo API key for lead sync. */
  BREVO_API_KEY?: string;
  /** Brevo list id for accessibility leads — a NEW list, not the existing list 3. */
  BREVO_LIST_ID?: string;
  /** Anthropic API key for alt-text drafting. */
  ANTHROPIC_API_KEY?: string;

  /** Injected by Webflow Cloud: the mount path, e.g. "/a11y". */
  BASE_URL?: string;
  /** Injected by Webflow Cloud: URL prefix for static assets. */
  ASSETS_PREFIX?: string;
}
