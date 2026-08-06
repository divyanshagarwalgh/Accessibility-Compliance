import { source as axeSource } from "axe-core";
import type { Env } from "./index";
import { customChecks } from "./custom-checks";

/** The user agent the product commits to in its own error copy. */
export const USER_AGENT =
  "Mozilla/5.0 (compatible; WebyanshBot/1.0; +https://webyansh.com/tools/accessibility)";

const NAV_TIMEOUT_MS = 30_000;
const AXE_TIMEOUT_MS = 45_000;

type Job = { scanId: string; url: string; callbackUrl: string };

async function report(
  job: Job,
  secret: string,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    await fetch(job.callbackUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ scanId: job.scanId, ...payload }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    // Nothing useful to do — the app will time the scan out on its own.
  }
}

/**
 * robots.txt is checked before rendering, and the result is honoured.
 *
 * The product states "We respect robots.txt" on the scan screen and offers
 * "robots.txt blocks this path" as an error state. That has to be true.
 * Fetch failures are treated as "allowed" — an unreachable robots.txt is not a
 * disallow, and treating it as one would block most scans.
 */
async function robotsAllows(target: URL): Promise<boolean> {
  try {
    const res = await fetch(new URL("/robots.txt", target.origin).toString(), {
      headers: { "user-agent": USER_AGENT },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return true;

    const text = await res.text();
    const path = target.pathname || "/";

    // Walk the groups, tracking which apply to us. Longest matching Allow or
    // Disallow wins, per the robots.txt specification.
    let applies = false;
    let bestDisallow = -1;
    let bestAllow = -1;

    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.split("#")[0]!.trim();
      if (!line) continue;
      const [rawField, ...rest] = line.split(":");
      const field = rawField!.trim().toLowerCase();
      const value = rest.join(":").trim();

      if (field === "user-agent") {
        const ua = value.toLowerCase();
        applies = ua === "*" || ua.includes("webyanshbot");
      } else if (applies && field === "disallow" && value) {
        if (path.startsWith(value)) bestDisallow = Math.max(bestDisallow, value.length);
      } else if (applies && field === "allow" && value) {
        if (path.startsWith(value)) bestAllow = Math.max(bestAllow, value.length);
      }
    }

    return bestDisallow === -1 || bestAllow >= bestDisallow;
  } catch {
    return true;
  }
}

export async function runScan(
  puppeteer: typeof import("@cloudflare/puppeteer").default,
  env: Env,
  job: Job,
): Promise<void> {
  const secret = env.SHARED_SECRET;
  const target = new URL(job.url);

  await report(job, secret, { status: "running", step: "fetching" });

  if (!(await robotsAllows(target))) {
    await report(job, secret, {
      status: "failed",
      errorCode: "robots_disallowed",
      errorDetail: `${target.origin}/robots.txt disallows ${target.pathname} for our user agent. We respect robots.txt and will not scan it.`,
    });
    return;
  }

  let browser;
  try {
    browser = await puppeteer.launch(env.BROWSER);
  } catch (err) {
    await report(job, secret, {
      status: "failed",
      errorCode: "internal_error",
      errorDetail: `Could not start a browser: ${String(err)}`,
    });
    return;
  }

  try {
    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);
    await page.setViewport({ width: 1440, height: 900 });

    await report(job, secret, { status: "running", step: "rendering" });

    const response = await page.goto(job.url, {
      waitUntil: "networkidle0",
      timeout: NAV_TIMEOUT_MS,
    });

    const httpStatus = response?.status() ?? 0;
    if (httpStatus === 403) {
      await report(job, secret, {
        status: "failed",
        errorCode: "fetch_403",
        errorDetail: `GET ${job.url} → 403 Forbidden. This usually means a firewall or bot protection is blocking our crawler.`,
      });
      return;
    }
    if (httpStatus === 404) {
      await report(job, secret, {
        status: "failed",
        errorCode: "fetch_404",
        errorDetail: `GET ${job.url} → 404 Not Found.`,
      });
      return;
    }
    if (httpStatus >= 500) {
      await report(job, secret, {
        status: "failed",
        errorCode: "fetch_5xx",
        errorDetail: `GET ${job.url} → ${httpStatus}.`,
      });
      return;
    }

    const contentType = response?.headers()["content-type"] ?? "";
    if (contentType && !contentType.includes("html")) {
      await report(job, secret, {
        status: "failed",
        errorCode: "not_html",
        errorDetail: `That URL returned ${contentType}, not an HTML page.`,
      });
      return;
    }

    await report(job, secret, { status: "running", step: "running-axe" });

    // axe-core is injected as source rather than added as a script tag so it
    // works on pages with a restrictive Content-Security-Policy.
    await page.evaluate(axeSource);

    const axeResults = (await page.evaluate(
      `(async () => {
        const r = await window.axe.run(document, {
          runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa'] },
          resultTypes: ['violations'],
          elementRef: false
        });
        return { violations: r.violations, engine: r.testEngine };
      })()`,
    )) as {
      violations: unknown[];
      engine?: { name?: string; version?: string };
    };

    await report(job, secret, { status: "running", step: "measuring-contrast" });

    // The three criteria axe has no rule for. See docs/rules-extracted.md.
    const extra = await customChecks(page);

    await report(job, secret, { status: "running", step: "mapping-fixes" });

    await report(job, secret, {
      status: "done",
      engineVersion: `axe-core@${axeResults.engine?.version ?? "unknown"}`,
      violations: [...axeResults.violations, ...extra],
    });
  } catch (err) {
    const message = String(err);
    const timedOut = /timeout|timed out/i.test(message);
    await report(job, secret, {
      status: "failed",
      errorCode: timedOut ? "render_timeout" : "render_crash",
      errorDetail: timedOut
        ? `Rendering timed out after ${NAV_TIMEOUT_MS / 1000} seconds. Heavy client-side apps sometimes need longer than a single-page scan allows.`
        : message,
    });
  } finally {
    try {
      await browser.close();
    } catch {
      // Best effort; the session times out on its own.
    }
  }
}

export const TIMEOUTS = { NAV_TIMEOUT_MS, AXE_TIMEOUT_MS };
