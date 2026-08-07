import { getIssues, getScan, saveDocument } from "@/lib/db";
import { issuesFromRows } from "@/lib/issues";
import { rateLimit, tooManyRequests } from "@/lib/ratelimit";
import { generateStatement, type StatementInput } from "@/documents/statement";
import { scoreScan } from "@/rules/score";

export const dynamic = "force-dynamic";

/** Deliberately permissive: this only decides whether we echo the value back. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/documents/statement — generate an accessibility statement.
 *
 * `scanId` is optional. With one, the known-limitations section is populated
 * from the scan and the coverage sentence quotes real numbers; without one, the
 * statement still generates, because a business that needs a statement for the
 * EAA should not be blocked from writing one by our scanner.
 *
 * Ungated by design. The roadmap's rule is to gate the export, never the
 * answer — a statement trapped behind a form generates no search surface and
 * helps nobody comply.
 *
 * The response carries `warnings` whenever the caller asked for a stronger
 * conformance claim than the evidence supports. Those are not decoration: see
 * documents/statement.ts for why the generator will not manufacture one.
 */
export async function POST(request: Request): Promise<Response> {
  const limit = await rateLimit(request, "statement", 30, 60 * 60);
  if (!limit.allowed) return tooManyRequests(limit);

  let body: Partial<StatementInput> & { scanId?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const organisation = String(body.organisation ?? "").trim();
  const contactEmail = String(body.contactEmail ?? "").trim();
  let domain = String(body.domain ?? "").trim();

  if (!organisation) {
    return Response.json(
      { error: "missing_organisation", message: "An organisation name is required." },
      { status: 400 },
    );
  }
  if (!EMAIL.test(contactEmail)) {
    // The EAA requires the feedback channel to be real, so a malformed address
    // is a correctness problem rather than a formatting nicety.
    return Response.json(
      {
        error: "invalid_contact_email",
        message: "A working feedback email address is required by the EAA.",
      },
      { status: 400 },
    );
  }

  let scanContext: Parameters<typeof generateStatement>[1];
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
    const issues = issuesFromRows(await getIssues(scan.id));
    scanContext = { issues, score: scoreScan(issues) };
    scanId = scan.id;
    if (!domain) domain = scan.domain;
  }

  if (!domain) {
    return Response.json(
      { error: "missing_domain", message: "A domain is required when no scan is supplied." },
      { status: 400 },
    );
  }

  // `Number.isFinite`, not `typeof === "number"`: NaN satisfies the latter and
  // formats as "NaN undefined NaN" on the face of the document.
  const reviewedAt = Number.isFinite(body.reviewedAt) ? body.reviewedAt! : Date.now();

  const statement = generateStatement(
    {
      organisation,
      domain,
      contactEmail,
      reviewedAt,
      responseTime: body.responseTime,
      wcagVersion: body.wcagVersion,
      wcagLevel: body.wcagLevel,
      manualReviewCompleted: body.manualReviewCompleted,
      claimedStatus: body.claimedStatus,
      limitations: body.limitations,
    },
    scanContext,
  );

  const documentId = await saveDocument({
    type: "statement",
    scanId,
    payload: statement,
  });

  // `statement` already carries the formatted `reviewedOn`.
  return Response.json({ documentId, scanId, ...statement });
}
