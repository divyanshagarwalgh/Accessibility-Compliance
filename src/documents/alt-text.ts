/**
 * Alt text auditing — the classification half.
 *
 * Splitting this from the drafting half is deliberate. Deciding *what is wrong*
 * with an alt attribute is a rule, not a judgement: it is deterministic,
 * testable without a network call, and identical for every customer. Deciding
 * *what the replacement should say* needs to look at the image, which is the
 * only part that needs a model.
 *
 * ## The four states
 *
 * - `missing`     — no alt attribute at all. A screen reader falls back to
 *                   announcing the filename, so `IMG_4821.jpg` gets read out.
 * - `unhelpful`   — an alt attribute that carries no information: "image",
 *                   "photo", a filename, a bare dimension. Worse than missing
 *                   in one respect — it silences the fallback while adding
 *                   nothing, and automated checkers score it as a pass.
 * - `decorative`  — an image that adds nothing the surrounding copy does not
 *                   already say. The correct fix is `alt=""`, NOT a
 *                   description: announcing a spacer or a decorative flourish
 *                   is noise in a screen reader's ear.
 * - `good`        — has alt text that appears to say something. We do not
 *                   claim it is *right*: whether alt text is meaningful depends
 *                   on why the image is on the page, and no scanner knows that.
 *
 * ## Why `decorative` is a suggestion and never an automatic fix
 *
 * The difference between a decorative icon and a meaningful one is intent. An
 * arrow inside a button that already reads "Next" is decorative; the same arrow
 * as the button's only content is the entire label. We flag the candidates and
 * make a human confirm, which is why `needsHumanReview` is true on every row.
 */

export type AltStatus = "missing" | "unhelpful" | "decorative" | "good";

export type ImageRecord = {
  /** The `src` attribute, used to spot filename-as-alt and icon conventions. */
  src: string;
  /** The current alt attribute. `undefined` = absent; "" = explicitly empty. */
  alt?: string;
  /** Nearby copy, used to judge whether the image is carrying information. */
  surroundingText?: string;
  /** True when the image sits inside a Collection List. */
  inCms?: boolean;
  /** Collection and field, when known. Drives the CMS fix instruction. */
  collectionName?: string;
  fieldHint?: string;
  /** Rendered size, when the scan captured it. Drives the spacer heuristic. */
  width?: number;
  height?: number;
};

export type AltFinding = {
  image: ImageRecord;
  status: AltStatus;
  /** Why we classified it this way, in the user's language. */
  reason: string;
  /** True when the fix belongs on a CMS field rather than the element. */
  isCmsBound: boolean;
  /** Always true. Alt text is a judgement call and we never auto-apply. */
  needsHumanReview: boolean;
};

/**
 * Alt values that pass a naive "has alt" check while telling a user nothing.
 * Matched against the whole trimmed, lowercased value — not as substrings, so
 * a legitimate description containing the word "photo" is untouched.
 */
const UNHELPFUL_EXACT = new Set([
  "image", "img", "photo", "picture", "pic", "graphic", "icon", "logo",
  "banner", "thumbnail", "thumb", "screenshot", "figure", "illustration",
  "untitled", "placeholder", "spacer", "divider", "arrow", "bullet",
  "alt", "alt text", "image of", "picture of", "photo of", "n/a", "na",
  "none", "null", "undefined", "true", "false", "-", "--", ".",
]);

/** Filenames and machine identifiers pasted straight into the alt attribute. */
const FILENAME_LIKE = /\.(jpe?g|png|gif|webp|avif|svg|bmp|tiff?)$/i;
const CAMERA_FILENAME = /^(img|dsc|dscn|pxl|screenshot|photo|image)[\s_-]*\d+$/i;

/** Paths that conventionally hold presentational images. */
const DECORATIVE_PATH = /\/(icons?|sprites?|spacers?|dividers?|ornaments?|decorations?|bullets?|arrows?)\//i;
const DECORATIVE_FILENAME =
  /(^|\/|[-_])(spacer|divider|ornament|flourish|swoosh|squiggle|bg|background|pattern|texture|gradient|blob|shape)[-_.\d]*\.(png|jpe?g|gif|webp|avif|svg)$/i;

/** Below this, an image is almost certainly a spacer or a bullet. */
const TINY_PX = 24;

function filenameOf(src: string): string {
  const withoutQuery = src.split(/[?#]/)[0] ?? src;
  return withoutQuery.split("/").pop() ?? "";
}

/** Strips the extension so "warehouse-robotics.avif" reads as a slug. */
function stemOf(src: string): string {
  return filenameOf(src).replace(FILENAME_LIKE, "");
}

/**
 * True when the alt text is just the filename wearing a hat — the most common
 * form of unhelpful alt, because a CMS import often fills the field this way.
 */
function altIsFilename(alt: string, src: string): boolean {
  const a = alt.trim().toLowerCase();
  if (FILENAME_LIKE.test(a)) return true;
  if (CAMERA_FILENAME.test(a)) return true;

  const stem = stemOf(src).toLowerCase();
  if (!stem) return false;
  // "warehouse-robotics" vs "warehouse robotics" — same string, different
  // separators. A CMS that slugifies the filename produces exactly this.
  const normalise = (s: string) => s.replace(/[-_\s]+/g, " ").trim();
  return normalise(a) === normalise(stem);
}

function looksDecorative(image: ImageRecord): boolean {
  if (
    typeof image.width === "number" &&
    typeof image.height === "number" &&
    image.width <= TINY_PX &&
    image.height <= TINY_PX
  ) {
    return true;
  }
  return DECORATIVE_PATH.test(image.src) || DECORATIVE_FILENAME.test(image.src);
}

export function classifyImage(image: ImageRecord): AltFinding {
  const isCmsBound = image.inCms === true;
  const base = { image, isCmsBound, needsHumanReview: true as const };

  // An explicitly empty alt is a deliberate "this is decorative" statement.
  // Respect it — overriding it would add noise to a screen reader.
  if (image.alt === "") {
    return {
      ...base,
      status: "good",
      reason:
        "Marked decorative with an empty alt attribute. Screen readers will skip it, which is correct if the image carries no information the surrounding text does not.",
    };
  }

  if (image.alt === undefined || image.alt.trim() === "") {
    return {
      ...base,
      status: looksDecorative(image) ? "decorative" : "missing",
      reason: looksDecorative(image)
        ? "No alt attribute, and the file looks presentational. If it is decorative the fix is an empty alt attribute, not a description."
        : "No alt attribute. A screen reader will read the file name aloud instead.",
    };
  }

  const alt = image.alt.trim();
  const lowered = alt.toLowerCase();

  // Decorative is checked BEFORE the unhelpful rules, and the order is the
  // whole point. A spacer whose alt is "spacer" satisfies both, but the two
  // classifications give opposite advice: "unhelpful" tells the user to write
  // a better description, and for a decorative image that is the wrong fix —
  // it makes a screen reader announce something that should be silent. When an
  // image looks presentational, "use an empty alt" is the answer regardless of
  // what the current alt says.
  if (looksDecorative(image)) {
    return {
      ...base,
      status: "decorative",
      reason:
        "The file looks presentational but carries a description. If it is decorative, an empty alt attribute is better than describing it.",
    };
  }

  if (UNHELPFUL_EXACT.has(lowered)) {
    return {
      ...base,
      status: "unhelpful",
      reason: `Alt text reads "${alt}", which tells a screen reader user nothing about the image.`,
    };
  }

  if (altIsFilename(alt, image.src)) {
    return {
      ...base,
      status: "unhelpful",
      reason: `Alt text is the file name rather than a description.`,
    };
  }

  // Very short alt that is not a known-good short label. Two characters cannot
  // describe an image, but they can legitimately be a logo's wordmark, so this
  // is the weakest signal here and stays at "unhelpful" rather than "missing".
  if (alt.length < 3) {
    return {
      ...base,
      status: "unhelpful",
      reason: `Alt text is only ${alt.length} character${alt.length === 1 ? "" : "s"} long, which is unlikely to describe the image.`,
    };
  }

  return {
    ...base,
    status: "good",
    reason:
      "Has alt text. Whether it is meaningful depends on why the image is on the page, which only a person can judge.",
  };
}

export type AltAudit = {
  findings: AltFinding[];
  counts: Record<AltStatus, number>;
  /** Images a person needs to act on: missing, unhelpful, or decorative. */
  needsActionCount: number;
  guidance: string;
};

export const ALT_TEXT_GUIDANCE =
  "Drafts are generated from the image, the surrounding copy and the page title. " +
  "They are a starting point. Alt text depends on why the image is there, and only " +
  "you know that. Decorative images should carry an empty alt attribute rather than " +
  "a description, and a wrong description is worse than none.";

export function auditImages(images: ImageRecord[]): AltAudit {
  const findings = images.map(classifyImage);
  const counts: Record<AltStatus, number> = {
    missing: 0,
    unhelpful: 0,
    decorative: 0,
    good: 0,
  };
  for (const f of findings) counts[f.status]++;

  return {
    findings,
    counts,
    needsActionCount: counts.missing + counts.unhelpful + counts.decorative,
    guidance: ALT_TEXT_GUIDANCE,
  };
}
