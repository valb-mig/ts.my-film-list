import { NextResponse } from "next/server";
import { getDataSource } from "@/lib/datasource";
import { db, ensureInit } from "@/lib/db";

const SEED_LIMIT = 5;

export async function GET() {
  await ensureInit();

  const result = await db.execute({
    sql: "SELECT imdb_id FROM watched ORDER BY watched_at DESC LIMIT ?",
    args: [SEED_LIMIT],
  });
  const seedImdbIds = result.rows.map((r) => r.imdb_id as string);

  if (seedImdbIds.length === 0) {
    return NextResponse.json({ movies: [] });
  }

  try {
    const movies = await getDataSource().getRecommendations(seedImdbIds);
    return NextResponse.json({ movies });
  } catch (err) {
    console.error("Watched-based recommendations failed:", err);
    return NextResponse.json({ error: "Failed to load recommendations" }, { status: 500 });
  }
}
