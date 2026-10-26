export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db, ensureInit } from "@/lib/db";

export async function GET(req: NextRequest) {
  await ensureInit();
  const imdbId = req.nextUrl.searchParams.get("imdbId");

  const result = imdbId
    ? await db.execute({
        sql: "SELECT * FROM list_items WHERE imdb_id = ? ORDER BY added_at DESC",
        args: [imdbId],
      })
    : await db.execute("SELECT * FROM list_items ORDER BY added_at DESC");

  return NextResponse.json(result.rows);
}
