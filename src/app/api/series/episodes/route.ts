export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/datasource";

// One season's episodes (names, stills, runtimes) for the player's sidebar.
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const season = Number(req.nextUrl.searchParams.get("season"));
  if (!id?.trim() || !Number.isInteger(season) || season < 0) {
    return NextResponse.json({ error: "id and season required" }, { status: 400 });
  }
  try {
    const episodes = await getDataSource().getSeasonEpisodes(id, season);
    return NextResponse.json({ episodes });
  } catch (err) {
    console.error("Season episodes failed:", err);
    return NextResponse.json({ error: "Failed to load episodes" }, { status: 500 });
  }
}
