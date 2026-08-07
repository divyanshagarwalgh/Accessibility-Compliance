import { getEnv } from "@/lib/bindings";
import { attachEmail, createLead, getScan, markLeadSynced } from "@/lib/db";
import { rateLimit, tooManyRequests } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

/**
 * A deliberately permissive check. Aggressive email regexes reject valid
 * addresses (plus-addressing, new TLDs, unicode local parts) and the cost of a
 * false rejection here is a lost lead. Deliverability is Brevo's job.
 */
function looksLikeEmail(value: string): boolean {
  const v = value.trim();
  return v.length >= 6 && v.length <= 254 && /^[^\s@]+@[^\s@.]+\.[^\s@]+$/.test(v);
}

/**
 * POST /api/lead — capture the email that unlocks a report, and sync to Brevo.
 *
 * The Brevo call is best-effort: if it fails the lead is still stored in D1 with
 * brevo_synced = 0 so it can be retried. Losing the address because a third party
 * was down would be the worst outcome.
 */
export async function POST(request: Request): Promise<Response> {
  const limit = await rateLimit(request, "lead", 20, 60 * 60);
  if (!limit.allowed) return tooManyRequests(limit);

  let body: { email?: string; scanId?: string; source?: string; wantsRescan?: boolean };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  if (!looksLikeEmail(email)) {
    return Response.json(
      { error: "invalid_email", message: "Enter a valid work email." },
      { status: 400 },
    );
  }

  const scan = body.scanId ? await getScan(body.scanId) : null;

  const leadId = await createLead({
    email,
    scanId: scan?.id ?? null,
    sourceTool: body.source ?? "scanner",
    domain: scan?.domain ?? null,
    score: scan?.score ?? null,
    wantsRescan: Boolean(body.wantsRescan),
  });

  // Unlock the report immediately — before Brevo, which may be slow or down.
  if (scan) await attachEmail(scan.id, email);

  const env = await getEnv();

  // The sync outcome is reported back, not only written to `leads.brevo_error`.
  // A silent failure here looks identical to success from outside, and the row
  // it writes is only readable with database access — which cost a round of
  // guesswork when the list stayed empty and nothing said why.
  let sync: { attempted: boolean; synced: boolean; reason?: string } = {
    attempted: false,
    synced: false,
    reason: "not_configured",
  };

  if (env.BREVO_API_KEY && env.BREVO_LIST_ID) {
    try {
      const res = await fetch("https://api.brevo.com/v3/contacts", {
        method: "POST",
        headers: {
          "api-key": env.BREVO_API_KEY,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          email,
          listIds: [Number(env.BREVO_LIST_ID)],
          updateEnabled: true,
          attributes: {
            SCAN_DOMAIN: scan?.domain ?? null,
            SCAN_SCORE: scan?.score ?? null,
            SOURCE_TOOL: body.source ?? "scanner",
            WANTS_RESCAN: Boolean(body.wantsRescan),
          },
        }),
        signal: AbortSignal.timeout(5000),
      });
      // Brevo's message explains *why* on a 4xx — an IP block and a bad key
      // both return 401 and are indistinguishable without it.
      const reason = res.ok
        ? undefined
        : `brevo_${res.status}: ${(await res.text()).slice(0, 200)}`;
      await markLeadSynced(leadId, reason);
      sync = { attempted: true, synced: res.ok, reason };
    } catch (err) {
      const reason = err instanceof Error ? err.message : "brevo_failed";
      await markLeadSynced(leadId, reason);
      sync = { attempted: true, synced: false, reason };
    }
  }

  return Response.json({ ok: true, unlocked: Boolean(scan), sync });
}
