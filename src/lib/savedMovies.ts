import { db, ensureInit } from "@/lib/db";
import { getDataSource } from "@/lib/datasource";

export interface SavedMovie {
  imdb_id: string;
  title: string;
  year: number | null;
  poster_url: string | null;
}

export interface SavedMovieWithDetail extends SavedMovie {
  genres: string[];
  duration?: number;
}

// Everything the user saved — favorites plus every list — once per title.
export async function savedMovies(): Promise<SavedMovie[]> {
  await ensureInit();
  const result = await db.execute(`
    SELECT imdb_id, title, year, poster_url, added_at FROM favorites
    UNION ALL
    SELECT imdb_id, title, year, poster_url, added_at FROM list_items
    ORDER BY added_at DESC
  `);
  const byId = new Map<string, SavedMovie>();
  for (const r of result.rows) {
    const id = r.imdb_id as string;
    if (!byId.has(id)) {
      byId.set(id, {
        imdb_id: id,
        title: r.title as string,
        year: (r.year as number | null) ?? null,
        poster_url: (r.poster_url as string | null) ?? null,
      });
    }
  }
  return Array.from(byId.values());
}

// Genres/duration aren't stored — they come from the data source (cached by its fetch layer).
// A title whose lookup fails just has no genres/duration, so it never matches those filters.
export async function withDetails(movies: SavedMovie[]): Promise<SavedMovieWithDetail[]> {
  const source = getDataSource();
  return Promise.all(
    movies.map(async (m) => {
      const detail = await source.getMovieDetail(m.imdb_id).catch(() => null);
      return { ...m, genres: detail?.genres ?? [], duration: detail?.duration };
    })
  );
}
