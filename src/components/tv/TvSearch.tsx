"use client";

import { useEffect, useState } from "react";
import type { Movie } from "@/types/imdb";
import TvLayer from "./TvLayer";
import TvPoster from "./TvPoster";
import { Icon } from "./icons";

interface Props {
  onOpen: (movie: Movie) => void;
  onClose: () => void;
}

// Typing happens on the phone remote (its text goes straight into the focused field).
export default function TvSearch({ onOpen, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      fetch(`/api/search?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((d: { movies?: Movie[] }) => { if (!cancelled) setResults(d.movies ?? []); })
        .catch(() => { if (!cancelled) setResults([]); })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  return (
    <TvLayer
      className="z-40 bg-[#0a0906] text-[#f0e8dc] flex flex-col gap-[1.6vw] px-[4vw] py-[5vh]"
      onBack={() => { onClose(); return true; }}
    >
      <div className="relative">
        <Icon name="search" className="absolute left-[1.8vw] top-1/2 -translate-y-1/2 w-[2.2vw] h-[2.2vw] text-[#5a4e46]" />
        <input
          data-tv-autofocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar filme ou série…"
          className="w-full h-[5.2vw] rounded-[1.2vw] bg-white/[0.06] pl-[5.4vw] pr-[2vw] text-[2.2vw] text-[#f0e8dc] placeholder-[#5a4e46] outline-none focus:ring-[0.25vw] focus:ring-[#d4845a]"
        />
      </div>
      <p className="text-[1.2vw] text-[#9a8878]">
        {loading
          ? "Buscando…"
          : query.trim() && results.length === 0
            ? "Nada encontrado"
            : "Digite pelo controle do celular · ↓ vai pros resultados · Voltar fecha"}
      </p>
      <div className="flex-1 min-h-0 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex flex-wrap gap-[1.6vw] p-[1.2vw]">
          {results.map((m) => (
            <TvPoster key={m.id} movie={m} onOpen={onOpen} />
          ))}
        </div>
      </div>
    </TvLayer>
  );
}
