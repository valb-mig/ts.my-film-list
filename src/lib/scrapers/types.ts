export interface StreamServer {
  id: string;
  label: string;
  embedUrl: string;
}

export interface StreamResult {
  source: string;
  movieUrl: string;
  servers: StreamServer[];
  kind: "sub" | "dub";
}

export interface ScraperInput {
  id: string;
  title: string;
  year?: string;
  type?: "movie" | "tv";
  // Only set when type is "tv".
  season?: number;
  episode?: number;
}

export interface ScraperStrategy {
  readonly name: string;
  readonly kind: "sub" | "dub";
  scrape(input: ScraperInput): Promise<Omit<StreamResult, "kind"> | null>;
}

export interface SubtitleFile {
  // BCP 47-ish code, e.g. "pt-BR", "en".
  lang: string;
  // Direct download link.
  url: string;
}

export interface SubtitleResult {
  source: string;
  // Release the files were made for — tells the user which video cut they'll sync with.
  release: string;
  // Release page, for languages/versions not returned here.
  pageUrl: string;
  files: SubtitleFile[];
}

export interface SubtitleInput extends ScraperInput {
  // Wanted languages, in order of preference.
  langs: string[];
}

export interface SubtitleStrategy {
  readonly name: string;
  findSubtitles(input: SubtitleInput): Promise<SubtitleResult[]>;
  // Contents of one of the files this source returned, or null if the url isn't one of its own.
  fetchFile(url: string): Promise<string | null>;
}

// Anything that can be registered and enabled in config.json.
export type Source = ScraperStrategy | SubtitleStrategy;
