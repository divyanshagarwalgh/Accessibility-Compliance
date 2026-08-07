/**
 * Builds API URLs that survive the mount path.
 *
 * The app is served from `/app`, not the origin root. `next/link` applies
 * `basePath` for navigation, but `fetch` does not — so a client component
 * calling `fetch("/api/scan")` hits `webflow.io/api/scan`, which is the Webflow
 * site rather than this app, and gets a 404 that looks like a broken route.
 *
 * The obvious workaround is a relative path (`"../api/scan"`), and the first two
 * client components in this app used one. It resolves correctly only when the
 * caller sits at exactly the depth the `..` count assumed: the same string from
 * a nested route, or from a URL that picked up a trailing slash, silently
 * resolves somewhere else. That is a routing bug the type system cannot see, so
 * the depth is removed from the problem entirely.
 *
 * `NEXT_PUBLIC_BASE_PATH` is inlined from `next.config.ts` at build time, which
 * keeps the mount path defined in exactly one place.
 */

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/**
 * `apiPath("documents/statement")` → `/app/api/documents/statement`.
 *
 * Accepts the route with or without a leading slash, and with or without the
 * `api/` prefix, because both read naturally at the call site.
 */
export function apiPath(route: string): string {
  const clean = route.replace(/^\/+/, "").replace(/^api\//, "");
  return `${BASE}/api/${clean}`;
}

/** `appPath("report/abc")` → `/app/report/abc`. For `window.location`, not `next/link`. */
export function appPath(route: string): string {
  return `${BASE}/${route.replace(/^\/+/, "")}`;
}
