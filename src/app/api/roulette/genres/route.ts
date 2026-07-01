import { NextResponse } from "next/server";
import { db, ensureInit } from "@/lib/db";

export async function GET() {
  await ensureInit();

  const result = await db.execute(`
    SELECT genres_json FROM history_movies
    WHERE genres_json IS NOT NULL AND genres_json != '[]' AND genres_json != ''
    GROUP BY imdb_id
  `);

  const genreSet = new Set<string>();
  for (const row of result.rows) {
    try {
      const genres = JSON.parse(row.genres_json as string) as string[];
      for (const g of genres) genreSet.add(g);
    } catch {}
  }

  return NextResponse.json(Array.from(genreSet).sort());
}
