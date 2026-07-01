"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Movie } from "@/types/imdb";

interface HistoryMovie {
  imdb_id: string;
  title: string;
  year?: number;
  poster_url?: string;
  type?: string;
  genres_json?: string;
  first_seen_at?: number;
}

interface Props {
  genre: string;
  movies: HistoryMovie[];
  watchlistIds: Set<string>;
  favoriteIds: Set<string>;
  onSelectMovie: (movie: Movie) => void;
  onClose: () => void;
}

function toMovie(m: HistoryMovie): Movie {
  return { id: m.imdb_id, title: m.title, year: m.year, poster: m.poster_url, type: m.type };
}

export default function GenreMoviesModal({
  genre,
  movies,
  watchlistIds,
  favoriteIds,
  onSelectMovie,
  onClose,
}: Props) {
  const touchStartY = useRef(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const [translateY, setTranslateY] = useState(0);
  const isDragging = useRef(false);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    isDragging.current = true;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current) return;
    const delta = e.touches[0].clientY - touchStartY.current;
    if (delta > 0) setTranslateY(delta);
  };

  const handleTouchEnd = () => {
    if (translateY > 100) {
      onClose();
    } else {
      setTranslateY(0);
    }
    isDragging.current = false;
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        className="relative w-full sm:max-w-2xl max-h-[90vh] rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col"
        style={{
          background: "linear-gradient(135deg, rgba(30,26,22,0.97) 0%, rgba(20,18,14,0.97) 100%)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 40px 100px rgba(0,0,0,0.8)",
          transform: `translateY(${translateY}px)`,
          transition: isDragging.current ? "none" : "transform 0.3s ease",
        }}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0 border-b border-white/[0.06]">
          <div>
            <p className="text-[#9a8878] text-xs uppercase tracking-widest font-semibold mb-0.5">
              Gênero
            </p>
            <h2 className="text-[#f0e8dc] font-black text-2xl">{genre}</h2>
            <p className="text-[#5a4e46] text-sm mt-0.5">
              {movies.length} filme{movies.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-[#9a8878] hover:text-[#f0e8dc] transition-colors"
          >
            <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </div>

        {/* Scrollable grid */}
        <div className="overflow-y-auto flex-1 p-4">
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {movies.map((m) => {
              const mv = toMovie(m);
              const saved = watchlistIds.has(m.imdb_id);
              const fav = favoriteIds.has(m.imdb_id);

              return (
                <button
                  key={m.imdb_id}
                  onClick={() => { onSelectMovie(mv); onClose(); }}
                  className="text-left group"
                >
                  <div
                    className="aspect-[2/3] relative rounded-xl overflow-hidden"
                    style={{ boxShadow: "0 4px 16px rgba(0,0,0,0.5)" }}
                  >
                    {m.poster_url ? (
                      <Image src={m.poster_url} alt={m.title} fill className="object-cover group-hover:scale-105 transition-transform duration-300" sizes="160px" />
                    ) : (
                      <div className="w-full h-full bg-[#1e1a16] flex items-center justify-center p-2">
                        <span className="text-[#5a4e46] text-[9px] text-center leading-tight">{m.title}</span>
                      </div>
                    )}
                    <div className="absolute inset-0 rounded-xl border border-white/[0.07]" />
                    {(saved || fav) && (
                      <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-[#d4845a] flex items-center justify-center">
                        <svg width="8" height="8" fill="white" viewBox="0 0 24 24">
                          {saved ? (
                            <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z" />
                          ) : (
                            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                          )}
                        </svg>
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] text-[#9a8878] truncate mt-1.5 leading-tight px-0.5 group-hover:text-[#f0e8dc] transition-colors">{m.title}</p>
                  {m.year && <p className="text-[9px] text-[#5a4e46] px-0.5">{m.year}</p>}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
