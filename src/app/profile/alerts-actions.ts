"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth";
import { METALS } from "@/lib/metals-meta";
import { toTroyOz, usd } from "@/lib/units";

export type ActionState = { error?: string; message?: string } | null;

type CurrentValue =
  | { ok: true; symbol: string; value: number; label: "price" | "value" }
  | { ok: false; error: string };

// Resolves what an alert is currently watching: a metal's raw spot price
// (holdingId null) or a holding's live value — weight × purity × quantity ×
// spot, re-read fresh every call so holding edits are always reflected.
async function currentValueFor(userId: string, holdingId: string | null, symbol: string): Promise<CurrentValue> {
  if (holdingId) {
    const holding = await prisma.holding.findFirst({ where: { id: holdingId, userId } });
    if (!holding) return { ok: false, error: "Holding not found" };
    const spot = await prisma.metalSpotCache.findUnique({ where: { symbol: holding.symbol } });
    if (!spot) return { ok: false, error: "Current price isn't available yet — try again shortly" };
    return {
      ok: true,
      symbol: holding.symbol,
      value: toTroyOz(holding.weight, holding.unit) * holding.quantity * holding.purity * spot.priceUsd,
      label: "value",
    };
  }

  if (!METALS[symbol]) return { ok: false, error: "Unknown metal" };
  const spot = await prisma.metalSpotCache.findUnique({ where: { symbol } });
  if (!spot) return { ok: false, error: "Current price isn't available yet — try again shortly" };
  return { ok: true, symbol, value: spot.priceUsd, label: "price" };
}

// A target that's already on the wrong side of the current price/value would
// fire the very next cron run, so this is rejected both when an alert is
// created and whenever it's re-enabled (not just once at creation).
function validateTarget(condition: string, targetPriceUsd: number, current: CurrentValue & { ok: true }): string | null {
  if (condition === "above" && targetPriceUsd <= current.value) {
    return `Target must be above the current ${current.label} of ${usd(current.value)}`;
  }
  if (condition === "below" && targetPriceUsd >= current.value) {
    return `Target must be below the current ${current.label} of ${usd(current.value)}`;
  }
  return null;
}

export async function createAlert(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const userId = await requireUserId();
  const holdingId = String(formData.get("holdingId") || "") || null;
  const condition = String(formData.get("condition") || "");
  const targetPriceUsd = parseFloat(String(formData.get("targetPriceUsd") || ""));
  const requestedSymbol = String(formData.get("symbol") || "");

  if (condition !== "above" && condition !== "below") return { error: "Invalid condition" };
  if (!Number.isFinite(targetPriceUsd) || targetPriceUsd <= 0) {
    return { error: "Target price must be greater than 0" };
  }

  const current = await currentValueFor(userId, holdingId, requestedSymbol);
  if (!current.ok) return { error: current.error };

  const validationError = validateTarget(condition, targetPriceUsd, current);
  if (validationError) return { error: validationError };

  await prisma.priceAlert.create({
    data: { userId, holdingId, symbol: current.symbol, condition, targetPriceUsd },
  });

  revalidatePath("/profile");
  return { message: "Alert created" };
}

export async function toggleAlert(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");
  const active = formData.get("active") === "true";

  if (!active) {
    // Disabling is always allowed — no need to check current price.
    // updateMany with userId in the filter guarantees a user can only edit their own.
    await prisma.priceAlert.updateMany({ where: { id, userId }, data: { active: false } });
    revalidatePath("/profile");
    return null;
  }

  const alert = await prisma.priceAlert.findFirst({ where: { id, userId } });
  if (!alert) return { error: "Alert not found" };

  const current = await currentValueFor(userId, alert.holdingId, alert.symbol);
  if (!current.ok) return { error: current.error };

  const validationError = validateTarget(alert.condition, alert.targetPriceUsd, current);
  if (validationError) return { error: `Can't re-enable — ${validationError.charAt(0).toLowerCase()}${validationError.slice(1)}` };

  await prisma.priceAlert.updateMany({ where: { id, userId }, data: { active: true, triggeredAt: null } });
  revalidatePath("/profile");
  return { message: "Alert re-enabled" };
}

export async function deleteAlert(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");

  // deleteMany with userId in the filter guarantees a user can only delete their own.
  await prisma.priceAlert.deleteMany({ where: { id, userId } });

  revalidatePath("/profile");
}
