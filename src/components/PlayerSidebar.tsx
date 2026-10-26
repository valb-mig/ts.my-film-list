"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import type { Movie } from "@/types/imdb";
import type { MovieDetail } from "@/lib/datasource";
import type { ListInfo } from "@/hooks/useLists";
import EpisodeList from "./EpisodeList";
import ListsPicker from "./ListsPicker";
import { Icon } from "./titleIcons";

interface Props {
  // Resolved IMDb id — null while the detail is still loading.
  id: string | null;
  detail: MovieDetail | null;
  favorited: boolean;
  onToggleFavorite: () => void;
  // "Salvar" = the default (first) list, created on first use.
  saved: boolean;
  onToggleSave: () => void;
  lists: ListInfo[];
  listIds: Set<number>;
  onToggleList: (listId: number) => void;
  onCreateList: (name: string) => void;
  onPick: (movie: Movie) => void;
  // Films: where to rate it.
  letterboxdUrl?: string;
  // Series only: the episode list, with what's playing marked; picking one plays it.
  series?: {
    seasons: { number: number; episodeCount: number }[];
    season: number;
    episode: number;
    onPlay: (season: number, episode: number) => void;
  };
}

const action =
  "flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl text-xs font-semibold transition-colors disabled:opacity-40";
const idle = "bg-white/[0.06] text-[#9a8878] hover:bg-white/[0.12] hover:text-[#f0e8dc]";
const on = "bg-[#d4845a]/20 text-[#d4845a] hover:bg-[#d4845a]/30";

// Beside the player when it isn't in theater mode: what you're watching, saving it, the episodes
// (series) and what to watch next.
export default function PlayerSidebar({
  id, detail, favorited, onToggleFavorite, saved, onToggleSave, lists, listIds, onToggleList, onCreateList, onPick,
  letterboxdUrl, series,
}: Props) {
  const [recommended, setRecommended] = useState<Movie[] | null>(null);
  const [listsOpen, setListsOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setRecommended(null);
    if (!id) return;
    let cancelled = false;
    fetch(`/api/recommendations?id=${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((d: { movies?: Movie[] }) => { if (!cancelled) setRecommended(d.movies ?? []); })
      .catch(() => { if (!cancelled) setRecommended([]); });
    return () => { cancelled = true; };
  }, [id]);

  const meta = [
    detail?.year,
    detail?.duration ? `${detail.duration}min` : null,
    detail?.ratingValue ? `★ ${detail.ratingValue.toFixed(1)}` : null,
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-4 pb-4">
      <div className="flex flex-col gap-1.5">
        {meta.length > 0 && <p className="text-xs text-[#9a8878]">{meta.join(" · ")}</p>}
        {detail?.genres && detail.genres.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {detail.genres.map((g) => (
              <span key={g} className="bg-white/[0.05] text-[#9a8878] text-[11px] px-2 py-0.5 rounded-full border border-white/[0.07]">
                {g}
              </span>
            ))}
          </div>
        )}
        {detail?.description && (
          <button
            onClick={() => setExpanded((e) => !e)}
            className={`text-left text-sm leading-relaxed text-[#cbbfb2] ${expanded ? "" : "line-clamp-5"}`}
            title={expanded ? "Mostrar menos" : "Mostrar tudo"}
          >
            {detail.description}
          </button>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <button onClick={onToggleSave} disabled={!id} className={`${action} ${saved ? on : idle}`}>
            <Icon name={saved ? "saved" : "save"} />
            {saved ? "Salvo" : "Salvar"}
          </button>
          <button onClick={onToggleFavorite} disabled={!id} className={`${action} ${favorited ? on : idle}`}>
            <Icon name={favorited ? "heart" : "heartOutline"} />
            {favorited ? "Favorito" : "Favoritar"}
          </button>
          <button
            onClick={() => setListsOpen((o) => !o)}
            disabled={!id}
            className={`${action} ${listsOpen || listIds.size > 0 ? on : idle}`}
          >
            <Icon name="list" />
            Listas
          </button>
        </div>
        {listsOpen && <ListsPicker lists={lists} listIds={listIds} onToggleList={onToggleList} onCreateList={onCreateList} />}
        {id && (
          <div className="flex gap-2">
            {letterboxdUrl && (
              <a
                href={letterboxdUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`${action} ${idle} flex-[2]`}
              >
                <Icon name="star" />
                Avaliar no Letterboxd ↗
              </a>
            )}
            <a href={`https://www.imdb.com/title/${id}/`} target="_blank" rel="noopener noreferrer" className={`${action} ${idle}`}>
              IMDb ↗
            </a>
          </div>
        )}
      </div>

      {series && id && (
        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#5a4e46]">Episódios</p>
          <EpisodeList
            id={id}
            seasons={series.seasons}
            initialSeason={series.season}
            current={{ season: series.season, episode: series.episode, label: "Tocando" }}
            onPlay={series.onPlay}
          />
        </div>
      )}

      <div className="flex flex-col gap-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#5a4e46]">Recomendados</p>
        {recommended === null ? (
          Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex gap-3">
              <div className="w-14 aspect-[2/3] rounded-lg bg-white/[0.05] animate-pulse" />
              <div className="flex-1 flex flex-col gap-1.5 pt-1">
                <div className="h-3 w-3/4 rounded bg-white/[0.05] animate-pulse" />
                <div className="h-3 w-1/4 rounded bg-white/[0.05] animate-pulse" />
              </div>
            </div>
          ))
        ) : recommended.length === 0 ? (
          <p className="text-xs text-[#5a4e46]">Nada por aqui.</p>
        ) : (
          recommended.map((m) => (
            <button
              key={m.id}
              onClick={() => onPick(m)}
              title={`Assistir ${m.title}`}
              className="group flex gap-3 rounded-xl p-1.5 -mx-1.5 text-left hover:bg-white/[0.05] transition-colors"
            >
              <div className="relative w-14 shrink-0 aspect-[2/3] rounded-lg overflow-hidden bg-white/[0.05]">
                {m.poster && <Image src={m.poster} alt="" fill sizes="56px" className="object-cover" />}
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <p className="text-sm font-semibold text-[#f0e8dc] group-hover:text-[#d4845a] line-clamp-2 transition-colors">{m.title}</p>
                {m.year && <p className="text-xs text-[#5a4e46] mt-0.5">{m.year}</p>}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
