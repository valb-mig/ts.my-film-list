"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Image from "next/image";
import { Movie } from "@/types/imdb";
import { MovieDetail } from "@/lib/datasource";
import type { StreamResult } from "@/lib/scrapers/types";
import type { ListInfo } from "@/hooks/useLists";

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
  isWatched?: boolean;
  onWatchedToggle?: (imdbId: string, watched: boolean) => void;
}

function SourceAccordion({ stream, onWatch }: { stream: StreamResult; onWatch: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] text-[#9a8878] hover:text-[#f0e8dc] text-xs font-medium px-3 py-1.5 rounded-xl transition-colors"
      >
        {stream.source}
        <svg
          width="10" height="10" fill="currentColor" viewBox="0 0 24 24"
          className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          <path d="M7 10l5 5 5-5z" />
        </svg>
      </button>
      {open && stream.servers.map((s) => (
        <a
          key={s.id}
          href={s.embedUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onWatch}
          className="bg-white/[0.04] hover:bg-white/[0.10] border border-white/[0.06] text-[#9a8878] hover:text-[#f0e8dc] text-xs px-3 py-1.5 rounded-xl transition-colors"
        >
          {s.label}
        </a>
      ))}
      {open && (
        <a
          href={stream.movieUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#5a4e46] hover:text-[#9a8878] text-xs transition-colors"
        >
          {stream.source} ↗
        </a>
      )}
    </div>
  );
}

export default function MovieModal({
  movie, onClose, lists, listIdsFor, onAddToList, onRemoveFromList, onCreateList,
  isFavorited = false, onFavoriteToggle, isWatched = false, onWatchedToggle,
}: Props) {
  const [detail, setDetail] = useState<MovieDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [streams, setStreams] = useState<StreamResult[]>([]);
  const [streamsLoading, setStreamsLoading] = useState(true);
  const subStreams = streams.filter((s) => s.kind === "sub");
  const dubStreams = streams.filter((s) => s.kind === "dub");
  const [favorited, setFavorited] = useState(isFavorited);
  const [favoriting, setFavoriting] = useState(false);
  const [watched, setWatched] = useState(isWatched);
  const [markingWatched, setMarkingWatched] = useState(false);
  const [listsOpen, setListsOpen] = useState(false);
  const [creatingList, setCreatingList] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [busyListId, setBusyListId] = useState<number | null>(null);
  const listsPopoverRef = useRef<HTMLDivElement>(null);
  // Home-row cards carry a synthetic tmdb-* id (no imdb_id resolved yet, to avoid an extra TMDB
  // call per card). Real ids resolve immediately; synthetic ones wait for the detail fetch below.
  const [resolvedId, setResolvedId] = useState<string | null>(() => /^tt\d+$/.test(movie.id) ? movie.id : null);

  useEffect(() => { setFavorited(isFavorited); setWatched(isWatched); }, [isFavorited, isWatched, movie.id]);
  useEffect(() => { setResolvedId(/^tt\d+$/.test(movie.id) ? movie.id : null); }, [movie.id]);

  useEffect(() => {
    if (!listsOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (listsPopoverRef.current && !listsPopoverRef.current.contains(e.target as Node)) {
        setListsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [listsOpen]);

  useEffect(() => {
    setLoading(true);
    setDetail(null);
    fetch(`/api/movie/${movie.id}`)
      .then((r) => r.json())
      .then((data: MovieDetail & { error?: string }) => {
        if (!data.error) {
          setDetail(data);
          setResolvedId(data.id);
          if (data.genres?.length || data.duration) {
            fetch(`/api/history/movie/${data.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ genres: data.genres, duration: data.duration }),
            }).catch(() => {});
          }
        } else {
          // Couldn't resolve a real id (e.g. detail lookup failed) — stop the streams skeleton.
          setStreamsLoading(false);
        }
      })
      .catch(() => setStreamsLoading(false))
      .finally(() => setLoading(false));
  }, [movie.id]);

  useEffect(() => {
    if (!resolvedId) return;
    setStreamsLoading(true);
    setStreams([]);
    const params = new URLSearchParams({ id: resolvedId, title: movie.title });
    if (movie.year) params.set("year", String(movie.year));
    fetch(`/api/streams?${params}`)
      .then((r) => r.json())
      .then((data: StreamResult[]) => { if (Array.isArray(data)) setStreams(data); })
      .catch(() => {})
      .finally(() => setStreamsLoading(false));
  }, [resolvedId, movie.title, movie.year]);

  const handleKey = useCallback((e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }, [onClose]);
  useEffect(() => {
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", handleKey); document.body.style.overflow = ""; };
  }, [handleKey]);

  const handleFavoriteToggle = useCallback(async () => {
    if (!resolvedId) return;
    setFavoriting(true);
    try {
      if (favorited) {
        await fetch(`/api/favorites/${resolvedId}`, { method: "DELETE" });
        setFavorited(false);
        onFavoriteToggle?.(resolvedId, false);
      } else {
        await fetch("/api/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imdb_id: resolvedId, title: detail?.title ?? movie.title, year: detail?.year ?? movie.year, poster_url: movie.poster, rating: detail?.ratingValue }),
        });
        setFavorited(true);
        onFavoriteToggle?.(resolvedId, true);
      }
    } catch { /* noop */ } finally { setFavoriting(false); }
  }, [favorited, movie, detail, resolvedId, onFavoriteToggle]);

  const title = detail?.title ?? movie.title;
  const year = detail?.year ?? movie.year;
  const duration = detail?.duration ? `${detail.duration}min` : null;
  const poster = movie.poster;
  const movieListIds = resolvedId ? listIdsFor(resolvedId) : new Set<number>();

  const handleToggleList = useCallback(async (listId: number) => {
    if (!resolvedId) return;
    setBusyListId(listId);
    try {
      if (movieListIds.has(listId)) {
        await onRemoveFromList(listId, resolvedId);
      } else {
        await onAddToList(listId, { id: resolvedId, title, year, poster }, detail?.ratingValue);
      }
    } finally {
      setBusyListId(null);
    }
  }, [resolvedId, movieListIds, onRemoveFromList, onAddToList, title, year, poster, detail]);

  const handleCreateList = useCallback(async () => {
    const name = newListName.trim();
    if (!name || !resolvedId) return;
    const created = await onCreateList(name);
    setNewListName("");
    setCreatingList(false);
    if (created) await onAddToList(created.id, { id: resolvedId, title, year, poster }, detail?.ratingValue);
  }, [newListName, onCreateList, onAddToList, resolvedId, title, year, poster, detail]);

  const handleWatch = useCallback(() => {
    if (!resolvedId) return;
    fetch("/api/watched", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imdb_id: resolvedId, title, year, poster_url: poster }),
    }).catch(() => {});
    setWatched(true);
    onWatchedToggle?.(resolvedId, true);
  }, [resolvedId, title, year, poster, onWatchedToggle]);

  const handleWatchedToggle = useCallback(async () => {
    if (!resolvedId) return;
    setMarkingWatched(true);
    try {
      if (watched) {
        await fetch(`/api/watched/${resolvedId}`, { method: "DELETE" });
        setWatched(false);
        onWatchedToggle?.(resolvedId, false);
      } else {
        await fetch("/api/watched", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imdb_id: resolvedId, title, year, poster_url: poster }),
        });
        setWatched(true);
        onWatchedToggle?.(resolvedId, true);
      }
    } catch { /* noop */ } finally { setMarkingWatched(false); }
  }, [watched, resolvedId, title, year, poster, onWatchedToggle]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-lg"
      onClick={onClose}
    >
      <div
        className="relative w-full sm:max-w-3xl max-h-[92vh] rounded-t-3xl sm:rounded-3xl overflow-hidden"
        style={{
          background: "linear-gradient(135deg, rgba(26,22,18,0.98) 0%, rgba(14,12,10,0.98) 100%)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 40px 100px rgba(0,0,0,0.9)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Blurred poster background */}
        <div className="absolute inset-0 z-0">
          {poster ? (
            <Image
              src={poster}
              alt=""
              fill
              className="object-cover"
              style={{ filter: "blur(40px) brightness(0.12)", transform: "scale(1.15)" }}
              aria-hidden
              priority
            />
          ) : (
            <div className="w-full h-full bg-[#0a0906]" />
          )}
          <div className="absolute inset-0 bg-[#0a0906]/50" />
        </div>

        {/* Content */}
        <div className="relative z-10 overflow-y-auto max-h-[92vh]">
          {/* Action bar */}
          <div className="flex items-center justify-end gap-2 p-4">
            <button
              onClick={handleWatchedToggle}
              disabled={markingWatched || !resolvedId}
              className={`p-2 rounded-full transition-all disabled:opacity-50 ${
                watched
                  ? "bg-[#d4845a]/20 text-[#d4845a] hover:bg-[#d4845a]/30"
                  : "bg-white/[0.06] text-[#9a8878] hover:bg-white/[0.12] hover:text-[#f0e8dc]"
              }`}
              aria-label={watched ? "Desmarcar como assistido" : "Marcar como assistido"}
              title={watched ? "Assistido" : "Marcar como assistido"}
            >
              <svg width="15" height="15" fill="currentColor" viewBox="0 0 24 24">
                {watched ? (
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                ) : (
                  <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zm0 12.5c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8a3 3 0 100 6 3 3 0 000-6z" />
                )}
              </svg>
            </button>

            <button
              onClick={handleFavoriteToggle}
              disabled={favoriting || !resolvedId}
              className={`p-2 rounded-full transition-all disabled:opacity-50 ${
                favorited
                  ? "bg-[#d4845a]/20 text-[#d4845a] hover:bg-[#d4845a]/30"
                  : "bg-white/[0.06] text-[#9a8878] hover:bg-white/[0.12] hover:text-[#f0e8dc]"
              }`}
              aria-label={favorited ? "Remover dos favoritos" : "Adicionar aos favoritos"}
            >
              <svg width="15" height="15" fill="currentColor" viewBox="0 0 24 24">
                {favorited ? (
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                ) : (
                  <path d="M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3zm-4.4 15.55l-.1.1-.1-.1C7.14 14.24 4 11.39 4 8.5 4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.87C13.46 5.99 14.96 5 16.5 5c2 0 3.5 1.5 3.5 3.5 0 2.89-3.14 5.74-7.9 10.05z" />
                )}
              </svg>
            </button>

            <div className="relative" ref={listsPopoverRef}>
              <button
                onClick={() => setListsOpen((o) => !o)}
                disabled={!resolvedId}
                className={`p-2 rounded-full transition-all disabled:opacity-50 ${
                  movieListIds.size > 0
                    ? "bg-[#d4845a]/20 text-[#d4845a] hover:bg-[#d4845a]/30"
                    : "bg-white/[0.06] text-[#9a8878] hover:bg-white/[0.12] hover:text-[#f0e8dc]"
                }`}
                aria-label="Adicionar às listas"
                title="Adicionar às listas"
              >
                <svg width="15" height="15" fill="currentColor" viewBox="0 0 24 24">
                  {movieListIds.size > 0 ? (
                    <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z" />
                  ) : (
                    <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2zm0 15l-5-2.18L7 18V5h10v13z" />
                  )}
                </svg>
              </button>

              {listsOpen && (
                <div
                  className="absolute top-full right-0 mt-2 z-20 rounded-2xl w-56 p-2"
                  style={{
                    background: "rgba(20,18,14,0.98)",
                    border: "1px solid rgba(255,255,255,0.09)",
                    boxShadow: "0 20px 60px rgba(0,0,0,0.7)",
                    backdropFilter: "blur(16px)",
                  }}
                >
                  {lists.length === 0 && (
                    <p className="text-[#5a4e46] text-xs px-2 py-2">Nenhuma lista ainda</p>
                  )}
                  {lists.length > 0 && (
                    <div className="flex flex-col gap-0.5 max-h-48 overflow-y-auto">
                      {lists.map((l) => {
                        const checked = movieListIds.has(l.id);
                        return (
                          <button
                            key={l.id}
                            onClick={() => handleToggleList(l.id)}
                            disabled={busyListId === l.id}
                            className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-left hover:bg-white/[0.06] transition-colors disabled:opacity-50"
                          >
                            <span className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 ${
                              checked ? "bg-[#d4845a] border-[#d4845a]" : "border-white/20"
                            }`}>
                              {checked && (
                                <svg width="10" height="10" fill="white" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" /></svg>
                              )}
                            </span>
                            <span className="text-[#f0e8dc] truncate flex-1">{l.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className="border-t border-white/[0.06] mt-1.5 pt-1.5">
                    {creatingList ? (
                      <input
                        autoFocus
                        type="text"
                        value={newListName}
                        onChange={(e) => setNewListName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleCreateList(); if (e.key === "Escape") setCreatingList(false); }}
                        onBlur={handleCreateList}
                        placeholder="Nome da lista"
                        className="w-full bg-white/[0.06] text-[#f0e8dc] placeholder-[#5a4e46] text-xs px-2.5 py-1.5 rounded-lg outline-none border border-[#d4845a]/40"
                      />
                    ) : (
                      <button
                        onClick={() => setCreatingList(true)}
                        className="w-full text-left px-2 py-1.5 rounded-lg text-xs text-[#9a8878] hover:text-[#f0e8dc] hover:bg-white/[0.06] transition-colors"
                      >
                        + Nova lista
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {resolvedId && (
              <a
                href={`https://www.imdb.com/title/${resolvedId}/`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-[#F5C518] hover:bg-[#e0b315] text-black text-xs font-black px-3 py-1.5 rounded-full transition-colors"
              >
                IMDb
              </a>
            )}

            <button
              onClick={onClose}
              className="p-2 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-[#9a8878] hover:text-[#f0e8dc] transition-colors"
              aria-label="Fechar"
            >
              <svg width="15" height="15" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
              </svg>
            </button>
          </div>

          {/* Main content */}
          <div className="flex flex-col sm:flex-row gap-5 px-5 pb-5">
            {/* Poster */}
            <div className="sm:shrink-0">
              {poster ? (
                <div className="relative mx-auto w-32 sm:w-40 aspect-[2/3] rounded-2xl overflow-hidden"
                  style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.7)", border: "1px solid rgba(255,255,255,0.1)" }}>
                  <Image src={poster} alt={title} fill className="object-cover" sizes="160px" priority />
                </div>
              ) : (
                <div className="mx-auto w-32 sm:w-40 aspect-[2/3] rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
                  <span className="text-3xl opacity-20">🎬</span>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 flex flex-col gap-3 min-w-0">
              <div>
                <h2 className="text-[#f0e8dc] font-black text-2xl sm:text-3xl leading-tight">{title}</h2>
                {detail?.originalTitle && detail.originalTitle !== title && (
                  <p className="text-[#5a4e46] text-xs mt-0.5">{detail.originalTitle}</p>
                )}
                <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-[#9a8878]">
                  {year && <span>{year}</span>}
                  {duration && <><span className="text-[#5a4e46]">·</span><span>{duration}</span></>}
                  {detail?.titleType && detail.titleType !== "Filme" && (
                    <span className="border border-white/[0.08] px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider text-[#5a4e46]">
                      {detail.titleType}
                    </span>
                  )}
                </div>
              </div>

              {detail?.ratingValue ? (
                <div className="flex items-center gap-2">
                  <svg width="15" height="15" fill="#F5C518" viewBox="0 0 24 24">
                    <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                  </svg>
                  <span className="text-[#F5C518] font-bold text-xl">{detail.ratingValue.toFixed(1)}</span>
                  <span className="text-[#5a4e46] text-sm">/10</span>
                  {detail.voteCount && (
                    <span className="text-[#5a4e46] text-xs">({detail.voteCount.toLocaleString("pt-BR")} votos)</span>
                  )}
                </div>
              ) : loading ? (
                <div className="h-6 w-28 bg-white/[0.06] rounded animate-pulse" />
              ) : null}

              {detail?.genres && detail.genres.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {detail.genres.map((g) => (
                    <span key={g} className="bg-white/[0.05] text-[#9a8878] text-xs px-2.5 py-1 rounded-full border border-white/[0.07]">
                      {g}
                    </span>
                  ))}
                </div>
              )}

              {detail?.description ? (
                <p className="text-[#9a8878] text-sm leading-relaxed line-clamp-4">{detail.description}</p>
              ) : loading ? (
                <div className="flex flex-col gap-2">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className={`h-3 bg-white/[0.06] rounded animate-pulse w-${["full","5/6","4/6"][i]}`} />
                  ))}
                </div>
              ) : null}

              <div className="flex flex-col gap-1.5 text-sm">
                {detail?.directors && detail.directors.length > 0 && (
                  <div className="flex gap-2">
                    <span className="text-[#5a4e46] shrink-0">Direção:</span>
                    <span className="text-[#9a8878]">{detail.directors.join(", ")}</span>
                  </div>
                )}
                {detail?.actors && detail.actors.length > 0 && (
                  <div className="flex gap-2">
                    <span className="text-[#5a4e46] shrink-0">Elenco:</span>
                    <span className="text-[#9a8878] line-clamp-2">{detail.actors.join(", ")}</span>
                  </div>
                )}
              </div>

              {loading && (
                <div className="flex flex-col gap-1.5">
                  <div className="h-3 bg-white/[0.06] rounded animate-pulse w-2/3" />
                  <div className="h-3 bg-white/[0.06] rounded animate-pulse w-3/4" />
                </div>
              )}
            </div>
          </div>

          {/* Watch section */}
          <div className="mx-5 mb-5 rounded-2xl p-4"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex gap-6 flex-wrap">
              <div className="flex flex-col gap-2 min-w-[140px]">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#5a4e46]">Legendado</p>
                {streamsLoading ? (
                  <div className="h-8 w-24 bg-white/[0.06] rounded-xl animate-pulse" />
                ) : subStreams.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {subStreams.map((s) => <SourceAccordion key={s.source} stream={s} onWatch={handleWatch} />)}
                  </div>
                ) : (
                  <p className="text-[#5a4e46] text-xs">Não disponível</p>
                )}
              </div>

              <div className="w-px bg-white/[0.06] self-stretch hidden sm:block" />

              <div className="flex flex-col gap-2 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#5a4e46]">Dublado</p>
                {streamsLoading ? (
                  <div className="h-8 w-24 bg-white/[0.06] rounded-xl animate-pulse" />
                ) : dubStreams.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {dubStreams.map((s) => <SourceAccordion key={s.source} stream={s} onWatch={handleWatch} />)}
                  </div>
                ) : (
                  <p className="text-[#5a4e46] text-xs">Não disponível</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
