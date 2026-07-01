"use client";

import { useRef, useEffect, useState } from "react";

interface Props {
  genres: string[];
  selected: Set<string>;
  onToggle: (genre: string) => void;
  onClear: () => void;
  label?: string;
}

export default function GenreMultiSelect({ genres, selected, onToggle, onClear, label = "Gêneros" }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = search.trim()
    ? genres.filter((g) => g.toLowerCase().includes(search.toLowerCase()))
    : genres;

  const count = selected.size;

  useEffect(() => {
    if (!open) { setSearch(""); return; }
    setTimeout(() => inputRef.current?.focus(), 50);
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClear();
  };

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1 px-2.5 h-[34px] rounded-xl text-xs font-medium transition-all whitespace-nowrap ${
          count > 0
            ? "bg-[#d4845a] text-white"
            : "bg-white/[0.05] text-[#9a8878] hover:text-[#f0e8dc] border border-white/[0.08] hover:border-white/[0.14]"
        }`}
      >
        <span>{count > 0 ? `${label} · ${count}` : label}</span>
        {count > 0 ? (
          <span
            onClick={handleClear}
            className="ml-0.5 w-4 h-4 flex items-center justify-center rounded-full hover:bg-white/20 text-sm leading-none"
          >
            ×
          </span>
        ) : (
          <svg
            width="11" height="11" viewBox="0 0 24 24" fill="currentColor"
            className={`transition-transform ${open ? "rotate-180" : ""}`}
          >
            <path d="M7 10l5 5 5-5H7z" />
          </svg>
        )}
      </button>

      {open && (
        <div
          className="absolute top-full left-0 mt-2 z-50 rounded-2xl w-72"
          style={{
            background: "rgba(20,18,14,0.97)",
            border: "1px solid rgba(255,255,255,0.09)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.7)",
            backdropFilter: "blur(16px)",
          }}
        >
          <div className="p-2 border-b border-white/[0.06]">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar gênero..."
              className="w-full bg-white/[0.05] text-[#f0e8dc] placeholder-[#5a4e46] text-xs px-3 py-2 rounded-xl outline-none border border-white/[0.06] focus:border-[#d4845a]/40 transition-colors"
            />
          </div>
          <div className="p-3 max-h-60 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-[#5a4e46] text-xs text-center py-2">Nenhum gênero encontrado</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {filtered.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => onToggle(g)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                      selected.has(g)
                        ? "bg-[#d4845a] text-white"
                        : "bg-white/[0.05] text-[#9a8878] hover:bg-white/[0.10] hover:text-[#f0e8dc]"
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            )}
          </div>
          {count > 0 && (
            <div className="p-2 border-t border-white/[0.06] flex justify-end">
              <button
                onClick={onClear}
                className="text-[#5a4e46] hover:text-[#9a8878] text-[10px] font-medium px-2 py-1 transition-colors"
              >
                Limpar seleção
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
