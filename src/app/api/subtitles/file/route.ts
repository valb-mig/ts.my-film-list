export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/datasource";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url?.trim()) {
    return NextResponse.json({ error: "url required" }, { status: 400 });
  }

  const text = await getDataSource().fetchSubtitleFile(url);
  if (text === null) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return new NextResponse(text, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "private, max-age=3600" },
  });
}
