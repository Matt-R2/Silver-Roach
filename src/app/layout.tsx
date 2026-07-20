import type { Metadata } from "next";
import { Space_Grotesk, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

const display = Space_Grotesk({ subsets: ["latin"], weight: ["500", "700"], variable: "--font-display" });
const sans = Inter({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-sans" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Silver Roach — precious metals tracker",
  description: "Track the value of your gold, silver and platinum holdings over time.",
};

async function getTheme(): Promise<"dark" | "light"> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "dark";
  const profile = await prisma.profile.findUnique({ where: { userId: user.id }, select: { theme: true } });
  return profile?.theme === "light" ? "light" : "dark";
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = await getTheme();
  return (
    <html lang="en" data-theme={theme} className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
