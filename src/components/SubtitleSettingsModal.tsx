"use client";

import { useEffect } from "react";
import { useSubtitleStyle } from "@/hooks/useSubtitleStyle";
import {
  DEFAULT_SUBTITLE_STYLE,
  MAX_SCALE,
  MIN_SCALE,
  SUBTITLE_COLORS,
  type SubtitleStyle,
} from "@/lib/subtitleStyle";
import SubtitleLayer from "./SubtitleLayer";

interface Props {
  open: boolean;
  onClose: () => void;
}

const PREVIEW_TEXT = "Essa é a sua legenda.\nArraste pra mudar a posição.";

const LANGS: { value: string; label: string }[] = [
  { value: "pt-BR", label: "PT-BR" },
  { value: "en", label: "EN" },
  { value: "", label: "Desligada" },
];

function Choice<T extends string | boolean>({
  value, current, onSelect, children,
}: { value: T; current: T; onSelect: (v: T) => void; children: React.ReactNode }) {
  const active = value === current;
  return (
    <button
      onClick={() => onSelect(value)}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
        active
          ? "bg-[#d4845a] text-white"
          : "bg-white/[0.05] text-[#9a8878] hover:text-[#f0e8dc] border border-white/[0.08]"
      }`}
    >
      {children}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <p className="text-[#9a8878] text-xs">{label}</p>
      <div className="flex items-center gap-1.5">{children}</div>
    </div>
  );
}

export default function SubtitleSettingsModal({ open, onClose }: Props) {
  const [style, updateStyle] = useSubtitleStyle();

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", handleKey); document.body.style.overflow = ""; };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-lg"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-5 flex flex-col gap-5"
        style={{
          background: "linear-gradient(135deg, rgba(26,22,18,0.98) 0%, rgba(14,12,10,0.98) 100%)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 40px 100px rgba(0,0,0,0.9)",
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[#f0e8dc] font-black text-xl">Legendas</h2>
            <p className="text-[#5a4e46] text-xs mt-1">
              Padrão do player. O que você ajustar dentro do player também fica salvo aqui.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-[#9a8878] hover:text-[#f0e8dc] transition-colors"
            aria-label="Fechar"
          >
            <svg width="15" height="15" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </div>

        <div
          className="relative aspect-video rounded-2xl overflow-hidden border border-white/[0.06] [container-type:inline-size]"
          style={{
            background:
              "radial-gradient(ellipse at 30% 35%, rgba(212,132,90,0.35), transparent 55%), radial-gradient(ellipse at 75% 70%, rgba(90,110,140,0.35), transparent 60%), #14110d",
          }}
        >
          <SubtitleLayer
            text={PREVIEW_TEXT}
            style={style}
            editing
            onMove={(position) => updateStyle({ position })}
          />
        </div>

        <div className="flex flex-col gap-4">
          <Field label="Idioma ao abrir o player">
            {LANGS.map((l) => (
              <Choice key={l.value} value={l.value} current={style.lang} onSelect={(lang) => updateStyle({ lang })}>
                {l.label}
              </Choice>
            ))}
          </Field>

          <Field label="Tamanho">
            <input
              type="range"
              min={MIN_SCALE * 100}
              max={MAX_SCALE * 100}
              step={10}
              value={Math.round(style.scale * 100)}
              onChange={(e) => updateStyle({ scale: Number(e.target.value) / 100 })}
              className="w-36 accent-[#d4845a] cursor-pointer"
              aria-label="Tamanho da legenda"
            />
            <span className="text-[#f0e8dc] text-xs tabular-nums w-10 text-right">{Math.round(style.scale * 100)}%</span>
          </Field>

          <Field label="Cor">
            {(Object.keys(SUBTITLE_COLORS) as SubtitleStyle["color"][]).map((c) => (
              <Choice key={c} value={c} current={style.color} onSelect={(color) => updateStyle({ color })}>
                <span className="w-3 h-3 rounded-full border border-black/40" style={{ background: SUBTITLE_COLORS[c] }} />
                {c === "white" ? "Branca" : "Amarela"}
              </Choice>
            ))}
          </Field>

          <Field label="Fundo">
            <Choice value={false} current={style.background} onSelect={(background) => updateStyle({ background })}>
              Contorno
            </Choice>
            <Choice value={true} current={style.background} onSelect={(background) => updateStyle({ background })}>
              Caixa escura
            </Choice>
          </Field>

          <Field label="Posição">
            <span className="text-[#5a4e46] text-xs">
              {style.position ? "Personalizada" : "Padrão (embaixo, centralizada)"}
            </span>
            {style.position && (
              <button
                onClick={() => updateStyle({ position: null })}
                className="px-3 py-1.5 rounded-xl text-xs font-medium bg-white/[0.05] text-[#9a8878] hover:text-[#f0e8dc] border border-white/[0.08] transition-colors"
              >
                Voltar ao padrão
              </button>
            )}
          </Field>
        </div>

        <button
          onClick={() => updateStyle(DEFAULT_SUBTITLE_STYLE)}
          className="self-start text-[#5a4e46] hover:text-[#9a8878] text-xs transition-colors"
        >
          Restaurar tudo pro padrão
        </button>
      </div>
    </div>
  );
}
