import { NextRequest, NextResponse } from "next/server";
import { db, ensureInit } from "@/lib/db";

export async function GET(req: NextRequest) {
  await ensureInit();

  if (req.nextUrl.searchParams.get("all") === "1") {
    const result = await db.execute("SELECT * FROM watched ORDER BY watched_at DESC");
    return NextResponse.json(result.rows);
  }

  const limit = Math.min(50, Math.max(1, Number(req.nextUrl.searchParams.get("limit") ?? "20")));

  const result = await db.execute({
    sql: "SELECT * FROM watched ORDER BY watched_at DESC LIMIT ?",
    args: [limit],
  });
  return NextResponse.json(result.rows);
}

export async function POST(req: NextRequest) {
  await ensureInit();
  const body = await req.json();
  const { imdb_id, title, year, poster_url } = body;

  if (!imdb_id || !title) {
    return NextResponse.json({ error: "imdb_id and title required" }, { status: 400 });
  }

  await db.execute({
    sql: `INSERT OR REPLACE INTO watched (imdb_id, title, year, poster_url, watched_at)
          VALUES (?, ?, ?, ?, unixepoch())`,
    args: [imdb_id, title, year ?? null, poster_url ?? null],
  });

  return NextResponse.json({ ok: true });
}
