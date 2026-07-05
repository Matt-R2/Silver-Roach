"use server";

import { createClient } from "@/lib/supabase/server";

// Never derive this from request headers (Host/X-Forwarded-Host are attacker-controllable
// and would let a forged header redirect password-reset links to an attacker's domain).
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function requestPasswordReset(_prev: unknown, formData: FormData) {
  const email = String(formData.get("email") || "");

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${SITE_URL}/auth/callback?next=/update-password`,
  });

  if (error) return { error: error.message };
  return { message: "Check your email for a password reset link." };
}
