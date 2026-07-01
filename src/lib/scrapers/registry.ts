import type { ScraperStrategy } from "./types";

// This reference build ships no real scraper — only the mock data source is wired up
// (see src/lib/datasource/mock.ts).
//
// To add a scraper:
// 1. Create a file here implementing ScraperStrategy (see types.ts for the contract).
// 2. Register its factory below under a unique id.
// 3. Add that id to the "enabled" list in config.json.
const REGISTRY: Record<string, () => ScraperStrategy> = {};

export function createScraper(id: string): ScraperStrategy | null {
  const factory = REGISTRY[id];
  return factory ? factory() : null;
}
