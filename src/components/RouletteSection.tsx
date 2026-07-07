"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Movie } from "@/types/imdb";
import GenreMultiSelect from "@/components/GenreMultiSelect";
import DurationSelect from "@/components/DurationSelect";
import { DurationBucket, durationBucketRange } from "@/lib/duration";

interface RouletteMovie {
  imdb_id: string;
  title: string;
  year: number | null;
  poster_url: string | null;
  type: string | null;
}

interface Props {
  onSelectMovie: (movie: Movie) => void;
}

export default function RouletteSection({ onSelectMovie }: Props) {
  const [genres, setGenres] = useState<string[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<Set<string>>(new Set());
  const [durationBucket, setDurationBucket] = useState<DurationBucket>("any");
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<RouletteMovie | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wheelRef = useRef<HTMLDivElement>(null);
  const rotationRef = useRef(0);

  useEffect(() => {
    fetch("/api/roulette/genres")
      .then((r) => r.json())
      .then((g: string[]) => setGenres(g))
      .catch(() => {});
  }, []);

  // Close modal on Escape + lock scroll while open
  useEffect(() => {
    if (!showModal) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") setShowModal(false); };
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [showModal]);

  const toggleGenre = (g: string) => {
    setSelectedGenres((prev) => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g); else next.add(g);
      return next;
    });
  };

  const spin = async () => {
    if (spinning) return;
    setSpinning(true);
    setResult(null);
    setShowModal(false);
    setError(null);

    const params = new URLSearchParams();
    if (selectedGenres.size > 0) params.set("genres", Array.from(selectedGenres).join(","));
    const { min, max } = durationBucketRange(durationBucket);
    if (min !== undefined) params.set("minDuration", String(min));
    if (max !== undefined) params.set("maxDuration", String(max));
    const query = params.toString();
    const url = query ? `/api/roulette?${query}` : "/api/roulette";
    const hasFilter = selectedGenres.size > 0 || durationBucket !== "any";

    // Animate wheel
    const extraSpins = 5 + Math.random() * 3;
    const targetRotation = rotationRef.current + extraSpins * 360 + Math.random() * 360;
    const startRotation = rotationRef.current;
    const duration = 3000 + Math.random() * 400;
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      rotationRef.current = startRotation + (targetRotation - startRotation) * eased;
      if (wheelRef.current) {
        wheelRef.current.style.transform = `rotate(${rotationRef.current}deg)`;
      }
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);

    const [movie] = await Promise.all([
      fetch(url).then((r) => r.json()).catch(() => null),
      new Promise((res) => setTimeout(res, 3300)),
    ]);

    setSpinning(false);

    if (!movie || movie.error) {
      setError(
        hasFilter
          ? `Nenhum filme encontrado com esses filtros.`
          : "Banco vazio. Pesquise alguns filmes primeiro."
      );
      return;
    }

    setResult(movie);
    setShowModal(true);
  };

  const movie: Movie | null = result
    ? { id: result.imdb_id, title: result.title, year: result.year ?? undefined, poster: result.poster_url ?? undefined, type: result.type ?? undefined }
    : null;

  return (
    <div className="mt-12 mb-8">
      {/* Section divider */}
      <div className="flex items-center gap-3 mb-8">
        <div className="h-px flex-1 bg-white/[0.06]" />
        <div className="flex items-center gap-2">
          <svg width="13" height="13" className="text-[#d4845a]" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-13a5 5 0 100 10 5 5 0 000-10zm0 7a2 2 0 110-4 2 2 0 010 4z" />
          </svg>
          <h2 className="text-[#9a8878] text-xs font-bold uppercase tracking-[0.2em]">Roleta</h2>
        </div>
        <div className="h-px flex-1 bg-white/[0.06]" />
      </div>

      {/* Panel */}
      <div
        className="rounded-3xl px-6 py-10 sm:px-8 sm:py-12 flex flex-col items-center text-center"
        style={{
          background: "radial-gradient(120% 120% at 50% 0%, rgba(212,132,90,0.08) 0%, rgba(255,255,255,0.03) 38%, rgba(255,255,255,0.02) 100%)",
          border: "1px solid rgba(255,255,255,0.07)",
          backdropFilter: "blur(12px)",
        }}
      >
        <h3 className="text-[#f0e8dc] font-black text-xl sm:text-2xl">Não sabe o que assistir?</h3>
        <p className="text-[#9a8878] text-sm mt-2 max-w-xs">
          Gire a roleta e deixe a sorte escolher. Filtre por gênero ou vá no escuro.
        </p>

        {/* Filters */}
        {genres.length > 0 && (
          <div className="mt-6 flex items-center gap-2 flex-wrap justify-center">
            <GenreMultiSelect
              genres={genres}
              selected={selectedGenres}
              onToggle={toggleGenre}
              onClear={() => setSelectedGenres(new Set())}
              label="Gêneros"
            />
            <DurationSelect value={durationBucket} onChange={setDurationBucket} />
          </div>
        )}

        {/* Wheel */}
        <div className="relative mt-9 mb-2">
          {/* Glow ring */}
          <div
            className={`absolute inset-0 rounded-full blur-2xl pointer-events-none ${spinning ? "roulette-glow" : ""}`}
            style={{ background: "radial-gradient(circle, rgba(212,132,90,0.4) 0%, transparent 70%)", transform: "scale(1.15)" }}
          />
          {/* Pointer */}
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 z-10" style={{ filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.5))" }}>
            <div
              style={{
                width: 0, height: 0,
                borderLeft: "9px solid transparent",
                borderRight: "9px solid transparent",
                borderTop: "16px solid #d4845a",
              }}
            />
          </div>
          <div
            className="relative w-52 h-52 sm:w-56 sm:h-56 cursor-pointer select-none"
            onClick={!spinning ? spin : undefined}
            style={{ filter: spinning ? "brightness(1.12)" : "brightness(1)", transition: "filter 0.3s ease" }}
          >
            <div ref={wheelRef} className="w-full h-full" style={{ transformOrigin: "center center" }}>
              <Image src="/wheel.png" alt="Roleta" fill className="object-contain" sizes="224px" />
            </div>
          </div>
        </div>

        {/* Spin button */}
        <button
          onClick={spin}
          disabled={spinning}
          className="mt-6 flex items-center gap-2 px-7 py-2.5 bg-[#d4845a] hover:bg-[#e8956d] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-full text-sm transition-colors shadow-lg shadow-[#d4845a]/20"
        >
          {spinning ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              Girando...
            </>
          ) : (
            <>
              <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" />
              </svg>
              {result ? "Girar de novo" : "Girar"}
            </>
          )}
        </button>

        {/* Inline error */}
        {error && <p className="text-[#5a4e46] text-sm mt-5">{error}</p>}
      </div>

      {/* Result modal */}
      {showModal && movie && (
        <div
          className="roulette-backdrop fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
          onClick={() => setShowModal(false)}
        >
          <div
            className="roulette-pop relative w-full max-w-xs rounded-3xl overflow-hidden"
            style={{
              background: "linear-gradient(160deg, rgba(30,26,22,0.98) 0%, rgba(20,18,14,0.98) 100%)",
              border: "1px solid rgba(255,255,255,0.09)",
              boxShadow: "0 40px 100px rgba(0,0,0,0.8), 0 0 60px rgba(212,132,90,0.15)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close */}
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-black/40 hover:bg-black/60 text-white/70 hover:text-white transition-colors"
            >
              <svg width="15" height="15" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
              </svg>
            </button>

            <div className="flex flex-col items-center pt-7 px-6 pb-6">
              <p className="text-[#d4845a] text-[11px] font-bold uppercase tracking-[0.25em]">A roleta escolheu</p>

              {/* Poster with glow */}
              <div className="relative mt-5">
                <div
                  className="roulette-glow absolute inset-0 rounded-2xl blur-xl pointer-events-none"
                  style={{ background: "radial-gradient(circle, rgba(212,132,90,0.5) 0%, transparent 70%)", transform: "scale(1.1)" }}
                />
                <div
                  className="roulette-poster relative w-40 aspect-[2/3] rounded-2xl overflow-hidden"
                  style={{ boxShadow: "0 16px 50px rgba(0,0,0,0.7)", border: "1px solid rgba(255,255,255,0.12)" }}
                >
                  {movie.poster ? (
                    <Image src={movie.poster} alt={movie.title} fill className="object-cover" sizes="160px" />
                  ) : (
                    <div className="w-full h-full bg-[#1e1a16] flex items-center justify-center p-3">
                      <span className="text-[#5a4e46] text-xs text-center">{movie.title}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Title */}
              <h3 className="text-[#f0e8dc] font-black text-lg leading-tight mt-5 text-center">{movie.title}</h3>
              <div className="flex items-center gap-2 mt-1.5 text-[#9a8878] text-xs">
                {movie.year && <span className="tabular-nums">{movie.year}</span>}
                {movie.year && movie.type && <span className="text-[#5a4e46]">·</span>}
                {movie.type && <span className="capitalize">{movie.type}</span>}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 mt-6 w-full">
                <button
                  onClick={() => { onSelectMovie(movie); setShowModal(false); }}
                  className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#d4845a] hover:bg-[#e8956d] text-white text-xs font-bold rounded-xl transition-colors"
                >
                  <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  Ver detalhes
                </button>
                <button
                  onClick={() => { setShowModal(false); spin(); }}
                  className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-white/[0.07] hover:bg-white/[0.12] text-[#f0e8dc] text-xs font-medium rounded-xl transition-colors border border-white/[0.08]"
                >
                  <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" />
                  </svg>
                  De novo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
