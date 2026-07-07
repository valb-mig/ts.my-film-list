import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/datasource";
import { findMood } from "@/lib/moods";

export async function GET(request: NextRequest) {
  const moodKey = request.nextUrl.searchParams.get("mood");
  const start = parseInt(request.nextUrl.searchParams.get("start") || "1");
  const minDurationParam = request.nextUrl.searchParams.get("minDuration");
  const maxDurationParam = request.nextUrl.searchParams.get("maxDuration");
  const minDuration = minDurationParam ? parseInt(minDurationParam) : undefined;
  const maxDuration = maxDurationParam ? parseInt(maxDurationParam) : undefined;

  if (!moodKey) {
    return NextResponse.json({ error: "mood required" }, { status: 400 });
  }

  const mood = findMood(moodKey);
  if (!mood) {
    return NextResponse.json({ error: "unknown mood" }, { status: 404 });
  }

  try {
    const result = await getDataSource().browseMood({ mood, start, minDuration, maxDuration });
    return NextResponse.json(result);
  } catch (err) {
    console.error("Mood browse failed:", err);
    return NextResponse.json({ error: "Mood browse failed" }, { status: 500 });
  }
}
