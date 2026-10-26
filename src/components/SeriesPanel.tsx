"use client";

import { useState } from "react";
import Image from "next/image";
import type { Movie } from "@/types/imdb";
import type { MovieDetail } from "@/lib/datasource";
import type { ListInfo } from "@/hooks/useLists";
import EpisodeList from "./EpisodeList";
import ListsPicker from "./ListsPicker";
import { Icon } from "./titleIcons";

interface Props {
  movie: Movie;
  detail: MovieDetail | null;
  // Resolved IMDb id.
  id: string;
  favorited: boolean;
  onToggleFavorite: () => void;
  saved: boolean;
  onToggleSave: () => void;
  lists: ListInfo[];
  listIds: Set<number>;
  onToggleList: (listId: number) => void;
  onCreateList: (name: string) => void;
  // What "Assistir" plays: the first episode, or the last one watched in this session.
  season: number;
  episode: number;
  lastWatched: { season: number; episode: number } | null;
  onPlay: (season: number, episode: number) => void;
  onClose: () => void;
}

const action =
  "flex items-center gap-2 h-11 px-4 rounded-xl text-sm font-semibold transition-colors disabled:opacity-40";
const idle = "bg-white/[0.08] text-[#f0e8dc] hover:bg-white/[0.16]";
const on = "bg-[#d4845a]/20 text-[#d4845a] hover:bg-[#d4845a]/30";

// Opening a series: what it is and its episodes, one click from playing. (Movies skip this and
// open straight in the player.)
export default function SeriesPanel({
  movie, detail, id, favorited, onToggleFavorite, saved, onToggleSave, lists, listIds, onToggleList, onCreateList,
  season, episode, lastWatched, onPlay, onClose,
}: Props) {
  const [listsOpen, setListsOpen] = useState(false);
  const title = detail?.title ?? movie.title;
  const seasons = detail?.seasons ?? [];
  const image = detail?.backdrop ?? movie.poster ?? detail?.poster;
  const meta = [
    detail?.year ?? movie.year,
    seasons.length ? `${seasons.length} temporada${seasons.length > 1 ? "s" : ""}` : null,
    detail?.genres?.slice(0, 3).join(" · "),
  ].filter(Boolean);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-lg"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full sm:max-w-4xl max-h-[94vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-[#0f0d0b] border border-white/[0.08] shadow-[0_40px_100px_rgba(0,0,0,0.9)] [scrollbar-width:thin]">
        <div className="relative h-[46vh] min-h-[300px] max-h-[460px]">
          {image && (
            <Image
              src={image}
              alt=""
              fill
              sizes="900px"
              priority
              className={`object-cover ${detail?.backdrop ? "" : "blur-2xl scale-110 opacity-60"}`}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0f0d0b] via-[#0f0d0b]/40 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0f0d0b]/80 via-transparent to-transparent" />

          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2.5 rounded-full bg-black/50 hover:bg-black/70 text-[#f0e8dc] transition-colors"
            aria-label="Fechar"
          >
            <Icon name="close" size={16} />
          </button>

          <div className="absolute inset-x-0 bottom-0 px-6 sm:px-8 pb-6 flex flex-col gap-3">
            <h2 className="text-3xl sm:text-5xl font-black leading-[1.05] text-[#f0e8dc] max-w-2xl">{title}</h2>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[#cbbfb2]">
              {detail?.ratingValue ? (
                <span className="flex items-center gap-1 text-[#F5C518] font-bold">
                  <Icon name="star" size={15} />
                  {detail.ratingValue.toFixed(1)}
                </span>
              ) : null}
              {meta.map((m, i) => (
                <span key={i}>{m}</span>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <button
                onClick={() => onPlay(season, episode)}
                className="flex items-center gap-2 h-11 px-6 rounded-xl text-sm font-bold bg-[#f0e8dc] text-[#0a0906] hover:bg-white transition-colors"
              >
                <Icon name="play" size={18} />
                {lastWatched ? "Continuar" : "Assistir"} T{season} E{episode}
              </button>
              <button onClick={onToggleFavorite} className={`${action} ${favorited ? on : idle}`} title={favorited ? "Remover dos favoritos" : "Favoritar"}>
                <Icon name={favorited ? "heart" : "heartOutline"} size={16} />
              </button>
              <button onClick={onToggleSave} className={`${action} ${saved ? on : idle}`}>
                <Icon name={saved ? "saved" : "save"} size={16} />
                {saved ? "Salvo" : "Salvar"}
              </button>
              <button onClick={() => setListsOpen((o) => !o)} className={`${action} ${listsOpen || listIds.size > 0 ? on : idle}`}>
                <Icon name="list" size={16} />
                Listas
              </button>
              <a
                href={`https://www.imdb.com/title/${id}/`}
                target="_blank"
                rel="noopener noreferrer"
                className="h-11 px-4 flex items-center rounded-xl bg-[#F5C518] hover:bg-[#e0b315] text-black text-sm font-black transition-colors"
              >
                IMDb
              </a>
            </div>
          </div>
        </div>

        <div className="px-6 sm:px-8 pb-8 flex flex-col gap-6">
          {listsOpen && (
            <div className="max-w-sm">
              <ListsPicker lists={lists} listIds={listIds} onToggleList={onToggleList} onCreateList={onCreateList} />
            </div>
          )}

          {(detail?.description || (detail?.actors && detail.actors.length > 0)) && (
            <div className="flex flex-col gap-2 max-w-3xl">
              {detail?.description && <p className="text-[15px] leading-relaxed text-[#cbbfb2]">{detail.description}</p>}
              {detail?.actors && detail.actors.length > 0 && (
                <p className="text-sm text-[#5a4e46]">
                  Elenco: <span className="text-[#9a8878]">{detail.actors.slice(0, 6).join(", ")}</span>
                </p>
              )}
            </div>
          )}

          {seasons.length > 0 && (
            <div className="flex flex-col gap-3">
              <h3 className="text-lg font-bold text-[#f0e8dc]">Episódios</h3>
              <EpisodeList
                id={id}
                seasons={seasons}
                initialSeason={lastWatched?.season ?? season}
                current={lastWatched ? { ...lastWatched, label: "Último assistido" } : null}
                onPlay={onPlay}
                size="large"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
