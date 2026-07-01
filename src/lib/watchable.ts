const NON_WATCHABLE = new Set([
  "TV series",
  "TV mini series",
  "TV mini-series",
  "TV episode",
  "TV special",
  "video game",
  "podcast series",
  "podcast episode",
  "short",
  "Short",
]);

export function isWatchable(type?: string | null): boolean {
  if (!type) return true;
  return !NON_WATCHABLE.has(type);
}
