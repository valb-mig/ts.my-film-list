import type { EpisodeInfo } from "@/lib/datasource";

export interface SeasonSummary {
  number: number;
  episodeCount: number;
}

// The panel, the player's sidebar and the next-episode card all look at the same seasons — fetch
// each one once.
const cache = new Map<string, Promise<EpisodeInfo[]>>();

export function seasonEpisodes(id: string, season: number): Promise<EpisodeInfo[]> {
  const key = `${id}:${season}`;
  let pending = cache.get(key);
  if (!pending) {
    pending = fetch(`/api/series/episodes?id=${encodeURIComponent(id)}&season=${season}`)
      .then((r) => r.json())
      .then((d: { episodes?: EpisodeInfo[] }) => d.episodes ?? [])
      .catch(() => []);
    cache.set(key, pending);
  }
  return pending;
}

// The episode after season/episode: the next one in the season, else the first of the next season
// that has episodes; null after the series' last one.
export function nextEpisode(
  seasons: SeasonSummary[],
  season: number,
  episode: number
): { season: number; episode: number } | null {
  const current = seasons.find((s) => s.number === season);
  if (current && episode < current.episodeCount) return { season, episode: episode + 1 };
  const later = seasons
    .filter((s) => s.number > season && s.episodeCount > 0)
    .sort((a, b) => a.number - b.number)[0];
  return later ? { season: later.number, episode: 1 } : null;
}
