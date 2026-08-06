import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Access to the Workers bindings that Webflow Cloud provisions from wrangler.json.
 *
 * Bindings only exist inside a request. Never call these at module scope or during
 * build — Next.js evaluates modules at build time, when no binding is present.
 */

export type Bindings = CloudflareEnv;

export async function getEnv(): Promise<Bindings> {
  const { env } = await getCloudflareContext({ async: true });
  return env as unknown as Bindings;
}

/** D1. Durable records. Never poll this for live scan status — that is KV's job. */
export async function getDb(): Promise<D1Database> {
  const env = await getEnv();
  if (!env.DB) throw new BindingError("DB", "D1");
  return env.DB;
}

/** KV. Hot, short-lived scan status for 2-second client polling. */
export async function getKv(): Promise<KVNamespace> {
  const env = await getEnv();
  if (!env.KV) throw new BindingError("KV", "KV");
  return env.KV;
}

/** R2. Generated PDFs and raw axe-core JSON. */
export async function getArtifacts(): Promise<R2Bucket> {
  const env = await getEnv();
  if (!env.ARTIFACTS) throw new BindingError("ARTIFACTS", "R2");
  return env.ARTIFACTS;
}

export class BindingError extends Error {
  constructor(binding: string, kind: string) {
    super(
      `${kind} binding "${binding}" is not available. Check wrangler.json and that ` +
        `the Webflow Cloud environment has finished provisioning it.`,
    );
    this.name = "BindingError";
  }
}
