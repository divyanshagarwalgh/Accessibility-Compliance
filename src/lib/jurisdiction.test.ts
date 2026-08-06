import { describe, expect, test } from "vitest";
import { LEGAL_DISCLAIMER, mapJurisdictions } from "./jurisdiction";

describe("mapJurisdictions", () => {
  test("selling to EU consumers triggers the EAA and a mandatory statement", () => {
    const result = mapJurisdictions(["eu"], ["private-business"]);
    const eaa = result.regimes.find((r) => r.id === "eaa");
    expect(eaa!.status).toBe("Applies now");
    expect(result.statementMandatory).toBe(true);
  });

  test("a US private business is bound by Title III, not Title II", () => {
    const result = mapJurisdictions(["us"], ["private-business"]);
    expect(result.regimes.find((r) => r.id === "ada-title-iii")!.status).toBe("Applies now");
    expect(result.regimes.find((r) => r.id === "ada-title-ii")!.status).toBe("Does not apply");
  });

  test("selling to a US federal agency triggers Section 508 regardless of market", () => {
    const result = mapJurisdictions(["au"], ["sells-to-us-federal"]);
    expect(result.regimes.find((r) => r.id === "section-508")!.status).toBe("Applies now");
  });

  test("reports the strictest baseline across everything that applies", () => {
    // Section 508 is 2.0 AA and the EAA is 2.1 AA. The answer is the stricter one,
    // because building to 2.0 would leave the EAA unmet.
    const result = mapJurisdictions(["eu"], ["sells-to-us-federal"]);
    expect(result.strictestBaseline).toBe("WCAG 2.1 AA");
  });

  test("lists applicable regimes before inapplicable ones", () => {
    const result = mapJurisdictions(["eu"], ["private-business"]);
    const firstInapplicable = result.regimes.findIndex((r) => r.status !== "Applies now");
    const lastApplicable = result.regimes.map((r) => r.status).lastIndexOf("Applies now");
    expect(lastApplicable).toBeLessThan(firstInapplicable);
  });

  test("selecting nothing binds nothing, and says so rather than guessing", () => {
    const result = mapJurisdictions([], []);
    expect(result.applicableCount).toBe(0);
    expect(result.strictestBaseline).toBe("None selected");
    expect(result.statementMandatory).toBe(false);
  });

  test("always returns the legal disclaimer", () => {
    // Guardrail: this is a planning aid, never legal advice. No caller should be
    // able to render a result without the caveat attached to it.
    for (const input of [[], ["us"], ["eu", "uk", "au"]] as const) {
      expect(mapJurisdictions([...input], []).disclaimer).toBe(LEGAL_DISCLAIMER);
    }
  });

  test("every regime carries a deadline and a standard, never a blank cell", () => {
    const result = mapJurisdictions(["us", "eu", "uk", "ca-on", "au"], ["private-business"]);
    for (const r of result.regimes) {
      expect(r.deadline.length).toBeGreaterThan(0);
      expect(r.standard.length).toBeGreaterThan(0);
      expect(r.note.length).toBeGreaterThan(0);
    }
  });
});
