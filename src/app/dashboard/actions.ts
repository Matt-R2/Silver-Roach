"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { METALS } from "@/lib/metals-meta";
import { UNIT_TO_OZT } from "@/lib/units";

async function requireUserId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user.id;
}

export async function addHolding(formData: FormData) {
  const userId = await requireUserId();

  const symbol = String(formData.get("symbol") || "");
  const unit = String(formData.get("unit") || "");
  const weight = parseFloat(String(formData.get("weight") || ""));
  const quantityRaw = String(formData.get("quantity") || "1");
  const quantity = quantityRaw ? parseInt(quantityRaw, 10) : 1;
  const purityRaw = String(formData.get("purity") || "1");
  const purity = purityRaw ? parseFloat(purityRaw) : 1;
  const paidRaw = String(formData.get("paid") || "");
  const paid = paidRaw ? parseFloat(paidRaw) : null;
  const acquiredAtRaw = String(formData.get("acquiredAt") || "");
  const acquiredAt = acquiredAtRaw ? new Date(acquiredAtRaw) : null;

  if (!METALS[symbol]) throw new Error("Unknown metal");
  if (!(unit in UNIT_TO_OZT)) throw new Error("Unknown unit");
  if (!Number.isFinite(weight) || weight <= 0) throw new Error("Weight must be greater than 0");
  if (!Number.isInteger(quantity) || quantity <= 0) throw new Error("Quantity must be a positive whole number");
  if (!Number.isFinite(purity) || purity <= 0 || purity > 1) throw new Error("Purity must be between 0 and 1");
  if (acquiredAt && Number.isNaN(acquiredAt.getTime())) throw new Error("Invalid acquired date");

  await prisma.holding.create({
    data: {
      userId,
      symbol,
      unit,
      weight,
      quantity,
      purity,
      paid: paid != null && Number.isFinite(paid) ? paid : null,
      acquiredAt,
    },
  });

  revalidatePath("/dashboard");
}

export async function updateHolding(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");

  const nicknameRaw = String(formData.get("nickname") || "").trim();
  const nickname = nicknameRaw ? nicknameRaw.slice(0, 40) : null;

  const noteRaw = String(formData.get("note") || "").trim();
  const note = noteRaw ? noteRaw.slice(0, 280) : null;

  // updateMany with userId in the filter guarantees a user can only edit their own.
  await prisma.holding.updateMany({ where: { id, userId }, data: { nickname, note } });

  revalidatePath("/dashboard");
}

export async function deleteHolding(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");

  // deleteMany with userId in the filter guarantees a user can only delete their own.
  await prisma.holding.deleteMany({ where: { id, userId } });

  revalidatePath("/dashboard");
}
