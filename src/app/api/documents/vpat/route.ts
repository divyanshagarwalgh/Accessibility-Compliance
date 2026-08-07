import { getIssues, getScan, saveDocument } from "@/lib/db";
import { issuesFromRows } from "@/lib/issues";
import { rateLimit, tooManyRequests } from "@/lib/ratelimit";
import { formatReviewDate } from "@/documents/statement";
import { generateVpat, type VpatEdition } from "@/documents/vpat";

export const dynamic = "force-dynamic";

const EDITIONS: VpatEdition[] = ["wcag", "508", "eu"];

/**
 * POST /api/documents/vpat — generate a VPAT 2.5 draft.
 *
 * Every one of the 55 WCAG 2.2 A/AA criteria comes back, including the ones no
 * scanner can reach, which are marked `Not evaluated`. That is the point of the
 * document: a procurement team reads it against their own checklist, and a
 * table that quietly omits what was not tested reads as a table where
 * everything passed.
 *
 * Without a `scanId` the draft is still useful — it is the blank template with
 * the untestable criteria already marked — so the scan is optional here too.
 */
export async function POST(request: Request): Promise<Response> {
  const limit = await rateLimit(request, "vpat", 30, 60 * 60);
  if (!limit.allowed) return tooManyRequests(limit);

  let body: { scanId?: string; productName?: string; edition?: string; evaluatedAt?: number };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const edition = EDITIONS.includes(body.edition as VpatEdition)
    ? (body.edition as VpatEdition)
    : "wcag";

  let productName = String(body.productName ?? "").trim();
  let scanContext: Parameters<typeof generateVpat>[1];
  let scanId: string | null = null;

  if (body.scanId) {
    const scan = await getScan(body.scanId);
    if (!scan) return Response.json({ error: "scan_not_found" }, { status: 404 });
    if (scan.status !== "done") {
      return Response.json(
        { error: "scan_incomplete", message: "That scan has not finished." },
        { status: 409 },
      );
    }
    scanContext = { issues: issuesFromRows(await getIssues(scan.id)) };
    scanId = scan.id;
    if (!productName) productName = scan.domain;
  }

  if (!productName) {
    return Response.json(
      {
        error: "missing_product_name",
        message: "A product name is required when no scan is supplied.",
      },
      { status: 400 },
    );
  }

  // `Number.isFinite`, not `typeof === "number"`: NaN satisfies the latter and
  // formats as "NaN undefined NaN" in the document header.
  const evaluatedAt = Number.isFinite(body.evaluatedAt) ? body.evaluatedAt! : Date.now();

  const vpat = generateVpat(
    { productName, evaluatedAt, edition, evaluatedOn: formatReviewDate(evaluatedAt) },
    scanContext,
  );

  const documentId = await saveDocument({ type: "vpat", scanId, payload: vpat });

  return Response.json({ documentId, scanId, ...vpat });
}
