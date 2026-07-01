import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/datasource";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const title = req.nextUrl.searchParams.get("title");
  const year = req.nextUrl.searchParams.get("year") ?? undefined;

  if (!id?.trim() || !title?.trim()) {
    return NextResponse.json({ error: "id and title required" }, { status: 400 });
  }

  const results = await getDataSource().findStreams({ id, title, year });
  return NextResponse.json(results);
}
