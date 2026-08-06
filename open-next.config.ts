import { defineCloudflareConfig } from "@opennextjs/cloudflare";

/**
 * OpenNext adapter config for the Cloudflare Workers runtime that Webflow Cloud runs on.
 *
 * Deliberately minimal. Incremental cache / tag cache / queue overrides are NOT enabled:
 * Webflow Cloud replaces Cache-Control with `private, no-cache` on every response, so a
 * cache layer here would add worker bundle weight for no benefit. The 10 MB bundle
 * ceiling is the binding constraint on this app.
 */
export default defineCloudflareConfig({});
