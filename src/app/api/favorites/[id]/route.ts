import { NextResponse } from "next/server";
import { db, ensureInit } from "@/lib/db";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  await ensureInit();
  await db.execute({
    sql: "DELETE FROM favorites WHERE imdb_id = ?",
    args: [params.id],
  });
  return NextResponse.json({ ok: true });
}
