export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db, ensureInit } from "@/lib/db";

export async function GET() {
  await ensureInit();
  const result = await db.execute(`
    SELECT lists.id, lists.name, lists.created_at, COUNT(list_items.imdb_id) as count
    FROM lists
    LEFT JOIN list_items ON list_items.list_id = lists.id
    GROUP BY lists.id
    ORDER BY lists.created_at ASC
  `);
  return NextResponse.json(result.rows);
}

export async function POST(req: NextRequest) {
  await ensureInit();
  const { name } = await req.json();

  if (!name || !String(name).trim()) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  const result = await db.execute({
    sql: "INSERT INTO lists (name) VALUES (?)",
    args: [String(name).trim()],
  });

  return NextResponse.json({ id: Number(result.lastInsertRowid), name: String(name).trim() });
}
