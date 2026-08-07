import { describe, expect, test } from "vitest";
import { ALT_TEXT_GUIDANCE, auditImages, classifyImage } from "./alt-text";

const img = (over: Partial<Parameters<typeof classifyImage>[0]> = {}) =>
  classifyImage({ src: "/images/hero-dashboard.avif", ...over });

describe("missing alt", () => {
  test("flags an absent alt attribute", () => {
    const f = img({ alt: undefined });
    expect(f.status).toBe("missing");
    expect(f.reason).toMatch(/read the file name aloud/i);
  });

  test("treats whitespace-only alt as missing", () => {
    expect(img({ alt: "   " }).status).toBe("missing");
  });

  test("routes a missing alt on a presentational file to decorative", () => {
    // The fix differs: a description for content, an empty alt for decoration.
    expect(img({ src: "/icons/arrow-right.svg", alt: undefined }).status).toBe("decorative");
  });
});

describe("explicitly empty alt", () => {
  test("is respected as a deliberate decorative marker", () => {
    // alt="" is a statement, not an omission. Overriding it would make a
    // screen reader announce something the user deliberately silenced.
    const f = img({ alt: "" });
    expect(f.status).toBe("good");
    expect(f.reason).toMatch(/marked decorative/i);
  });
});

describe("unhelpful alt", () => {
  test.each([
    "image", "img", "photo", "picture", "graphic", "icon", "logo",
    "thumbnail", "placeholder", "spacer", "arrow", "untitled", "n/a", "-",
  ])("flags the placeholder value %j", (alt) => {
    expect(img({ alt }).status).toBe("unhelpful");
  });

  test("is case and whitespace insensitive", () => {
    expect(img({ alt: "  IMAGE  " }).status).toBe("unhelpful");
  });

  test("flags a filename pasted into the alt attribute", () => {
    expect(img({ alt: "hero-dashboard.avif" }).status).toBe("unhelpful");
    expect(img({ alt: "IMG_4821" }).status).toBe("unhelpful");
    expect(img({ alt: "DSC00123" }).status).toBe("unhelpful");
  });

  test("flags a slugified filename, which is how a CMS import fills the field", () => {
    const f = classifyImage({
      src: "/blog/warehouse-robotics.avif",
      alt: "warehouse robotics",
    });
    expect(f.status).toBe("unhelpful");
    expect(f.reason).toMatch(/file name/i);
  });

  test("flags alt too short to describe anything", () => {
    expect(img({ alt: "ab" }).status).toBe("unhelpful");
  });

  test("does not flag a real description that merely contains a stop word", () => {
    // "photo" as a whole value is unhelpful; "photo" inside a sentence is not.
    const f = img({ alt: "A photo of the Denver team outside the office" });
    expect(f.status).toBe("good");
  });
});

describe("decorative candidates", () => {
  test("flags images under an icons or spacers path", () => {
    expect(classifyImage({ src: "/icons/chevron.svg", alt: "chevron pointing right" }).status)
      .toBe("decorative");
    expect(classifyImage({ src: "/assets/spacers/gap.png", alt: "gap" }).status)
      .toBe("decorative");
  });

  test("decorative beats unhelpful when both would match", () => {
    // "/spacers/gap.png" with alt "gap" is both a filename-as-alt and a
    // decorative file. The two give opposite advice — write a better
    // description vs. use an empty alt — and for a spacer the second is right.
    // Calling it unhelpful would send the user to add screen-reader noise.
    const f = classifyImage({ src: "/assets/spacers/gap.png", alt: "gap" });
    expect(f.status).toBe("decorative");
    expect(f.reason).toMatch(/empty alt attribute is better/i);
  });

  test("flags images whose filename reads as decoration", () => {
    expect(classifyImage({ src: "/media/background-pattern.png", alt: "pattern" }).status)
      .toBe("decorative");
  });

  test("flags anything rendered at 24px or under", () => {
    const f = classifyImage({
      src: "/media/dot.png",
      alt: "a small blue dot",
      width: 12,
      height: 12,
    });
    expect(f.status).toBe("decorative");
    expect(f.reason).toMatch(/empty alt attribute is better/i);
  });

  test("leaves a large image on a normal path alone", () => {
    expect(classifyImage({
      src: "/media/team-photo.avif",
      alt: "The team outside the Denver office",
      width: 1200,
      height: 800,
    }).status).toBe("good");
  });
});

describe("good alt", () => {
  test("does not claim the text is correct, only that it exists", () => {
    // Guardrail 5: whether alt text is meaningful is not machine-decidable.
    const f = img({ alt: "The Cascade Ops dashboard showing live shipment routes" });
    expect(f.status).toBe("good");
    expect(f.reason).toMatch(/only a person can judge/i);
  });
});

describe("CMS binding", () => {
  test("carries the CMS flag through, because the fix lands elsewhere", () => {
    // Fixing the element only fixes the first Collection List item, and the
    // next publish overwrites it.
    const f = classifyImage({
      src: "/blog/cold-chain.avif",
      alt: undefined,
      inCms: true,
      collectionName: "Blog posts",
      fieldHint: "Thumbnail",
    });
    expect(f.isCmsBound).toBe(true);
    expect(f.image.collectionName).toBe("Blog posts");
  });

  test("defaults to not CMS-bound", () => {
    expect(img({ alt: "x y z" }).isCmsBound).toBe(false);
  });
});

describe("every finding needs human review", () => {
  test("holds for all four statuses", () => {
    const all = [
      img({ alt: undefined }),
      img({ alt: "image" }),
      classifyImage({ src: "/icons/x.svg", alt: "x mark" }),
      img({ alt: "A meaningful description of the image" }),
    ];
    expect(all.every((f) => f.needsHumanReview)).toBe(true);
    expect(new Set(all.map((f) => f.status)).size).toBe(4);
  });
});

describe("auditImages", () => {
  const images = [
    { src: "/hero.avif" },                                   // missing
    { src: "/blog/a.avif", alt: undefined, inCms: true },     // missing
    { src: "/logo-acme.svg", alt: "image" },                  // unhelpful
    { src: "/icons/arrow.svg", alt: "arrow" },                // decorative (path wins)
    { src: "/media/pattern-bg.png", alt: "a repeating pattern" }, // decorative
    { src: "/team.avif", alt: "The team outside the office" },    // good
  ];

  test("counts every status", () => {
    const audit = auditImages(images);
    expect(audit.counts.missing).toBe(2);
    expect(audit.counts.unhelpful).toBe(1);
    expect(audit.counts.decorative).toBe(2);
    expect(audit.counts.good).toBe(1);
  });

  test("counts what a person still has to act on", () => {
    expect(auditImages(images).needsActionCount).toBe(5);
  });

  test("carries the guidance that a wrong description is worse than none", () => {
    const audit = auditImages(images);
    expect(audit.guidance).toBe(ALT_TEXT_GUIDANCE);
    expect(audit.guidance).toMatch(/wrong description is worse than none/i);
    expect(audit.guidance).toMatch(/empty alt attribute/i);
  });

  test("handles an empty page", () => {
    const audit = auditImages([]);
    expect(audit.findings).toHaveLength(0);
    expect(audit.needsActionCount).toBe(0);
  });
});
