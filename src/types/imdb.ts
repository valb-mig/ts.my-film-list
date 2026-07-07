export interface IMDBSuggestionItem {
  id: string;
  l: string;
  y?: number;
  s?: string;
  q?: string;
  i?: {
    imageUrl: string;
    height: number;
    width: number;
  };
}

export interface IMDBSearchResponse {
  d: IMDBSuggestionItem[];
  q: string;
  v: number;
}

export interface Movie {
  id: string;
  title: string;
  year?: number;
  stars?: string;
  type?: string;
  poster?: string;
}

export interface FavoriteItem {
  imdb_id: string;
  title: string;
  year?: number;
  poster_url?: string;
  rating?: number;
  added_at: number;
}
