"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Image from "next/image";
import { Movie } from "@/types/imdb";
import { MovieDetail } from "@/lib/datasource";
import type { ListInfo } from "@/hooks/useLists";

interface FeaturedMovie {
  id: string;
  title: string;
  year?: number;
  poster?: string;
}

interface ListItemRow {
  imdb_id: string;
  title: string;
  year?: number;
  poster_url?: string;
}

interface Props {
  watchlistIds: Set<string>;
  lists: ListInfo[];
  onAddToList: (listId: number, movie: Movie, rating?: number) => Promise<void>;
  onRemoveFromList: (listId: number, imdbId: string) => Promise<void>;
  onCreateList: (name: string) => Promise<ListInfo | null>;
  onSelectMovie: (movie: Movie) => void;
  refreshTrigger: number;
}

export default function HeroSpotlight({ watchlistIds, lists, onAddToList, onRemoveFromList, onCreateList, onSelectMovie, refreshTrigger }: Props) {
  const [featured, setFeatured] = useState<FeaturedMovie | null>(null);
  const [detail, setDetail] = useState<MovieDetail | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const posterRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [shine, setShine] = useState({ x: 50, y: 50 });
  const [proximity, setProximity] = useState(0);

  const handleSectionMouseMove = useCallback((e: React.MouseEvent<HTMLElement>) => {
    if (!posterRef.current) return;
    const rect = posterRef.current.getBoundingClientRect();
    const cardCx = rect.left + rect.width / 2;
    const cardCy = rect.top + rect.height / 2;
    const dx = e.clientX - cardCx;
    const dy = e.clientY - cardCy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const maxDist = 320;
    const prox = Math.max(0, 1 - dist / maxDist);
    setProximity(prox);

    if (prox > 0) {
      const relX = (e.clientX - rect.left) / rect.width - 0.5;
      const relY = (e.clientY - rect.top) / rect.height - 0.5;
      setTilt({ x: relY * -20 * prox, y: relX * 20 * prox });
      setShine({
        x: Math.max(-20, Math.min(120, ((e.clientX - rect.left) / rect.width) * 100)),
        y: Math.max(-20, Math.min(120, ((e.clientY - rect.top) / rect.height) * 100)),
      });
    } else {
      setTilt({ x: 0, y: 0 });
    }
  }, []);

  const handleSectionMouseLeave = useCallback(() => {
    setTilt({ x: 0, y: 0 });
    setProximity(0);
  }, []);

  const fetchFeatured = useCallback(async () => {
    setLoading(true);
    try {
      const wlRes = await fetch("/api/lists/items");
      const wlItems: ListItemRow[] = await wlRes.json();
      if (wlItems.length > 0) {
        const w = wlItems[0];
        setFeatured({ id: w.imdb_id, title: w.title, year: w.year, poster: w.poster_url });
        return;
      }
      const favRes = await fetch("/api/favorites");
      const favorites: ListItemRow[] = await favRes.json();
      const f = favorites[0];
      setFeatured(f ? { id: f.imdb_id, title: f.title, year: f.year, poster: f.poster_url } : null);
    } catch {
      setFeatured(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchFeatured(); }, [refreshTrigger, fetchFeatured]);

  useEffect(() => {
    if (!featured) return;
    setDetail(null);
    fetch(`/api/movie/${featured.id}`)
      .then((r) => r.json())
      .then((d: MovieDetail & { error?: string }) => { if (!d.error) setDetail(d); })
      .catch(() => {});
  }, [featured?.id]);

  // Quick-save from the hero always targets the default (first-created) list — the modal's
  // list picker is the place to manage multiple lists per movie.
  const handleSave = useCallback(async () => {
    if (!featured) return;
    setSaving(true);
    const isSaved = watchlistIds.has(featured.id);
    try {
      const defaultList = lists[0] ?? (await onCreateList("Minha Lista"));
      if (!defaultList) return;
      const movie: Movie = { id: featured.id, title: detail?.title ?? featured.title, year: detail?.year ?? featured.year, poster: featured.poster };
      if (isSaved) {
        await onRemoveFromList(defaultList.id, featured.id);
      } else {
        await onAddToList(defaultList.id, movie, detail?.ratingValue);
      }
    } catch { /* noop */ } finally { setSaving(false); }
  }, [featured, watchlistIds, detail, lists, onAddToList, onRemoveFromList, onCreateList]);

  if (!loading && !featured) return null;

  if (loading || !featured) {
    return (
      <section className="relative -mt-[68px] h-screen w-full bg-[#0a0906] flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-start gap-4 px-16 w-full max-w-7xl">
          <div className="h-5 w-24 bg-white/[0.06] rounded" />
          <div className="h-4 w-48 bg-white/[0.06] rounded" />
          <div className="h-14 w-80 bg-white/[0.06] rounded" />
          <div className="h-4 w-64 bg-white/[0.06] rounded" />
          <div className="h-16 w-96 bg-white/[0.06] rounded" />
          <div className="flex gap-3 mt-2">
            <div className="h-10 w-28 bg-white/[0.06] rounded-xl" />
            <div className="h-10 w-28 bg-white/[0.06] rounded-xl" />
          </div>
        </div>
      </section>
    );
  }

  const isSaved = watchlistIds.has(featured.id);
  const title = detail?.title ?? featured.title;
  const year = detail?.year ?? featured.year;
  const genres = detail?.genres ?? [];
  const directors = detail?.directors ?? [];
  const actors = detail?.actors?.slice(0, 3) ?? [];
  const description = detail?.description;
  const duration = detail?.duration ? `${detail.duration}min` : null;

  return (
    <section
      className="relative -mt-[68px] h-screen w-full overflow-hidden"
      onMouseMove={handleSectionMouseMove}
      onMouseLeave={handleSectionMouseLeave}
    >
      {/* Blurred BG */}
      {featured.poster && (
        <div className="absolute inset-0 scale-110">
          <Image
            src={featured.poster}
            alt=""
            fill
            className="object-cover"
            style={{ filter: "blur(28px) brightness(0.18) saturate(0.7)" }}
            priority
            aria-hidden
          />
        </div>
      )}

      {/* Gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#0a0906]/98 via-[#0a0906]/70 to-[#0a0906]/20" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0a0906] via-transparent to-[#0a0906]/50" />

      {/* Noise on the hero */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)'/%3E%3C/svg%3E\")",
          opacity: 0.03,
        }}
      />

      {/* Content */}
      <div className="relative h-full flex items-center px-6 sm:px-12 lg:px-16 max-w-7xl mx-auto">
        <div className="flex-1 max-w-2xl flex flex-col gap-4">
          {/* Rating */}
          {detail?.ratingValue ? (
            <div className="flex items-center gap-2">
              <svg width="16" height="16" fill="#F5C518" viewBox="0 0 24 24">
                <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
              </svg>
              <span className="text-[#F5C518] font-bold text-xl">{detail.ratingValue.toFixed(1)}</span>
              <span className="text-[#5a4e46] text-sm">/10</span>
              {detail.voteCount && (
                <span className="text-[#5a4e46] text-xs">({detail.voteCount.toLocaleString("pt-BR")} votos)</span>
              )}
            </div>
          ) : (
            <div className="h-6 w-28 bg-white/[0.06] rounded animate-pulse" />
          )}

          {/* Genres */}
          {genres.length > 0 ? (
            <p className="text-[#9a8878] text-xs font-semibold uppercase tracking-[0.2em]">
              {genres.join(" · ")}
            </p>
          ) : (
            <div className="h-4 w-40 bg-white/[0.06] rounded animate-pulse" />
          )}

          {/* Title */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-[#f0e8dc] leading-none tracking-tight">
            {title}
          </h1>

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[#9a8878] text-sm">
            {year && <span>{year}</span>}
            {duration && <><span className="text-[#5a4e46]">·</span><span>{duration}</span></>}
            {directors.length > 0 && (
              <><span className="text-[#5a4e46]">·</span>
              <span><span className="text-[#5a4e46]">Dir.</span> {directors[0]}</span></>
            )}
            {actors.length > 0 && (
              <><span className="text-[#5a4e46]">·</span><span className="text-[#5a4e46]">{actors.join(", ")}</span></>
            )}
          </div>

          {/* Description */}
          {description ? (
            <p className="text-[#9a8878] text-sm leading-relaxed line-clamp-3 max-w-lg">{description}</p>
          ) : (
            <div className="flex flex-col gap-2 max-w-lg">
              {[...Array(3)].map((_, i) => (
                <div key={i} className={`h-3 bg-white/[0.06] rounded animate-pulse w-${["full","5/6","3/4"][i]}`} />
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-3 mt-2">
            <button
              onClick={() => onSelectMovie({ id: featured.id, title: featured.title, year: featured.year, poster: featured.poster })}
              className="flex items-center gap-2 bg-[#d4845a] hover:bg-[#e8956d] text-white font-bold px-6 py-2.5 rounded-xl transition-colors text-sm"
            >
              <svg width="14" height="14" fill="white" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
              Assistir
            </button>

            <button
              onClick={handleSave}
              disabled={saving}
              className={`flex items-center gap-2 font-semibold px-6 py-2.5 rounded-xl transition-all text-sm border disabled:opacity-50 ${
                isSaved
                  ? "bg-[#d4845a]/10 border-[#d4845a]/40 text-[#d4845a] hover:bg-[#d4845a]/20"
                  : "bg-white/[0.06] border-white/[0.1] text-[#f0e8dc] hover:bg-white/[0.12]"
              }`}
            >
              <svg width="13" height="13" fill="currentColor" viewBox="0 0 24 24">
                {isSaved ? (
                  <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z" />
                ) : (
                  <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2zm0 15l-5-2.18L7 18V5h10v13z" />
                )}
              </svg>
              {isSaved ? "Na lista" : "Salvar"}
            </button>
          </div>
        </div>

        {/* Poster card */}
        {featured.poster && (
          <div className="hidden lg:block ml-auto shrink-0" style={{ perspective: "900px" }}>
            <div
              ref={posterRef}
              className="relative w-52 xl:w-60 aspect-[2/3] rounded-3xl overflow-hidden"
              style={{
                transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale(${1 + proximity * 0.07})`,
                transition: proximity > 0.02
                  ? "transform 0.1s ease-out, box-shadow 0.1s ease-out"
                  : "transform 0.6s cubic-bezier(0.23,1,0.32,1), box-shadow 0.6s cubic-bezier(0.23,1,0.32,1)",
                transformStyle: "preserve-3d",
                boxShadow: `0 ${30 + proximity * 40}px ${80 + proximity * 60}px rgba(0,0,0,${0.65 + proximity * 0.25}), 0 0 ${proximity * 40}px rgba(212,132,90,${proximity * 0.15})`,
                border: "1px solid rgba(255,255,255,0.1)",
                willChange: "transform",
              }}
            >
              <Image src={featured.poster} alt={title} fill className="object-cover" sizes="240px" priority />

              {/* Shine overlay */}
              <div
                className="absolute inset-0 pointer-events-none rounded-3xl"
                style={{
                  background: `radial-gradient(circle at ${shine.x}% ${shine.y}%, rgba(255,255,255,${0.18 * proximity}) 0%, transparent 55%)`,
                  opacity: proximity,
                  transition: proximity > 0.02 ? "none" : "opacity 0.6s ease-out",
                }}
              />

              {/* Permanent glass sheen */}
              <div
                className="absolute inset-0 rounded-3xl pointer-events-none"
                style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.06) 0%, transparent 50%)" }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-[#5a4e46] animate-bounce">
        <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
          <path d="M7 10l5 5 5-5z" />
        </svg>
      </div>
    </section>
  );
}
