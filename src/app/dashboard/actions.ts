"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { METALS } from "@/lib/metals-meta";
import { UNIT_TO_OZT } from "@/lib/units";
import { requireUserId } from "@/lib/auth";

function readHoldingFields(formData: FormData) {
  const symbol = String(formData.get("symbol") || "");
  const unit = String(formData.get("unit") || "");
  const weight = parseFloat(String(formData.get("weight") || ""));
  const quantityRaw = String(formData.get("quantity") || "1");
  const quantity = quantityRaw ? parseInt(quantityRaw, 10) : 1;
  const purityRaw = String(formData.get("purity") || "1");
  const purity = purityRaw ? parseFloat(purityRaw) : 1;

  const noteRaw = String(formData.get("note") || "").trim();
  const note = noteRaw ? noteRaw.slice(0, 280) : null;

  if (!METALS[symbol]) throw new Error("Unknown metal");
  if (!(unit in UNIT_TO_OZT)) throw new Error("Unknown unit");
  if (!Number.isFinite(weight) || weight <= 0) throw new Error("Weight must be greater than 0");
  if (!Number.isInteger(quantity) || quantity <= 0) throw new Error("Quantity must be a positive whole number");
  if (!Number.isFinite(purity) || purity <= 0 || purity > 1) throw new Error("Purity must be between 0 and 1");

  return { symbol, unit, weight, quantity, purity, note };
}

export async function addHolding(formData: FormData) {
  const userId = await requireUserId();
  const fields = readHoldingFields(formData);

  await prisma.holding.create({ data: { userId, ...fields } });

  revalidatePath("/dashboard");
}

export async function updateHolding(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");
  const fields = readHoldingFields(formData);

  // updateMany with userId in the filter guarantees a user can only edit their own.
  await prisma.holding.updateMany({ where: { id, userId }, data: fields });

  revalidatePath("/dashboard");
}

export async function renameHolding(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");
  const raw = String(formData.get("nickname") || "").trim();
  const nickname = raw ? raw.slice(0, 40) : null;

  // updateMany with userId in the filter guarantees a user can only edit their own.
  await prisma.holding.updateMany({ where: { id, userId }, data: { nickname } });

  revalidatePath("/dashboard");
}

export async function deleteHolding(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");

  // deleteMany with userId in the filter guarantees a user can only delete their own.
  await prisma.holding.deleteMany({ where: { id, userId } });

  revalidatePath("/dashboard");
}
