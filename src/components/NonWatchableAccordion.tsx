"use client";

import { useState } from "react";

interface Props {
  count: number;
  children: React.ReactNode;
}

export default function NonWatchableAccordion({ count, children }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 text-[#5a4e46] hover:text-[#9a8878] text-sm transition-colors py-1 select-none"
      >
        <svg
          width="13" height="13" fill="currentColor" viewBox="0 0 24 24"
          className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          <path d="M7 10l5 5 5-5z" />
        </svg>
        <span className="flex items-center gap-1.5">
          Séries &amp; Outros
          <span
            className="text-[9px] px-1.5 py-0.5 rounded-full tabular-nums text-[#5a4e46]"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            {count}
          </span>
        </span>
      </button>

      {open && <div className="mt-3">{children}</div>}
    </div>
  );
}
