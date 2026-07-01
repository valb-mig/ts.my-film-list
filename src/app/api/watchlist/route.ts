import { NextRequest, NextResponse } from "next/server";
import { db, ensureInit } from "@/lib/db";

export async function GET() {
  await ensureInit();
  const result = await db.execute("SELECT * FROM watchlist ORDER BY added_at DESC");
  return NextResponse.json(result.rows);
}

export async function POST(req: NextRequest) {
  await ensureInit();
  const body = await req.json();
  const { imdb_id, title, year, poster_url, rating } = body;

  if (!imdb_id || !title) {
    return NextResponse.json({ error: "imdb_id and title required" }, { status: 400 });
  }

  await db.execute({
    sql: `INSERT OR REPLACE INTO watchlist (imdb_id, title, year, poster_url, rating)
          VALUES (?, ?, ?, ?, ?)`,
    args: [imdb_id, title, year ?? null, poster_url ?? null, rating ?? null],
  });

  return NextResponse.json({ ok: true });
}
