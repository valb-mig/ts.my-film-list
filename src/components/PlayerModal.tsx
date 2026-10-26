"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SubtitleResult } from "@/lib/scrapers/types";
import { parseSrt, withoutAds, cueAt, nextCueIndex, type Cue } from "@/lib/srt";
import { PlayerClock } from "@/lib/playerClock";
import { clampScale } from "@/lib/subtitleStyle";
import { isTvMode } from "@/lib/tvMode";
import { useSubtitleStyle } from "@/hooks/useSubtitleStyle";
import SubtitleLayer from "./SubtitleLayer";
import {
  applyMark,
  loadSync,
  nudge,
  saveSync,
  toSubtitleTime,
  NO_SYNC,
  type SubtitleSync,
} from "@/lib/subtitleSync";

interface Props {
  title: string;
  label: string;
  embedUrl: string;
  subtitles: SubtitleResult[];
  onClose: () => void;
}

interface SubtitleOption {
  url: string;
  lang: string;
  label: string;
}

function subtitleOptions(subtitles: SubtitleResult[]): SubtitleOption[] {
  const multiple = subtitles.length > 1;
  return subtitles.flatMap((s) =>
    s.files.map((f) => ({
      url: f.url,
      lang: f.lang,
      label: multiple ? `${f.lang.toUpperCase()} · ${s.release}` : f.lang.toUpperCase(),
    }))
  );
}

function formatSeconds(seconds: number): string {
  const v = Math.round(seconds * 10) / 10;
  return `${v > 0 ? "+" : ""}${v.toFixed(1).replace(".", ",")}s`;
}

const SAMPLE_TEXT = "Arraste a legenda\npra onde quiser";

const barButton =
  "px-2.5 h-7 rounded-lg text-xs font-medium text-[#9a8878] hover:text-[#f0e8dc] bg-white/[0.06] hover:bg-white/[0.12] transition-colors disabled:opacity-40 outline-none focus:ring-2 focus:ring-[#d4845a] focus:text-[#f0e8dc]";

export default function PlayerModal({ title, label, embedUrl, subtitles, onClose }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const clockRef = useRef(new PlayerClock());

  const [style, updateStyle] = useSubtitleStyle();
  const options = useMemo(() => subtitleOptions(subtitles), [subtitles]);
  // null = no explicit choice yet (follow the preferred language), "" = subtitles off.
  const [choice, setChoice] = useState<string | null>(null);
  const defaultUrl = style.lang ? (options.find((o) => o.lang === style.lang) ?? options[0])?.url ?? "" : "";
  const selectedUrl = choice ?? defaultUrl;

  const [cues, setCues] = useState<Cue[] | null>(null);
  const [cueStatus, setCueStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [sync, setSync] = useState<SubtitleSync>(NO_SYNC);
  const [text, setText] = useState("");
  const [cursorVisible, setCursorVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  // Index of the cue offered for "sync by line", while that panel is open.
  const [marking, setMarking] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  // "Mover" mode: the subtitle can be dragged/resized; clicks don't reach the player meanwhile.
  const [editing, setEditing] = useState(false);
  // Inside the projector hub: no header, the video fills the screen, no drag (remote has no mouse drag).
  const [tv] = useState(isTvMode);
  // The bar normally follows the player's cursor; with a remote there's no cursor, so key presses
  // (and focus inside the bar) keep it up too.
  const [keyAwake, setKeyAwake] = useState(tv);
  const [barFocused, setBarFocused] = useState(false);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (editing) setEditing(false);
      // In fullscreen, Escape just leaves fullscreen.
      else if (!document.fullscreenElement) onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose, editing]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const wake = () => {
      setKeyAwake(true);
      clearTimeout(timer);
      timer = setTimeout(() => setKeyAwake(false), 5000);
    };
    // Capture phase on window: the hub's TV-mode script stops arrow keys from propagating further.
    window.addEventListener("keydown", wake, true);
    // On a TV the bar starts visible (so you see the subtitle controls exist), then hides itself.
    if (tv) wake();
    return () => {
      window.removeEventListener("keydown", wake, true);
      clearTimeout(timer);
    };
  }, [tv]);

  useEffect(() => {
    const handleChange = () => setIsFullscreen(document.fullscreenElement === stageRef.current);
    document.addEventListener("fullscreenchange", handleChange);
    return () => document.removeEventListener("fullscreenchange", handleChange);
  }, []);

  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.source !== iframeRef.current?.contentWindow) return;
      clockRef.current.handle(e.data);
      const type = (e.data as { type?: unknown } | null)?.type;
      if (type === "CURSOR_SHOW") setCursorVisible(true);
      if (type === "CURSOR_HIDE") setCursorVisible(false);
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  useEffect(() => {
    setCues(null);
    setMarking(null);
    setEditing(false);
    setText("");
    if (!selectedUrl) {
      setCueStatus("idle");
      return;
    }
    setSync(loadSync(selectedUrl));
    setCueStatus("loading");
    let cancelled = false;
    fetch(`/api/subtitles/file?url=${encodeURIComponent(selectedUrl)}`)
      .then((r) => {
        if (!r.ok) throw new Error(`subtitle fetch failed: ${r.status}`);
        return r.text();
      })
      .then((srt) => {
        if (cancelled) return;
        const parsed = withoutAds(parseSrt(srt));
        setCues(parsed);
        setCueStatus(parsed.length > 0 ? "ready" : "error");
      })
      .catch(() => { if (!cancelled) setCueStatus("error"); });
    return () => { cancelled = true; };
  }, [selectedUrl]);

  useEffect(() => {
    if (!cues) return;
    const id = setInterval(() => {
      const now = clockRef.current.now();
      setText(now === null ? "" : cueAt(cues, toSubtitleTime(sync, now))?.text ?? "");
    }, 100);
    return () => clearInterval(id);
  }, [cues, sync]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(id);
  }, [toast]);

  const updateSync = useCallback((next: SubtitleSync) => {
    setSync(next);
    saveSync(selectedUrl, next);
  }, [selectedUrl]);

  const startMarking = () => {
    if (!cues?.length) return;
    const now = clockRef.current.now();
    if (now === null) {
      setToast("O player ainda não informou o tempo. Dê play primeiro.");
      return;
    }
    setMarking(nextCueIndex(cues, toSubtitleTime(sync, now)));
  };

  const confirmMark = () => {
    if (!cues || marking === null) return;
    const now = clockRef.current.now();
    if (now === null) {
      setToast("O player ainda não informou o tempo. Dê play primeiro.");
      return;
    }
    const next = applyMark(sync, cues[marking].start, now);
    updateSync(next);
    setMarking(null);
    setToast(
      next.scale !== sync.scale
        ? "Sincronizado — velocidade da legenda corrigida (diferença de FPS)"
        : "Sincronizado"
    );
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else stageRef.current?.requestFullscreen().catch(() => {});
  };

  const showBar = cursorVisible || keyAwake || barFocused || marking !== null || toast !== null || editing;

  return (
    <div data-tv-layer className="fixed inset-0 z-[60] flex flex-col bg-black/95 backdrop-blur-lg">
      <div className={`flex items-center gap-3 px-4 py-3 ${tv ? "hidden" : ""}`}>
        <div className="flex-1 min-w-0">
          <p className="text-[#f0e8dc] font-bold text-sm truncate">{title}</p>
          <p className="text-[#5a4e46] text-xs">{label}</p>
        </div>
        <a
          href={embedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#5a4e46] hover:text-[#9a8878] text-xs transition-colors"
        >
          Abrir em nova aba ↗
        </a>
        <button
          onClick={onClose}
          className="p-2 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-[#9a8878] hover:text-[#f0e8dc] transition-colors"
          aria-label="Fechar player"
        >
          <svg width="15" height="15" fill="currentColor" viewBox="0 0 24 24">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
          </svg>
        </button>
      </div>

      <div className={`flex-1 min-h-0 flex items-center justify-center ${tv ? "" : "px-4 pb-4"}`}>
        <div
          ref={stageRef}
          className={`relative w-full max-h-full aspect-video overflow-hidden bg-black [container-type:inline-size] [&:fullscreen]:rounded-none [&:fullscreen]:border-0 ${
            tv ? "max-w-[calc(100vh*16/9)]" : "max-w-[calc((100vh-6rem)*16/9)] rounded-2xl border border-white/[0.06]"
          }`}
        >
          {/* No sandbox: the player refuses to load inside a sandboxed frame — popups it opens are
              closed by extensions/firefox-popup-closer. No fullscreen either: the player's own
              fullscreen would hide our subtitle overlay, so fullscreen goes through the stage. */}
          <iframe
            ref={iframeRef}
            src={embedUrl}
            className="w-full h-full"
            allow="autoplay; picture-in-picture; encrypted-media"
          />

          <SubtitleLayer
            text={editing ? text || SAMPLE_TEXT : text}
            style={style}
            raised={cursorVisible}
            editing={editing}
            onMove={(position) => updateStyle({ position })}
            onScaleStep={(delta) => updateStyle({ scale: clampScale(style.scale + delta) })}
          />

          {/* Only the panels themselves take clicks — the strip around them stays clickable for the player. */}
          <div
            className={`pointer-events-none absolute top-3 inset-x-3 flex flex-col items-center gap-2 transition-opacity duration-200 ${
              showBar ? "opacity-100 [&>*]:pointer-events-auto" : "opacity-0"
            } ${tv ? "[zoom:1.8]" : ""}`}
            onFocus={() => setBarFocused(true)}
            onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setBarFocused(false); }}
          >
            <div className="flex items-center gap-1.5 flex-wrap justify-center rounded-xl px-2 py-1.5 bg-black/75 backdrop-blur border border-white/[0.08]">
              <select
                value={selectedUrl}
                onChange={(e) => setChoice(e.target.value)}
                aria-label="Legenda"
                className="h-7 max-w-[14rem] truncate rounded-lg px-2 text-xs font-medium bg-white/[0.06] text-[#f0e8dc] border border-white/[0.08] outline-none cursor-pointer focus:ring-2 focus:ring-[#d4845a]"
                style={{ colorScheme: "dark" }}
              >
                {options.length === 0 && <option value="">Sem legenda</option>}
                {options.map((o) => (
                  <option key={o.url} value={o.url}>Legenda {o.label}</option>
                ))}
                {options.length > 0 && <option value="">Legenda desligada</option>}
              </select>

              {cueStatus === "loading" && <span className="text-[#9a8878] text-xs px-1">Carregando…</span>}
              {cueStatus === "error" && <span className="text-[#d4845a] text-xs px-1">Não consegui carregar</span>}

              {cueStatus === "ready" && (
                <>
                  <button
                    onClick={() => updateSync(nudge(sync, -0.5))}
                    className={barButton}
                    title="Legenda aparece meio segundo mais cedo"
                  >
                    −0,5s
                  </button>
                  <span className="text-[#f0e8dc] text-xs tabular-nums w-12 text-center" title="Atraso da legenda">
                    {formatSeconds(sync.offset)}
                  </span>
                  <button
                    onClick={() => updateSync(nudge(sync, 0.5))}
                    className={barButton}
                    title="Legenda aparece meio segundo mais tarde"
                  >
                    +0,5s
                  </button>
                  <button onClick={startMarking} className={barButton}>Sincronizar pela fala</button>
                  {(sync.offset !== 0 || sync.scale !== 1) && (
                    <button onClick={() => updateSync(NO_SYNC)} className={barButton} title="Desfazer ajustes">
                      Zerar
                    </button>
                  )}

                  <span className="w-px h-4 bg-white/[0.12] mx-0.5" />

                  <button
                    onClick={() => updateStyle({ scale: clampScale(style.scale - 0.1) })}
                    className={barButton}
                    aria-label="Diminuir legenda"
                  >
                    A−
                  </button>
                  <span className="text-[#f0e8dc] text-xs tabular-nums w-10 text-center" title="Tamanho da legenda">
                    {Math.round(style.scale * 100)}%
                  </span>
                  <button
                    onClick={() => updateStyle({ scale: clampScale(style.scale + 0.1) })}
                    className={barButton}
                    aria-label="Aumentar legenda"
                  >
                    A+
                  </button>
                  {!tv && (
                    <button
                      onClick={() => setEditing((e) => !e)}
                      className={`${barButton} ${editing ? "!bg-[#d4845a] !text-white" : ""}`}
                      title="Arrastar a legenda pra qualquer lugar do vídeo"
                    >
                      {editing ? "Pronto" : "Mover"}
                    </button>
                  )}
                </>
              )}

              <button
                onClick={toggleFullscreen}
                className={barButton}
                aria-label={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
              >
                <svg width="13" height="13" fill="currentColor" viewBox="0 0 24 24">
                  {isFullscreen ? (
                    <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
                  ) : (
                    <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
                  )}
                </svg>
              </button>
            </div>

            {marking !== null && cues && (
              <div className="flex flex-col items-center gap-2 max-w-xl rounded-xl px-4 py-3 bg-black/85 backdrop-blur border border-[#d4845a]/40">
                <p className="text-[#9a8878] text-[11px]">Clique em <b className="text-[#f0e8dc]">Agora!</b> quando ouvir esta fala:</p>
                <p className="text-[#f0e8dc] text-sm text-center whitespace-pre-line">“{cues[marking].text}”</p>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setMarking((i) => Math.max(0, (i ?? 0) - 1))}
                    className={barButton}
                    aria-label="Fala anterior"
                  >
                    ‹
                  </button>
                  <button
                    onClick={confirmMark}
                    className="px-4 h-8 rounded-lg text-sm font-bold bg-[#d4845a] hover:bg-[#c07448] text-white transition-colors outline-none focus:ring-2 focus:ring-[#f0e8dc]"
                  >
                    Agora!
                  </button>
                  <button
                    onClick={() => setMarking((i) => Math.min(cues.length - 1, (i ?? 0) + 1))}
                    className={barButton}
                    aria-label="Próxima fala"
                  >
                    ›
                  </button>
                  <button onClick={() => setMarking(null)} className={barButton}>Cancelar</button>
                </div>
              </div>
            )}

            {editing && (
              <div className="flex items-center gap-2 rounded-xl px-3 py-2 bg-black/85 backdrop-blur border border-[#d4845a]/40">
                <p className="text-[#9a8878] text-xs">
                  Arraste a legenda pra qualquer lugar · roda do mouse muda o tamanho
                </p>
                <button onClick={() => updateStyle({ position: null })} className={barButton}>Posição padrão</button>
              </div>
            )}

            {toast && (
              <p className="rounded-lg px-3 py-1.5 bg-black/85 text-[#f0e8dc] text-xs border border-white/[0.08]">{toast}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
