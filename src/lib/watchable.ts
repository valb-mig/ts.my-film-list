// Series used to be here too (no stream source had episodes); now they play like movies.
const NON_WATCHABLE = new Set([
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
