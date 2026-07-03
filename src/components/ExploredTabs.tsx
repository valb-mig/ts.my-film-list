"use client";

import { useState } from "react";
import { Movie } from "@/types/imdb";
import SearchHistory from "@/components/SearchHistory";
import ActivityTimeline from "@/components/ActivityTimeline";

interface Props {
  refreshTrigger: number;
  watchlistIds: Set<string>;
  favoriteIds: Set<string>;
  onSelectMovie: (movie: Movie) => void;
}

export default function ExploredTabs({ refreshTrigger, watchlistIds, favoriteIds, onSelectMovie }: Props) {
  const [tab, setTab] = useState<"genre" | "timeline">("genre");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-1.5">
        {([
          { key: "genre" as const, label: "Por gênero" },
          { key: "timeline" as const, label: "Linha do tempo" },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
              tab === t.key
                ? "bg-[#d4845a] text-white shadow-sm shadow-[#d4845a]/30"
                : "bg-white/[0.06] text-[#9a8878] hover:bg-white/[0.1] hover:text-[#f0e8dc]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "genre" ? (
        <SearchHistory
          refreshTrigger={refreshTrigger}
          watchlistIds={watchlistIds}
          favoriteIds={favoriteIds}
          onSelectMovie={onSelectMovie}
        />
      ) : (
        <ActivityTimeline refreshTrigger={refreshTrigger} onSelectMovie={onSelectMovie} />
      )}
    </div>
  );
}
