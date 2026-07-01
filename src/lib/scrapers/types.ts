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
}

export interface ScraperStrategy {
  readonly name: string;
  readonly kind: "sub" | "dub";
  scrape(input: ScraperInput): Promise<Omit<StreamResult, "kind"> | null>;
}
