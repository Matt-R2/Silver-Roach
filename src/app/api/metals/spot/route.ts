import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSpots } from "@/lib/metals";
import { METALS } from "@/lib/metals-meta";

// GET /api/metals/spot?symbols=AU,AG,PT&currency=USD
// Auth-gated so the free-tier quota isn't exposed to the public internet.
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const currency = searchParams.get("currency") ?? "USD";
  const requested = (searchParams.get("symbols") ?? "AU,AG,PT,PD")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s) => s in METALS);

  if (requested.length === 0) {
    return NextResponse.json({ error: "No valid symbols" }, { status: 400 });
  }

  try {
    const spots = await getSpots(requested, currency);
    return NextResponse.json({ currency, spots });
  } catch (e) {
    return NextResponse.json({ error: "Upstream error" }, { status: 502 });
  }
}
