"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { Movie } from "@/types/imdb";
import type { EpisodeInfo, MovieDetail } from "@/lib/datasource";
import { nextEpisode, seasonEpisodes } from "@/lib/episodes";
import type { StreamResult, StreamServer, SubtitleResult } from "@/lib/scrapers/types";
import type { ListInfo } from "@/hooks/useLists";
import { sourceQuery, useSourceList } from "@/hooks/useSourceList";
import { focusElement } from "@/lib/tvNav";
import PlayerModal from "@/components/PlayerModal";
import TvLayer from "./TvLayer";
import { Icon } from "./icons";
import { formatDuration, getDetail } from "./detailCache";

interface Props {
  movie: Movie;
  isFavorite: (id: string) => boolean;
  onToggleFavorite: (movie: Movie, favorite: boolean) => void;
  lists: ListInfo[];
  listIdsFor: (id: string) => Set<number>;
  onAddToList: (listId: number, movie: Movie) => Promise<void>;
  onRemoveFromList: (listId: number, id: string) => Promise<void>;
  onCreateList: (name: string) => Promise<ListInfo | null>;
  onClose: () => void;
}

const bigButton =
  "flex items-center gap-[0.8vw] h-[4.4vw] px-[2.4vw] rounded-[1vw] text-[1.5vw] font-bold outline-none transition-all duration-150 focus:scale-105 focus:ring-[0.25vw] focus:ring-[#f0e8dc]";
const primary = `${bigButton} bg-[#d4845a] text-white focus:bg-[#e2946a]`;
const secondary = `${bigButton} bg-white/[0.08] text-[#f0e8dc] focus:bg-white/[0.2]`;
const chip =
  "shrink-0 h-[3.2vw] min-w-[3.8vw] px-[1vw] rounded-[0.7vw] text-[1.3vw] font-semibold outline-none transition-all duration-150 focus:scale-110 focus:ring-[0.22vw] focus:ring-[#d4845a]";
const scrollRow = "flex gap-[0.8vw] overflow-x-auto py-[0.7vw] px-[0.5vw] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

export default function TvDetail({
  movie, isFavorite, onToggleFavorite, lists, listIdsFor, onAddToList, onRemoveFromList, onCreateList, onClose,
}: Props) {
  const [detail, setDetail] = useState<MovieDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [season, setSeason] = useState(1);
  const [episode, setEpisode] = useState(1);
  const [playing, setPlaying] = useState<StreamServer | null>(null);
  const [picker, setPicker] = useState(false);
  // "Play as soon as the sources for the current title/episode are in."
  const [pendingPlay, setPendingPlay] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const playRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let cancelled = false;
    getDetail(movie.id).then((d) => {
      if (cancelled) return;
      setDetail(d);
      if (d?.seasons?.length) setSeason(d.seasons[0].number);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [movie.id]);

  const id = detail?.id ?? (/^tt\d+$/.test(movie.id) ? movie.id : null);
  const isSeries = (detail?.titleType ?? movie.type) === "TV series";
  const seasons = detail?.seasons ?? [];
  const episodeCount = seasons.find((s) => s.number === season)?.episodeCount ?? 0;
  const title = detail?.title ?? movie.title;
  const year = detail?.year ?? movie.year;
  const saved: Movie = { id: id ?? movie.id, title, year, poster: movie.poster };
  const favorite = isFavorite(saved.id);

  const query = !loading && id ? sourceQuery(id, movie.title, movie.year, isSeries ? { season, episode } : null) : null;
  const { items: streams, loading: streamsLoading } = useSourceList<StreamResult>("/api/streams", query, loading);
  const { items: subtitles } = useSourceList<SubtitleResult>("/api/subtitles", query, loading);
  const sub = streams.find((s) => s.kind === "sub")?.servers[0];
  const dub = streams.find((s) => s.kind === "dub")?.servers[0];
  const hasPtSubtitle = subtitles.some((r) => r.files.some((f) => f.lang === "pt-BR"));

  useEffect(() => {
    if (!pendingPlay || streamsLoading) return;
    setPendingPlay(false);
    const server = sub ?? dub;
    if (server) setPlaying(server);
    else setMessage("Nenhuma fonte disponível pra este título.");
  }, [pendingPlay, streamsLoading, sub, dub]);

  // Opening the player: let go of "Assistir" (it's behind the player now — OK would hit it again);
  // the first arrow lands on the player's bar. Back from the player: OK is right on "Assistir" again.
  const wasPlaying = useRef(false);
  useEffect(() => {
    if (playing && document.activeElement instanceof HTMLElement) document.activeElement.blur();
    if (wasPlaying.current && !playing && playRef.current) focusElement(playRef.current);
    wasPlaying.current = Boolean(playing);
  }, [playing]);

  const play = (server?: StreamServer) => {
    setMessage(null);
    if (server) setPlaying(server);
    else setPendingPlay(true);
  };

  const playEpisode = (n: number, s = season) => {
    setSeason(s);
    setEpisode(n);
    setMessage(null);
    setPendingPlay(true);
  };

  // What plays after this episode (next-episode card in the player), with its name and still.
  const upNext = isSeries ? nextEpisode(seasons, season, episode) : null;
  const [upNextInfo, setUpNextInfo] = useState<EpisodeInfo | null>(null);
  useEffect(() => {
    setUpNextInfo(null);
    if (!upNext || !id || !playing) return;
    let cancelled = false;
    seasonEpisodes(id, upNext.season).then((eps) => {
      if (!cancelled) setUpNextInfo(eps.find((e) => e.number === upNext.episode) ?? null);
    });
    return () => { cancelled = true; };
    // upNext is rebuilt every render; its season/episode are what matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, upNext?.season, upNext?.episode, Boolean(playing)]);

  const meta = [
    year,
    formatDuration(detail?.duration),
    detail?.ratingValue ? `★ ${detail.ratingValue.toFixed(1)}` : null,
    detail?.genres?.slice(0, 3).join(" · "),
  ].filter(Boolean);

  const playLabel = pendingPlay
    ? "Procurando…"
    : isSeries ? `Assistir T${season} E${episode}` : "Assistir";

  return (
    <TvLayer
      className="z-50 bg-[#0a0906] text-[#f0e8dc]"
      onBack={() => {
        if (playing) return false;
        onClose();
        return true;
      }}
    >
      {movie.poster && (
        <Image src={movie.poster} alt="" fill sizes="100vw" className="object-cover opacity-25 blur-[3vw] scale-110" />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-[#0a0906] via-[#0a0906]/90 to-[#0a0906]/50" />

      <div className="relative h-full flex items-center gap-[4vw] px-[5vw] py-[5vh]">
        <div className="relative shrink-0 w-[22vw] aspect-[2/3] rounded-[1.2vw] overflow-hidden bg-white/[0.05] shadow-[0_2vw_5vw_rgba(0,0,0,0.8)]">
          {movie.poster && <Image src={movie.poster} alt="" fill sizes="25vw" className="object-cover" />}
        </div>

        <div className="flex-1 min-w-0 flex flex-col gap-[1.3vw]">
          <h1 className="text-[3.6vw] font-black leading-[1.05] line-clamp-2">{title}</h1>
          {meta.length > 0 && <p className="text-[1.4vw] text-[#9a8878]">{meta.join("   ·   ")}</p>}
          {detail?.description ? (
            <p className="max-w-[52vw] text-[1.35vw] leading-relaxed text-[#cbbfb2] line-clamp-4">{detail.description}</p>
          ) : loading ? (
            <div className="h-[6vw] max-w-[40vw] rounded-[0.6vw] bg-white/[0.05] animate-pulse" />
          ) : null}

          <div className="flex flex-wrap items-center gap-[1vw] mt-[0.6vw]">
            <button ref={playRef} data-tv-autofocus className={primary} onClick={() => play(sub ?? dub)}>
              <Icon name="play" />
              {playLabel}
            </button>
            {sub && dub && (
              <button className={secondary} onClick={() => play(dub)}>
                Dublado
              </button>
            )}
            <button className={secondary} onClick={() => onToggleFavorite(saved, !favorite)}>
              <Icon name={favorite ? "heart" : "heartOutline"} className={`w-[1.6vw] h-[1.6vw] ${favorite ? "text-[#d4845a]" : ""}`} />
              {favorite ? "Favorito" : "Favoritar"}
            </button>
            <button className={secondary} onClick={() => setPicker(true)}>
              <Icon name="list" />
              Listas
            </button>
          </div>

          <p className="text-[1.15vw] text-[#9a8878] min-h-[1.6vw]">
            {message ? (
              <span className="text-[#d4845a]">{message}</span>
            ) : streamsLoading ? (
              "Procurando fontes…"
            ) : sub || dub ? (
              hasPtSubtitle ? "Legenda em português pronta" : "Sem legenda em português pra este título"
            ) : query ? (
              "Nenhuma fonte encontrada"
            ) : null}
          </p>

          {isSeries && seasons.length > 0 && (
            <div className="flex flex-col gap-[0.4vw]">
              <div data-tv-row className={scrollRow}>
                {seasons.map((s) => (
                  <button
                    key={s.number}
                    onClick={() => { setSeason(s.number); setEpisode(1); }}
                    className={`${chip} ${s.number === season ? "bg-[#f0e8dc] text-[#0a0906]" : "bg-white/[0.08] text-[#f0e8dc]"}`}
                  >
                    Temporada {s.number}
                  </button>
                ))}
              </div>
              <div data-tv-row className={scrollRow}>
                {Array.from({ length: episodeCount }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    onClick={() => playEpisode(n)}
                    className={`${chip} ${n === episode ? "bg-[#d4845a] text-white" : "bg-white/[0.08] text-[#f0e8dc]"}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <p className="text-[1.05vw] text-[#5a4e46]">OK num episódio já começa a tocar</p>
            </div>
          )}
        </div>
      </div>

      {picker && (
        <TvLayer
          className="z-[55] flex items-center justify-center bg-black/80"
          onBack={() => { setPicker(false); return true; }}
        >
          <div className="w-[38vw] max-h-[80vh] overflow-y-auto rounded-[1.5vw] bg-[#1a1612] p-[2.5vw] flex flex-col gap-[1vw] [scrollbar-width:none]">
            <h3 className="text-[2vw] font-black">Salvar em…</h3>
            {lists.length === 0 ? (
              <button
                data-tv-autofocus
                className={primary}
                onClick={async () => {
                  const created = await onCreateList("Minha Lista");
                  if (created) await onAddToList(created.id, saved);
                  setPicker(false);
                }}
              >
                <Icon name="plus" />
                Criar “Minha Lista” e salvar
              </button>
            ) : (
              lists.map((l, i) => {
                const inList = listIdsFor(saved.id).has(l.id);
                return (
                  <button
                    key={l.id}
                    data-tv-autofocus={i === 0 || undefined}
                    className={`${secondary} justify-between w-full`}
                    onClick={() => (inList ? onRemoveFromList(l.id, saved.id) : onAddToList(l.id, saved))}
                  >
                    <span className="truncate">{l.name}</span>
                    <Icon name={inList ? "check" : "plus"} className={`w-[1.8vw] h-[1.8vw] ${inList ? "text-[#d4845a]" : "text-[#9a8878]"}`} />
                  </button>
                );
              })
            )}
            <p className="text-[1.1vw] text-[#9a8878]">OK marca ou desmarca · Voltar fecha</p>
          </div>
        </TvLayer>
      )}

      {playing && (
        <PlayerModal
          // A new episode is a new player: fresh subtitle choice, sync and playback clock.
          key={playing.embedUrl}
          title={isSeries ? `${title} · T${season} E${episode}` : title}
          label={playing.label}
          embedUrl={playing.embedUrl}
          subtitles={subtitles}
          onClose={() => setPlaying(null)}
          next={
            upNext
              ? {
                  label: `T${upNext.season} E${upNext.episode}`,
                  name: upNextInfo?.name,
                  still: upNextInfo?.still,
                  onPlay: () => playEpisode(upNext.episode, upNext.season),
                }
              : undefined
          }
        />
      )}
    </TvLayer>
  );
}
