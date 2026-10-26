"use client";

import { useCallback, useEffect, useState } from "react";
import type { Movie } from "@/types/imdb";
import { useCollections } from "@/hooks/useCollections";
import { useLists } from "@/hooks/useLists";
import { useTvNav } from "@/hooks/useTvNav";
import { focusElement, initialFocus } from "@/lib/tvNav";
import { handleTvBack } from "./TvLayer";
import TvInfoPanel from "./TvInfoPanel";
import TvRow from "./TvRow";
import TvDetail from "./TvDetail";
import TvSearch from "./TvSearch";

const SECTIONS: [string, string][] = [
  ["Em alta", "trending"],
  ["Populares", "popular"],
  ["Mais bem avaliados", "top_rated"],
  ["Nos cinemas", "now_playing"],
];

interface SavedRow {
  imdb_id: string;
  title: string;
  year: number | null;
  poster_url: string | null;
  list_id?: number;
}

const toMovie = (r: SavedRow): Movie => ({
  id: r.imdb_id,
  title: r.title,
  year: r.year ?? undefined,
  poster: r.poster_url ?? undefined,
});

type HubWindow = Window & { webkit?: { messageHandlers?: { hub?: { postMessage: (m: string) => void } } } };

// The TV version: one screen of poster rows driven by a remote (arrows, OK, Back). Two presses to
// watch: OK on a poster opens it with "Assistir" focused, OK again plays.
export default function TvApp() {
  const { favoriteIds, handleFavoriteToggle } = useCollections();
  const { lists, listIdsFor, addToList, removeFromList, createList } = useLists();
  const [sections, setSections] = useState<Record<string, Movie[]>>({});
  const [favorites, setFavorites] = useState<Movie[]>([]);
  const [listItems, setListItems] = useState<SavedRow[]>([]);
  const [recommended, setRecommended] = useState<Movie[]>([]);
  const [savedVersion, setSavedVersion] = useState(0);
  // Favorites and lists come first on screen — wait for them before picking where focus starts.
  const [savedLoaded, setSavedLoaded] = useState(false);
  const [focused, setFocused] = useState<Movie | null>(null);
  const [detailMovie, setDetailMovie] = useState<Movie | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useTvNav(() => {
    const handled = handleTvBack();
    if (handled !== null) return handled;
    // Nothing open: Back leaves the site (to the projector hub's home).
    const hub = (window as HubWindow).webkit?.messageHandlers?.hub;
    if (!hub) return false;
    hub.postMessage("back");
    return true;
  });

  useEffect(() => {
    for (const [, section] of SECTIONS) {
      fetch(`/api/home?section=${section}`)
        .then((r) => r.json())
        .then((d: { movies?: Movie[] }) => setSections((prev) => ({ ...prev, [section]: d.movies ?? [] })))
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    Promise.all([
      fetch("/api/favorites")
        .then((r) => r.json())
        .then((rows: SavedRow[]) => setFavorites(rows.map(toMovie)))
        .catch(() => {}),
      fetch("/api/lists/items")
        .then((r) => r.json())
        .then((rows: SavedRow[]) => setListItems(rows))
        .catch(() => {}),
    ]).finally(() => setSavedLoaded(true));
    fetch("/api/home/recommendations")
      .then((r) => r.json())
      .then((d: { movies?: Movie[] }) => setRecommended(d.movies ?? []))
      .catch(() => {});
  }, [savedVersion]);

  const rows = [
    ...lists.map((l) => ({
      key: `list-${l.id}`,
      title: l.name,
      movies: listItems.filter((i) => i.list_id === l.id).map(toMovie),
    })),
    { key: "favorites", title: "Favoritos", movies: favorites },
    { key: "recommended", title: "Baseado no que você curtiu", movies: recommended },
    ...SECTIONS.map(([title, section]) => ({ key: section, title, movies: sections[section] ?? [] })),
  ].filter((r) => r.movies.length > 0);

  // First load: land on the first poster as soon as there is one (and nothing else has focus).
  const hasRows = rows.length > 0;
  useEffect(() => {
    if (!hasRows || !savedLoaded || detailMovie || searchOpen) return;
    if (document.activeElement && document.activeElement !== document.body) return;
    const first = initialFocus();
    if (first) focusElement(first, false);
  }, [hasRows, savedLoaded, detailMovie, searchOpen]);

  // A row showing up above the focused one (e.g. recommendations arriving late) pushes it down —
  // line the focused row up again.
  const rowKeys = rows.map((r) => r.key).join("|");
  useEffect(() => {
    const active = document.activeElement;
    if (active instanceof HTMLElement && active.closest("main")) focusElement(active, false);
  }, [rowKeys]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  const toggleFavorite = useCallback(async (movie: Movie, favorite: boolean) => {
    if (favorite) {
      await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imdb_id: movie.id, title: movie.title, year: movie.year, poster_url: movie.poster }),
      });
    } else {
      await fetch(`/api/favorites/${movie.id}`, { method: "DELETE" });
    }
    handleFavoriteToggle(movie.id, favorite);
    setSavedVersion((v) => v + 1);
  }, [handleFavoriteToggle]);

  const addToListAndRefresh = useCallback(async (listId: number, movie: Movie) => {
    await addToList(listId, movie);
    setSavedVersion((v) => v + 1);
  }, [addToList]);

  const removeFromListAndRefresh = useCallback(async (listId: number, id: string) => {
    await removeFromList(listId, id);
    setSavedVersion((v) => v + 1);
  }, [removeFromList]);

  const surprise = async () => {
    const res = await fetch("/api/roulette").catch(() => null);
    const pick = res?.ok ? await res.json() : null;
    if (!pick?.imdb_id) {
      setToast("Salve filmes nos favoritos ou numa lista pra sortear.");
      return;
    }
    setDetailMovie(toMovie(pick));
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#0a0906] text-[#f0e8dc] flex flex-col select-none">
      <TvInfoPanel movie={focused} onSearch={() => setSearchOpen(true)} onSurprise={surprise} />

      <main className="flex-1 min-h-0 overflow-y-auto pb-[8vh] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {rows.map((r, i) => (
          <TvRow
            key={r.key}
            title={r.title}
            movies={r.movies}
            onFocus={setFocused}
            onOpen={setDetailMovie}
            autoFocusFirst={i === 0}
          />
        ))}
        {!hasRows && (
          <div className="flex gap-[1vw] px-[4vw] pt-[3vw]">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="shrink-0 w-[10.5vw] aspect-[2/3] rounded-[0.8vw] bg-white/[0.05] animate-pulse" />
            ))}
          </div>
        )}
      </main>

      {searchOpen && <TvSearch onOpen={setDetailMovie} onClose={() => setSearchOpen(false)} />}

      {detailMovie && (
        <TvDetail
          key={detailMovie.id}
          movie={detailMovie}
          isFavorite={(id) => favoriteIds.has(id)}
          onToggleFavorite={toggleFavorite}
          lists={lists}
          listIdsFor={listIdsFor}
          onAddToList={addToListAndRefresh}
          onRemoveFromList={removeFromListAndRefresh}
          onCreateList={createList}
          onClose={() => setDetailMovie(null)}
        />
      )}

      {toast && (
        <div className="fixed bottom-[6vh] left-1/2 -translate-x-1/2 z-[70] rounded-full bg-[#1a1612] border border-white/[0.1] px-[2vw] py-[1vw] text-[1.3vw]">
          {toast}
        </div>
      )}
    </div>
  );
}
