"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth";

export async function updateDisplayName(_prev: unknown, formData: FormData) {
  const userId = await requireUserId();
  const raw = String(formData.get("displayName") || "").trim();
  const displayName = raw ? raw.slice(0, 60) : null;

  await prisma.profile.upsert({
    where: { userId },
    update: { displayName },
    create: { userId, displayName },
  });

  revalidatePath("/profile");
  revalidatePath("/dashboard");
  return { message: "Saved." };
}

export async function updateTheme(theme: "dark" | "light") {
  const userId = await requireUserId();

  await prisma.profile.upsert({
    where: { userId },
    update: { theme },
    create: { userId, theme },
  });

  revalidatePath("/", "layout");
}

export async function updateEmail(_prev: unknown, formData: FormData) {
  const newEmail = String(formData.get("newEmail") || "").trim();
  const currentPassword = String(formData.get("currentPassword") || "");

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const email = userData.user?.email;
  if (!email || !currentPassword) return { error: "Enter your current password." };

  // Reauthenticate before changing something this sensitive, same as the
  // password-change flow — a hijacked/shared session shouldn't be able to
  // lock the real owner out by moving the account to a different inbox.
  const { error: reauthError } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
  if (reauthError) return { error: "Current password is incorrect." };

  const { error } = await supabase.auth.updateUser({ email: newEmail });
  if (error) return { error: error.message };

  return { message: "Check your new email address to confirm the change." };
}

export async function deleteAccount(_prev: unknown, formData: FormData) {
  const currentPassword = String(formData.get("currentPassword") || "");

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user?.email || !currentPassword) return { error: "Enter your current password." };

  const { error: reauthError } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPassword });
  if (reauthError) return { error: "Current password is incorrect." };

  await prisma.holding.deleteMany({ where: { userId: user.id } });
  await prisma.profile.deleteMany({ where: { userId: user.id } });

  const admin = createAdminClient();
  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) return { error: `Could not delete account: ${deleteError.message}` };

  await supabase.auth.signOut();
  redirect("/login");
}
