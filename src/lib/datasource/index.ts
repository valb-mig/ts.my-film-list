import { MockDataSource } from "./mock";
import type { MovieDataSource } from "./types";

// This reference build ships only the mock data source.
// To use a real source: implement MovieDataSource in a new file (see mock.ts for the
// shape) and swap it in here, e.g. based on process.env.DATA_SOURCE.
let instance: MovieDataSource | null = null;

export function getDataSource(): MovieDataSource {
  if (!instance) instance = new MockDataSource();
  return instance;
}

export type {
  MovieDataSource,
  MovieDetail,
  GenreBrowseParams,
  GenreBrowseResult,
  Movie,
  StreamResult,
  StreamServer,
} from "./types";
