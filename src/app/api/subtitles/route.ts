export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/datasource";
import { parseScraperInput } from "@/lib/scraperInput";

const LANGS = ["pt-BR", "en"];

export async function GET(req: NextRequest) {
  const input = parseScraperInput(req.nextUrl.searchParams);
  if (!input) {
    return NextResponse.json({ error: "id and title required" }, { status: 400 });
  }

  const results = await getDataSource().findSubtitles({ ...input, langs: LANGS });
  return NextResponse.json(results);
}
