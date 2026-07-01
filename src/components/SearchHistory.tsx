"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Movie } from "@/types/imdb";
import { isWatchable } from "@/lib/watchable";
import { usePinnedGenres } from "@/hooks/usePinnedGenres";
import GenreMoviesModal from "@/components/GenreMoviesModal";
import GenreMultiSelect from "@/components/GenreMultiSelect";

interface HistoryMovie {
  imdb_id: string;
  title: string;
  year?: number;
  poster_url?: string;
  type?: string;
  genres_json?: string;
  first_seen_at?: number;
}

interface Props {
  refreshTrigger: number;
  watchlistIds: Set<string>;
  favoriteIds: Set<string>;
  onSelectMovie: (movie: Movie) => void;
}

const GENRE_COLORS: Record<string, string> = {
  "Ação":              "#c4502a",
  "Aventura":          "#b48820",
  "Animação":          "#b84468",
  "Comédia":           "#8e9820",
  "Crime":             "#2e5272",
  "Documentário":      "#1e7264",
  "Drama":             "#623478",
  "Família":           "#b8507a",
  "Fantasia":          "#52309a",
  "Ficção Científica": "#22488a",
  "Guerra":            "#4e6020",
  "História":          "#745020",
  "Horror":            "#7a1818",
  "Mistério":          "#3e2278",
  "Música":            "#b41e58",
  "Romance":           "#b43044",
  "Suspense":          "#1e3e52",
  "Terror":            "#620808",
  "Thriller":          "#243040",
  "Western":           "#84601a",
  "Outros":            "#5a4a38",
};

const CARD_W = 200;
const CARD_H = 300;
const VISIBLE_RANGE = 3;

const STAGE: { tx: number; tz: number; ry: number; s: number; op: number }[] = [
  { tx: 0,   tz: 0,    ry: 0,  s: 1.05, op: 1    },
  { tx: 175, tz: -60,  ry: 46, s: 0.87, op: 1    },
  { tx: 305, tz: -115, ry: 58, s: 0.73, op: 0.82 },
  { tx: 400, tz: -165, ry: 68, s: 0.59, op: 0.55 },
];

// Circular offset: maps cardIdx relative to active into [-N/2, N/2]
function circularOffset(cardIdx: number, active: number, N: number): number {
  if (N <= 1) return 0;
  const raw = ((cardIdx - active) % N + N) % N;
  return raw > N / 2 ? raw - N : raw;
}

function getCoverflowStyle(
  offset: number,
  tilt: { x: number; y: number },
  isTilting: boolean
): React.CSSProperties {
  const abs = Math.abs(offset);
  const dir = Math.sign(offset);

  if (abs > VISIBLE_RANGE) {
    return {
      opacity: 0,
      pointerEvents: "none",
      zIndex: 0,
      transform: `translateX(${dir * 440}px) translateZ(-200px) rotateY(${-dir * 72}deg) scale(0.4)`,
      transition: "transform 0.45s cubic-bezier(0.25,0.46,0.45,0.94), opacity 0.3s ease",
    };
  }

  const c = STAGE[abs];

  if (abs === 0) {
    return {
      transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale(${c.s}) translateZ(20px)`,
      opacity: 1,
      zIndex: 30,
      transition: isTilting ? "transform 0.07s ease-out" : "transform 0.45s cubic-bezier(0.25,0.46,0.45,0.94)",
      cursor: "pointer",
    };
  }

  return {
    transform: `translateX(${dir * c.tx}px) translateZ(${c.tz}px) rotateY(${-dir * c.ry}deg) scale(${c.s})`,
    opacity: c.op,
    zIndex: 30 - abs * 6,
    transition: "transform 0.45s cubic-bezier(0.25,0.46,0.45,0.94), opacity 0.45s ease",
    cursor: "pointer",
  };
}

function getGenreColor(genre: string): string {
  return GENRE_COLORS[genre] ?? "#5a4a38";
}

function movieGenres(m: HistoryMovie): string[] {
  const genres = m.genres_json ? (JSON.parse(m.genres_json) as string[]) : null;
  if (genres && genres.length > 0) return genres;
  if (m.type) return [m.type];
  return ["Outros"];
}

function buildGroups(movies: HistoryMovie[]): Map<string, HistoryMovie[]> {
  const groups = new Map<string, HistoryMovie[]>();
  for (const m of movies) {
    for (const genre of movieGenres(m)) {
      const list = groups.get(genre) ?? [];
      list.push(m);
      groups.set(genre, list);
    }
  }
  return groups;
}

function sortedGroups(groups: Map<string, HistoryMovie[]>, pinned: Set<string>): [string, HistoryMovie[]][] {
  return Array.from(groups.entries()).sort(([a], [b]) => {
    const ap = pinned.has(a) ? 0 : 1;
    const bp = pinned.has(b) ? 0 : 1;
    if (ap !== bp) return ap - bp;
    return a.localeCompare(b, "pt-BR");
  });
}

function isNewToday(movies: HistoryMovie[]): boolean {
  const todayStart = Math.floor(Date.now() / 86400000) * 86400;
  return movies.some((m) => (m.first_seen_at ?? 0) >= todayStart);
}

export default function SearchHistory({ refreshTrigger, watchlistIds, favoriteIds, onSelectMovie }: Props) {
  const [allMovies, setAllMovies] = useState<HistoryMovie[]>([]);
  const [loading, setLoading] = useState(true);
  const { pinned, toggle: togglePin } = usePinnedGenres();
  const [openGenre, setOpenGenre] = useState<string | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [isTilting, setIsTilting] = useState(false);
  const [showOnlyPinned, setShowOnlyPinned] = useState(false);
  const [selectedGenres, setSelectedGenres] = useState<Set<string>>(new Set());
  const touchStartX = useRef<number | null>(null);

  const fetchGenres = useCallback(() => {
    setLoading(true);
    fetch("/api/history/genres")
      .then((r) => r.json())
      .then((rows: HistoryMovie[]) => setAllMovies(rows))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchGenres(); }, [refreshTrigger, fetchGenres]);

  // Reset to first card when filter changes
  useEffect(() => { setActiveIdx(0); }, [showOnlyPinned, selectedGenres]);

  const navigate = useCallback((dir: 1 | -1, N: number) => {
    if (N <= 1) return;
    setActiveIdx((i) => ((i + dir) % N + N) % N);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // only fire if no input focused
      if (document.activeElement?.tagName === "INPUT") return;
      if (e.key === "ArrowLeft")  setActiveIdx((i) => ((i - 1 + 9999) % 9999)); // recalculated below
      if (e.key === "ArrowRight") setActiveIdx((i) => i + 1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleCenterMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: y * -14, y: x * 14 });
    setIsTilting(true);
  }, []);

  const handleCenterMouseLeave = useCallback(() => {
    setTilt({ x: 0, y: 0 });
    setIsTilting(false);
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent, N: number) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 48) navigate(dx < 0 ? 1 : -1, N);
    touchStartX.current = null;
  }, [navigate]);

  if (loading && allMovies.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <div className="h-3 w-20 bg-white/[0.05] rounded animate-pulse" />
        <div className="relative flex items-center justify-center" style={{ height: CARD_H + 48 }}>
          {[...Array(5)].map((_, i) => {
            const off = i - 2;
            const abs = Math.min(Math.abs(off), 3);
            const c = STAGE[abs];
            return (
              <div
                key={i}
                className="absolute rounded-2xl bg-white/[0.04] animate-pulse"
                style={{
                  width: CARD_W, height: CARD_H,
                  left: "50%", top: "50%",
                  marginLeft: -CARD_W / 2, marginTop: -CARD_H / 2,
                  transform: `translateX(${Math.sign(off) * c.tx}px) translateZ(${c.tz}px) scale(${c.s})`,
                  opacity: c.op,
                  zIndex: 30 - abs * 6,
                  animationDelay: `${i * 70}ms`,
                }}
              />
            );
          })}
        </div>
      </div>
    );
  }

  if (allMovies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[55vh] text-center select-none">
        <div className="text-8xl mb-6 opacity-10">🎬</div>
        <p className="text-[#5a4e46] text-lg">Pesquise um filme para começar</p>
        <p className="text-[#5a4e46]/60 text-sm mt-2">Ex: Memento, Inception, Interstellar</p>
      </div>
    );
  }

  const watchable = allMovies.filter((m) => isWatchable(m.type ? String(m.type) : null));
  const allGroups = sortedGroups(buildGroups(watchable), pinned);
  const pinnedGroups = allGroups.filter(([g]) => pinned.has(g));
  const groups = selectedGenres.size > 0
    ? allGroups.filter(([g]) => selectedGenres.has(g))
    : showOnlyPinned ? pinnedGroups : allGroups;

  const toggleGenre = (g: string) => {
    setSelectedGenres((prev) => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g); else next.add(g);
      return next;
    });
  };
  const N = groups.length;
  const actualActive = N > 0 ? ((activeIdx % N) + N) % N : 0;

  const openGenreMovies = openGenre ? (allGroups.find(([g]) => g === openGenre)?.[1] ?? []) : [];

  return (
    <>
      <div className="flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-[#9a8878] text-xs font-bold uppercase tracking-[0.2em] shrink-0">Explorado</h2>

          {/* Fixados badge */}
          {pinnedGroups.length > 0 && selectedGenres.size === 0 && (
            <button
              onClick={() => setShowOnlyPinned((v) => !v)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all duration-200 ${
                showOnlyPinned
                  ? "bg-[#d4845a] text-white shadow-sm shadow-[#d4845a]/30"
                  : "bg-white/[0.06] text-[#9a8878] hover:bg-white/[0.1] hover:text-[#f0e8dc]"
              }`}
            >
              <svg width="9" height="9" fill="currentColor" viewBox="0 0 24 24">
                <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
              </svg>
              Fixados
              <span className={`tabular-nums rounded-full px-1 text-[8px] leading-none py-0.5 ${
                showOnlyPinned ? "bg-white/20" : "bg-white/[0.08]"
              }`}>
                {pinnedGroups.length}
              </span>
            </button>
          )}

          {/* Genre filter dropdown */}
          <GenreMultiSelect
            genres={allGroups.map(([g]) => g)}
            selected={selectedGenres}
            onToggle={(g) => { toggleGenre(g); setShowOnlyPinned(false); }}
            onClear={() => setSelectedGenres(new Set())}
            label="Filtrar"
          />

          <span className="text-[#5a4e46] text-xs tabular-nums ml-auto shrink-0">
            {allMovies.length} título{allMovies.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Empty states */}
        {selectedGenres.size > 0 && N === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center select-none">
            <p className="text-[#5a4e46] text-sm">Nenhum gênero encontrado</p>
          </div>
        )}
        {selectedGenres.size === 0 && showOnlyPinned && pinnedGroups.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center select-none">
            <p className="text-[#5a4e46] text-sm">Nenhum gênero fixado</p>
            <p className="text-[#5a4e46]/60 text-xs mt-1">Passe o mouse num card e clique no pin</p>
          </div>
        )}

        {/* Coverflow stage */}
        {N > 0 && (
          <div
            className="relative select-none"
            style={{
              height: CARD_H + 48,
              perspective: "1100px",
              perspectiveOrigin: "50% 50%",
              overflow: "hidden",
            }}
            onTouchStart={handleTouchStart}
            onTouchEnd={(e) => handleTouchEnd(e, N)}
          >
            {groups.map(([genre, movies], i) => {
              const color = getGenreColor(genre);
              const offset = circularOffset(i, actualActive, N);
              const isCenter = offset === 0;
              const isPinned = pinned.has(genre);
              const isNew = isNewToday(movies);
              const coverMovie = movies.reduce((prev, cur) =>
                (cur.first_seen_at ?? 0) > (prev.first_seen_at ?? 0) ? cur : prev
              );
              const cardStyle = getCoverflowStyle(offset, tilt, isTilting);

              return (
                <div
                  key={genre}
                  className="absolute rounded-2xl overflow-hidden"
                  style={{
                    width: CARD_W,
                    height: CARD_H,
                    left: "50%",
                    top: "50%",
                    marginLeft: -CARD_W / 2,
                    marginTop: -CARD_H / 2,
                    ...cardStyle,
                    boxShadow: isCenter
                      ? `0 24px 60px rgba(0,0,0,0.75), 0 0 48px ${color}40, 0 0 0 1px rgba(255,255,255,0.13)`
                      : "0 8px 28px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.06)",
                  }}
                  onClick={() => {
                    if (!isCenter) { setActiveIdx(i); return; }
                    setOpenGenre(genre);
                  }}
                  onMouseMove={isCenter ? handleCenterMouseMove : undefined}
                  onMouseLeave={isCenter ? handleCenterMouseLeave : undefined}
                >
                  {/* Poster */}
                  {coverMovie.poster_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={coverMovie.poster_url}
                      alt={coverMovie.title}
                      className="absolute inset-0 w-full h-full object-cover"
                      style={{
                        transition: "transform 0.5s ease-out",
                        transform: isCenter ? "scale(1.04)" : "scale(1)",
                      }}
                      loading="lazy"
                    />
                  ) : (
                    <div className="absolute inset-0" style={{ background: color }} />
                  )}

                  {/* Color fade from bottom */}
                  <div
                    className="absolute inset-0"
                    style={{
                      background: `linear-gradient(to top, ${color}f5 0%, ${color}cc 22%, ${color}66 45%, transparent 65%)`,
                    }}
                  />

                  {/* Top vignette */}
                  <div
                    className="absolute inset-x-0 top-0 h-16 pointer-events-none"
                    style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.52) 0%, transparent 100%)" }}
                  />

                  {/* Top-right badges */}
                  <div className="absolute top-2.5 right-2.5 flex flex-col items-end gap-1.5">
                    {isNew && (
                      <span className="text-[7px] font-black uppercase tracking-widest bg-[#d4845a] text-white px-1.5 py-0.5 rounded-full leading-none shadow">
                        NEW
                      </span>
                    )}
                    {/* Pin badge — always visible if pinned, or on hover of center */}
                    {(isPinned || isCenter) && (
                      <button
                        onClick={(e) => { e.stopPropagation(); togglePin(genre); }}
                        className={`transition-all drop-shadow ${
                          isPinned ? "text-white opacity-100" : "text-white/40 hover:text-white"
                        }`}
                        aria-label={isPinned ? `Desafixar ${genre}` : `Fixar ${genre}`}
                        title={isPinned ? "Desafixar" : "Fixar gênero"}
                      >
                        <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24">
                          {isPinned ? (
                            <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
                          ) : (
                            <path d="M14 4v5.17l1.83 1.83H16v2h-5.17L9 11.17V4h5m3-2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2V4h1V2z" />
                          )}
                        </svg>
                      </button>
                    )}
                  </div>

                  {/* Bottom info */}
                  <div className="absolute bottom-0 left-0 right-0 p-3 pb-4">
                    <p className="text-white font-bold text-sm leading-tight" style={{ textShadow: "0 1px 6px rgba(0,0,0,0.7)" }}>
                      {genre}
                    </p>
                    <p className="text-white/55 text-[10px] mt-0.5 tabular-nums">
                      {movies.length} filme{movies.length !== 1 ? "s" : ""}
                    </p>
                  </div>

                  {/* Glass sheen on center */}
                  {isCenter && (
                    <div
                      className="absolute inset-0 pointer-events-none"
                      style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 55%)" }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Navigation */}
        {N > 1 && (
          <div className="flex items-center justify-center gap-6 mt-1">
            <button
              onClick={() => navigate(-1, N)}
              className="w-8 h-8 flex items-center justify-center rounded-full border border-white/[0.1] text-[#9a8878] hover:text-[#f0e8dc] hover:border-white/[0.2] transition-all"
            >
              <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24">
                <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
              </svg>
            </button>

            {/* Dot indicators — show max 9 dots, use condensed view beyond that */}
            <div className="flex items-center gap-1.5 max-w-[200px] overflow-hidden">
              {(N <= 12 ? groups : groups.slice(Math.max(0, actualActive - 4), actualActive + 5)).map(([genre], arrI) => {
                const realI = N <= 12 ? arrI : Math.max(0, actualActive - 4) + arrI;
                return (
                  <button
                    key={genre}
                    onClick={() => setActiveIdx(realI)}
                    className="rounded-full transition-all duration-300 shrink-0"
                    style={{
                      width: realI === actualActive ? 20 : 6,
                      height: 6,
                      background: realI === actualActive ? "#d4845a" : "rgba(255,255,255,0.15)",
                    }}
                    aria-label={`Ir para ${genre}`}
                  />
                );
              })}
            </div>

            <button
              onClick={() => navigate(1, N)}
              className="w-8 h-8 flex items-center justify-center rounded-full border border-white/[0.1] text-[#9a8878] hover:text-[#f0e8dc] hover:border-white/[0.2] transition-all"
            >
              <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24">
                <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {openGenre && (
        <GenreMoviesModal
          genre={openGenre}
          movies={openGenreMovies}
          watchlistIds={watchlistIds}
          favoriteIds={favoriteIds}
          onSelectMovie={(m) => { onSelectMovie(m); setOpenGenre(null); }}
          onClose={() => setOpenGenre(null)}
        />
      )}
    </>
  );
}
