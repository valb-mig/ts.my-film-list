"use client";

import { useState, useCallback, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import SearchBar from "@/components/SearchBar";
import MovieModal from "@/components/MovieModal";
import WatchlistDrawer from "@/components/WatchlistDrawer";
import FavoritesDrawer from "@/components/FavoritesDrawer";
import DbDrawer from "@/components/DbDrawer";
import HeroSpotlight from "@/components/HeroSpotlight";
import HomeSections from "@/components/HomeSections";
import ExploredTabs from "@/components/ExploredTabs";
import RouletteSection from "@/components/RouletteSection";
import { Movie } from "@/types/imdb";
import { useCollections } from "@/hooks/useCollections";

export default function Home() {
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [favoritesDrawerOpen, setFavoritesDrawerOpen] = useState(false);
  const [dbDrawerOpen, setDbDrawerOpen] = useState(false);
  const [historyTrigger, setHistoryTrigger] = useState(0);

  const {
    watchlistIds,
    favoriteIds,
    handleSaveToggle: baseSaveToggle,
    handleFavoriteToggle,
  } = useCollections();

  const handleSaveToggle = useCallback((imdbId: string, saved: boolean) => {
    baseSaveToggle(imdbId, saved);
    setHistoryTrigger((t) => t + 1);
  }, [baseSaveToggle]);

  return (
    <div className="min-h-screen bg-[#0a0906]">
      {/* Header */}
      <header className="sticky top-0 z-40 px-4 sm:px-6 py-3"
        style={{ background: "linear-gradient(to bottom, rgba(10,9,6,0.95) 0%, rgba(10,9,6,0.0) 100%)", backdropFilter: "blur(12px)" }}>
        <div className="max-w-7xl mx-auto flex items-center gap-4 sm:gap-6">
          {/* Logo */}
          <Link href="/" className="shrink-0 hover:opacity-80 transition-opacity">
            <Image
              src="/logo.png"
              alt="My Film List"
              width={56}
              height={56}
              className="object-contain"
              priority
            />
          </Link>

          {/* Search */}
          <div className="flex-1 max-w-md">
            <SearchBar mode="full" />
          </div>

          {/* Collection buttons */}
          <div className="flex items-center gap-1 sm:gap-2 ml-auto">
            <button
              onClick={() => setDbDrawerOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[#9a8878] hover:text-[#f0e8dc] hover:bg-white/[0.06] transition-all text-xs font-medium"
              aria-label="Base de Dados"
            >
              <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20 6H4V4h16v2zm0 4H4V8h16v2zm-8 8H4v-2h8v2zm0-4H4v-2h8v2zm5 1v3h-2v-3h-3v-2h3v-3h2v3h3v2h-3z" />
              </svg>
              <span className="hidden sm:block">Banco</span>
            </button>

            <button
              onClick={() => setFavoritesDrawerOpen(true)}
              className="relative flex items-center gap-1.5 px-3 py-2 rounded-xl text-[#9a8878] hover:text-[#f0e8dc] hover:bg-white/[0.06] transition-all text-xs font-medium"
              aria-label="Favoritos"
            >
              <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                <path d="M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3zm-4.4 15.55l-.1.1-.1-.1C7.14 14.24 4 11.39 4 8.5 4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.87C13.46 5.99 14.96 5 16.5 5c2 0 3.5 1.5 3.5 3.5 0 2.89-3.14 5.74-7.9 10.05z" />
              </svg>
              <span className="hidden sm:block">Favoritos</span>
              {favoriteIds.size > 0 && (
                <span className="absolute -top-1 -right-1 sm:static sm:ml-0 bg-[#d4845a] text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
                  {favoriteIds.size > 99 ? "99+" : favoriteIds.size}
                </span>
              )}
            </button>

            <button
              onClick={() => setDrawerOpen(true)}
              className="relative flex items-center gap-1.5 px-3 py-2 rounded-xl text-[#9a8878] hover:text-[#f0e8dc] hover:bg-white/[0.06] transition-all text-xs font-medium"
              aria-label="Minha Lista"
            >
              <svg width="17" height="17" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2zm0 15l-5-2.18L7 18V5h10v13z" />
              </svg>
              <span className="hidden sm:block">Lista</span>
              {watchlistIds.size > 0 && (
                <span className="absolute -top-1 -right-1 sm:static sm:ml-0 bg-[#d4845a] text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
                  {watchlistIds.size > 99 ? "99+" : watchlistIds.size}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="-mt-[68px]">
        <HeroSpotlight
          watchlistIds={watchlistIds}
          onSaveToggle={handleSaveToggle}
          onSelectMovie={setSelectedMovie}
          refreshTrigger={historyTrigger}
        />
      </div>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-10">
        <HomeSections
          watchlistIds={watchlistIds}
          favoriteIds={favoriteIds}
          onSelectMovie={setSelectedMovie}
        />
        <ExploredTabs
          refreshTrigger={historyTrigger}
          watchlistIds={watchlistIds}
          favoriteIds={favoriteIds}
          onSelectMovie={setSelectedMovie}
        />
        <RouletteSection onSelectMovie={setSelectedMovie} />
      </main>

      {/* Modals */}
      {selectedMovie && (
        <MovieModal
          movie={selectedMovie}
          onClose={() => setSelectedMovie(null)}
          isSaved={watchlistIds.has(selectedMovie.id)}
          onSaveToggle={handleSaveToggle}
          isFavorited={favoriteIds.has(selectedMovie.id)}
          onFavoriteToggle={handleFavoriteToggle}
        />
      )}

      <FavoritesDrawer
        open={favoritesDrawerOpen}
        onClose={() => setFavoritesDrawerOpen(false)}
        onSelectMovie={setSelectedMovie}
        onRemove={(id) => handleFavoriteToggle(id, false)}
      />

      <WatchlistDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSelectMovie={setSelectedMovie}
        onRemove={(id) => handleSaveToggle(id, false)}
      />

      <DbDrawer
        open={dbDrawerOpen}
        onClose={() => setDbDrawerOpen(false)}
        onSelectMovie={setSelectedMovie}
      />
    </div>
  );
}
