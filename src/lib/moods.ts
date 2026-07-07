export interface MoodPreset {
  key: string;
  label: string;
  emoji: string;
  // Genre names as used across the app (see GENRE_MAP in lib/datasource/tmdb.ts) — matched with OR semantics.
  genres: string[];
  yearMin?: number;
  yearMax?: number;
  minRating?: number;
  minVotes?: number;
  sortBy?: "popularity" | "rating" | "release_date";
}

export const MOODS: MoodPreset[] = [
  { key: "feliz", label: "Quero me sentir feliz", emoji: "😊", genres: ["Comedy", "Family", "Animation"], sortBy: "popularity" },
  { key: "medo", label: "Quero sentir medo", emoji: "👻", genres: ["Horror", "Thriller"], minRating: 6, minVotes: 150 },
  { key: "nostalgia", label: "Nostalgia", emoji: "📼", genres: ["Family", "Adventure", "Fantasy", "Animation"], yearMax: 2005 },
  { key: "fofo", label: "Fofo", emoji: "🥹", genres: ["Animation", "Family"], sortBy: "popularity" },
  { key: "cerebro-desligado", label: "Cérebro desligado", emoji: "🍿", genres: ["Comedy", "Action"], sortBy: "popularity" },
  { key: "chorar", label: "Chorar litros", emoji: "😭", genres: ["Drama", "Romance"], sortBy: "rating", minVotes: 200 },
  { key: "vira-cabeca", label: "Vira a cabeça", emoji: "🌀", genres: ["Thriller", "Sci-Fi", "Mystery"], minVotes: 100 },
  { key: "prato-cheio", label: "Prato cheio", emoji: "🎬", genres: ["Adventure", "Fantasy", "Sci-Fi"], sortBy: "rating", minVotes: 300 },
  { key: "date-night", label: "Date night", emoji: "❤️", genres: ["Romance", "Comedy"], sortBy: "popularity" },
  { key: "sessao-da-tarde", label: "Sessão da tarde", emoji: "📺", genres: ["Family", "Adventure", "Comedy"], yearMin: 1980, yearMax: 2005 },
  { key: "adrenalina", label: "Adrenalina", emoji: "🔥", genres: ["Action", "Thriller"], sortBy: "popularity" },
];

export function findMood(key: string): MoodPreset | undefined {
  return MOODS.find((m) => m.key === key);
}
