"use client";

import { useEffect, useRef, useState } from "react";
import { Movie } from "@/types/imdb";
import MovieCard from "@/components/MovieCard";

interface Props {
  title: string;
  endpoint: string;
  watchlistIds: Set<string>;
  favoriteIds: Set<string>;
  onSelectMovie: (movie: Movie) => void;
}

export default function HomeRow({ title, endpoint, watchlistIds, favoriteIds, onSelectMovie }: Props) {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);

  // Rows below the fold don't fetch until they're about to scroll into view — no point paying
  // for 4-5 rows of TMDB calls on mount when only the first one or two are ever seen.
  useEffect(() => {
    if (visible) return;
    const el = rowRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { rootMargin: "400px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setLoading(true);
    fetch(endpoint)
      .then((r) => r.json())
      .then((data: { movies?: Movie[] }) => { if (!cancelled) setMovies(data.movies ?? []); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [visible, endpoint]);

  if (visible && !loading && movies.length === 0) return null;

  return (
    <div ref={rowRef} className="flex flex-col gap-3">
      <h2 className="text-[#9a8878] text-xs font-bold uppercase tracking-[0.2em]">{title}</h2>

      <div className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 sm:-mx-6 sm:px-6 snap-x snap-mandatory scrollbar-hide">
        {loading
          ? [...Array(6)].map((_, i) => (
              <div
                key={i}
                className="shrink-0 w-[130px] sm:w-[160px] aspect-[2/3] rounded-xl bg-white/[0.04] animate-pulse"
              />
            ))
          : movies.map((movie) => (
              <div key={movie.id} className="shrink-0 w-[130px] sm:w-[160px] snap-start">
                <MovieCard
                  movie={movie}
                  onClick={onSelectMovie}
                  saved={watchlistIds.has(movie.id)}
                  favorited={favoriteIds.has(movie.id)}
                />
              </div>
            ))}
      </div>
    </div>
  );
}
