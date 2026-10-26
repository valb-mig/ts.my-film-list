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

const sources: Source[] = config.enabled
  .map((id) => createScraper(id))
  .filter((s): s is Source => s !== null);

const scrapers = sources.filter((s): s is ScraperStrategy => "scrape" in s);
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
