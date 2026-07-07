"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { Movie } from "@/types/imdb";
import { relativeTime } from "@/lib/relativeTime";
import { useChunkedList } from "@/lib/useChunkedList";

interface WatchedRow {
  imdb_id: string;
  title: string;
  year?: number;
  poster_url?: string;
  watched_at: number;
}

interface Props {
  refreshTrigger: number;
  onSelectMovie: (movie: Movie) => void;
}

export default function WatchedList({ refreshTrigger, onSelectMovie }: Props) {
  const [items, setItems] = useState<WatchedRow[] | null>(null);

  const fetchWatched = useCallback(() => {
    fetch("/api/watched?all=1")
      .then((r) => r.json())
      .then((rows: WatchedRow[]) => setItems(rows))
      .catch(() => setItems([]));
  }, []);

  useEffect(() => { fetchWatched(); }, [refreshTrigger, fetchWatched]);

  const handleRemove = useCallback(async (imdbId: string) => {
    await fetch(`/api/watched/${imdbId}`, { method: "DELETE" });
    setItems((prev) => prev?.filter((i) => i.imdb_id !== imdbId) ?? null);
  }, []);

  const { visible, hasMore, sentinelRef } = useChunkedList(items ?? [], 30);

  if (items === null) {
    return (
      <div className="flex flex-col gap-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-16 bg-white/[0.04] rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center select-none">
        <p className="text-[#5a4e46] text-sm">Nenhum filme assistido ainda</p>
        <p className="text-[#5a4e46]/60 text-xs mt-1">Marque um filme como assistido pra ver aqui</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[#5a4e46] text-xs tabular-nums self-end">
        {items.length} título{items.length !== 1 ? "s" : ""}
      </p>
      {visible.map((item) => (
        <div
          key={item.imdb_id}
          className="flex items-center gap-3 group rounded-2xl p-2.5 hover:bg-white/[0.04] transition-colors"
          style={{ border: "1px solid rgba(255,255,255,0.04)" }}
        >
          <button
            className="shrink-0 w-12 h-[68px] relative bg-[#1e1a16] rounded-xl overflow-hidden cursor-pointer"
            onClick={() => onSelectMovie({ id: item.imdb_id, title: item.title, year: item.year, poster: item.poster_url })}
          >
            {item.poster_url ? (
              <Image src={item.poster_url} alt={item.title} fill className="object-cover" sizes="48px" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-[#5a4e46] text-xs text-center px-1 leading-tight">{item.title}</span>
              </div>
            )}
          </button>

          <div
            className="flex-1 flex flex-col justify-center gap-0.5 cursor-pointer min-w-0"
            onClick={() => onSelectMovie({ id: item.imdb_id, title: item.title, year: item.year, poster: item.poster_url })}
          >
            <p className="text-[#f0e8dc] text-sm font-medium truncate">{item.title}</p>
            <div className="flex items-center gap-2 text-xs text-[#5a4e46]">
              {item.year && <span>{item.year}</span>}
              {item.year && <span>·</span>}
              <span>{relativeTime(item.watched_at)}</span>
            </div>
          </div>

          <button
            onClick={() => handleRemove(item.imdb_id)}
            className="shrink-0 self-center p-1.5 rounded-full text-[#5a4e46] hover:text-[#d4845a] hover:bg-[#d4845a]/10 transition-colors opacity-0 group-hover:opacity-100"
            aria-label="Desmarcar como assistido"
            title="Desmarcar como assistido"
          >
            <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </div>
      ))}
      {hasMore && (
        <div ref={sentinelRef} className="flex justify-center py-4">
          <div className="w-4 h-4 border-2 border-white/[0.1] border-t-[#9a8878] rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
