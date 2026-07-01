import { NextResponse } from "next/server";
import { db, ensureInit } from "@/lib/db";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  await ensureInit();
  const { genres } = await req.json();

  if (!Array.isArray(genres) || genres.length === 0) {
    return NextResponse.json({ ok: true });
  }

  await db.execute({
    sql: "UPDATE history_movies SET genres_json = ? WHERE imdb_id = ?",
    args: [JSON.stringify(genres), params.id],
  });

  return NextResponse.json({ ok: true });
}
