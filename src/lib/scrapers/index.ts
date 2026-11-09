import { createScraper } from "./registry";
import config from "./config.json";
import type {
  ScraperStrategy,
  StreamResult,
  ScraperInput,
  Source,
  SubtitleInput,
  SubtitleResult,
  SubtitleStrategy,
} from "./types";

// Stream source built from the link pasted in scripts/setup.sh — no site is hardcoded here, the
// templates live in .env.local: STREAM_MOVIE_URL (".../movie/{id}") and, optionally, STREAM_TV_URL
// (".../tv/{id}/{season}/{episode}"). {id} is the IMDb id.
function createLinkScraper(): ScraperStrategy | null {
  const movieUrl = process.env.STREAM_MOVIE_URL?.trim() || undefined;
  const tvUrl = process.env.STREAM_TV_URL?.trim() || undefined;
  const sample = movieUrl ?? tvUrl;
  if (!sample?.includes("{id}")) return null;

  let host: string;
  try {
    host = new URL(sample).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }

  const fill = (template: string, values: Record<string, string | number>) =>
    template.replace(/\{(\w+)\}/g, (match, key: string) =>
      key in values ? encodeURIComponent(String(values[key])) : match
    );

  return {
    name: host,
    kind: "sub",
    async scrape({ id, type, season, episode }) {
      if (!/^tt\d+$/.test(id)) return null;

      let embedUrl: string;
      if (type === "tv") {
        if (!tvUrl || !season || !episode) return null;
        embedUrl = fill(tvUrl, { id, season, episode });
      } else {
        if (!movieUrl) return null;
        embedUrl = fill(movieUrl, { id });
      }

      return { source: host, movieUrl: embedUrl, servers: [{ id: "link", label: host, embedUrl }] };
    },
  };
}

const sources: Source[] = config.enabled
  .map((id) => createScraper(id))
  .filter((s): s is Source => s !== null);

const linkScraper = createLinkScraper();
const scrapers = [
  ...sources.filter((s): s is ScraperStrategy => "scrape" in s),
  ...(linkScraper ? [linkScraper] : []),
];
const subtitleSources = sources.filter((s): s is SubtitleStrategy => "findSubtitles" in s);

export async function findStreams(input: ScraperInput): Promise<StreamResult[]> {
  const settled = await Promise.allSettled(
    scrapers.map((s) => s.scrape(input).then((r) => (r ? { ...r, kind: s.kind } : null)))
  );
  return settled
    .filter((r): r is PromiseFulfilledResult<StreamResult | null> => r.status === "fulfilled")
    .map((r) => r.value)
    .filter((r): r is StreamResult => r !== null);
}

export async function findSubtitles(input: SubtitleInput): Promise<SubtitleResult[]> {
  const settled = await Promise.allSettled(subtitleSources.map((s) => s.findSubtitles(input)));
  return settled
    .filter((r): r is PromiseFulfilledResult<SubtitleResult[]> => r.status === "fulfilled")
    .flatMap((r) => r.value);
}

// Subtitle text for in-app rendering — browsers can't fetch it cross-origin themselves.
export async function fetchSubtitleFile(url: string): Promise<string | null> {
  for (const s of subtitleSources) {
    const text = await s.fetchFile(url).catch(() => null);
    if (text !== null) return text;
  }
  return null;
}

export type {
  StreamResult,
  StreamServer,
  ScraperStrategy,
  ScraperInput,
  SubtitleFile,
  SubtitleInput,
  SubtitleResult,
  SubtitleStrategy,
} from "./types";
