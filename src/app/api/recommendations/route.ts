export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/datasource";

// Titles recommended from one title (the player's sidebar).
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id?.trim()) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  try {
    const movies = await getDataSource().getRecommendations([id]);
    return NextResponse.json({ movies });
  } catch (err) {
    console.error("Recommendations failed:", err);
    return NextResponse.json({ error: "Failed to load recommendations" }, { status: 500 });
  }
}
