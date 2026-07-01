import { createScraper } from "./registry";
import config from "./config.json";
import type { ScraperStrategy, StreamResult, ScraperInput } from "./types";

const scrapers: ScraperStrategy[] = config.enabled
  .map((id) => createScraper(id))
  .filter((s): s is ScraperStrategy => s !== null);

export async function findStreams(input: ScraperInput): Promise<StreamResult[]> {
  const settled = await Promise.allSettled(
    scrapers.map((s) => s.scrape(input).then((r) => (r ? { ...r, kind: s.kind } : null)))
  );
  return settled
    .filter((r): r is PromiseFulfilledResult<StreamResult | null> => r.status === "fulfilled")
    .map((r) => r.value)
    .filter((r): r is StreamResult => r !== null);
}

export type { StreamResult, StreamServer, ScraperStrategy, ScraperInput } from "./types";
