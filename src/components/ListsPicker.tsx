"use client";

import { useState } from "react";
import type { ListInfo } from "@/hooks/useLists";
import { Icon } from "./titleIcons";

interface Props {
  lists: ListInfo[];
  listIds: Set<number>;
  onToggleList: (listId: number) => void;
  // Creates the list and saves the title in it.
  onCreateList: (name: string) => void;
}

export default function ListsPicker({ lists, listIds, onToggleList, onCreateList }: Props) {
  const [name, setName] = useState("");
  return (
    <div className="flex flex-col gap-0.5 rounded-xl p-2 bg-white/[0.03] border border-white/[0.06]">
      {lists.map((l) => {
        const checked = listIds.has(l.id);
        return (
          <button
            key={l.id}
            onClick={() => onToggleList(l.id)}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-left hover:bg-white/[0.06] transition-colors"
          >
            <span className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 ${checked ? "bg-[#d4845a] border-[#d4845a] text-white" : "border-white/20"}`}>
              {checked && <Icon name="check" size={11} />}
            </span>
            <span className="text-[#f0e8dc] truncate">{l.name}</span>
          </button>
        );
      })}
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && name.trim()) {
            onCreateList(name.trim());
            setName("");
          }
        }}
        placeholder="+ Nova lista (Enter cria e salva)"
        className="mt-1 bg-white/[0.04] text-[#f0e8dc] placeholder-[#5a4e46] text-xs px-2.5 py-1.5 rounded-lg outline-none border border-white/[0.06] focus:border-[#d4845a]/40"
      />
    </div>
  );
}
