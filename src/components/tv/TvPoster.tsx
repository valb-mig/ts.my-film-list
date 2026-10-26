"use client";

import Image from "next/image";
import type { Movie } from "@/types/imdb";

interface Props {
  movie: Movie;
  onFocus?: (movie: Movie) => void;
  onOpen: (movie: Movie) => void;
  autoFocus?: boolean;
}

export default function TvPoster({ movie, onFocus, onOpen, autoFocus }: Props) {
  return (
    <button
      data-tv-autofocus={autoFocus || undefined}
      onFocus={() => onFocus?.(movie)}
      onClick={() => onOpen(movie)}
      aria-label={movie.title}
      className="relative shrink-0 w-[10.5vw] aspect-[2/3] rounded-[0.8vw] overflow-hidden bg-white/[0.05] outline-none transition-transform duration-150 focus:scale-110 focus:z-10 focus:ring-[0.3vw] focus:ring-[#d4845a] focus:shadow-[0_1vw_3vw_rgba(0,0,0,0.85)]"
    >
      {movie.poster ? (
        <Image src={movie.poster} alt="" fill sizes="12vw" className="object-cover" />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center p-[0.8vw] text-center text-[1vw] text-[#9a8878]">
          {movie.title}
        </span>
      )}
    </button>
  );
}
