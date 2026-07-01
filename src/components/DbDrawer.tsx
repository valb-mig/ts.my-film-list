"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import Image from "next/image";
import { Movie } from "@/types/imdb";
import { DbMovie } from "@/app/api/db/route";
import { useChunkedList } from "@/lib/useChunkedList";

type Filter = "all" | "watchlist" | "history";

interface Props {
  open: boolean;
  onClose: () => void;
  onSelectMovie: (movie: Movie) => void;
}

export default function DbDrawer({ open, onClose, onSelectMovie }: Props) {
  const [items, setItems] = useState<DbMovie[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const touchStartY = useRef(0);
  const [translateY, setTranslateY] = useState(0);
  const isDragging = useRef(false);

  const fetchItems = useCallback(() => {
    setLoading(true);
    fetch("/api/db")
      .then((r) => r.json())
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { if (open) { fetchItems(); setTranslateY(0); } }, [open, fetchItems]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", handleKey); document.body.style.overflow = ""; };
  }, [open, onClose]);

  const filtered = useMemo(() => {
    let list = items;
    if (filter === "watchlist") list = list.filter((i) => i.in_watchlist);
    else if (filter === "history") list = list.filter((i) => i.in_history);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((i) => i.title.toLowerCase().includes(q));
    }
    return list;
  }, [items, filter, search]);

  const counts = useMemo(() => ({
    all: items.length,
    watchlist: items.filter((i) => i.in_watchlist).length,
    history: items.filter((i) => i.in_history).length,
  }), [items]);

  const { visible, hasMore: hasMoreVisible, sentinelRef } = useChunkedList(filtered, 30);

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
        className="relative w-full sm:max-w-md max-h-[92vh] sm:max-h-[85vh] rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col"
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
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        <div className="flex items-center justify-between px-6 py-4 shrink-0 border-b border-white/[0.06]">
          <div>
            <h2 className="text-[#f0e8dc] font-black text-xl">Base de Dados</h2>
            {!loading && <p className="text-[#5a4e46] text-xs mt-0.5">{counts.all} filmes únicos</p>}
          </div>
          <button onClick={onClose} className="p-2 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-[#9a8878] hover:text-[#f0e8dc] transition-colors">
            <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </div>

        {/* Filter tabs */}
        <div className="shrink-0 flex gap-1.5 px-4 pt-3 pb-2">
          {(["all", "watchlist", "history"] as Filter[]).map((f) => {
            const labels = { all: "Todos", watchlist: "Salvos", history: "Histórico" };
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  filter === f
                    ? "bg-[#d4845a] text-white"
                    : "bg-white/[0.05] text-[#9a8878] hover:text-[#f0e8dc] border border-white/[0.06]"
                }`}
              >
                {labels[f]}
                <span className={`${filter === f ? "text-white/70" : "text-[#5a4e46]"} tabular-nums`}>
                  {counts[f]}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="shrink-0 px-4 pb-3">
          <div className="relative">
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5a4e46] pointer-events-none">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filtrar por título..."
              className="w-full bg-white/[0.04] border border-white/[0.07] text-[#f0e8dc] placeholder-[#5a4e46] pl-8 pr-7 py-2 rounded-xl text-xs outline-none focus:border-[#d4845a]/40 transition-colors"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#5a4e46] hover:text-[#f0e8dc] text-xs">✕</button>
            )}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {loading && (
            <div className="flex flex-col gap-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex gap-3 animate-pulse">
                  <div className="w-10 h-14 bg-white/[0.06] rounded-xl shrink-0" />
                  <div className="flex-1 flex flex-col gap-2 pt-1">
                    <div className="h-3 bg-white/[0.06] rounded w-3/4" />
                    <div className="h-2.5 bg-white/[0.06] rounded w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <p className="text-[#5a4e46] text-sm">{items.length === 0 ? "Banco vazio" : "Nenhum resultado"}</p>
            </div>
          )}

          {!loading && filtered.length > 0 && (
            <div className="flex flex-col gap-2">
              {visible.map((item) => {
                const movie: Movie = { id: item.imdb_id, title: item.title, year: item.year ?? undefined, poster: item.poster_url ?? undefined, type: item.type ?? undefined };
                return (
                  <button
                    key={item.imdb_id}
                    onClick={() => { onSelectMovie(movie); onClose(); }}
                    className="flex gap-3 w-full text-left rounded-2xl p-2.5 hover:bg-white/[0.04] transition-colors group"
                    style={{ border: "1px solid rgba(255,255,255,0.04)" }}
                  >
                    <div className="shrink-0 w-10 h-14 relative bg-[#1e1a16] rounded-xl overflow-hidden">
                      {item.poster_url ? (
                        <Image src={item.poster_url} alt={item.title} fill className="object-cover" sizes="40px" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center p-1">
                          <span className="text-[#5a4e46] text-[8px] text-center leading-tight">{item.title}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 flex flex-col justify-center gap-1 min-w-0">
                      <p className="text-[#f0e8dc] text-xs font-medium truncate">{item.title}</p>
                      <div className="flex items-center gap-1.5">
                        {item.year && <span className="text-[#5a4e46] text-[10px]">{item.year}</span>}
                        {item.type && <span className="text-[#5a4e46] text-[10px]">· {item.type}</span>}
                      </div>
                      <div className="flex gap-1">
                        {!!item.in_watchlist && (
                          <span className="bg-[#d4845a]/15 text-[#d4845a] text-[8px] font-bold px-1.5 py-0.5 rounded-full">SALVO</span>
                        )}
                        {!!item.in_history && (
                          <span className="bg-white/[0.06] text-[#9a8878] text-[8px] font-bold px-1.5 py-0.5 rounded-full">HISTÓRICO</span>
                        )}
                      </div>
                    </div>
                  </button>
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
