import type { MovieDetail } from "@/lib/datasource";

// Details are fetched as focus moves over posters — cache them so going back and forth is free.
const cache = new Map<string, Promise<MovieDetail | null>>();

export function getDetail(id: string): Promise<MovieDetail | null> {
  let pending = cache.get(id);
  if (!pending) {
    pending = fetch(`/api/movie/${id}`)
      .then((r) => r.json())
      .then((d: MovieDetail & { error?: string }) => (d.error ? null : d))
      .catch(() => null);
    cache.set(id, pending);
  }
  return pending;
}

export function formatDuration(minutes?: number): string | null {
  if (!minutes) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h${m ? ` ${m}min` : ""}` : `${m}min`;
}
