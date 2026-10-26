export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/datasource";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q");

  if (!query?.trim()) {
    return NextResponse.json({ movies: [] });
  }

  try {
    const movies = await getDataSource().search(query);
    return NextResponse.json({ movies });
  } catch {
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
