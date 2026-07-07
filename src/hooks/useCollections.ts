"use client";

import { useState, useEffect, useCallback } from "react";

export function useCollections() {
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [watchedIds, setWatchedIds] = useState<Set<string>>(new Set());

  const fetchFavorites = useCallback(() => {
    fetch("/api/favorites")
      .then((r) => r.json())
      .then((items: { imdb_id: string }[]) =>
        setFavoriteIds(new Set(items.map((i) => i.imdb_id)))
      )
      .catch(() => {});
  }, []);

  const fetchWatched = useCallback(() => {
    fetch("/api/watched?all=1")
      .then((r) => r.json())
      .then((items: { imdb_id: string }[]) =>
        setWatchedIds(new Set(items.map((i) => i.imdb_id)))
      )
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchFavorites();
    fetchWatched();
  }, [fetchFavorites, fetchWatched]);

  const handleFavoriteToggle = useCallback((imdbId: string, fav: boolean) => {
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (fav) next.add(imdbId);
      else next.delete(imdbId);
      return next;
    });
  }, []);

  const handleWatchedToggle = useCallback((imdbId: string, watched: boolean) => {
    setWatchedIds((prev) => {
      const next = new Set(prev);
      if (watched) next.add(imdbId);
      else next.delete(imdbId);
      return next;
    });
  }, []);

  return {
    favoriteIds,
    watchedIds,
    handleFavoriteToggle,
    handleWatchedToggle,
    refreshFavorites: fetchFavorites,
    refreshWatched: fetchWatched,
  };
}
