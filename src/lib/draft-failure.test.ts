import { describe, expect, it } from "vitest";
import { draftFailureMessage } from "./draft-failure";

describe("draftFailureMessage", () => {
  it("names the unreachable-image cause when the error points at one", () => {
    // What the API actually says when it cannot fetch an image by URL.
    const message = draftFailureMessage(
      new Error("Could not fetch the image from the provided url"),
    );
    expect(message).toContain("could not be fetched from its URL");
    expect(message).toContain("reachable without a login");
  });

  it("stays vague when the cause is not recognisable", () => {
    const message = draftFailureMessage(new Error("upstream connect timeout"));
    expect(message).not.toContain("image");
    expect(message).toContain("needs no model");
  });

  it("always says the classification survived", () => {
    // The point of the whole branch: the half that needed no model did not fail,
    // and throwing it away with a 500 is the bug this replaced.
    for (const err of [new Error("bad image url"), new Error("boom"), "not an error", null]) {
      expect(draftFailureMessage(err)).toMatch(/classification/i);
    }
  });

  it("handles a non-Error throw without crashing", () => {
    expect(draftFailureMessage({ weird: true })).toContain("Drafting failed");
  });
});
