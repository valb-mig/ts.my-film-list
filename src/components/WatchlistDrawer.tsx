"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Image from "next/image";
import { WatchlistItem, Movie } from "@/types/imdb";
import { useChunkedList } from "@/lib/useChunkedList";

interface Props {
  open: boolean;
  onClose: () => void;
  onSelectMovie: (movie: Movie) => void;
  onRemove: (imdbId: string) => void;
}

export default function WatchlistDrawer({ open, onClose, onSelectMovie, onRemove }: Props) {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(false);
  const touchStartY = useRef(0);
  const [translateY, setTranslateY] = useState(0);
  const isDragging = useRef(false);

  const fetchItems = useCallback(() => {
    setLoading(true);
    fetch("/api/watchlist")
      .then((r) => r.json())
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { if (open) { fetchItems(); setTranslateY(0); } }, [open, fetchItems]);

  const handleRemove = useCallback(async (imdbId: string) => {
    await fetch(`/api/watchlist/${imdbId}`, { method: "DELETE" });
    setItems((prev) => prev.filter((i) => i.imdb_id !== imdbId));
    onRemove(imdbId);
  }, [onRemove]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", handleKey); document.body.style.overflow = ""; };
  }, [open, onClose]);

  const { visible, hasMore: hasMoreVisible, sentinelRef } = useChunkedList(items, 30);

  const handleTouchStart = (e: React.TouchEvent) => { touchStartY.current = e.touches[0].clientY; isDragging.current = true; };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current) return;
    const delta = e.touches[0].clientY - touchStartY.current;
    if (delta > 0) setTranslateY(delta);
  };
  const handleTouchEnd = () => {
    if (translateY > 100) onClose(); else setTranslateY(0);
    isDragging.current = false;
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="relative w-full sm:max-w-md max-h-[88vh] sm:max-h-[80vh] rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col"
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
            <h2 className="text-[#f0e8dc] font-black text-xl">Minha Lista</h2>
            {!loading && (
              <p className="text-[#5a4e46] text-xs mt-0.5">{items.length} {items.length === 1 ? "filme" : "filmes"}</p>
            )}
          </div>
          <button onClick={onClose} className="p-2 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-[#9a8878] hover:text-[#f0e8dc] transition-colors">
            <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading && (
            <div className="flex flex-col gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-3 animate-pulse">
                  <div className="w-12 h-[68px] bg-white/[0.06] rounded-xl shrink-0" />
                  <div className="flex-1 flex flex-col gap-2 pt-1">
                    <div className="h-3 bg-white/[0.06] rounded w-3/4" />
                    <div className="h-3 bg-white/[0.06] rounded w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && items.length === 0 && (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <p className="text-[#5a4e46] text-sm">Lista vazia</p>
              <p className="text-[#5a4e46]/60 text-xs mt-1">Salve filmes para ver aqui</p>
            </div>
          )}

          {!loading && items.length > 0 && (
            <div className="flex flex-col gap-2">
              {visible.map((item) => {
                const movie: Movie = { id: item.imdb_id, title: item.title, year: item.year, poster: item.poster_url ?? undefined };
                return (
                  <div
                    key={item.imdb_id}
                    className="flex gap-3 group rounded-2xl p-2.5 hover:bg-white/[0.04] transition-colors"
                    style={{ border: "1px solid rgba(255,255,255,0.04)" }}
                  >
                    <button
                      className="shrink-0 w-12 h-[68px] relative bg-[#1e1a16] rounded-xl overflow-hidden cursor-pointer"
                      onClick={() => { onSelectMovie(movie); onClose(); }}
                    >
                      {item.poster_url ? (
                        <Image src={item.poster_url} alt={item.title} fill className="object-cover" sizes="48px" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="text-[#5a4e46] text-xs text-center px-1 leading-tight">{item.title}</span>
                        </div>
                      )}
                    </button>

                    <div className="flex-1 flex flex-col justify-center gap-1 cursor-pointer min-w-0"
                      onClick={() => { onSelectMovie(movie); onClose(); }}>
                      <p className="text-[#f0e8dc] text-sm font-medium truncate">{item.title}</p>
                      <div className="flex items-center gap-2 text-xs text-[#5a4e46]">
                        {item.year && <span>{item.year}</span>}
                        {item.rating && (
                          <><span>·</span>
                          <span className="flex items-center gap-1">
                            <svg width="9" height="9" fill="#F5C518" viewBox="0 0 24 24">
                              <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                            </svg>
                            {item.rating.toFixed(1)}
                          </span></>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => handleRemove(item.imdb_id)}
                      className="shrink-0 self-center p-1.5 rounded-full text-[#5a4e46] hover:text-[#d4845a] hover:bg-[#d4845a]/10 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                      </svg>
                    </button>
                  </div>
                );
              })}
              {hasMoreVisible && (
                <div ref={sentinelRef} className="flex justify-center py-4">
                  <div className="w-4 h-4 border-2 border-white/[0.1] border-t-[#9a8878] rounded-full animate-spin" />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
