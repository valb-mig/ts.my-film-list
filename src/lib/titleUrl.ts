// The title on screen lives in the URL — ?t=<id>, plus &s=<season>&e=<episode> while a series is
// playing — so a refresh (or a shared link) reopens it. Other params (e.g. the search's ?q=) stay.

export interface TitleUrl {
  id: string | null;
  season?: number;
  episode?: number;
}

export function readTitleUrl(): TitleUrl {
  if (typeof window === "undefined") return { id: null };
  const params = new URLSearchParams(window.location.search);
  const season = Number(params.get("s"));
  const episode = Number(params.get("e"));
  return {
    id: params.get("t"),
    season: Number.isInteger(season) && season > 0 ? season : undefined,
    episode: Number.isInteger(episode) && episode > 0 ? episode : undefined,
  };
}

// Replaces the current history entry: opening, switching episodes or closing doesn't pile up
// entries for the back button.
export function writeTitleUrl({ id, season, episode }: TitleUrl): void {
  const url = new URL(window.location.href);
  for (const key of ["t", "s", "e"]) url.searchParams.delete(key);
  if (id) url.searchParams.set("t", id);
  if (id && season && episode) {
    url.searchParams.set("s", String(season));
    url.searchParams.set("e", String(episode));
  }
  if (url.href !== window.location.href) window.history.replaceState(window.history.state, "", url);
}
