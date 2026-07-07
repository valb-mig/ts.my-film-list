import type { Movie } from "@/types/imdb";
import type { StreamResult, ScraperInput } from "@/lib/scrapers/types";
import type { MoodPreset } from "@/lib/moods";

export type { Movie } from "@/types/imdb";
export type { StreamResult, StreamServer, ScraperInput } from "@/lib/scrapers/types";
export type { MoodPreset } from "@/lib/moods";

export interface MovieDetail {
  id: string;
  title: string;
  originalTitle?: string;
  description?: string;
  year?: number;
  genres?: string[];
  directors?: string[];
  writers?: string[];
  actors?: string[];
  ratingValue?: number;
  voteCount?: number;
  duration?: number;
  titleType?: string;
}

export interface GenreBrowseParams {
  genre: string;
  title?: string;
  start: number;
  minDuration?: number;
  maxDuration?: number;
}

export interface GenreBrowseResult {
  movies: Movie[];
  hasMore: boolean;
  nextStart: number;
  sessionReset?: boolean;
}

export type HomeSection = "trending" | "popular" | "top_rated" | "now_playing";

export interface MoodBrowseParams {
  mood: MoodPreset;
  start: number;
  minDuration?: number;
  maxDuration?: number;
}

export interface MovieDataSource {
  search(query: string): Promise<Movie[]>;
  getMovieDetail(id: string): Promise<MovieDetail | null>;
  browseGenre(params: GenreBrowseParams): Promise<GenreBrowseResult>;
  browseMood(params: MoodBrowseParams): Promise<GenreBrowseResult>;
  findStreams(input: ScraperInput): Promise<StreamResult[]>;
  browseHome(section: HomeSection): Promise<Movie[]>;
  getRecommendations(seedImdbIds: string[]): Promise<Movie[]>;
}
