"use client";

import { useRef, useEffect, useState } from "react";
import { MOODS } from "@/lib/moods";

interface Props {
  onSelect: (moodKey: string) => void;
}

export default function MoodSelector({ onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 px-2.5 h-[38px] rounded-xl text-xs font-medium whitespace-nowrap bg-white/[0.05] text-[#9a8878] hover:text-[#f0e8dc] border border-white/[0.08] hover:border-white/[0.14] transition-all"
        aria-label="Escolher clima"
        title="Como você quer se sentir?"
      >
        <span>🎭</span>
        <svg
          width="11" height="11" viewBox="0 0 24 24" fill="currentColor"
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M7 10l5 5 5-5H7z" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute top-full left-0 mt-2 z-50 rounded-2xl w-72 p-3 max-h-80 overflow-y-auto"
          style={{
            background: "rgba(20,18,14,0.97)",
            border: "1px solid rgba(255,255,255,0.09)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.7)",
            backdropFilter: "blur(16px)",
          }}
        >
          <p className="text-[#5a4e46] text-[10px] uppercase tracking-widest font-semibold px-1 pb-2">
            Como você quer se sentir?
          </p>
          <div className="flex flex-wrap gap-1.5">
            {MOODS.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => { onSelect(m.key); setOpen(false); }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium bg-white/[0.05] text-[#9a8878] hover:bg-white/[0.10] hover:text-[#f0e8dc] transition-all"
              >
                <span>{m.emoji}</span>
                {m.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
