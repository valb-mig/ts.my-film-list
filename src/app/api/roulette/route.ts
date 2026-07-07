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
  const minDurationParam = req.nextUrl.searchParams.get("minDuration");
  const maxDurationParam = req.nextUrl.searchParams.get("maxDuration");
  const minDuration = minDurationParam ? parseInt(minDurationParam) : undefined;
  const maxDuration = maxDurationParam ? parseInt(maxDurationParam) : undefined;
  const hasDurationFilter = minDuration !== undefined || maxDuration !== undefined;

  // Duration only exists for history_movies whose detail the user has already opened —
  // when filtering by it, watchlist-only titles (no duration on file) are excluded too.
  const durationCondition = hasDurationFilter
    ? `AND duration_min IS NOT NULL
       ${minDuration !== undefined ? "AND duration_min >= ?" : ""}
       ${maxDuration !== undefined ? "AND duration_min <= ?" : ""}`
    : "";
  const durationArgs = hasDurationFilter
    ? [...(minDuration !== undefined ? [minDuration] : []), ...(maxDuration !== undefined ? [maxDuration] : [])]
    : [];

  let result;

  if (genres.length > 0) {
    const genreConditions = genres.map(() => `genres_json LIKE ?`).join(" OR ");
    result = await db.execute({
      sql: `
        SELECT imdb_id, title, year, poster_url, type
        FROM history_movies
        WHERE (${genreConditions})
          AND (type IS NULL OR (${typeExclude}))
          ${durationCondition}
        GROUP BY imdb_id
        ORDER BY RANDOM()
        LIMIT 1
      `,
      args: [...genres.map((g) => `%"${g}"%`), ...NON_WATCHABLE_TYPES, ...durationArgs],
    });
  } else if (hasDurationFilter) {
    result = await db.execute({
      sql: `
        SELECT imdb_id, title, year, poster_url, type
        FROM history_movies
        WHERE (type IS NULL OR (${typeExclude}))
          ${durationCondition}
        GROUP BY imdb_id
        ORDER BY RANDOM()
        LIMIT 1
      `,
      args: [...NON_WATCHABLE_TYPES, ...durationArgs],
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
          SELECT imdb_id, title, year, poster_url, NULL as type FROM list_items
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
