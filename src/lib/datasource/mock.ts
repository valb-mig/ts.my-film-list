import type { Movie } from "@/types/imdb";
import type { StreamResult, ScraperInput, SubtitleInput, SubtitleResult } from "@/lib/scrapers/types";
import type {
  MovieDataSource,
  MovieDetail,
  GenreBrowseParams,
  GenreBrowseResult,
  HomeSection,
  MoodBrowseParams,
  EpisodeInfo,
} from "./types";
import moviesData from "./mocks/movies.json";
import streamsData from "./mocks/streams.json";
import subtitlesData from "./mocks/subtitles.json";

interface MockMovie extends Movie, Omit<MovieDetail, "id" | "title" | "year"> {}

const MOVIES = moviesData as MockMovie[];
const STREAMS = streamsData as Record<string, StreamResult[]>;
const SUBTITLES = subtitlesData as Record<string, SubtitleResult[]>;
const SAMPLE_SRT = `1
00:00:01,000 --> 00:00:04,000
Legenda de exemplo do MockDataSource.

2
00:00:05,000 --> 00:00:08,000
Use os controles do player pra sincronizar.
`;

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
      poster: m.poster,
    });
  }

  async browseGenre({ genre, title = "", minDuration, maxDuration }: GenreBrowseParams): Promise<GenreBrowseResult> {
    const genreKey = genre.toLowerCase();
    const titleFilter = title.toLowerCase().trim();

    const movies = MOVIES.filter((m) => m.genres?.some((g) => g.toLowerCase() === genreKey))
      .filter((m) => !titleFilter || m.title.toLowerCase().includes(titleFilter))
      .filter((m) => minDuration === undefined || (m.duration ?? 0) >= minDuration)
      .filter((m) => maxDuration === undefined || (m.duration ?? Infinity) <= maxDuration)
      .map(({ id, title, year, stars, type, poster }) => ({ id, title, year, stars, type, poster }));

    return delay({ movies, hasMore: false, nextStart: movies.length + 1 });
  }

  async browseMood({ mood, minDuration, maxDuration }: MoodBrowseParams): Promise<GenreBrowseResult> {
    const genreSet = new Set(mood.genres.map((g) => g.toLowerCase()));

    const movies = MOVIES
      .filter((m) => m.genres?.some((g) => genreSet.has(g.toLowerCase())))
      .filter((m) => !mood.yearMin || (m.year ?? 0) >= mood.yearMin)
      .filter((m) => !mood.yearMax || (m.year ?? 9999) <= mood.yearMax)
      .filter((m) => !mood.minRating || (m.ratingValue ?? 0) >= mood.minRating)
      .filter((m) => !mood.minVotes || (m.voteCount ?? 0) >= mood.minVotes)
      .filter((m) => minDuration === undefined || (m.duration ?? 0) >= minDuration)
      .filter((m) => maxDuration === undefined || (m.duration ?? Infinity) <= maxDuration)
      .map(({ id, title, year, stars, type, poster }) => ({ id, title, year, stars, type, poster }));

    return delay({ movies, hasMore: false, nextStart: movies.length + 1 });
  }

  async findStreams({ id }: ScraperInput): Promise<StreamResult[]> {
    return delay(STREAMS[id] ?? []);
  }

  async findSubtitles({ id }: SubtitleInput): Promise<SubtitleResult[]> {
    return delay(SUBTITLES[id] ?? []);
  }

  async fetchSubtitleFile(url: string): Promise<string | null> {
    return delay(url.startsWith("https://mock.local/") ? SAMPLE_SRT : null);
  }

  async browseHome(section: HomeSection): Promise<Movie[]> {
    const toMovie = ({ id, title, year, stars, type, poster }: MockMovie) =>
      ({ id, title, year, stars, type, poster });

    let sorted: MockMovie[];
    switch (section) {
      case "top_rated":
        sorted = [...MOVIES].sort((a, b) => (b.ratingValue ?? 0) - (a.ratingValue ?? 0));
        break;
      case "popular":
        sorted = [...MOVIES].sort((a, b) => (b.voteCount ?? 0) - (a.voteCount ?? 0));
        break;
      case "now_playing":
        sorted = [...MOVIES].sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
        break;
      case "trending":
      default:
        sorted = MOVIES;
    }

    return delay(sorted.slice(0, 20).map(toMovie));
  }

  // The fixtures have no series.
  async getSeasonEpisodes(): Promise<EpisodeInfo[]> {
    return delay([]);
  }

  async getRecommendations(seedImdbIds: string[]): Promise<Movie[]> {
    if (seedImdbIds.length === 0) return delay([]);

    const seedSet = new Set(seedImdbIds);
    const seedGenres = new Set(
      MOVIES.filter((m) => seedSet.has(m.id)).flatMap((m) => m.genres ?? [])
    );
    if (seedGenres.size === 0) return delay([]);

    const results = MOVIES
      .filter((m) => !seedSet.has(m.id) && m.genres?.some((g) => seedGenres.has(g)))
      .sort((a, b) => (b.ratingValue ?? 0) - (a.ratingValue ?? 0))
      .slice(0, 20)
      .map(({ id, title, year, stars, type, poster }) => ({ id, title, year, stars, type, poster }));

    return delay(results);
  }
}
