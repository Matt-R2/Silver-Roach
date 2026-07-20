import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import ProfileClient from "./profile-client";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await prisma.profile.findUnique({ where: { userId: user.id } });

  return (
    <ProfileClient
      email={user.email ?? ""}
      displayName={profile?.displayName ?? ""}
      theme={profile?.theme === "light" ? "light" : "dark"}
    />
  );
}
