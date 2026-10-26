"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { EpisodeInfo } from "@/lib/datasource";
import { seasonEpisodes } from "@/lib/episodes";
import { Icon } from "./titleIcons";

interface Props {
  // Resolved IMDb id of the series.
  id: string;
  seasons: { number: number; episodeCount: number }[];
  // Season shown first — the one playing or last watched.
  initialSeason: number;
  // Highlighted episode (e.g. what's playing) and the word shown under it.
  current?: { season: number; episode: number; label: string } | null;
  onPlay: (season: number, episode: number) => void;
  // "compact" for the player's sidebar, "large" for the series panel.
  size?: "compact" | "large";
}

const chip = "shrink-0 px-3 h-8 rounded-lg text-xs font-semibold transition-colors";

export default function EpisodeList({ id, seasons, initialSeason, current, onPlay, size = "compact" }: Props) {
  const large = size === "large";
  // The season being browsed — can differ from the one playing until an episode is picked.
  const [viewSeason, setViewSeason] = useState(initialSeason);
  const [episodes, setEpisodes] = useState<EpisodeInfo[] | null>(null);
  const currentRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { setViewSeason(initialSeason); }, [initialSeason]);

  useEffect(() => {
    setEpisodes(null);
    let cancelled = false;
    seasonEpisodes(id, viewSeason).then((eps) => { if (!cancelled) setEpisodes(eps); });
    return () => { cancelled = true; };
  }, [id, viewSeason]);

  // No episode data (source without it, or the lookup failed): numbered entries still work.
  const count = seasons.find((s) => s.number === viewSeason)?.episodeCount ?? 0;
  const list: EpisodeInfo[] =
    episodes && episodes.length > 0 ? episodes : Array.from({ length: count }, (_, i) => ({ number: i + 1 }));

  useEffect(() => {
    if (!large) currentRef.current?.scrollIntoView({ block: "nearest" });
  }, [episodes, large]);

  return (
    <div className="flex flex-col gap-3">
      {seasons.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:thin]">
          {seasons.map((s) => (
            <button
              key={s.number}
              onClick={() => setViewSeason(s.number)}
              className={`${chip} ${s.number === viewSeason ? "bg-[#f0e8dc] text-[#0a0906]" : "bg-white/[0.06] text-[#9a8878] hover:text-[#f0e8dc]"}`}
            >
              Temporada {s.number}
            </button>
          ))}
        </div>
      )}
      {episodes === null && count === 0 ? (
        <div className="h-20 rounded-xl bg-white/[0.05] animate-pulse" />
      ) : (
        <div className={`flex flex-col ${large ? "gap-2" : "gap-1"}`}>
          {list.map((ep) => {
            const isCurrent = current?.season === viewSeason && current.episode === ep.number;
            return (
              <button
                key={ep.number}
                ref={isCurrent ? currentRef : undefined}
                onClick={() => onPlay(viewSeason, ep.number)}
                className={`group flex rounded-xl text-left transition-colors ${large ? "gap-4 p-2" : "gap-3 p-1.5 -mx-1.5"} ${
                  isCurrent ? "bg-[#d4845a]/15" : "hover:bg-white/[0.05]"
                }`}
              >
                <div className={`relative shrink-0 aspect-video rounded-lg overflow-hidden bg-white/[0.05] flex items-center justify-center ${large ? "w-44" : "w-28"}`}>
                  {ep.still ? (
                    <Image src={ep.still} alt="" fill sizes={large ? "176px" : "112px"} className="object-cover" />
                  ) : (
                    <span className="text-lg font-black text-[#5a4e46]">{ep.number}</span>
                  )}
                  <span
                    className={`absolute inset-0 flex items-center justify-center bg-black/55 text-[#f0e8dc] transition-opacity ${
                      isCurrent ? "opacity-100 text-[#d4845a]" : "opacity-0 group-hover:opacity-100"
                    }`}
                  >
                    <Icon name="play" size={large ? 26 : 18} />
                  </span>
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <p
                    className={`font-semibold line-clamp-1 transition-colors ${large ? "text-base" : "text-sm"} ${
                      isCurrent ? "text-[#d4845a]" : "text-[#f0e8dc] group-hover:text-[#d4845a]"
                    }`}
                  >
                    {ep.number}. {ep.name ?? `Episódio ${ep.number}`}
                  </p>
                  <p className="text-[11px] text-[#5a4e46]">
                    {isCurrent ? current.label : ep.runtime ? `${ep.runtime}min` : ""}
                  </p>
                  {ep.overview && (
                    <p className={`text-[#9a8878] mt-0.5 ${large ? "text-sm line-clamp-2" : "text-xs line-clamp-2"}`}>{ep.overview}</p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
