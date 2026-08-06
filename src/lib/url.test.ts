import { describe, expect, test } from "vitest";
import { validateScanUrl } from "./url";

describe("validateScanUrl — SSRF protection", () => {
  // This endpoint hands a user-supplied URL to a real browser. Without these
  // rejections the scanner becomes a proxy into private networks and cloud
  // metadata services.
  test.each([
    ["http://localhost/admin", "localhost"],
    ["http://127.0.0.1:8080", "loopback"],
    ["http://0.0.0.0", "unspecified address"],
    ["http://169.254.169.254/latest/meta-data/", "cloud metadata"],
    ["http://metadata.google.internal/", "GCP metadata"],
    ["http://10.0.0.5/", "private class A"],
    ["http://192.168.1.1/", "private class C"],
    ["http://172.16.0.1/", "private class B"],
    ["http://printer.local/", "mDNS"],
  ])("rejects %s (%s)", (input) => {
    expect(validateScanUrl(input).ok).toBe(false);
  });

  test("rejects non-http schemes", () => {
    expect(validateScanUrl("file:///etc/passwd").ok).toBe(false);
    expect(validateScanUrl("ftp://example.com").ok).toBe(false);
  });

  test("rejects a bare hostname with no dot", () => {
    expect(validateScanUrl("intranet").ok).toBe(false);
  });

  test("rejects empty input", () => {
    expect(validateScanUrl("").ok).toBe(false);
    expect(validateScanUrl("   ").ok).toBe(false);
  });
});

describe("validateScanUrl — accepting real input", () => {
  test("accepts a bare domain, because that is what people paste", () => {
    const result = validateScanUrl("example.com");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.url.protocol).toBe("https:");
  });

  test("accepts a full URL with a path", () => {
    const result = validateScanUrl("https://example.com/pricing");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.normalised).toBe("https://example.com/pricing");
  });

  test("strips the fragment, which never reaches the server anyway", () => {
    const result = validateScanUrl("https://example.com/a#section");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.normalised).not.toContain("#");
  });

  test("strips tracking parameters so repeat scans of one page group together", () => {
    const result = validateScanUrl("https://example.com/a?utm_source=x&id=7");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.normalised).toContain("id=7");
      expect(result.normalised).not.toContain("utm_source");
    }
  });

  test("normalises away a trailing slash so / and '' are one page", () => {
    const a = validateScanUrl("https://example.com/pricing/");
    const b = validateScanUrl("https://example.com/pricing");
    expect(a.ok && b.ok && a.normalised).toBe(b.ok ? b.normalised : null);
  });

  test("reports the domain without www, for grouping and lead records", () => {
    const result = validateScanUrl("https://www.example.com/x");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.domain).toBe("example.com");
  });
});
