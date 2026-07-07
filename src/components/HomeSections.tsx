"use client";

import { Movie } from "@/types/imdb";
import HomeRow from "@/components/HomeRow";

interface Props {
  watchlistIds: Set<string>;
  favoriteIds: Set<string>;
  onSelectMovie: (movie: Movie) => void;
}

const SECTIONS = [
  { title: "Em alta", endpoint: "/api/home?section=trending" },
  { title: "Em cartaz", endpoint: "/api/home?section=now_playing" },
  { title: "Populares", endpoint: "/api/home?section=popular" },
  { title: "Mais bem avaliados", endpoint: "/api/home?section=top_rated" },
];

export default function HomeSections({ watchlistIds, favoriteIds, onSelectMovie }: Props) {
  return (
    <div className="flex flex-col gap-8">
      {SECTIONS.map((section) => (
        <HomeRow
          key={section.endpoint}
          title={section.title}
          endpoint={section.endpoint}
          watchlistIds={watchlistIds}
          favoriteIds={favoriteIds}
          onSelectMovie={onSelectMovie}
        />
      ))}
      <HomeRow
        title="Baseado no que você curtiu"
        endpoint="/api/home/recommendations"
        watchlistIds={watchlistIds}
        favoriteIds={favoriteIds}
        onSelectMovie={onSelectMovie}
      />
      <HomeRow
        title="Baseado no que você assistiu"
        endpoint="/api/home/recommendations/watched"
        watchlistIds={watchlistIds}
        favoriteIds={favoriteIds}
        onSelectMovie={onSelectMovie}
      />
    </div>
  );
}
