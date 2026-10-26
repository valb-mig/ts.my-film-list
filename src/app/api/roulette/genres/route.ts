export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { savedMovies, withDetails } from "@/lib/savedMovies";

// Genres present among favorites + lists, for the roulette's filter.
export async function GET() {
  const movies = await withDetails(await savedMovies());
  const genres = new Set(movies.flatMap((m) => m.genres));
  return NextResponse.json(Array.from(genres).sort((a, b) => a.localeCompare(b, "pt-BR")));
}
