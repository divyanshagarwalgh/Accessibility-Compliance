import { describe, expect, it } from "vitest";
import { apiPath, appPath } from "./api-path";

// NEXT_PUBLIC_BASE_PATH is not inlined under Vitest, so BASE is "" here. These
// pin the joining rules, which is where the bugs live — the mount path itself is
// verified by the live health check.
describe("apiPath", () => {
  it("prefixes the api segment", () => {
    expect(apiPath("scan")).toBe("/api/scan");
  });

  it("accepts a leading slash", () => {
    expect(apiPath("/scan")).toBe("/api/scan");
  });

  it("does not double the api segment", () => {
    expect(apiPath("api/documents/statement")).toBe("/api/documents/statement");
    expect(apiPath("/api/documents/statement")).toBe("/api/documents/statement");
  });

  it("keeps nested routes intact", () => {
    expect(apiPath(`scan/abc123/status`)).toBe("/api/scan/abc123/status");
  });

  it("never depends on the caller's depth", () => {
    // The whole point: the same string from any route resolves to one place.
    expect(apiPath("lead")).toBe(apiPath("/lead"));
  });
});

describe("appPath", () => {
  it("joins without doubling slashes", () => {
    expect(appPath("report/abc")).toBe("/report/abc");
    expect(appPath("/report/abc")).toBe("/report/abc");
  });
});
