import { NextRequest, NextResponse } from "next/server";
import { db, ensureInit } from "@/lib/db";
import { Movie } from "@/types/imdb";

const PAGE_SIZE = 5;

export async function GET(req: NextRequest) {
  await ensureInit();
  const page = Math.max(1, Number(req.nextUrl.searchParams.get("page") ?? "1"));
  const offset = (page - 1) * PAGE_SIZE;

  const [countResult, searches] = await Promise.all([
    db.execute("SELECT COUNT(*) AS count FROM search_history"),
    db.execute({
      sql: "SELECT * FROM search_history ORDER BY searched_at DESC LIMIT ? OFFSET ?",
      args: [PAGE_SIZE, offset],
    }),
  ]);

  const total = Number(countResult.rows[0].count);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const populated = await Promise.all(
    searches.rows.map(async (s) => {
      const movies = await db.execute({
        sql: "SELECT * FROM history_movies WHERE history_id = ?",
        args: [s.id],
      });
      return { ...s, movies: movies.rows };
    })
  );

  return NextResponse.json({ searches: populated, total, page, totalPages });
}

export async function POST(req: NextRequest) {
  await ensureInit();
  const body = await req.json();
  const { query, movies }: { query: string; movies: Movie[] } = body;

  if (!query?.trim() || !Array.isArray(movies) || movies.length === 0) {
    return NextResponse.json({ error: "query and movies required" }, { status: 400 });
  }

  const result = await db.execute({
    sql: "INSERT INTO search_history (query) VALUES (?)",
    args: [query.trim()],
  });

  const histId = Number(result.lastInsertRowid);
  const nowSecs = Math.floor(Date.now() / 1000);

  await db.batch(
    movies.map((m) => ({
      sql: `INSERT OR IGNORE INTO history_movies
              (history_id, imdb_id, title, year, poster_url, type, first_seen_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [histId, m.id, m.title, m.year ?? null, m.poster ?? null, m.type ?? null, nowSecs],
    })),
    "write"
  );

  return NextResponse.json({ ok: true, id: histId });
}
