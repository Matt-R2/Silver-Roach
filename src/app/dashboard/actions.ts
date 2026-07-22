"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth";
import { readHoldingFields } from "@/lib/holding-fields";

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
