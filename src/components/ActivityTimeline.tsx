"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Movie } from "@/types/imdb";
import { relativeTime } from "@/lib/relativeTime";

interface WatchedRow {
  imdb_id: string;
  title: string;
  year?: number;
  poster_url?: string;
  watched_at: number;
}

interface SearchMovie {
  imdb_id: string;
  title: string;
  year?: number;
  poster_url?: string;
}

interface SearchRow {
  id: number;
  query: string;
  searched_at: number;
  movies: SearchMovie[];
}

type TimelineEntry =
  | { kind: "watched"; at: number; data: WatchedRow }
  | { kind: "search"; at: number; data: SearchRow };

interface Props {
  refreshTrigger: number;
  onSelectMovie: (movie: Movie) => void;
}

export default function ActivityTimeline({ refreshTrigger, onSelectMovie }: Props) {
  const [entries, setEntries] = useState<TimelineEntry[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/watched?limit=20").then((r) => r.json()) as Promise<WatchedRow[]>,
      fetch("/api/history?page=1").then((r) => r.json()) as Promise<{ searches: SearchRow[] }>,
    ])
      .then(([watched, history]) => {
        if (cancelled) return;
        const merged: TimelineEntry[] = [
          ...watched.map((w): TimelineEntry => ({ kind: "watched", at: w.watched_at, data: w })),
          ...(history.searches ?? []).map((s): TimelineEntry => ({ kind: "search", at: s.searched_at, data: s })),
        ].sort((a, b) => b.at - a.at);
        setEntries(merged);
      })
      .catch(() => { if (!cancelled) setEntries([]); });
    return () => { cancelled = true; };
  }, [refreshTrigger]);

  if (entries === null) {
    return (
      <div className="flex flex-col gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-16 bg-white/[0.04] rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center select-none">
        <p className="text-[#5a4e46] text-sm">Sem atividade ainda</p>
        <p className="text-[#5a4e46]/60 text-xs mt-1">Pesquise ou assista algo pra começar a linha do tempo</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {entries.map((entry) =>
        entry.kind === "watched" ? (
          <button
            key={`w-${entry.data.imdb_id}-${entry.at}`}
            onClick={() => onSelectMovie({ id: entry.data.imdb_id, title: entry.data.title, year: entry.data.year, poster: entry.data.poster_url })}
            className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.05] transition-colors text-left"
          >
            <div className="relative w-9 h-9 rounded-full bg-[#d4845a]/15 flex items-center justify-center shrink-0">
              <svg width="14" height="14" fill="#d4845a" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
            </div>
            {entry.data.poster_url && (
              <div className="relative w-9 h-12 rounded-md overflow-hidden shrink-0">
                <Image src={entry.data.poster_url} alt={entry.data.title} fill className="object-cover" sizes="36px" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[#f0e8dc] text-sm truncate">Assistiu <span className="font-semibold">{entry.data.title}</span></p>
              <p className="text-[#5a4e46] text-xs">{relativeTime(entry.at)}</p>
            </div>
          </button>
        ) : (
          <div
            key={`s-${entry.data.id}`}
            className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05]"
          >
            <div className="w-9 h-9 rounded-full bg-white/[0.06] flex items-center justify-center shrink-0">
              <svg width="14" height="14" fill="#9a8878" viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" /></svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[#f0e8dc] text-sm truncate">Pesquisou <span className="font-semibold">&ldquo;{entry.data.query}&rdquo;</span></p>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-[#5a4e46] text-xs shrink-0">{relativeTime(entry.at)}</p>
                {entry.data.movies.length > 0 && (
                  <div className="flex -space-x-2">
                    {entry.data.movies.slice(0, 5).map((m) => (
                      <button
                        key={m.imdb_id}
                        onClick={() => onSelectMovie({ id: m.imdb_id, title: m.title, year: m.year, poster: m.poster_url })}
                        className="relative w-5 h-7 rounded-sm overflow-hidden border border-[#0a0906] shrink-0"
                        title={m.title}
                      >
                        {m.poster_url ? (
                          <Image src={m.poster_url} alt={m.title} fill className="object-cover" sizes="20px" />
                        ) : (
                          <div className="w-full h-full bg-white/10" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      )}
    </div>
  );
}
