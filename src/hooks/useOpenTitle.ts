"use client";

import { useCallback, useEffect, useState } from "react";
import type { Movie } from "@/types/imdb";
import { readTitleUrl, writeTitleUrl } from "@/lib/titleUrl";

// The title open in a page (its MovieModal), kept in the URL so a refresh brings it back. Restored
// with just its id — the modal fills in the rest from the detail.
export function useOpenTitle(): [Movie | null, (movie: Movie | null) => void] {
  const [movie, setMovie] = useState<Movie | null>(null);

  useEffect(() => {
    const { id } = readTitleUrl();
    if (id) setMovie({ id, title: "" });
  }, []);

  const open = useCallback((next: Movie | null) => {
    setMovie(next);
    writeTitleUrl({ id: next?.id ?? null });
  }, []);

  return [movie, open];
}
