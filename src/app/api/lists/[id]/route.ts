export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db, ensureInit } from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  await ensureInit();
  const { name } = await req.json();

  if (!name || !String(name).trim()) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  await db.execute({
    sql: "UPDATE lists SET name = ? WHERE id = ?",
    args: [String(name).trim(), params.id],
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  await ensureInit();
  await db.batch(
    [
      { sql: "DELETE FROM list_items WHERE list_id = ?", args: [params.id] },
      { sql: "DELETE FROM lists WHERE id = ?", args: [params.id] },
    ],
    "write"
  );
  return NextResponse.json({ ok: true });
}
