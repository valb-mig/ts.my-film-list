"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import SearchBar from "@/components/SearchBar";
import MovieModal from "@/components/MovieModal";
import ListsDrawer from "@/components/ListsDrawer";
import FavoritesDrawer from "@/components/FavoritesDrawer";
import SubtitleSettingsModal from "@/components/SubtitleSettingsModal";
import HeroSpotlight from "@/components/HeroSpotlight";
import HomeSections from "@/components/HomeSections";
import RouletteSection from "@/components/RouletteSection";
import { Movie } from "@/types/imdb";
import { useCollections } from "@/hooks/useCollections";
import { useOpenTitle } from "@/hooks/useOpenTitle";
import { useLists } from "@/hooks/useLists";
import { isTvMode } from "@/lib/tvMode";

export default function Home() {
  // On a TV (projector hub, ?tv=1) the remote-friendly version is the one to use. A full load, not
  // a client-side route change: the hub decides what to inject into a page by its URL at load time.
  useEffect(() => { if (isTvMode()) window.location.replace("/tv"); }, []);
  const [selectedMovie, setSelectedMovie] = useOpenTitle();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [favoritesDrawerOpen, setFavoritesDrawerOpen] = useState(false);
  const [subtitleSettingsOpen, setSubtitleSettingsOpen] = useState(false);
  const [listsTrigger, setListsTrigger] = useState(0);

  const { favoriteIds, handleFavoriteToggle } = useCollections();
  const { lists, membership, listIdsFor, createList, renameList, deleteList, addToList: baseAddToList, removeFromList: baseRemoveFromList } = useLists();

  const watchlistIds = useMemo(() => new Set(membership.keys()), [membership]);

  const addToList = useCallback(async (listId: number, movie: Movie, rating?: number) => {
    await baseAddToList(listId, movie, rating);
    setListsTrigger((t) => t + 1);
  }, [baseAddToList]);

  const removeFromList = useCallback(async (listId: number, imdbId: string) => {
    await baseRemoveFromList(listId, imdbId);
    setListsTrigger((t) => t + 1);
  }, [baseRemoveFromList]);

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
              onClick={() => setSubtitleSettingsOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[#9a8878] hover:text-[#f0e8dc] hover:bg-white/[0.06] transition-all text-xs font-medium"
              aria-label="Configurações de legenda"
            >
              <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zM4 12h4v2H4v-2zm10 6H4v-2h10v2zm6 0h-4v-2h4v2zm0-4H10v-2h10v2z" />
              </svg>
              <span className="hidden sm:block">Legendas</span>
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
      <HeroSpotlight
        watchlistIds={watchlistIds}
        lists={lists}
        onAddToList={addToList}
        onRemoveFromList={removeFromList}
        onCreateList={createList}
        onSelectMovie={setSelectedMovie}
        refreshTrigger={listsTrigger}
      />

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-10">
        <HomeSections
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

      <FavoritesDrawer
        open={favoritesDrawerOpen}
        onClose={() => setFavoritesDrawerOpen(false)}
        onSelectMovie={setSelectedMovie}
        onRemove={(id) => handleFavoriteToggle(id, false)}
      />

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

      <SubtitleSettingsModal open={subtitleSettingsOpen} onClose={() => setSubtitleSettingsOpen(false)} />
    </div>
  );
}
