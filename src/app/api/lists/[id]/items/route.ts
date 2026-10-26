export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db, ensureInit } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  await ensureInit();
  const result = await db.execute({
    sql: "SELECT * FROM list_items WHERE list_id = ? ORDER BY added_at DESC",
    args: [params.id],
  });
  return NextResponse.json(result.rows);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  await ensureInit();
  const body = await req.json();
  const { imdb_id, title, year, poster_url, rating } = body;

  if (!imdb_id || !title) {
    return NextResponse.json({ error: "imdb_id and title required" }, { status: 400 });
  }

  await db.execute({
    sql: `INSERT OR REPLACE INTO list_items (list_id, imdb_id, title, year, poster_url, rating)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [params.id, imdb_id, title, year ?? null, poster_url ?? null, rating ?? null],
  });

  return NextResponse.json({ ok: true });
}
