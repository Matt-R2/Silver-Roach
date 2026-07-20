import { createClient } from "@supabase/supabase-js";

// Service-role client for privileged operations (e.g. deleting an auth user)
// that the anon/session client can't perform. Server-only — never import
// this into a client component.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
