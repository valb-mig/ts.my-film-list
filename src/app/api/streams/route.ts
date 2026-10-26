export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/datasource";
import { parseScraperInput } from "@/lib/scraperInput";

export async function GET(req: NextRequest) {
  const input = parseScraperInput(req.nextUrl.searchParams);
  if (!input) {
    return NextResponse.json({ error: "id and title required" }, { status: 400 });
  }

  const results = await getDataSource().findStreams(input);
  return NextResponse.json(results);
}
