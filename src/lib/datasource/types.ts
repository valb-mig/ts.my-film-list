import type { Movie } from "@/types/imdb";
import type { StreamResult, ScraperInput } from "@/lib/scrapers/types";

export type { Movie } from "@/types/imdb";
export type { StreamResult, StreamServer, ScraperInput } from "@/lib/scrapers/types";

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
}

export interface GenreBrowseResult {
  movies: Movie[];
  hasMore: boolean;
  nextStart: number;
  sessionReset?: boolean;
}

export interface MovieDataSource {
  search(query: string): Promise<Movie[]>;
  getMovieDetail(id: string): Promise<MovieDetail | null>;
  browseGenre(params: GenreBrowseParams): Promise<GenreBrowseResult>;
  findStreams(input: ScraperInput): Promise<StreamResult[]>;
}
