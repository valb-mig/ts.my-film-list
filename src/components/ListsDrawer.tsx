"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import Image from "next/image";
import { Movie } from "@/types/imdb";
import { useChunkedList } from "@/lib/useChunkedList";
import { ListInfo } from "@/hooks/useLists";

interface ListItem {
  imdb_id: string;
  title: string;
  year?: number;
  poster_url?: string;
  rating?: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSelectMovie: (movie: Movie) => void;
  lists: ListInfo[];
  createList: (name: string) => Promise<ListInfo | null>;
  renameList: (listId: number, name: string) => Promise<void>;
  deleteList: (listId: number) => Promise<void>;
  removeFromList: (listId: number, imdbId: string) => Promise<void>;
}

export default function ListsDrawer({
  open, onClose, onSelectMovie, lists, createList, renameList, deleteList, removeFromList,
}: Props) {
  const [activeListId, setActiveListId] = useState<number | null>(null);
  const [items, setItems] = useState<ListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const touchStartY = useRef(0);
  const [translateY, setTranslateY] = useState(0);
  const isDragging = useRef(false);

  useEffect(() => {
    if (!open) return;
    setTranslateY(0);
    setActiveListId((prev) => (prev !== null && lists.some((l) => l.id === prev) ? prev : lists[0]?.id ?? null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const fetchItems = useCallback((listId: number) => {
    setLoading(true);
    fetch(`/api/lists/${listId}/items`)
      .then((r) => r.json())
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (open && activeListId !== null) fetchItems(activeListId);
    else setItems([]);
  }, [open, activeListId, fetchItems]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", handleKey); document.body.style.overflow = ""; };
  }, [open, onClose]);

  const activeList = useMemo(() => lists.find((l) => l.id === activeListId) ?? null, [lists, activeListId]);

  const handleCreate = useCallback(async () => {
    const name = newName.trim();
    if (!name) return;
    const created = await createList(name);
    setNewName("");
    setCreating(false);
    if (created) setActiveListId(created.id);
  }, [newName, createList]);

  const handleRenameSave = useCallback(async () => {
    const name = renameValue.trim();
    if (renamingId !== null && name) await renameList(renamingId, name);
    setRenamingId(null);
  }, [renamingId, renameValue, renameList]);

  const handleDelete = useCallback(async (listId: number) => {
    if (!window.confirm("Excluir essa lista? Os filmes salvos nela serão removidos.")) return;
    await deleteList(listId);
    if (activeListId === listId) {
      const remaining = lists.filter((l) => l.id !== listId);
      setActiveListId(remaining[0]?.id ?? null);
    }
  }, [deleteList, activeListId, lists]);

  const handleRemove = useCallback(async (imdbId: string) => {
    if (activeListId === null) return;
    await removeFromList(activeListId, imdbId);
    setItems((prev) => prev.filter((i) => i.imdb_id !== imdbId));
  }, [activeListId, removeFromList]);

  const { visible, hasMore: hasMoreVisible, sentinelRef } = useChunkedList(items, 30);

  const handleTouchStart = (e: React.TouchEvent) => { touchStartY.current = e.touches[0].clientY; isDragging.current = true; };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current) return;
    const delta = e.touches[0].clientY - touchStartY.current;
    if (delta > 0) setTranslateY(delta);
  };
  const handleTouchEnd = () => {
    if (translateY > 100) onClose(); else setTranslateY(0);
    isDragging.current = false;
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="relative w-full sm:max-w-md max-h-[88vh] sm:max-h-[80vh] rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col"
        style={{
          background: "linear-gradient(135deg, rgba(30,26,22,0.97) 0%, rgba(20,18,14,0.97) 100%)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 40px 100px rgba(0,0,0,0.8)",
          transform: `translateY(${translateY}px)`,
          transition: isDragging.current ? "none" : "transform 0.3s ease",
        }}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        <div className="flex items-center justify-between px-6 py-4 shrink-0 border-b border-white/[0.06]">
          <h2 className="text-[#f0e8dc] font-black text-xl">Minhas Listas</h2>
          <button onClick={onClose} className="p-2 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-[#9a8878] hover:text-[#f0e8dc] transition-colors">
            <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </div>

        {/* List chips */}
        <div className="shrink-0 flex gap-1.5 px-4 pt-3 pb-2 overflow-x-auto scrollbar-hide">
          {lists.map((l) => (
            <button
              key={l.id}
              onClick={() => setActiveListId(l.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                activeListId === l.id
                  ? "bg-[#d4845a] text-white"
                  : "bg-white/[0.05] text-[#9a8878] hover:text-[#f0e8dc] border border-white/[0.06]"
              }`}
            >
              {l.name}
              <span className={activeListId === l.id ? "text-white/70" : "text-[#5a4e46]"}>{l.count}</span>
            </button>
          ))}

          {creating ? (
            <div className="flex items-center gap-1 shrink-0">
              <input
                autoFocus
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setCreating(false); }}
                onBlur={handleCreate}
                placeholder="Nome da lista"
                className="bg-white/[0.06] text-[#f0e8dc] placeholder-[#5a4e46] text-xs px-2.5 py-1.5 rounded-full outline-none border border-[#d4845a]/40 w-32"
              />
            </div>
          ) : (
            <button
              onClick={() => setCreating(true)}
              className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-white/[0.05] text-[#9a8878] hover:text-[#f0e8dc] border border-dashed border-white/[0.14] transition-all"
            >
              + Nova
            </button>
          )}
        </div>

        {/* Active list actions */}
        {activeList && (
          <div className="shrink-0 flex items-center gap-2 px-6 pb-2">
            {renamingId === activeList.id ? (
              <input
                autoFocus
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleRenameSave(); if (e.key === "Escape") setRenamingId(null); }}
                onBlur={handleRenameSave}
                className="bg-white/[0.06] text-[#f0e8dc] text-xs px-2 py-1 rounded-lg outline-none border border-[#d4845a]/40"
              />
            ) : (
              <button
                onClick={() => { setRenamingId(activeList.id); setRenameValue(activeList.name); }}
                className="text-[#5a4e46] hover:text-[#9a8878] text-[10px] font-medium flex items-center gap-1 transition-colors"
              >
                <svg width="10" height="10" fill="currentColor" viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" /></svg>
                Renomear
              </button>
            )}
            <button
              onClick={() => handleDelete(activeList.id)}
              className="text-[#5a4e46] hover:text-[#d4845a] text-[10px] font-medium flex items-center gap-1 transition-colors"
            >
              <svg width="10" height="10" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" /></svg>
              Excluir lista
            </button>
          </div>
        )}

        {/* Items */}
        <div className="flex-1 overflow-y-auto p-4">
          {!activeList && (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <p className="text-[#5a4e46] text-sm">Nenhuma lista ainda</p>
              <p className="text-[#5a4e46]/60 text-xs mt-1">Crie uma lista pra começar a salvar filmes</p>
            </div>
          )}

          {activeList && loading && (
            <div className="flex flex-col gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-3 animate-pulse">
                  <div className="w-12 h-[68px] bg-white/[0.06] rounded-xl shrink-0" />
                  <div className="flex-1 flex flex-col gap-2 pt-1">
                    <div className="h-3 bg-white/[0.06] rounded w-3/4" />
                    <div className="h-3 bg-white/[0.06] rounded w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeList && !loading && items.length === 0 && (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <p className="text-[#5a4e46] text-sm">Lista vazia</p>
              <p className="text-[#5a4e46]/60 text-xs mt-1">Salve filmes para ver aqui</p>
            </div>
          )}

          {activeList && !loading && items.length > 0 && (
            <div className="flex flex-col gap-2">
              {visible.map((item) => {
                const movie: Movie = { id: item.imdb_id, title: item.title, year: item.year, poster: item.poster_url ?? undefined };
                return (
                  <div
                    key={item.imdb_id}
                    className="flex gap-3 group rounded-2xl p-2.5 hover:bg-white/[0.04] transition-colors"
                    style={{ border: "1px solid rgba(255,255,255,0.04)" }}
                  >
                    <button
                      className="shrink-0 w-12 h-[68px] relative bg-[#1e1a16] rounded-xl overflow-hidden cursor-pointer"
                      onClick={() => { onSelectMovie(movie); onClose(); }}
                    >
                      {item.poster_url ? (
                        <Image src={item.poster_url} alt={item.title} fill className="object-cover" sizes="48px" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="text-[#5a4e46] text-xs text-center px-1 leading-tight">{item.title}</span>
                        </div>
                      )}
                    </button>

                    <div className="flex-1 flex flex-col justify-center gap-1 cursor-pointer min-w-0"
                      onClick={() => { onSelectMovie(movie); onClose(); }}>
                      <p className="text-[#f0e8dc] text-sm font-medium truncate">{item.title}</p>
                      <div className="flex items-center gap-2 text-xs text-[#5a4e46]">
                        {item.year && <span>{item.year}</span>}
                        {item.rating && (
                          <><span>·</span>
                          <span className="flex items-center gap-1">
                            <svg width="9" height="9" fill="#F5C518" viewBox="0 0 24 24">
                              <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                            </svg>
                            {item.rating.toFixed(1)}
                          </span></>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => handleRemove(item.imdb_id)}
                      className="shrink-0 self-center p-1.5 rounded-full text-[#5a4e46] hover:text-[#d4845a] hover:bg-[#d4845a]/10 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                      </svg>
                    </button>
                  </div>
                );
              })}
              {hasMoreVisible && (
                <div ref={sentinelRef} className="flex justify-center py-4">
                  <div className="w-4 h-4 border-2 border-white/[0.1] border-t-[#9a8878] rounded-full animate-spin" />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
