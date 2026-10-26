export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/datasource";
import type { HomeSection } from "@/lib/datasource";

const VALID_SECTIONS: HomeSection[] = ["trending", "popular", "top_rated", "now_playing"];

export async function GET(req: NextRequest) {
  const section = req.nextUrl.searchParams.get("section");

  if (!VALID_SECTIONS.includes(section as HomeSection)) {
    return NextResponse.json({ error: "invalid section" }, { status: 400 });
  }

  try {
    const movies = await getDataSource().browseHome(section as HomeSection);
    return NextResponse.json({ movies });
  } catch (err) {
    console.error("Home section failed:", err);
    return NextResponse.json({ error: "Failed to load section" }, { status: 500 });
  }
}
