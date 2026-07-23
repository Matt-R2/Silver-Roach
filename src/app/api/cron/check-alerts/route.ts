import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendAlertTriggeredEmail } from "@/lib/email";
import { METALS } from "@/lib/metals-meta";
import { toTroyOz } from "@/lib/units";

// GET /api/cron/check-alerts
// Runs right after refresh-prices (see .github/workflows/refresh-prices.yml) so
// it always sees a fresh MetalSpotCache. Alerts are one-shot: a crossed alert
// emails the user and deactivates itself, only once the email send succeeds —
// a transient Resend outage leaves it active so it's retried next run instead
// of silently going dark.
//
// An alert with holdingId set watches that holding's current value (weight ×
// purity × quantity × spot), re-read fresh every run so edits to the holding
// are reflected. An alert with holdingId null watches the raw metal spot price.
export async function GET(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7) : null;
  const fromQuery = new URL(request.url).searchParams.get("secret");
  const provided = bearer ?? fromQuery;

  if (!process.env.CRON_SECRET || provided !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const activeAlerts = await prisma.priceAlert.findMany({ where: { active: true } });
  if (activeAlerts.length === 0) {
    return NextResponse.json({ ok: true, checked: 0, triggered: [], emailFailed: [], at: new Date().toISOString() });
  }

  const holdingIds = [...new Set(activeAlerts.filter((a) => a.holdingId).map((a) => a.holdingId as string))];
  const holdings = await prisma.holding.findMany({ where: { id: { in: holdingIds } } });
  const holdingById = new Map(holdings.map((h) => [h.id, h]));

  const symbolsNeeded = new Set<string>();
  for (const alert of activeAlerts) {
    const symbol = alert.holdingId ? holdingById.get(alert.holdingId)?.symbol : alert.symbol;
    if (symbol) symbolsNeeded.add(symbol);
  }
  const spots = await prisma.metalSpotCache.findMany({ where: { symbol: { in: [...symbolsNeeded] } } });
  const priceBySymbol = new Map(spots.map((s) => [s.symbol, s.priceUsd]));

  const admin = createAdminClient();
  const results = { triggered: [] as string[], emailFailed: [] as string[] };

  for (const alert of activeAlerts) {
    let currentValue: number;
    let subjectLabel: string;
    let bodyDescription: string;

    if (alert.holdingId) {
      const holding = holdingById.get(alert.holdingId);
      if (!holding) continue; // holding was deleted; deleteHolding cascades but skip defensively
      const spotPrice = priceBySymbol.get(holding.symbol);
      if (spotPrice == null) continue;
      currentValue = toTroyOz(holding.weight, holding.unit) * holding.quantity * holding.purity * spotPrice;
      const metalName = METALS[holding.symbol]?.name ?? holding.symbol;
      subjectLabel = holding.nickname ? `${metalName} – ${holding.nickname}` : metalName;
      bodyDescription = `Your holding "${subjectLabel}"`;
    } else {
      const spotPrice = priceBySymbol.get(alert.symbol);
      if (spotPrice == null) continue;
      currentValue = spotPrice;
      const metalName = METALS[alert.symbol]?.name ?? alert.symbol;
      subjectLabel = `${metalName} (${alert.symbol})`;
      bodyDescription = `${metalName} (${alert.symbol}) spot price`;
    }

    const crossed =
      alert.condition === "above" ? currentValue >= alert.targetPriceUsd : currentValue <= alert.targetPriceUsd;
    if (!crossed) continue;

    const { data: userData } = await admin.auth.admin.getUserById(alert.userId);
    const email = userData?.user?.email;
    if (!email) continue;

    const sendResult = await sendAlertTriggeredEmail({
      to: email,
      subjectLabel,
      bodyDescription,
      condition: alert.condition as "above" | "below",
      targetPriceUsd: alert.targetPriceUsd,
      currentPriceUsd: currentValue,
    });

    if (sendResult.ok) {
      await prisma.priceAlert.update({
        where: { id: alert.id },
        data: { active: false, triggeredAt: new Date() },
      });
      results.triggered.push(alert.id);
    } else {
      results.emailFailed.push(alert.id);
    }
  }

  return NextResponse.json({ ok: true, checked: activeAlerts.length, ...results, at: new Date().toISOString() });
}
