import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSpots } from "@/lib/metals";
import { ALL_SYMBOLS } from "@/lib/metals-meta";

// GET /api/cron/refresh-prices
// Fetches spot prices for all 10 metals and upserts them into MetalSpotCache.
// Runs hourly via Vercel Cron. Dashboard and snapshot routes read from the cache
// instead of hitting the API directly, keeping quota usage predictable.
export async function GET(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7) : null;
  const fromQuery = new URL(request.url).searchParams.get("secret");
  const provided = bearer ?? fromQuery;

  if (!process.env.CRON_SECRET || provided !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const spots = await getSpots([...ALL_SYMBOLS]);

  const results = { updated: [] as string[], failed: [] as string[] };

  await Promise.all(
    Object.entries(spots).map(async ([symbol, priceUsd]) => {
      if (priceUsd == null) {
        results.failed.push(symbol);
        return;
      }
      await prisma.metalSpotCache.upsert({
        where: { symbol },
        update: { priceUsd },
        create: { symbol, priceUsd },
      });
      results.updated.push(symbol);
    })
  );

  return NextResponse.json({ ok: true, ...results, at: new Date().toISOString() });
}
