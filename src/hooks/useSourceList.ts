"use client";

import { useEffect, useState } from "react";

// Query for /api/streams and /api/subtitles. Series need season/episode, movies don't.
export function sourceQuery(
  id: string,
  title: string,
  year: number | undefined,
  episode: { season: number; episode: number } | null
): string {
  const params = new URLSearchParams({ id, title });
  if (year) params.set("year", String(year));
  if (episode) {
    params.set("type", "tv");
    params.set("season", String(episode.season));
    params.set("episode", String(episode.episode));
  }
  return params.toString();
}

// Fetches a source list (streams, subtitles) once its query is known. `waiting` keeps the
// skeleton up while the query can't be built yet; a null query after that means nothing to fetch.
export function useSourceList<T>(endpoint: string, query: string | null, waiting: boolean) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  // The query `items` belong to. Until it matches the current one, the list is still loading —
  // even in the render right after the query changes, before the effect below has run.
  const [settled, setSettled] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    setItems([]);
    if (waiting) { setLoading(true); return; }
    if (query === null) { setLoading(false); setSettled(null); return; }
    let cancelled = false;
    setLoading(true);
    fetch(`${endpoint}?${query}`)
      .then((r) => r.json())
      .then((data: T[]) => { if (!cancelled && Array.isArray(data)) setItems(data); })
      .catch(() => {})
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
        setSettled(query);
      });
    return () => { cancelled = true; };
  }, [endpoint, query, waiting]);

  return { items, loading: loading || settled !== query };
}
