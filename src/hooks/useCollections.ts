"use client";

import { useState, useEffect, useCallback } from "react";

export function useCollections() {
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());

  const fetchFavorites = useCallback(() => {
    fetch("/api/favorites")
      .then((r) => r.json())
      .then((items: { imdb_id: string }[]) =>
        setFavoriteIds(new Set(items.map((i) => i.imdb_id)))
      )
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  const handleFavoriteToggle = useCallback((imdbId: string, fav: boolean) => {
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (fav) next.add(imdbId);
      else next.delete(imdbId);
      return next;
    });
  }, []);

  return {
    favoriteIds,
    handleFavoriteToggle,
    refreshFavorites: fetchFavorites,
  };
}
