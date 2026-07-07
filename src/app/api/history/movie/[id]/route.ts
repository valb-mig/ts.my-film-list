import { NextResponse } from "next/server";
import { db, ensureInit } from "@/lib/db";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  await ensureInit();
  const { genres, duration } = await req.json();

  if (Array.isArray(genres) && genres.length > 0) {
    await db.execute({
      sql: "UPDATE history_movies SET genres_json = ? WHERE imdb_id = ?",
      args: [JSON.stringify(genres), params.id],
    });
  }

  if (typeof duration === "number" && duration > 0) {
    await db.execute({
      sql: "UPDATE history_movies SET duration_min = ? WHERE imdb_id = ?",
      args: [Math.round(duration), params.id],
    });
  }

  return NextResponse.json({ ok: true });
}
