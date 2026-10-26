import { TmdbDataSource } from "./tmdb";
import { MockDataSource } from "./mock";
import type { MovieDataSource } from "./types";

let instance: MovieDataSource | null = null;

export function getDataSource(): MovieDataSource {
  if (!instance) {
    instance = process.env.DATA_SOURCE === "mock" ? new MockDataSource() : new TmdbDataSource();
  }
  return instance;
}

export type {
  MovieDataSource,
  MovieDetail,
  GenreBrowseParams,
  GenreBrowseResult,
  HomeSection,
  Movie,
  StreamResult,
  StreamServer,
  SubtitleFile,
  SubtitleResult,
} from "./types";
