/**
 * URL validation for the scan endpoint.
 *
 * This endpoint takes a user-supplied URL and asks a browser to fetch it, which
 * makes it a server-side request forgery surface. Everything below exists to stop
 * the scanner being used as a proxy into private networks.
 */

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "metadata.google.internal",
  "169.254.169.254", // cloud instance metadata
]);

const PRIVATE_V4 =
  /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.)/;

export type UrlCheck =
  | { ok: true; url: URL; normalised: string; domain: string }
  | { ok: false; reason: string };

export function validateScanUrl(input: string): UrlCheck {
  const trimmed = String(input ?? "").trim();
  if (!trimmed) return { ok: false, reason: "Enter a URL to scan." };

  // Accept "example.com" as well as a full URL — most people paste the former.
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return { ok: false, reason: "That does not look like a valid URL." };
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, reason: "Only http and https URLs can be scanned." };
  }

  const host = url.hostname.toLowerCase();

  if (BLOCKED_HOSTNAMES.has(host) || PRIVATE_V4.test(host) || host.endsWith(".local")) {
    return { ok: false, reason: "That address is not publicly reachable." };
  }

  // A hostname with no dot is either a bare intranet name or a typo.
  if (!host.includes(".")) {
    return { ok: false, reason: "Enter a full public domain, for example example.com." };
  }

  // Strip the fragment and any tracking noise so repeat scans of the same page group.
  url.hash = "";
  for (const p of [...url.searchParams.keys()]) {
    if (/^(utm_|fbclid|gclid|mc_eid|_hs)/i.test(p)) url.searchParams.delete(p);
  }

  return {
    ok: true,
    url,
    normalised: url.origin + url.pathname.replace(/\/$/, "") + url.search,
    domain: host.replace(/^www\./, ""),
  };
}
