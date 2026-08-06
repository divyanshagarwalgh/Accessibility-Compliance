import { PROGRESS_STEPS, getStatus } from "@/lib/scan-status";

export const dynamic = "force-dynamic";

/**
 * GET /api/scan/[id]/status — polled every 2s by the client.
 *
 * Reads KV only. Never touches D1: this is the highest-frequency route in the app
 * and a scan generates roughly ten polls.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const status = await getStatus(id);

  if (!status) {
    // Either a bad id or an expired scan. Both are "we do not have this".
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  return Response.json({
    status: status.status,
    step: status.step,
    pct: status.pct,
    steps: PROGRESS_STEPS.map((s, i) => ({
      label: s.label,
      state:
        status.step === "done"
          ? "done"
          : s.step === status.step
            ? "active"
            : i < PROGRESS_STEPS.findIndex((x) => x.step === status.step)
              ? "done"
              : "idle",
    })),
    errorCode: status.errorCode ?? null,
    errorDetail: status.errorDetail ?? null,
  });
}
