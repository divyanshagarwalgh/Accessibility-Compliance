import { getDocument } from "@/lib/db";
import { rateLimit, tooManyRequests } from "@/lib/ratelimit";
import { statementDocx, vpatDocx } from "@/documents/docx";
import type { Statement } from "@/documents/statement";
import type { Vpat } from "@/documents/vpat";

export const dynamic = "force-dynamic";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/**
 * GET /api/documents/{id}/export?format=docx
 *
 * Renders a stored statement or VPAT as a Word document.
 *
 * A GET rather than a POST because the browser has to be able to follow it as a
 * plain link — a fetch that returns a blob works, but it loses the filename the
 * `Content-Disposition` header carries, and a VPAT that downloads as
 * `download.docx` is a support ticket.
 *
 * Regenerating from the stored payload rather than storing the bytes keeps one
 * source of truth: a fix to the document builder reaches every document that has
 * ever been generated, including ones already handed to a procurement team.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ documentId: string }> },
): Promise<Response> {
  const limit = await rateLimit(request, "export", 60, 60 * 60);
  if (!limit.allowed) return tooManyRequests(limit);

  const format = new URL(request.url).searchParams.get("format") ?? "docx";
  if (format !== "docx") {
    return Response.json(
      {
        error: "unsupported_format",
        message: "Only `docx` is available here. HTML and plain text come back with the document itself.",
      },
      { status: 400 },
    );
  }

  const { documentId } = await params;
  const row = await getDocument(documentId);
  if (!row) return Response.json({ error: "not_found" }, { status: 404 });

  let bytes: Uint8Array<ArrayBuffer>;
  let filename: string;

  try {
    if (row.type === "statement") {
      const statement = JSON.parse(row.payload) as Statement;
      bytes = statementDocx(statement);
      filename = `${slug(statement.title)}.docx`;
    } else {
      const vpat = JSON.parse(row.payload) as Vpat;
      bytes = vpatDocx(vpat);
      filename = `vpat-${vpat.edition}-${slug(vpat.productName)}.docx`;
    }
  } catch {
    // A stored payload that will not parse is our bug, not the caller's.
    return Response.json({ error: "document_unreadable" }, { status: 500 });
  }

  return new Response(bytes, {
    headers: {
      "content-type": DOCX_MIME,
      // The quoted form is the one every browser agrees on for an ASCII name,
      // and `slug` guarantees the name is ASCII.
      "content-disposition": `attachment; filename="${filename}"`,
      "content-length": String(bytes.length),
    },
  });
}

/** ASCII, lowercase, no path separators — safe in a Content-Disposition header. */
function slug(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "document"
  );
}
