import { getEnv } from "./bindings";
import type { RunComparison } from "@/rules/regression";

/**
 * Transactional email, via Brevo.
 *
 * Brevo rather than a second provider because the account is already there for
 * lead capture, its SMTP relay is enabled, and one credential to rotate beats
 * two. The free tier allows 300 sends a day, which is far more than a
 * regression-only alert policy will ever use.
 *
 * ## Sending is best-effort and never blocks a scan
 *
 * A monitor run that finds a regression and then fails to email has still done
 * the valuable half of the work: the run is recorded, the report is live, and
 * the dashboard shows the drop. Throwing here would abort the scan callback and
 * lose the findings, so every failure is swallowed and recorded on the run as
 * `alert_sent = 0`.
 */

export type EmailResult = { sent: boolean; reason?: string };

const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendEmail(params: {
  to: string[];
  subject: string;
  html: string;
  text: string;
}): Promise<EmailResult> {
  const env = (await getEnv()) as unknown as {
    BREVO_API_KEY?: string;
    ALERT_FROM_EMAIL?: string;
    ALERT_FROM_NAME?: string;
  };

  if (!env.BREVO_API_KEY) return { sent: false, reason: "not_configured" };
  if (params.to.length === 0) return { sent: false, reason: "no_recipients" };

  try {
    const res = await fetch(BREVO_ENDPOINT, {
      method: "POST",
      headers: {
        "api-key": env.BREVO_API_KEY,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender: {
          name: env.ALERT_FROM_NAME ?? "Webyansh Accessibility",
          email: env.ALERT_FROM_EMAIL ?? "divyanshgraphic@gmail.com",
        },
        to: params.to.map((email) => ({ email })),
        subject: params.subject,
        htmlContent: params.html,
        textContent: params.text,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    return res.ok
      ? { sent: true }
      : { sent: false, reason: `brevo_${res.status}` };
  } catch (err) {
    return { sent: false, reason: err instanceof Error ? err.message : "send_failed" };
  }
}

/**
 * Composes the regression alert.
 *
 * The subject line carries the finding, not the product name — someone
 * triaging a full inbox decides whether to open this from the subject alone,
 * and "Accessibility monitoring report" tells them nothing.
 */
export function composeRegressionAlert(params: {
  siteUrl: string;
  comparison: RunComparison;
  reportUrl: string;
}): { subject: string; html: string; text: string } {
  const { siteUrl, comparison, reportUrl } = params;
  const domain = (() => {
    try {
      return new URL(siteUrl).hostname;
    } catch {
      return siteUrl;
    }
  })();

  const newCritical = comparison.regressions.filter(
    (r) => r.kind === "new" && r.severity === "Critical",
  );

  const subject =
    newCritical.length > 0
      ? `${domain}: ${newCritical.length} new critical accessibility issue${newCritical.length === 1 ? "" : "s"}`
      : `${domain}: accessibility score fell to ${comparison.score}`;

  const lines: string[] = [];
  lines.push(`Something changed on ${domain} since the last check.`);
  lines.push("");
  for (const reason of comparison.alertReasons) lines.push(reason);
  lines.push("");

  if (comparison.regressions.length > 0) {
    lines.push("What regressed:");
    for (const r of comparison.regressions) {
      lines.push(
        r.kind === "new"
          ? `- ${r.name} (${r.severity}) — now failing on ${r.nodeCount} element${r.nodeCount === 1 ? "" : "s"}, previously passing.`
          : `- ${r.name} (${r.severity}) — grew from ${r.previousNodeCount} to ${r.nodeCount} elements.`,
      );
    }
    lines.push("");
  }

  if (comparison.fixed.length > 0) {
    lines.push("Fixed since the last check:");
    for (const f of comparison.fixed) lines.push(`- ${f.name}`);
    lines.push("");
  }

  lines.push(`Full report: ${reportUrl}`);
  lines.push("");
  lines.push(
    "This checks the WCAG criteria a machine can evaluate, which is about a fifth of " +
      "WCAG 2.2 Level A and AA. It is a regression alarm, not a compliance statement.",
  );

  const text = lines.join("\n");

  const html = [
    `<div style="font-family:system-ui,-apple-system,sans-serif;line-height:1.6;color:#1a1a1a;max-width:640px">`,
    `<p>Something changed on <strong>${escapeHtml(domain)}</strong> since the last check.</p>`,
    ...comparison.alertReasons.map((r) => `<p><strong>${escapeHtml(r)}</strong></p>`),
    comparison.regressions.length > 0
      ? `<h3 style="margin:24px 0 8px">What regressed</h3><ul>${comparison.regressions
          .map((r) =>
            r.kind === "new"
              ? `<li><strong>${escapeHtml(r.name)}</strong> (${r.severity}) — now failing on ${r.nodeCount} element${r.nodeCount === 1 ? "" : "s"}, previously passing.</li>`
              : `<li><strong>${escapeHtml(r.name)}</strong> (${r.severity}) — grew from ${r.previousNodeCount} to ${r.nodeCount} elements.</li>`,
          )
          .join("")}</ul>`
      : "",
    comparison.fixed.length > 0
      ? `<h3 style="margin:24px 0 8px">Fixed since the last check</h3><ul>${comparison.fixed
          .map((f) => `<li>${escapeHtml(f.name)}</li>`)
          .join("")}</ul>`
      : "",
    `<p style="margin:24px 0"><a href="${escapeHtml(reportUrl)}" style="background:#ff4d00;color:#1a1a1a;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">View the full report</a></p>`,
    `<p style="font-size:14px;color:#5c5c5c;border-top:1px solid #e6e6e6;padding-top:16px">`,
    `This checks the WCAG criteria a machine can evaluate, which is about a fifth of WCAG 2.2 Level A and AA. `,
    `It is a regression alarm, not a compliance statement.</p>`,
    `</div>`,
  ].join("");

  return { subject, html, text };
}
