import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { METALS } from "@/lib/metals-meta";
import { toTroyOz, formatPurity } from "@/lib/units";
import ProfileClient from "./profile-client";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [profile, alerts, holdings, spots] = await Promise.all([
    prisma.profile.findUnique({ where: { userId: user.id } }),
    prisma.priceAlert.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
    prisma.holding.findMany({ where: { userId: user.id } }),
    prisma.metalSpotCache.findMany(),
  ]);

  const spotBySymbol = Object.fromEntries(spots.map((s) => [s.symbol, s.priceUsd]));

  const holdingOptions = holdings.map((h) => {
    const metalName = METALS[h.symbol]?.name ?? h.symbol;
    const label = `${metalName}${h.nickname ? ` – ${h.nickname}` : ""} (${formatPurity(h.symbol, h.purity)})`;
    const currentValue = toTroyOz(h.weight, h.unit) * h.quantity * h.purity * (spotBySymbol[h.symbol] ?? 0);
    return { id: h.id, symbol: h.symbol, label, currentValue };
  });

  const holdingLabelById = Object.fromEntries(holdingOptions.map((h) => [h.id, h.label]));

  const alertsForClient = alerts.map((a) => ({
    id: a.id,
    holdingId: a.holdingId,
    holdingLabel: a.holdingId ? (holdingLabelById[a.holdingId] ?? null) : null,
    symbol: a.symbol,
    condition: a.condition,
    targetPriceUsd: a.targetPriceUsd,
    active: a.active,
    triggeredAt: a.triggeredAt,
  }));

  return (
    <ProfileClient
      email={user.email ?? ""}
      displayName={profile?.displayName ?? ""}
      theme={profile?.theme === "light" ? "light" : "dark"}
      alerts={alertsForClient}
      holdingOptions={holdingOptions}
      spotBySymbol={spotBySymbol}
    />
  );
}
