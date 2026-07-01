import type { Movie } from "@/types/imdb";
import type { StreamResult, ScraperInput } from "@/lib/scrapers/types";
import type {
  MovieDataSource,
  MovieDetail,
  GenreBrowseParams,
  GenreBrowseResult,
} from "./types";
import moviesData from "./mocks/movies.json";
import streamsData from "./mocks/streams.json";

interface MockMovie extends Movie, Omit<MovieDetail, "id" | "title" | "year"> {}

const MOVIES = moviesData as MockMovie[];
const STREAMS = streamsData as Record<string, StreamResult[]>;

function delay<T>(value: T, ms = 150): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export class MockDataSource implements MovieDataSource {
  async search(query: string): Promise<Movie[]> {
    const q = query.toLowerCase().trim();
    if (!q) return delay([]);

    const results = MOVIES.filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        m.originalTitle?.toLowerCase().includes(q) ||
        m.stars?.toLowerCase().includes(q)
    ).map(({ id, title, year, stars, type, poster }) => ({ id, title, year, stars, type, poster }));

    return delay(results);
  }

  async getMovieDetail(id: string): Promise<MovieDetail | null> {
    const m = MOVIES.find((movie) => movie.id === id);
    if (!m) return delay(null);

    return delay({
      id: m.id,
      title: m.title,
      originalTitle: m.originalTitle,
      description: m.description,
      year: m.year,
      genres: m.genres,
      directors: m.directors,
      writers: m.writers,
      actors: m.actors,
      ratingValue: m.ratingValue,
      voteCount: m.voteCount,
      duration: m.duration,
      titleType: m.titleType,
    });
  }

  async browseGenre({ genre, title = "" }: GenreBrowseParams): Promise<GenreBrowseResult> {
    const genreKey = genre.toLowerCase();
    const titleFilter = title.toLowerCase().trim();

    const movies = MOVIES.filter((m) => m.genres?.some((g) => g.toLowerCase() === genreKey))
      .filter((m) => !titleFilter || m.title.toLowerCase().includes(titleFilter))
      .map(({ id, title, year, stars, type, poster }) => ({ id, title, year, stars, type, poster }));

    return delay({ movies, hasMore: false, nextStart: movies.length + 1 });
  }

  async findStreams({ id }: ScraperInput): Promise<StreamResult[]> {
    return delay(STREAMS[id] ?? []);
  }
}
