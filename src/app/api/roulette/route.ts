import { NextRequest, NextResponse } from "next/server";
import { db, ensureInit } from "@/lib/db";

const NON_WATCHABLE_TYPES = [
  "TV series", "TV mini series", "TV mini-series",
  "TV episode", "TV special", "video game",
  "podcast series", "podcast episode", "short", "Short",
];

const typeExclude = NON_WATCHABLE_TYPES.map(() => "type != ?").join(" AND ");

export async function GET(req: NextRequest) {
  await ensureInit();
  const genresParam = req.nextUrl.searchParams.get("genres");
  const genres = genresParam ? genresParam.split(",").map((g) => g.trim()).filter(Boolean) : [];

  let result;

  if (genres.length > 0) {
    const genreConditions = genres.map(() => `genres_json LIKE ?`).join(" OR ");
    result = await db.execute({
      sql: `
        SELECT imdb_id, title, year, poster_url, type
        FROM history_movies
        WHERE (${genreConditions})
          AND (type IS NULL OR (${typeExclude}))
        GROUP BY imdb_id
        ORDER BY RANDOM()
        LIMIT 1
      `,
      args: [...genres.map((g) => `%"${g}"%`), ...NON_WATCHABLE_TYPES],
    });
  } else {
    result = await db.execute({
      sql: `
        SELECT imdb_id, title, year, poster_url, type
        FROM (
          SELECT imdb_id, title, year, poster_url, type FROM history_movies
          WHERE type IS NULL OR (${typeExclude})
          GROUP BY imdb_id
          UNION
          SELECT imdb_id, title, year, poster_url, NULL as type FROM watchlist
        )
        ORDER BY RANDOM()
        LIMIT 1
      `,
      args: [...NON_WATCHABLE_TYPES],
    });
  }

  if (!result.rows.length) {
    return NextResponse.json({ error: "no movies" }, { status: 404 });
  }

  return NextResponse.json(result.rows[0]);
}
