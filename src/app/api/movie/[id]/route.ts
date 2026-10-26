export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/datasource";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;

  if (!id?.match(/^tt\d+$/) && !id?.match(/^tmdb-(movie|tv)-\d+$/)) {
    return NextResponse.json({ error: "Invalid movie id" }, { status: 400 });
  }

  try {
    const detail = await getDataSource().getMovieDetail(id);

    if (!detail) {
      return NextResponse.json({ error: "Movie not found" }, { status: 404 });
    }

    return NextResponse.json(detail);
  } catch {
    return NextResponse.json({ error: "Failed to fetch movie details" }, { status: 500 });
  }
}
