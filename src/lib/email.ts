// SERVER-ONLY. Uses RESEND_API_KEY — never import into a client component.
import { Resend } from "resend";

function client() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set in the environment");
  return new Resend(key);
}

export async function sendAlertTriggeredEmail(params: {
  to: string;
  // Short label for the subject line, e.g. "Gold (AU)" or "Gold – Wedding ring".
  subjectLabel: string;
  // Longer phrase used in the body, e.g. "Gold (AU) spot price" or
  // 'your holding "Gold – Wedding ring"'.
  bodyDescription: string;
  condition: "above" | "below";
  targetPriceUsd: number;
  currentPriceUsd: number;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { to, subjectLabel, condition, targetPriceUsd } = params;
  const subject = `${subjectLabel} is ${condition} $${targetPriceUsd.toFixed(2)}`;

  try {
    const res = await client().emails.send({
      from: process.env.RESEND_FROM ?? "Silver Roach <onboarding@resend.dev>",
      to,
      subject,
      html: renderAlertEmailHtml(params),
    });
    if (res.error) return { ok: false, error: res.error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

function renderAlertEmailHtml(p: {
  bodyDescription: string;
  condition: "above" | "below";
  targetPriceUsd: number;
  currentPriceUsd: number;
}): string {
  return `
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h2 style="margin: 0 0 12px;">${p.bodyDescription} crossed your target</h2>
      <p>Current: <strong>$${p.currentPriceUsd.toFixed(2)}</strong></p>
      <p>Your alert: notify when ${p.condition} <strong>$${p.targetPriceUsd.toFixed(2)}</strong></p>
      <p style="margin-top: 20px; padding: 12px; background: #f4f4f4; border-radius: 8px;">
        This alert has been turned off now that it's fired. If you'd like to keep watching this
        price, sign in to Silver Roach and re-enable it from the Price Alerts tab of your profile.
      </p>
    </div>
  `;
}
