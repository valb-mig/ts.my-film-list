import type { Source } from "./types";

// This reference build ships no real scraper — only the mock data source is wired up
// (see src/lib/datasource/mock.ts).
//
// To add a source:
// 1. Create a file here implementing ScraperStrategy (stream links) or SubtitleStrategy
//    (subtitle downloads) — see types.ts for the contracts.
// 2. Register its factory below under a unique id.
// 3. Add that id to the "enabled" list in config.json.
const REGISTRY: Record<string, () => Source> = {};

export function createScraper(id: string): Source | null {
  const factory = REGISTRY[id];
  return factory ? factory() : null;
}
