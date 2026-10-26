export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { savedMovies, withDetails } from "@/lib/savedMovies";

// Draws one title from favorites + lists, optionally filtered by genre and duration.
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const genres = (params.get("genres") ?? "").split(",").map((g) => g.trim()).filter(Boolean);
  const minDuration = params.get("minDuration") ? parseInt(params.get("minDuration")!) : undefined;
  const maxDuration = params.get("maxDuration") ? parseInt(params.get("maxDuration")!) : undefined;
  const filtered = genres.length > 0 || minDuration !== undefined || maxDuration !== undefined;

  let pool = await savedMovies();
  if (filtered) {
    pool = (await withDetails(pool)).filter(
      (m) =>
        (genres.length === 0 || m.genres.some((g) => genres.includes(g))) &&
        (minDuration === undefined || (m.duration !== undefined && m.duration >= minDuration)) &&
        (maxDuration === undefined || (m.duration !== undefined && m.duration <= maxDuration))
    );
  }

  if (pool.length === 0) {
    return NextResponse.json({ error: "no movies" }, { status: 404 });
  }
  const { imdb_id, title, year, poster_url } = pool[Math.floor(Math.random() * pool.length)];
  return NextResponse.json({ imdb_id, title, year, poster_url });
}
