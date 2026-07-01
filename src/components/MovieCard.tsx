"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Movie } from "@/types/imdb";

interface Props {
  movie: Movie;
  onClick: (movie: Movie) => void;
  saved?: boolean;
  favorited?: boolean;
}

export default function MovieCard({ movie, onClick, saved = false, favorited = false }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [shine, setShine] = useState({ x: 50, y: 50 });
  const [hovered, setHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: y * -14, y: x * 14 });
    setShine({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    });
  };

  const handleMouseEnter = () => setHovered(true);

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
    setHovered(false);
  };

  return (
    <div className="card-3d-wrap cursor-pointer" onClick={() => onClick(movie)}>
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && onClick(movie)}
        aria-label={`Ver detalhes de ${movie.title}`}
        className="relative aspect-[2/3] rounded-xl overflow-hidden"
        style={{
          transform: hovered
            ? `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale(1.06)`
            : "rotateX(0deg) rotateY(0deg) scale(1)",
          transition: hovered ? "transform 0.08s ease-out" : "transform 0.35s ease-out",
          transformStyle: "preserve-3d" as const,
          boxShadow: hovered
            ? "0 24px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.12)"
            : "0 4px 20px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05)",
        }}
      >
        {/* Poster */}
        <div className="absolute inset-0 bg-[#1e1a16]">
          {movie.poster ? (
            <Image
              src={movie.poster}
              alt={movie.title}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center p-3 text-center">
              <span className="text-[#5a4e46] text-xs leading-tight">{movie.title}</span>
            </div>
          )}
        </div>

        {/* Shine */}
        {hovered && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `radial-gradient(circle at ${shine.x}% ${shine.y}%, rgba(255,255,255,0.18) 0%, transparent 55%)`,
            }}
          />
        )}

        {/* Bottom gradient on hover */}
        {hovered && (
          <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/70 to-transparent" />
        )}

        {/* Favorite badge */}
        {favorited && (
          <div className="absolute top-2 left-2 bg-[#d4845a] rounded-full p-1 shadow-lg">
            <svg width="9" height="9" fill="white" viewBox="0 0 24 24">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          </div>
        )}

        {/* Saved badge */}
        {saved && (
          <div className="absolute top-2 right-2 bg-[#d4845a] rounded-full p-1 shadow-lg">
            <svg width="9" height="9" fill="white" viewBox="0 0 24 24">
              <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z" />
            </svg>
          </div>
        )}

        {/* Glass border */}
        <div className="absolute inset-0 rounded-xl border border-white/10 pointer-events-none" />
      </div>

      <div className="mt-2 px-0.5">
        <p className="text-xs font-medium text-[#f0e8dc] truncate leading-tight">{movie.title}</p>
        {movie.year && <p className="text-[10px] text-[#5a4e46] mt-0.5">{movie.year}</p>}
      </div>
    </div>
  );
}
