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
  const paidRaw = String(formData.get("paid") || "");
  const paid = paidRaw ? parseFloat(paidRaw) : null;

  if (!METALS[symbol]) throw new Error("Unknown metal");
  if (!(unit in UNIT_TO_OZT)) throw new Error("Unknown unit");
  if (!Number.isFinite(weight) || weight <= 0) throw new Error("Weight must be greater than 0");

  await prisma.holding.create({
    data: { userId, symbol, unit, weight, paid: paid != null && Number.isFinite(paid) ? paid : null },
  });

  revalidatePath("/dashboard");
}

export async function deleteHolding(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");

  // deleteMany with userId in the filter guarantees a user can only delete their own.
  await prisma.holding.deleteMany({ where: { id, userId } });

  revalidatePath("/dashboard");
}
