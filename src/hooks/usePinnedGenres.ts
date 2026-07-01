"use client";

import { useState, useCallback, useEffect } from "react";

const KEY = "myfilmlist:pinnedGenres";

export function usePinnedGenres() {
  const [pinned, setPinned] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setPinned(new Set(JSON.parse(raw) as string[]));
    } catch {}
  }, []);

  const toggle = useCallback((genre: string) => {
    setPinned((prev) => {
      const next = new Set(prev);
      if (next.has(genre)) next.delete(genre);
      else next.add(genre);
      try {
        localStorage.setItem(KEY, JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  }, []);

  return { pinned, toggle };
}
