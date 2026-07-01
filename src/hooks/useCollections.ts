"use client";

import { useState, useEffect, useCallback } from "react";

export function useCollections() {
  const [watchlistIds, setWatchlistIds] = useState<Set<string>>(new Set());
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());

  const fetchWatchlist = useCallback(() => {
    fetch("/api/watchlist")
      .then((r) => r.json())
      .then((items: { imdb_id: string }[]) =>
        setWatchlistIds(new Set(items.map((i) => i.imdb_id)))
      )
      .catch(() => {});
  }, []);

  const fetchFavorites = useCallback(() => {
    fetch("/api/favorites")
      .then((r) => r.json())
      .then((items: { imdb_id: string }[]) =>
        setFavoriteIds(new Set(items.map((i) => i.imdb_id)))
      )
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchWatchlist();
    fetchFavorites();
  }, [fetchWatchlist, fetchFavorites]);

  const handleSaveToggle = useCallback((imdbId: string, saved: boolean) => {
    setWatchlistIds((prev) => {
      const next = new Set(prev);
      if (saved) next.add(imdbId);
      else next.delete(imdbId);
      return next;
    });
  }, []);

  const handleFavoriteToggle = useCallback((imdbId: string, fav: boolean) => {
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (fav) next.add(imdbId);
      else next.delete(imdbId);
      return next;
    });
  }, []);

  return {
    watchlistIds,
    favoriteIds,
    handleSaveToggle,
    handleFavoriteToggle,
    refreshWatchlist: fetchWatchlist,
    refreshFavorites: fetchFavorites,
  };
}
