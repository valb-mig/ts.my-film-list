import { NextResponse } from "next/server";
import { db, ensureInit } from "@/lib/db";

export async function DELETE(_req: Request, { params }: { params: { id: string; imdbId: string } }) {
  await ensureInit();
  await db.execute({
    sql: "DELETE FROM list_items WHERE list_id = ? AND imdb_id = ?",
    args: [params.id, params.imdbId],
  });
  return NextResponse.json({ ok: true });
}
