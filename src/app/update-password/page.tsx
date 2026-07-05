import { createClient } from "@/lib/supabase/server";
import { usedRecoveryLink } from "@/lib/supabase/amr";
import { UpdatePasswordForm } from "./update-password-form";

export default async function UpdatePasswordPage() {
  const supabase = await createClient();
  const requireCurrentPassword = !(await usedRecoveryLink(supabase));

  return <UpdatePasswordForm requireCurrentPassword={requireCurrentPassword} />;
}
