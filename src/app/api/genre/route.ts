import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/datasource";

export async function GET(request: NextRequest) {
  const genre = request.nextUrl.searchParams.get("genre");
  const title = request.nextUrl.searchParams.get("title") || "";
  const start = parseInt(request.nextUrl.searchParams.get("start") || "1");

  if (!genre) {
    return NextResponse.json({ error: "genre required" }, { status: 400 });
  }

  try {
    const result = await getDataSource().browseGenre({ genre, title, start });
    return NextResponse.json(result);
  } catch (err) {
    console.error("Genre search failed:", err);
    return NextResponse.json({ error: "Genre search failed" }, { status: 500 });
  }
}
