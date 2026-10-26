"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import type { Movie } from "@/types/imdb";
import type { MovieDetail } from "@/lib/datasource";
import { Icon } from "./icons";
import { formatDuration, getDetail } from "./detailCache";

interface Props {
  movie: Movie | null;
  onSearch: () => void;
  onSurprise: () => void;
}

const topButton =
  "flex items-center gap-[0.7vw] h-[3.6vw] px-[1.8vw] rounded-full bg-white/[0.08] text-[1.3vw] font-semibold text-[#f0e8dc] outline-none transition-all duration-150 focus:scale-105 focus:bg-[#d4845a] focus:text-white";

// Top of the home screen: whatever poster has focus, described — so you can browse without opening.
export default function TvInfoPanel({ movie, onSearch, onSurprise }: Props) {
  const [detail, setDetail] = useState<MovieDetail | null>(null);

  useEffect(() => {
    setDetail(null);
    if (!movie) return;
    let cancelled = false;
    // Wait for focus to settle — scrolling through a row shouldn't fetch every poster it passes.
    const timer = setTimeout(() => {
      getDetail(movie.id).then((d) => { if (!cancelled) setDetail(d); });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [movie]);

  const meta = movie
    ? [
        detail?.year ?? movie.year,
        formatDuration(detail?.duration),
        detail?.ratingValue ? `★ ${detail.ratingValue.toFixed(1)}` : null,
        detail?.genres?.slice(0, 3).join(" · "),
      ].filter(Boolean)
    : [];

  return (
    <header className="relative h-[40vh] shrink-0 overflow-hidden">
      {movie?.poster && (
        <Image
          key={movie.poster}
          src={movie.poster}
          alt=""
          fill
          sizes="100vw"
          className="object-cover object-[50%_25%] opacity-35 blur-[1.5vw] scale-110"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-[#0a0906] via-[#0a0906]/80 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0a0906] via-transparent to-[#0a0906]/60" />

      <div className="relative h-full flex flex-col px-[4vw] pt-[4vh] pb-[2vh]">
        <div className="flex items-center gap-[1vw]">
          <Image src="/logo.png" alt="My Film List" width={64} height={64} className="w-[3.4vw] h-auto" priority />
          <div className="ml-auto flex gap-[1vw]">
            <button className={topButton} onClick={onSearch}>
              <Icon name="search" className="w-[1.5vw] h-[1.5vw]" />
              Buscar
            </button>
            <button className={topButton} onClick={onSurprise}>
              <Icon name="shuffle" className="w-[1.5vw] h-[1.5vw]" />
              Sortear
            </button>
          </div>
        </div>

        <div className="mt-auto max-w-[55vw] flex flex-col gap-[0.8vw]">
          {movie ? (
            <>
              <h1 className="text-[3.2vw] font-black leading-[1.05] line-clamp-1">{detail?.title ?? movie.title}</h1>
              {meta.length > 0 && <p className="text-[1.3vw] text-[#9a8878]">{meta.join("   ·   ")}</p>}
              <p className="text-[1.25vw] leading-relaxed text-[#cbbfb2] line-clamp-3 min-h-[3.6vw]">
                {detail?.description ?? ""}
              </p>
            </>
          ) : (
            <>
              <h1 className="text-[3.2vw] font-black leading-[1.05]">My Film List</h1>
              <p className="text-[1.3vw] text-[#9a8878]">Setas pra navegar · OK pra abrir · Voltar pra sair</p>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
