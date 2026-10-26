"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { Movie } from "@/types/imdb";
import type { EpisodeInfo, MovieDetail } from "@/lib/datasource";
import { nextEpisode, seasonEpisodes } from "@/lib/episodes";
import type { StreamResult, SubtitleResult } from "@/lib/scrapers/types";
import type { ListInfo } from "@/hooks/useLists";
import { sourceQuery, useSourceList } from "@/hooks/useSourceList";
import PlayerModal from "./PlayerModal";
import PlayerSidebar from "./PlayerSidebar";
import SeriesPanel from "./SeriesPanel";
import { Icon } from "./titleIcons";

interface Props {
  movie: Movie;
  onClose: () => void;
  lists: ListInfo[];
  listIdsFor: (imdbId: string) => Set<number>;
  onAddToList: (listId: number, movie: Movie, rating?: number) => Promise<void>;
  onRemoveFromList: (listId: number, imdbId: string) => Promise<void>;
  onCreateList: (name: string) => Promise<ListInfo | null>;
  isFavorited?: boolean;
  onFavoriteToggle?: (imdbId: string, favorited: boolean) => void;
  // Switches to another title (the player's recommendations).
  onSelectMovie?: (movie: Movie) => void;
}

// After watching most of a movie: a nudge to rate it while it's fresh.
function PostWatchCard({ poster, title, rateUrl, onClose }: { poster?: string; title: string; rateUrl: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-lg"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="flex flex-col items-center gap-5 rounded-3xl bg-[#0f0d0b] border border-white/[0.08] px-10 py-8 shadow-[0_40px_100px_rgba(0,0,0,0.9)] text-center">
        {poster && (
          <div className="relative w-28 aspect-[2/3] rounded-xl overflow-hidden shadow-lg">
            <Image src={poster} alt="" fill sizes="112px" className="object-cover" />
          </div>
        )}
        <div className="flex flex-col gap-1">
          <p className="text-xl font-black text-[#f0e8dc]">Como foi {title}?</p>
          <p className="text-sm text-[#9a8878]">Dá sua nota enquanto tá fresco.</p>
        </div>
        <div className="flex gap-2">
          <a
            href={rateUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
            autoFocus
            className="flex items-center gap-2 h-11 px-5 rounded-xl text-sm font-bold bg-[#d4845a] hover:bg-[#e2946a] text-white transition-colors"
          >
            <Icon name="star" size={16} />
            Dar nota no Letterboxd ↗
          </a>
          <button
            onClick={onClose}
            className="h-11 px-5 rounded-xl text-sm font-semibold bg-white/[0.08] hover:bg-white/[0.14] text-[#f0e8dc] transition-colors"
          >
            Agora não
          </button>
        </div>
      </div>
    </div>
  );
}

function LoadingScreen({ movie, failed, onClose }: { movie: Movie; failed: boolean; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-lg"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {movie.poster && (
        <Image src={movie.poster} alt="" fill sizes="100vw" className="object-cover opacity-20 blur-3xl scale-110 pointer-events-none" />
      )}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2.5 rounded-full bg-white/[0.08] hover:bg-white/[0.16] text-[#f0e8dc] transition-colors"
        aria-label="Fechar"
      >
        <Icon name="close" size={16} />
      </button>
      <div className="relative flex flex-col items-center gap-4 text-center px-6">
        {!failed && <span className="w-10 h-10 rounded-full border-[3px] border-white/10 border-t-[#d4845a] animate-spin" />}
        {movie.title && <p className="text-xl font-black text-[#f0e8dc]">{movie.title}</p>}
        {failed && <p className="text-sm text-[#9a8878]">Não consegui carregar este título.</p>}
      </div>
    </div>
  );
}

// Opening a title. Movies go straight to the player (details, saving and recommendations live in
// its sidebar); series open their panel with the episodes, and the player from there. Until the
// detail arrives — it's what tells a series from a movie, since cards from lists don't say — a
// quiet loading screen.
export default function MovieModal({
  movie, onClose, lists, listIdsFor, onAddToList, onRemoveFromList, onCreateList,
  isFavorited = false, onFavoriteToggle, onSelectMovie,
}: Props) {
  const [detail, setDetail] = useState<MovieDetail | null>(null);
  // Which title the detail state belongs to — right after `movie` changes, it still describes the
  // previous one for a render.
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [resolvedId, setResolvedId] = useState<string | null>(null);
  const [favorited, setFavorited] = useState(isFavorited);
  const [season, setSeason] = useState(1);
  const [episode, setEpisode] = useState(1);
  // Series: the player is open on top of the panel.
  const [watching, setWatching] = useState(false);
  const [lastWatched, setLastWatched] = useState<{ season: number; episode: number } | null>(null);
  // Closed the player after watching most of a movie: show the "rate it" card instead of closing.
  const [postWatch, setPostWatch] = useState(false);

  useEffect(() => { setFavorited(isFavorited); }, [isFavorited, movie.id]);

  useEffect(() => {
    const id = movie.id;
    setDetail(null);
    setSeason(1);
    setEpisode(1);
    setWatching(false);
    setLastWatched(null);
    setPostWatch(false);
    // Home-row cards carry a synthetic tmdb-* id; the detail resolves the real IMDb id.
    setResolvedId(/^tt\d+$/.test(id) ? id : null);
    let cancelled = false;
    fetch(`/api/movie/${id}`)
      .then((r) => r.json())
      .then((data: MovieDetail & { error?: string }) => {
        if (cancelled || data.error) return;
        setDetail(data);
        setResolvedId(data.id);
        if (data.seasons?.length) setSeason(data.seasons[0].number);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadedFor(id); });
    return () => { cancelled = true; };
  }, [movie.id]);

  const ready = loadedFor === movie.id;
  const isSeries = (detail?.titleType ?? movie.type) === "TV series";
  const seasons = detail?.seasons ?? [];
  const playerOpen = ready && !postWatch && (!isSeries || watching);

  const query = playerOpen && resolvedId
    ? sourceQuery(resolvedId, detail?.title ?? movie.title, detail?.year ?? movie.year, isSeries ? { season, episode } : null)
    : null;
  const { items: streams, loading: streamsLoading } = useSourceList<StreamResult>("/api/streams", query, !ready);
  const { items: subtitles } = useSourceList<SubtitleResult>("/api/subtitles", query, !ready);
  // Subtitled first (the subtitle overlay is the point), dubbed if that's all there is.
  const server = (streams.find((s) => s.kind === "sub") ?? streams.find((s) => s.kind === "dub"))?.servers[0];

  // Series: what plays after this episode, with its name and still for the next-episode card.
  const upNext = isSeries ? nextEpisode(seasons, season, episode) : null;
  const [upNextInfo, setUpNextInfo] = useState<EpisodeInfo | null>(null);
  useEffect(() => {
    setUpNextInfo(null);
    if (!upNext || !resolvedId || !playerOpen) return;
    let cancelled = false;
    seasonEpisodes(resolvedId, upNext.season).then((eps) => {
      if (!cancelled) setUpNextInfo(eps.find((e) => e.number === upNext.episode) ?? null);
    });
    return () => { cancelled = true; };
    // upNext is rebuilt every render; its season/episode are what matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedId, upNext?.season, upNext?.episode, playerOpen]);

  // While the player is open, Escape belongs to it (closes the player; for series, back to the panel).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !playerOpen) onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose, playerOpen]);

  const title = detail?.title ?? movie.title;
  const year = detail?.year ?? movie.year;
  const poster = movie.poster ?? detail?.poster;
  const listIds = resolvedId ? listIdsFor(resolvedId) : new Set<number>();
  // Letterboxd is films only; its /imdb/<id>/ address lands on the film's page (rating stars up top).
  const letterboxdUrl = !isSeries && resolvedId ? `https://letterboxd.com/imdb/${resolvedId}/` : undefined;

  const toggleFavorite = useCallback(async () => {
    if (!resolvedId) return;
    const next = !favorited;
    try {
      if (next) {
        await fetch("/api/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imdb_id: resolvedId, title, year, poster_url: poster, rating: detail?.ratingValue }),
        });
      } else {
        await fetch(`/api/favorites/${resolvedId}`, { method: "DELETE" });
      }
      setFavorited(next);
      onFavoriteToggle?.(resolvedId, next);
    } catch { /* noop */ }
  }, [resolvedId, favorited, title, year, poster, detail, onFavoriteToggle]);

  const toggleList = useCallback(async (listId: number) => {
    if (!resolvedId) return;
    if (listIds.has(listId)) await onRemoveFromList(listId, resolvedId);
    else await onAddToList(listId, { id: resolvedId, title, year, poster }, detail?.ratingValue);
  }, [resolvedId, listIds, onRemoveFromList, onAddToList, title, year, poster, detail]);

  // "Salvar": the first list, created as "Minha Lista" if there's none.
  const defaultList = lists[0];
  const toggleSave = useCallback(async () => {
    if (!resolvedId) return;
    if (defaultList) {
      await toggleList(defaultList.id);
      return;
    }
    const created = await onCreateList("Minha Lista");
    if (created) await onAddToList(created.id, { id: resolvedId, title, year, poster }, detail?.ratingValue);
  }, [resolvedId, defaultList, toggleList, onCreateList, onAddToList, title, year, poster, detail]);

  const createListAndSave = useCallback(async (name: string) => {
    if (!resolvedId) return;
    const created = await onCreateList(name);
    if (created) await onAddToList(created.id, { id: resolvedId, title, year, poster }, detail?.ratingValue);
  }, [resolvedId, onCreateList, onAddToList, title, year, poster, detail]);

  const playEpisode = useCallback((s: number, e: number) => {
    setSeason(s);
    setEpisode(e);
    setLastWatched({ season: s, episode: e });
    setWatching(true);
  }, []);

  if (!ready || (isSeries && !resolvedId)) {
    return <LoadingScreen movie={movie} failed={ready} onClose={onClose} />;
  }
  if (postWatch && letterboxdUrl) {
    return <PostWatchCard poster={poster} title={title} rateUrl={letterboxdUrl} onClose={onClose} />;
  }

  const saved = defaultList ? listIds.has(defaultList.id) : false;

  return (
    <>
      {isSeries && resolvedId && (
        <SeriesPanel
          movie={movie}
          detail={detail}
          id={resolvedId}
          favorited={favorited}
          onToggleFavorite={toggleFavorite}
          saved={saved}
          onToggleSave={toggleSave}
          lists={lists}
          listIds={listIds}
          onToggleList={toggleList}
          onCreateList={createListAndSave}
          season={season}
          episode={episode}
          lastWatched={lastWatched}
          onPlay={playEpisode}
          onClose={onClose}
        />
      )}

      {playerOpen && (
        <PlayerModal
          // A new source (or episode) is a new player: fresh subtitle choice, sync and playback clock.
          key={server?.embedUrl ?? `searching-${season}-${episode}`}
          title={isSeries ? `${title} · T${season} E${episode}` : title}
          label={server?.label ?? ""}
          embedUrl={server?.embedUrl ?? null}
          searching={streamsLoading}
          status={streamsLoading ? "Procurando fonte…" : "Nenhuma fonte disponível pra este título."}
          subtitles={subtitles}
          rateUrl={letterboxdUrl}
          next={
            upNext
              ? {
                  label: `T${upNext.season} E${upNext.episode}`,
                  name: upNextInfo?.name,
                  still: upNextInfo?.still,
                  onPlay: () => playEpisode(upNext.season, upNext.episode),
                }
              : undefined
          }
          onClose={(progress) => {
            if (isSeries) setWatching(false);
            else if (letterboxdUrl && progress !== null && progress >= 0.7) setPostWatch(true);
            else onClose();
          }}
          aside={
            <PlayerSidebar
              id={resolvedId}
              detail={detail}
              favorited={favorited}
              onToggleFavorite={toggleFavorite}
              saved={saved}
              onToggleSave={toggleSave}
              lists={lists}
              listIds={listIds}
              onToggleList={toggleList}
              onCreateList={createListAndSave}
              onPick={(next) => onSelectMovie?.(next)}
              letterboxdUrl={letterboxdUrl}
              series={isSeries && seasons.length > 0 ? { seasons, season, episode, onPlay: playEpisode } : undefined}
            />
          }
        />
      )}
    </>
  );
}
