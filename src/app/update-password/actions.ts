"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { usedRecoveryLink } from "@/lib/supabase/amr";

export async function updatePassword(_prev: unknown, formData: FormData) {
  const password = String(formData.get("password") || "");
  const currentPassword = String(formData.get("currentPassword") || "");

  const supabase = await createClient();

  // Only a fresh recovery-link session may set a new password without proving
  // the old one — an ordinary logged-in session must reauthenticate first, so
  // a hijacked/shared session can't be used to lock the real owner out.
  if (!(await usedRecoveryLink(supabase))) {
    const { data: userData } = await supabase.auth.getUser();
    const email = userData.user?.email;
    if (!email || !currentPassword) return { error: "Enter your current password." };

    const { error: reauthError } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
    if (reauthError) return { error: "Current password is incorrect." };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  await supabase.auth.signOut();
  redirect("/login");
}
