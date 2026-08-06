import { getEnv } from "@/lib/bindings";

// Bindings only exist per-request, so this route must never be prerendered.
export const dynamic = "force-dynamic";

type Probe = { ok: boolean; detail: string };

/**
 * Phase 1 verification endpoint.
 *
 * Confirms the worker is live at the mount path and that D1, KV and R2 are actually
 * reachable — not merely declared in wrangler.json. Reports binding reachability only;
 * no ids, keys, or environment values are ever returned.
 */
export async function GET() {
  const checks: Record<string, Probe> = {};

  let env: CloudflareEnv | null = null;
  try {
    env = await getEnv();
  } catch (err) {
    return json(
      {
        status: "error",
        message: "Cloudflare context unavailable",
        detail: msg(err),
      },
      503,
    );
  }

  checks.d1 = await probe(async () => {
    if (!env?.DB) throw new Error("binding absent");
    const row = await env.DB.prepare("select 1 as ok").first<{ ok: number }>();
    if (row?.ok !== 1) throw new Error("unexpected query result");
    return "reachable";
  });

  checks.kv = await probe(async () => {
    if (!env?.KV) throw new Error("binding absent");
    // Read-only probe: a miss is a healthy answer, it proves the namespace responds.
    await env.KV.get("__healthcheck__");
    return "reachable";
  });

  checks.r2 = await probe(async () => {
    if (!env?.ARTIFACTS) throw new Error("binding absent");
    await env.ARTIFACTS.head("__healthcheck__");
    return "reachable";
  });

  const healthy = Object.values(checks).every((c) => c.ok);

  return json(
    {
      status: healthy ? "ok" : "degraded",
      mountPath: env?.BASE_URL ?? "/app",
      checks,
    },
    healthy ? 200 : 503,
  );
}

async function probe(fn: () => Promise<string>): Promise<Probe> {
  try {
    return { ok: true, detail: await fn() };
  } catch (err) {
    return { ok: false, detail: msg(err) };
  }
}

function msg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
