"use client";

import { useState, useEffect, useCallback } from "react";
import { Movie } from "@/types/imdb";

export interface ListInfo {
  id: number;
  name: string;
  created_at: number;
  count: number;
}

interface ListItemRow {
  list_id: number;
  imdb_id: string;
}

export function useLists() {
  const [lists, setLists] = useState<ListInfo[]>([]);
  const [membership, setMembership] = useState<Map<string, Set<number>>>(new Map());
  const [loading, setLoading] = useState(true);

  const fetchLists = useCallback(() => {
    fetch("/api/lists")
      .then((r) => r.json())
      .then((rows: ListInfo[]) => setLists(rows))
      .catch(() => {});
  }, []);

  const fetchMembership = useCallback(() => {
    fetch("/api/lists/items")
      .then((r) => r.json())
      .then((rows: ListItemRow[]) => {
        const map = new Map<string, Set<number>>();
        for (const row of rows) {
          const set = map.get(row.imdb_id) ?? new Set<number>();
          set.add(row.list_id);
          map.set(row.imdb_id, set);
        }
        setMembership(map);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const refresh = useCallback(() => {
    fetchLists();
    fetchMembership();
  }, [fetchLists, fetchMembership]);

  useEffect(() => { refresh(); }, [refresh]);

  const createList = useCallback(async (name: string): Promise<ListInfo | null> => {
    const res = await fetch("/api/lists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) return null;
    const created = await res.json();
    const info: ListInfo = { id: created.id, name: created.name, created_at: Math.floor(Date.now() / 1000), count: 0 };
    setLists((prev) => [...prev, info]);
    return info;
  }, []);

  const renameList = useCallback(async (listId: number, name: string) => {
    await fetch(`/api/lists/${listId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setLists((prev) => prev.map((l) => (l.id === listId ? { ...l, name } : l)));
  }, []);

  const deleteList = useCallback(async (listId: number) => {
    await fetch(`/api/lists/${listId}`, { method: "DELETE" });
    setLists((prev) => prev.filter((l) => l.id !== listId));
    setMembership((prev) => {
      const next = new Map<string, Set<number>>();
      prev.forEach((listIds, imdbId) => {
        if (!listIds.has(listId)) { next.set(imdbId, listIds); return; }
        const remaining = new Set<number>(listIds);
        remaining.delete(listId);
        if (remaining.size > 0) next.set(imdbId, remaining);
      });
      return next;
    });
  }, []);

  const addToList = useCallback(async (listId: number, movie: Movie, rating?: number) => {
    await fetch(`/api/lists/${listId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imdb_id: movie.id, title: movie.title, year: movie.year, poster_url: movie.poster, rating }),
    });
    setMembership((prev) => {
      const next = new Map(prev);
      const set = new Set(next.get(movie.id) ?? []);
      set.add(listId);
      next.set(movie.id, set);
      return next;
    });
    setLists((prev) => prev.map((l) => (l.id === listId ? { ...l, count: l.count + 1 } : l)));
  }, []);

  const removeFromList = useCallback(async (listId: number, imdbId: string) => {
    await fetch(`/api/lists/${listId}/items/${imdbId}`, { method: "DELETE" });
    setMembership((prev) => {
      const next = new Map(prev);
      const set = new Set(next.get(imdbId) ?? []);
      set.delete(listId);
      if (set.size > 0) next.set(imdbId, set); else next.delete(imdbId);
      return next;
    });
    setLists((prev) => prev.map((l) => (l.id === listId ? { ...l, count: Math.max(0, l.count - 1) } : l)));
  }, []);

  return {
    lists,
    membership,
    loading,
    listIdsFor: useCallback((imdbId: string) => membership.get(imdbId) ?? new Set<number>(), [membership]),
    createList,
    renameList,
    deleteList,
    addToList,
    removeFromList,
    refresh,
  };
}
