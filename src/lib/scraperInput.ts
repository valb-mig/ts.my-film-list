import type { ScraperInput } from "@/lib/scrapers/types";

function positiveInt(value: string | null): number | undefined {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

// Shared by /api/streams and /api/subtitles — both take the same title/episode query.
export function parseScraperInput(params: URLSearchParams): ScraperInput | null {
  const id = params.get("id");
  const title = params.get("title");
  if (!id?.trim() || !title?.trim()) return null;

  return {
    id,
    title,
    year: params.get("year") ?? undefined,
    type: params.get("type") === "tv" ? "tv" : "movie",
    season: positiveInt(params.get("season")),
    episode: positiveInt(params.get("episode")),
  };
}
