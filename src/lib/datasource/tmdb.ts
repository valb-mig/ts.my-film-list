import type { Movie } from "@/types/imdb";
import type { StreamResult, ScraperInput } from "@/lib/scrapers/types";
import { findStreams as findConfiguredStreams } from "@/lib/scrapers";
import type {
  MovieDataSource,
  MovieDetail,
  GenreBrowseParams,
  GenreBrowseResult,
  HomeSection,
} from "./types";

const API_BASE = "https://api.themoviedb.org/3";
const IMAGE_BASE = "https://image.tmdb.org/t/p/w500";
const PAGE_SIZE = 20;
const HOME_ROW_SIZE = 12;

// Home rows/recommendations skip imdb_id resolution up front (that's an extra TMDB call per
// item — expensive across 5 rows of 12+ items each). They carry this synthetic id instead and
// getMovieDetail resolves the real imdb_id lazily, only for the one item the user clicks.
const SYNTHETIC_ID_RE = /^tmdb-(movie|tv)-(\d+)$/;

function syntheticId(mediaType: MediaType, tmdbId: number): string {
  return `tmdb-${mediaType}-${tmdbId}`;
}

function parseSyntheticId(id: string): { mediaType: MediaType; tmdbId: number } | null {
  const m = SYNTHETIC_ID_RE.exec(id);
  return m ? { mediaType: m[1] as MediaType, tmdbId: Number(m[2]) } : null;
}

type MediaType = "movie" | "tv";

// TMDB genre ids: https://developer.themoviedb.org/reference/genre-movie-list / genre-tv-list
// Genres with no TMDB equivalent (Biography, Film-Noir, Game-Show, Reality-TV, Short, Sport,
// Talk-Show) were dropped from the UI along with this map.
const GENRE_MAP: Record<string, { movie: number; tv?: number }> = {
  Action: { movie: 28, tv: 10759 },
  Adventure: { movie: 12, tv: 10759 },
  Animation: { movie: 16, tv: 16 },
  Comedy: { movie: 35, tv: 35 },
  Crime: { movie: 80, tv: 80 },
  Documentary: { movie: 99, tv: 99 },
  Drama: { movie: 18, tv: 18 },
  Family: { movie: 10751, tv: 10751 },
  Fantasy: { movie: 14, tv: 10765 },
  History: { movie: 36 },
  Horror: { movie: 27 },
  Music: { movie: 10402 },
  Mystery: { movie: 9648, tv: 9648 },
  Romance: { movie: 10749 },
  "Sci-Fi": { movie: 878, tv: 10765 },
  Thriller: { movie: 53 },
  War: { movie: 10752, tv: 10768 },
  Western: { movie: 37, tv: 37 },
};

interface TmdbSearchItem {
  id: number;
  media_type?: MediaType;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
  genre_ids?: number[];
}

interface TmdbFindResponse {
  movie_results: TmdbSearchItem[];
  tv_results: TmdbSearchItem[];
}

interface TmdbExternalIds {
  imdb_id?: string | null;
}

interface TmdbCreditPerson {
  name: string;
  job?: string;
}

interface TmdbDetail {
  id: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  overview?: string;
  release_date?: string;
  first_air_date?: string;
  runtime?: number;
  episode_run_time?: number[];
  genres?: { name: string }[];
  vote_average?: number;
  vote_count?: number;
  credits?: {
    cast?: TmdbCreditPerson[];
    crew?: TmdbCreditPerson[];
  };
  external_ids?: {
    imdb_id?: string | null;
  };
}

function accessToken(): string {
  const token = process.env.TMDB_ACCESS_TOKEN;
  if (!token) throw new Error("TMDB_ACCESS_TOKEN not set");
  return token;
}

async function tmdbGet<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${API_BASE}${path}`);
  url.searchParams.set("language", "pt-BR");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken()}` },
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`TMDB request failed: ${path}`);
  return res.json();
}

function parseYear(dateStr?: string): number | undefined {
  if (!dateStr) return undefined;
  const year = parseInt(dateStr.slice(0, 4));
  return isNaN(year) ? undefined : year;
}

function toMovie(item: TmdbSearchItem, mediaType: MediaType, imdbId: string): Movie {
  return {
    id: imdbId,
    title: item.title || item.name || "",
    year: parseYear(item.release_date || item.first_air_date),
    poster: item.poster_path ? `${IMAGE_BASE}${item.poster_path}` : undefined,
    type: mediaType === "tv" ? "TV series" : undefined,
  };
}

function toPreviewMovie(item: TmdbSearchItem, mediaType: MediaType): Movie {
  return toMovie(item, mediaType, syntheticId(mediaType, item.id));
}

async function resolveImdbId(tmdbId: number, mediaType: MediaType): Promise<string | undefined> {
  try {
    const ext = await tmdbGet<TmdbExternalIds>(`/${mediaType}/${tmdbId}/external_ids`);
    return ext.imdb_id ?? undefined;
  } catch {
    return undefined;
  }
}

async function withImdbIds(
  items: { item: TmdbSearchItem; mediaType: MediaType }[]
): Promise<Movie[]> {
  const resolved = await Promise.all(
    items.map(async ({ item, mediaType }) => {
      const imdbId = await resolveImdbId(item.id, mediaType);
      return imdbId ? toMovie(item, mediaType, imdbId) : null;
    })
  );
  return resolved.filter((m): m is Movie => m !== null);
}

export class TmdbDataSource implements MovieDataSource {
  async search(query: string): Promise<Movie[]> {
    if (!query.trim()) return [];

    const data = await tmdbGet<{ results: TmdbSearchItem[] }>("/search/multi", {
      query: query.trim(),
    });

    const candidates = data.results
      .filter((r) => r.media_type === "movie" || r.media_type === "tv")
      .map((item) => ({ item, mediaType: item.media_type as MediaType }));

    return withImdbIds(candidates);
  }

  async getMovieDetail(id: string): Promise<MovieDetail | null> {
    const synthetic = parseSyntheticId(id);
    let mediaType: MediaType;
    let tmdbId: number;

    if (synthetic) {
      // Already know the TMDB id from the home-row preview — skip /find entirely.
      mediaType = synthetic.mediaType;
      tmdbId = synthetic.tmdbId;
    } else {
      const found = await tmdbGet<TmdbFindResponse>(`/find/${id}`, {
        external_source: "imdb_id",
      });
      const movieHit = found.movie_results[0];
      const tvHit = found.tv_results[0];
      const hit = movieHit ?? tvHit;
      if (!hit) return null;
      mediaType = movieHit ? "movie" : "tv";
      tmdbId = hit.id;
    }

    const detail = await tmdbGet<TmdbDetail>(`/${mediaType}/${tmdbId}`, {
      append_to_response: "credits,external_ids",
    });

    // For a synthetic id, this is the first time we learn the real imdb_id — resolve it here.
    const resolvedId = synthetic ? detail.external_ids?.imdb_id : id;
    if (!resolvedId) return null;

    const crew = detail.credits?.crew ?? [];
    const cast = detail.credits?.cast ?? [];
    const duration = detail.runtime || detail.episode_run_time?.[0];

    return {
      id: resolvedId,
      title: detail.title || detail.name || resolvedId,
      originalTitle: detail.original_title || detail.original_name,
      description: detail.overview,
      year: parseYear(detail.release_date || detail.first_air_date),
      genres: detail.genres?.map((g) => g.name) ?? [],
      directors: crew.filter((c) => c.job === "Director").map((c) => c.name),
      writers: crew.filter((c) => c.job === "Writer" || c.job === "Screenplay").map((c) => c.name),
      actors: cast.slice(0, 10).map((c) => c.name),
      ratingValue: detail.vote_average,
      voteCount: detail.vote_count,
      duration: duration ? Math.round(duration) : undefined,
      titleType: mediaType === "tv" ? "TV series" : undefined,
    };
  }

  async browseGenre({ genre, title = "", start }: GenreBrowseParams): Promise<GenreBrowseResult> {
    const genreIds = GENRE_MAP[genre];
    if (!genreIds) return { movies: [], hasMore: false, nextStart: start };

    const page = Math.max(1, Math.ceil(start / PAGE_SIZE));
    const endpointBase = title.trim() ? "/search" : "/discover";
    const query = title.trim();

    const [movieData, tvData] = await Promise.all([
      tmdbGet<{ results: TmdbSearchItem[]; total_pages: number }>(`${endpointBase}/movie`, {
        ...(query ? { query } : { with_genres: String(genreIds.movie) }),
        page: String(page),
      }),
      genreIds.tv
        ? tmdbGet<{ results: TmdbSearchItem[]; total_pages: number }>(`${endpointBase}/tv`, {
            ...(query ? { query } : { with_genres: String(genreIds.tv) }),
            page: String(page),
          })
        : Promise.resolve({ results: [], total_pages: 0 }),
    ]);

    let movieResults = movieData.results;
    let tvResults = tvData.results;

    // /search doesn't take with_genres — filter client-side using the genre_ids it does return.
    if (query) {
      movieResults = movieResults.filter((r) => r.genre_ids?.includes(genreIds.movie));
      tvResults = genreIds.tv
        ? tvResults.filter((r) => r.genre_ids?.includes(genreIds.tv!))
        : [];
    }

    const candidates = [
      ...movieResults.map((item) => ({ item, mediaType: "movie" as MediaType })),
      ...tvResults.map((item) => ({ item, mediaType: "tv" as MediaType })),
    ];

    const movies = await withImdbIds(candidates);
    const hasMore = page < movieData.total_pages || page < tvData.total_pages;

    return { movies, hasMore, nextStart: start + PAGE_SIZE };
  }

  async findStreams(input: ScraperInput): Promise<StreamResult[]> {
    return findConfiguredStreams(input);
  }

  async browseHome(section: HomeSection): Promise<Movie[]> {
    const path: Record<HomeSection, string> = {
      trending: "/trending/movie/week",
      popular: "/movie/popular",
      top_rated: "/movie/top_rated",
      now_playing: "/movie/now_playing",
    };

    const data = await tmdbGet<{ results: TmdbSearchItem[] }>(path[section]);
    return data.results.slice(0, HOME_ROW_SIZE).map((item) => toPreviewMovie(item, "movie"));
  }

  async getRecommendations(seedImdbIds: string[]): Promise<Movie[]> {
    if (seedImdbIds.length === 0) return [];

    const seedHits = await Promise.all(
      seedImdbIds.map(async (imdbId) => {
        try {
          const found = await tmdbGet<TmdbFindResponse>(`/find/${imdbId}`, {
            external_source: "imdb_id",
          });
          const movieHit = found.movie_results[0];
          const tvHit = found.tv_results[0];
          const mediaType: MediaType = movieHit ? "movie" : "tv";
          const hit = movieHit ?? tvHit;
          return hit ? { hit, mediaType } : null;
        } catch {
          return null;
        }
      })
    );
    const seeds = seedHits.filter((s): s is { hit: TmdbSearchItem; mediaType: MediaType } => s !== null);
    if (seeds.length === 0) return [];

    const seedKeys = new Set(seeds.map((s) => `${s.mediaType}:${s.hit.id}`));

    const recLists = await Promise.all(
      seeds.map(({ hit, mediaType }) =>
        tmdbGet<{ results: TmdbSearchItem[] }>(`/${mediaType}/${hit.id}/recommendations`)
          .then((d) => d.results.map((item) => ({ item, mediaType })))
          .catch(() => [])
      )
    );

    const scored = new Map<string, { item: TmdbSearchItem; mediaType: MediaType; score: number }>();
    for (const list of recLists) {
      for (const { item, mediaType } of list) {
        const key = `${mediaType}:${item.id}`;
        if (seedKeys.has(key)) continue;
        const existing = scored.get(key);
        if (existing) existing.score += 1;
        else scored.set(key, { item, mediaType, score: 1 });
      }
    }

    let ranked = Array.from(scored.values()).sort((a, b) => b.score - a.score);

    // No overlap across recommendation lists — fall back to the seeds' own most common genre.
    if (ranked.length === 0) {
      const genreCount = new Map<number, number>();
      for (const { hit } of seeds) {
        for (const g of hit.genre_ids ?? []) genreCount.set(g, (genreCount.get(g) ?? 0) + 1);
      }
      const topGenre = Array.from(genreCount.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
      if (!topGenre) return [];

      const discover = await tmdbGet<{ results: TmdbSearchItem[] }>("/discover/movie", {
        with_genres: String(topGenre),
      });
      ranked = discover.results
        .filter((item) => !seedKeys.has(`movie:${item.id}`))
        .map((item) => ({ item, mediaType: "movie" as MediaType, score: 0 }));
    }

    return ranked.slice(0, HOME_ROW_SIZE).map(({ item, mediaType }) => toPreviewMovie(item, mediaType));
  }
}
