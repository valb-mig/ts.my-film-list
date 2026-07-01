import { NextResponse } from "next/server";
import { db, ensureInit } from "@/lib/db";

export interface DbMovie {
  imdb_id: string;
  title: string;
  year: number | null;
  poster_url: string | null;
  type: string | null;
  in_watchlist: number;
  in_history: number;
  added_at: number;
}

export async function GET() {
  await ensureInit();

  const result = await db.execute(`
    WITH all_ids AS (
      SELECT DISTINCT imdb_id FROM history_movies
      UNION
      SELECT DISTINCT imdb_id FROM watchlist
    ),
    latest_history AS (
      SELECT hm.imdb_id, hm.title, hm.year, hm.poster_url, hm.type
      FROM history_movies hm
      INNER JOIN (
        SELECT imdb_id, MAX(history_id) AS max_hid
        FROM history_movies
        GROUP BY imdb_id
      ) lh ON hm.imdb_id = lh.imdb_id AND hm.history_id = lh.max_hid
    )
    SELECT
      ai.imdb_id,
      COALESCE(lh.title, w.title)      AS title,
      COALESCE(lh.year, w.year)        AS year,
      COALESCE(lh.poster_url, w.poster_url) AS poster_url,
      lh.type,
      CASE WHEN w.imdb_id  IS NOT NULL THEN 1 ELSE 0 END AS in_watchlist,
      CASE WHEN lh.imdb_id IS NOT NULL THEN 1 ELSE 0 END AS in_history,
      COALESCE(w.added_at, 0) AS added_at
    FROM all_ids ai
    LEFT JOIN latest_history lh ON lh.imdb_id = ai.imdb_id
    LEFT JOIN watchlist      w  ON w.imdb_id  = ai.imdb_id
    ORDER BY COALESCE(w.added_at, 0) DESC, ai.imdb_id
  `);

  return NextResponse.json(result.rows as unknown as DbMovie[]);
}
