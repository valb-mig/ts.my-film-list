"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import GenreSelector from "./GenreSelector";
import MoodSelector from "./MoodSelector";

interface Props {
  mode: "full" | "text";
  defaultQuery?: string;
}

export default function SearchBar({ mode, defaultQuery = "" }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState(defaultQuery);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    setQuery(defaultQuery);
  }, [defaultQuery]);

  const handleGenreSelect = (genre: string | null) => {
    if (genre) {
      router.push(`/genre/${encodeURIComponent(genre)}`);
    } else {
      router.push("/");
    }
  };

  const handleMoodSelect = (moodKey: string) => {
    router.push(`/mood/${encodeURIComponent(moodKey)}`);
  };

  const handleTextChange = (value: string) => {
    setQuery(value);
    clearTimeout(debounceRef.current);
    if (!value.trim()) {
      if (mode === "text") router.push("/");
      return;
    }
    debounceRef.current = setTimeout(() => {
      router.push(`/search?q=${encodeURIComponent(value.trim())}`);
    }, 450);
  };

  const handleSubmit = () => {
    clearTimeout(debounceRef.current);
    if (!query.trim()) return;
    router.push(`/search?q=${encodeURIComponent(query.trim())}`);
  };

  const handleClear = () => {
    setQuery("");
    clearTimeout(debounceRef.current);
    router.push("/");
  };

  return (
    <div className="flex items-center gap-2">
      {mode === "full" && (
        <>
          <GenreSelector selected={null} onSelect={handleGenreSelect} />
          <MoodSelector onSelect={handleMoodSelect} />
        </>
      )}

      <div className="relative flex-1">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5a4e46] pointer-events-none">
          <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => handleTextChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder={mode === "full" ? "Pesquisar filmes..." : "Pesquisar..."}
          className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-[#d4845a]/60 outline-none text-[#f0e8dc] placeholder-[#5a4e46] pl-9 pr-8 py-2.5 rounded-xl text-sm transition-colors backdrop-blur-sm"
        />
        {query && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5a4e46] hover:text-[#f0e8dc] transition-colors"
          >
            <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
