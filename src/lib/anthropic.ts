import Anthropic from "@anthropic-ai/sdk";
import { getEnv } from "./bindings";
import type { AltFinding } from "@/documents/alt-text";

/**
 * Alt-text drafting.
 *
 * The only part of the product that calls a model at runtime. Everything else —
 * the rule engine, the scoring, the statement and VPAT generators, the alt-text
 * *classification* — is deterministic on purpose, so a scan produces the same
 * report twice and the methodology page can show its working.
 *
 * Drafting is the exception because it genuinely needs to look at the image.
 *
 * ## What the prompt has to get right
 *
 * Alt text is one of the few places where a confident wrong answer is worse
 * than no answer: a screen reader user has no way to tell that "a team photo"
 * is actually a product screenshot, and they will act on it. So the prompt is
 * built around three rules that the guidance copy also states to the user:
 *
 *   1. Decorative images get an empty alt, never a description. Announcing a
 *      spacer is noise; the model must be willing to return "".
 *   2. Describe what the image *conveys in context*, not what it depicts. The
 *      same photo needs different alt text on an About page and a case study.
 *   3. No "image of" / "picture of" prefix — a screen reader already says it.
 *
 * Every draft comes back for review. Nothing here is applied automatically.
 */

export class AnthropicNotConfigured extends Error {
  constructor() {
    super(
      "ANTHROPIC_API_KEY is not set in this environment. Alt-text drafting is " +
        "unavailable; classification still works without it.",
    );
    this.name = "AnthropicNotConfigured";
  }
}

/** Refusal is a normal HTTP 200 outcome, not an error. Surfaced as its own type. */
export class AnthropicRefused extends Error {
  constructor(readonly category: string | null) {
    super(`The model declined to draft alt text for this batch (${category ?? "unspecified"}).`);
    this.name = "AnthropicRefused";
  }
}

async function getClient(): Promise<Anthropic> {
  const env = (await getEnv()) as unknown as { ANTHROPIC_API_KEY?: string };
  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new AnthropicNotConfigured();
  return new Anthropic({ apiKey });
}

const DRAFT_SCHEMA = {
  type: "object",
  properties: {
    drafts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          index: {
            type: "integer",
            description: "The image index given in the prompt.",
          },
          decorative: {
            type: "boolean",
            description:
              "True when the image carries no information the surrounding text does not already give. Its alt must then be an empty string.",
          },
          alt: {
            type: "string",
            description:
              "The drafted alt text. Empty string when decorative is true. No 'image of' or 'photo of' prefix.",
          },
          confident: {
            type: "boolean",
            description:
              "False when the image is ambiguous or the purpose is unclear from the context given.",
          },
        },
        required: ["index", "decorative", "alt", "confident"],
        additionalProperties: false,
      },
    },
  },
  required: ["drafts"],
  additionalProperties: false,
} as const;

const SYSTEM = `You draft alternative text for images on a web page, for screen reader users.

Rules, in priority order:

1. If an image carries no information the surrounding text does not already give — a spacer, a background texture, a decorative flourish, an icon beside a label that already says the same thing — set decorative to true and alt to an empty string. Describing a decorative image adds noise a screen reader user cannot skip. Prefer this over inventing a description you are unsure of.
2. Describe what the image conveys in its context on the page, not merely what it depicts. The same photograph needs different alt text in a case study than on an About page.
3. Never begin with "image of", "picture of", "photo of", or "graphic of". A screen reader already announces that it is an image.
4. Be specific and brief. One sentence is almost always enough. Include text that appears in the image if it carries meaning.
5. For a logo, the organisation's name is usually the whole answer.
6. If the image is a chart or diagram, state its subject and the trend or conclusion it shows, not every data point.
7. Set confident to false when the purpose of the image is genuinely unclear from what you were given. A person will review every draft, and an honest "unclear" is more useful than a confident guess.`;

export type AltDraft = {
  index: number;
  alt: string;
  decorative: boolean;
  confident: boolean;
};

export type DraftContext = {
  /** The scanned page's title, for judging what an image is doing there. */
  pageTitle?: string;
  /** The scanned URL. */
  pageUrl?: string;
};

/**
 * Drafts alt text for a batch of images in one request.
 *
 * Batched rather than one call per image so the model can see the set together
 * — that is what lets it notice that six of them are the same icon and that a
 * logo strip is a logo strip.
 *
 * Images are passed by URL. Anything we cannot address as a public URL is
 * skipped rather than guessed at.
 */
export async function draftAltText(
  findings: AltFinding[],
  context: DraftContext = {},
): Promise<AltDraft[]> {
  const drawable = findings.filter((f) => /^https?:\/\//i.test(f.image.src));
  if (drawable.length === 0) return [];

  const client = await getClient();

  const content: Anthropic.ContentBlockParam[] = [];
  content.push({
    type: "text",
    text:
      `Page: ${context.pageTitle ?? "(title unknown)"}\n` +
      `URL: ${context.pageUrl ?? "(unknown)"}\n\n` +
      `Draft alt text for the ${drawable.length} image${drawable.length === 1 ? "" : "s"} below.`,
  });

  drawable.forEach((finding, index) => {
    const { image } = finding;
    const notes = [
      `Image index ${index}`,
      `file: ${image.src.split("/").pop() ?? image.src}`,
      image.alt ? `current alt: "${image.alt}"` : "current alt: none",
      `our classification: ${finding.status}`,
      image.inCms ? `bound to CMS collection "${image.collectionName ?? "unknown"}"` : null,
      image.surroundingText ? `nearby copy: ${image.surroundingText.slice(0, 300)}` : null,
    ]
      .filter(Boolean)
      .join(" · ");

    content.push({ type: "text", text: notes });
    content.push({ type: "image", source: { type: "url", url: image.src } });
  });

  const response = await client.messages.create({
    model: "claude-opus-5",
    max_tokens: 8192,
    system: SYSTEM,
    // Effort is the cost lever here rather than disabling thinking: describing
    // an image is not a reasoning-heavy task, and a disabled-thinking request
    // on this model can leak internal tags into the response.
    output_config: {
      effort: "low",
      format: { type: "json_schema", schema: DRAFT_SCHEMA },
    },
    messages: [{ role: "user", content }],
  });

  // A refusal is a successful HTTP response with an empty or partial body.
  // Reading content[0] without this check would throw on an unrelated line.
  if (response.stop_reason === "refusal") {
    throw new AnthropicRefused(response.stop_details?.category ?? null);
  }

  const text = response.content.find((b) => b.type === "text")?.text ?? "";
  if (!text) return [];

  const parsed = JSON.parse(text) as { drafts: AltDraft[] };

  // Map the model's indices back onto the original findings array, so a caller
  // that passed unreachable images still gets answers lined up correctly.
  return parsed.drafts
    .filter((d) => d.index >= 0 && d.index < drawable.length)
    .map((d) => ({
      ...d,
      // Rule 1 is load-bearing: a decorative image must not carry a description
      // even if the model wrote one anyway.
      alt: d.decorative ? "" : d.alt,
      index: findings.indexOf(drawable[d.index]),
    }));
}
