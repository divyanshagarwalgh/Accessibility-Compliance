import { getKv } from "./bindings";

/**
 * Live scan status.
 *
 * Held in KV, never D1. The client polls every 2 seconds and a scan takes ~20s,
 * so this is the hottest path in the app; D1 would be both slower and billed per
 * row read. D1 holds the durable record once the scan finishes.
 */

export type ScanStep =
  | "queued"
  | "fetching"
  | "rendering"
  | "running-axe"
  | "measuring-contrast"
  | "mapping-fixes"
  | "done"
  | "failed";

/** The five steps the progress screen shows, in order. */
export const PROGRESS_STEPS: { step: ScanStep; label: string }[] = [
  { step: "fetching", label: "Fetching page" },
  { step: "rendering", label: "Rendering with a headless browser" },
  { step: "running-axe", label: "Running axe-core against WCAG 2.2 AA" },
  { step: "measuring-contrast", label: "Measuring contrast on every text node" },
  { step: "mapping-fixes", label: "Mapping issues to Webflow fixes" },
];

export type ScanStatus = {
  status: "queued" | "running" | "done" | "failed";
  step: ScanStep;
  /** 0-100, for the progress bar. */
  pct: number;
  url: string;
  startedAt: number;
  errorCode?: string;
  errorDetail?: string;
};

const TTL_SECONDS = 60 * 60; // An hour is far longer than any scan; keeps KV tidy.

const key = (scanId: string) => `scan:status:${scanId}`;

export async function setStatus(scanId: string, status: ScanStatus): Promise<void> {
  const kv = await getKv();
  await kv.put(key(scanId), JSON.stringify(status), { expirationTtl: TTL_SECONDS });
}

export async function getStatus(scanId: string): Promise<ScanStatus | null> {
  const kv = await getKv();
  const raw = await kv.get(key(scanId));
  return raw ? (JSON.parse(raw) as ScanStatus) : null;
}

export function pctForStep(step: ScanStep): number {
  const index = PROGRESS_STEPS.findIndex((s) => s.step === step);
  if (step === "done") return 100;
  if (step === "queued") return 2;
  if (index === -1) return 0;
  return Math.round(((index + 1) / (PROGRESS_STEPS.length + 1)) * 100);
}
