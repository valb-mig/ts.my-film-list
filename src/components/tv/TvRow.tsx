"use client";

import type { Movie } from "@/types/imdb";
import TvPoster from "./TvPoster";

interface Props {
  title: string;
  movies: Movie[];
  onFocus: (movie: Movie) => void;
  onOpen: (movie: Movie) => void;
  autoFocusFirst?: boolean;
}

export default function TvRow({ title, movies, onFocus, onOpen, autoFocusFirst }: Props) {
  if (movies.length === 0) return null;
  return (
    <section data-tv-section className="flex flex-col pt-[1vw]">
      <h2 className="px-[4vw] text-[1.5vw] font-bold text-[#f0e8dc]">{title}</h2>
      {/* Vertical padding leaves room for the focused poster's zoom inside the scroll box. */}
      <div
        data-tv-row
        className="flex gap-[1vw] overflow-x-auto px-[4vw] py-[1.4vw] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {movies.map((m, i) => (
          <TvPoster key={`${m.id}-${i}`} movie={m} onFocus={onFocus} onOpen={onOpen} autoFocus={autoFocusFirst && i === 0} />
        ))}
      </div>
    </section>
  );
}
