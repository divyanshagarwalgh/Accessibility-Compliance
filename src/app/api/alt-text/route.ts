import { getIssues, getScan } from "@/lib/db";
import { rateLimit, tooManyRequests } from "@/lib/ratelimit";
import { auditImages, type ImageRecord } from "@/documents/alt-text";
import {
  AnthropicNotConfigured,
  AnthropicRefused,
  draftAltText,
} from "@/lib/anthropic";

export const dynamic = "force-dynamic";

/**
 * POST /api/alt-text — audit images and, optionally, draft replacements.
 *
 * The audit half is deterministic and always runs. The drafting half needs
 * `ANTHROPIC_API_KEY` and is requested with `draft: true`; without the key the
 * route still returns the full classification rather than failing, because
 * knowing *which* images are wrong is most of the value and does not need a
 * model.
 *
 * Images come either from a completed scan (`scanId`) or straight from the
 * caller (`images`), so the module is usable before the scanner has run.
 */
export async function POST(request: Request): Promise<Response> {
  // Drafting dispatches vision requests, so this is limited harder than the
  // document routes, which are pure computation.
  const limit = await rateLimit(request, "alt-text", 15, 60 * 60);
  if (!limit.allowed) return tooManyRequests(limit);

  let body: { scanId?: string; images?: ImageRecord[]; draft?: boolean };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  let images: ImageRecord[] = Array.isArray(body.images) ? body.images : [];
  let pageUrl: string | undefined;

  if (body.scanId) {
    const scan = await getScan(body.scanId);
    if (!scan) return Response.json({ error: "scan_not_found" }, { status: 404 });
    if (scan.status !== "done") {
      return Response.json(
        { error: "scan_incomplete", message: "That scan has not finished." },
        { status: 409 },
      );
    }
    pageUrl = scan.url;
    images = imagesFromScan(await getIssues(scan.id), scan.url);
  }

  if (images.length === 0) {
    return Response.json(
      {
        error: "no_images",
        message:
          "No images to audit. Supply `images`, or a `scanId` for a scan that found missing alt text.",
      },
      { status: 400 },
    );
  }

  const audit = auditImages(images);

  if (!body.draft) {
    return Response.json({ ...audit, drafted: false });
  }

  // Only images that actually need new text are worth spending a request on.
  const needsDraft = audit.findings.filter((f) => f.status !== "good");

  try {
    const drafts = await draftAltText(needsDraft, { pageUrl });
    return Response.json({
      ...audit,
      drafted: true,
      drafts: drafts.map((d) => ({
        ...d,
        src: needsDraft[d.index]?.image.src,
      })),
    });
  } catch (err) {
    if (err instanceof AnthropicNotConfigured) {
      // Not an error the user can fix, and the audit is still useful.
      return Response.json({
        ...audit,
        drafted: false,
        draftError: "not_configured",
        draftMessage: err.message,
      });
    }
    if (err instanceof AnthropicRefused) {
      return Response.json({
        ...audit,
        drafted: false,
        draftError: "refused",
        draftMessage: err.message,
      });
    }
    throw err;
  }
}

/**
 * Recovers image records from a scan's stored `alt` findings.
 *
 * The scanner stores a slice of each failing element's outerHTML, so the src
 * and any existing alt are parsed back out of it. Relative sources are
 * resolved against the scanned URL — the drafting step needs an address it can
 * actually fetch.
 */
function imagesFromScan(
  rows: Array<{ rule_id: string; selectors: string; is_cms_bound: number; cms_hint: string | null }>,
  pageUrl: string,
): ImageRecord[] {
  const altRow = rows.find((r) => r.rule_id === "alt");
  if (!altRow) return [];

  const nodes = JSON.parse(altRow.selectors) as Array<{ html?: string; text?: string }>;
  const out: ImageRecord[] = [];

  for (const node of nodes) {
    if (!node.html) continue;
    const src = /\bsrc\s*=\s*["']([^"']+)["']/i.exec(node.html)?.[1];
    if (!src) continue;

    // `alt=""` and a missing alt are different states and must stay different.
    const altMatch = /\balt\s*=\s*["']([^"']*)["']/i.exec(node.html);

    let absolute = src;
    try {
      absolute = new URL(src, pageUrl).toString();
    } catch {
      // A data: URI or a malformed src. Keep it — classification still works,
      // and draftAltText skips anything it cannot address.
    }

    out.push({
      src: absolute,
      alt: altMatch ? altMatch[1] : undefined,
      surroundingText: node.text,
      inCms: altRow.is_cms_bound === 1,
      collectionName: altRow.cms_hint ?? undefined,
    });
  }

  return out;
}
