import { createClient } from "@/lib/supabase/server";

// Whether this session's most recent authentication was the password-recovery
// link itself (as opposed to an ordinary already-logged-in session), per the
// JWT's `amr` (Authentication Method Reference) claim.
export async function usedRecoveryLink(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase.auth.getClaims();
  const amr = (data?.claims.amr ?? []) as (string | { method?: string })[];
  return amr.some((entry) => (typeof entry === "string" ? entry : entry.method) === "recovery");
}
