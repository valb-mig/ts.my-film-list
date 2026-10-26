"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import MovieCard from "@/components/MovieCard";
import MovieModal from "@/components/MovieModal";
import ListsDrawer from "@/components/ListsDrawer";
import FavoritesDrawer from "@/components/FavoritesDrawer";
import NonWatchableAccordion from "@/components/NonWatchableAccordion";
import DurationSelect from "@/components/DurationSelect";
import { Movie } from "@/types/imdb";
import { useCollections } from "@/hooks/useCollections";
import { useLists } from "@/hooks/useLists";
import { isWatchable } from "@/lib/watchable";
import { randomLoadingMessage } from "@/lib/searchLoadingMessages";
import { DurationBucket, durationBucketRange } from "@/lib/duration";

const GENRE_LABELS: Record<string, string> = {
  Action: "Ação", Adventure: "Aventura", Animation: "Animação",
  Comedy: "Comédia", Crime: "Policial", Documentary: "Documentário", Drama: "Drama",
  Family: "Família", Fantasy: "Fantasia",
  History: "História", Horror: "Terror", Music: "Musical", Mystery: "Mistério",
  Romance: "Romance", "Sci-Fi": "Ficção Científica",
  Thriller: "Suspense", War: "Guerra", Western: "Faroeste",
};

export default function GenrePage() {
  const params = useParams();
  const genre = decodeURIComponent(params.genre as string);
  const label = GENRE_LABELS[genre] ?? genre;

  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState(() => randomLoadingMessage());
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextStart, setNextStart] = useState(51);
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [favoritesDrawerOpen, setFavoritesDrawerOpen] = useState(false);
  const [durationBucket, setDurationBucket] = useState<DurationBucket>("any");

  const { favoriteIds, handleFavoriteToggle } = useCollections();
  const { lists, membership, listIdsFor, createList, renameList, deleteList, addToList, removeFromList } = useLists();
  const watchlistIds = useMemo(() => new Set(membership.keys()), [membership]);

  const durationParams = useCallback(() => {
    const { min, max } = durationBucketRange(durationBucket);
    const params = new URLSearchParams();
    if (min !== undefined) params.set("minDuration", String(min));
    if (max !== undefined) params.set("maxDuration", String(max));
    return params.toString();
  }, [durationBucket]);

  const fetchMovies = useCallback(async () => {
    setLoadingMessage(randomLoadingMessage());
    setLoading(true);
    try {
      const extra = durationParams();
      const res = await fetch(`/api/genre?genre=${encodeURIComponent(genre)}${extra ? `&${extra}` : ""}`);
      const data = await res.json();
      const results: Movie[] = data.movies ?? [];
      setMovies(results);
      setHasMore(data.hasMore ?? false);
      setNextStart(data.nextStart ?? 51);
    } catch {
      // noop
    } finally {
      setLoading(false);
    }
  }, [genre, durationParams]);

  useEffect(() => { fetchMovies(); }, [fetchMovies]);

  const handleLoadMore = async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const extra = durationParams();
      const res = await fetch(`/api/genre?genre=${encodeURIComponent(genre)}&start=${nextStart}${extra ? `&${extra}` : ""}`);
      const data = await res.json();
      const newMovies: Movie[] = data.movies ?? [];
      if (data.sessionReset) {
        setMovies(newMovies);
      } else {
        setMovies((prev) => [...prev, ...newMovies]);
      }
      setHasMore(data.hasMore ?? false);
      setNextStart(data.nextStart ?? nextStart + 50);
    } catch { /* noop */ } finally {
      setLoadingMore(false);
    }
  };

  const watchable = movies.filter((m) => isWatchable(m.type));
  const nonWatchable = movies.filter((m) => !isWatchable(m.type));

  return (
    <div className="min-h-screen bg-[#0a0906]">
      {/* Header */}
      <header className="sticky top-0 z-40 px-4 sm:px-6 py-3"
        style={{ background: "rgba(10,9,6,0.92)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div className="max-w-7xl mx-auto flex items-center gap-4">
          <Link href="/" className="shrink-0 hover:opacity-70 transition-opacity" aria-label="Voltar ao início">
            <Image src="/logo.png" alt="My Film List" width={48} height={48} className="object-contain" />
          </Link>

          <div className="flex-1 min-w-0">
            <p className="text-[#5a4e46] text-[10px] uppercase tracking-widest font-semibold">Gênero</p>
            <h1 className="text-[#f0e8dc] font-black text-lg leading-tight truncate">{label}</h1>
          </div>

          <div className="flex items-center gap-1">
            <button onClick={() => setFavoritesDrawerOpen(true)} className="relative p-2 rounded-xl text-[#9a8878] hover:text-[#f0e8dc] hover:bg-white/[0.06] transition-all">
              <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                <path d="M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3zm-4.4 15.55l-.1.1-.1-.1C7.14 14.24 4 11.39 4 8.5 4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.87C13.46 5.99 14.96 5 16.5 5c2 0 3.5 1.5 3.5 3.5 0 2.89-3.14 5.74-7.9 10.05z" />
              </svg>
              {favoriteIds.size > 0 && <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-[#d4845a] text-white text-[8px] font-bold rounded-full flex items-center justify-center">{favoriteIds.size}</span>}
            </button>
            <button onClick={() => setDrawerOpen(true)} className="relative p-2 rounded-xl text-[#9a8878] hover:text-[#f0e8dc] hover:bg-white/[0.06] transition-all">
              <svg width="17" height="17" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2zm0 15l-5-2.18L7 18V5h10v13z" />
              </svg>
              {watchlistIds.size > 0 && <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-[#d4845a] text-white text-[8px] font-bold rounded-full flex items-center justify-center">{watchlistIds.size}</span>}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <DurationSelect value={durationBucket} onChange={setDurationBucket} />
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center gap-3 text-[#9a8878]">
            <div className="w-4 h-4 border-2 border-[#d4845a]/40 border-t-[#d4845a] rounded-full animate-spin" />
            <span className="text-sm">{loadingMessage}</span>
          </div>
        )}

        {!loading && movies.length === 0 && (
          <div className="flex flex-col items-center justify-center h-[60vh] text-center">
            <p className="text-[#5a4e46] text-lg">Nenhum resultado encontrado</p>
            {durationBucket !== "any" && (
              <p className="text-[#5a4e46]/60 text-sm mt-2">Tente outra faixa de duração</p>
            )}
          </div>
        )}

        {!loading && movies.length > 0 && (
          <>
            <p className="text-[#5a4e46] text-sm mb-6 tabular-nums">
              {movies.length} resultado{movies.length !== 1 ? "s" : ""}
              {nonWatchable.length > 0 && (
                <span className="text-[#5a4e46]/60 ml-1">· {watchable.length} assistíveis</span>
              )}
            </p>

            {watchable.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {watchable.map((movie) => (
                  <MovieCard
                    key={movie.id}
                    movie={movie}
                    onClick={setSelectedMovie}
                    saved={watchlistIds.has(movie.id)}
                    favorited={favoriteIds.has(movie.id)}
                  />
                ))}
              </div>
            )}

            {nonWatchable.length > 0 && (
              <div className={watchable.length > 0 ? "mt-8" : ""}>
                <NonWatchableAccordion count={nonWatchable.length}>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 mt-3">
                    {nonWatchable.map((movie) => (
                      <MovieCard
                        key={movie.id}
                        movie={movie}
                        onClick={setSelectedMovie}
                        saved={watchlistIds.has(movie.id)}
                        favorited={favoriteIds.has(movie.id)}
                      />
                    ))}
                  </div>
                </NonWatchableAccordion>
              </div>
            )}

            {hasMore && (
              <div className="flex justify-center mt-10">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed text-[#9a8878] hover:text-[#f0e8dc] border border-white/[0.08] hover:border-white/[0.16] hover:bg-white/[0.04]"
                >
                  {loadingMore ? (
                    <><div className="w-4 h-4 border-2 border-white/20 border-t-[#9a8878] rounded-full animate-spin" />Carregando...</>
                  ) : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M15.88 9.29L12 13.17 8.12 9.29a.996.996 0 1 0-1.41 1.41l4.59 4.59c.39.39 1.02.39 1.41 0l4.59-4.59a.996.996 0 0 0 0-1.41c-.39-.38-1.03-.39-1.42 0z" />
                      </svg>
                      Mais 50
                    </>
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {selectedMovie && (
        <MovieModal
          movie={selectedMovie}
          onSelectMovie={setSelectedMovie}
          onClose={() => setSelectedMovie(null)}
          lists={lists}
          listIdsFor={listIdsFor}
          onAddToList={addToList}
          onRemoveFromList={removeFromList}
          onCreateList={createList}
          isFavorited={favoriteIds.has(selectedMovie.id)}
          onFavoriteToggle={handleFavoriteToggle}
        />
      )}

      <FavoritesDrawer open={favoritesDrawerOpen} onClose={() => setFavoritesDrawerOpen(false)} onSelectMovie={setSelectedMovie} onRemove={(id) => handleFavoriteToggle(id, false)} />
      <ListsDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSelectMovie={setSelectedMovie}
        lists={lists}
        createList={createList}
        renameList={renameList}
        deleteList={deleteList}
        removeFromList={removeFromList}
      />
    </div>
  );
}
