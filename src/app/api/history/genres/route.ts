import { NextResponse } from "next/server";
import { db, ensureInit } from "@/lib/db";

// Returns one row per unique movie (latest genres_json) + first_seen_at (globally first)
export async function GET() {
  await ensureInit();

  const result = await db.execute(`
    SELECT
      hm.imdb_id,
      hm.title,
      hm.year,
      hm.poster_url,
      hm.type,
      hm.genres_json,
      first_seen.first_seen_at
    FROM history_movies hm
    INNER JOIN (
      SELECT imdb_id, MAX(history_id) AS max_hid
      FROM history_movies
      GROUP BY imdb_id
    ) latest ON hm.imdb_id = latest.imdb_id AND hm.history_id = latest.max_hid
    INNER JOIN (
      SELECT imdb_id, MIN(first_seen_at) AS first_seen_at
      FROM history_movies
      GROUP BY imdb_id
    ) first_seen ON first_seen.imdb_id = hm.imdb_id
    ORDER BY hm.title
  `);

  return NextResponse.json(result.rows);
}
