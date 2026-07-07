"use client";

import { useRef, useEffect, useState } from "react";
import { DURATION_BUCKETS, DurationBucket } from "@/lib/duration";

interface Props {
  value: DurationBucket;
  onChange: (bucket: DurationBucket) => void;
}

export default function DurationSelect({ value, onChange }: Props) {
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

  const current = DURATION_BUCKETS.find((b) => b.key === value) ?? DURATION_BUCKETS[0];

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1 px-2.5 h-[34px] rounded-xl text-xs font-medium transition-all whitespace-nowrap ${
          value !== "any"
            ? "bg-[#d4845a] text-white"
            : "bg-white/[0.05] text-[#9a8878] hover:text-[#f0e8dc] border border-white/[0.08] hover:border-white/[0.14]"
        }`}
      >
        <svg width="11" height="11" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 20a8 8 0 100-16 8 8 0 000 16zm0-18a10 10 0 110 20 10 10 0 010-20zm.5 5H11v6l5.25 3.15.75-1.23-4.5-2.67V7z" />
        </svg>
        <span>{value === "any" ? "Duração" : current.label}</span>
        {value !== "any" && (
          <span
            onClick={(e) => { e.stopPropagation(); onChange("any"); }}
            className="ml-0.5 w-4 h-4 flex items-center justify-center rounded-full hover:bg-white/20 text-sm leading-none"
          >
            ×
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute top-full left-0 mt-2 z-50 rounded-2xl w-48 p-1.5"
          style={{
            background: "rgba(20,18,14,0.97)",
            border: "1px solid rgba(255,255,255,0.09)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.7)",
            backdropFilter: "blur(16px)",
          }}
        >
          {DURATION_BUCKETS.map((b) => (
            <button
              key={b.key}
              type="button"
              onClick={() => { onChange(b.key); setOpen(false); }}
              className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                value === b.key
                  ? "bg-[#d4845a] text-white"
                  : "text-[#9a8878] hover:bg-white/[0.08] hover:text-[#f0e8dc]"
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
