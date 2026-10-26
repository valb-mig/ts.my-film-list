"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import type { SubtitleResult } from "@/lib/scrapers/types";
import { parseSrt, withoutAds, cueAt, nextCueIndex, type Cue } from "@/lib/srt";
import { PlayerClock } from "@/lib/playerClock";
import { clampScale } from "@/lib/subtitleStyle";
import { isTvMode } from "@/lib/tvMode";
import { focusElement } from "@/lib/tvNav";
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
  // null while there's no source to show — still `searching` for one, or none found; `status`
  // is the message shown in its place.
  embedUrl: string | null;
  searching?: boolean;
  status?: string;
  subtitles: SubtitleResult[];
  // Gets how much was watched (0–1), or null if the player never reported it.
  onClose: (progress: number | null) => void;
  // Where to rate this title (e.g. its Letterboxd page) — offered once the credits roll.
  rateUrl?: string;
  // Series: the episode after this one — offered during the credits, played after a countdown.
  next?: { label: string; name?: string; still?: string; onPlay: () => void };
  // Shown beside the video when not in theater mode (details, saving, recommendations).
  aside?: React.ReactNode;
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

// Next-episode card: shows when this little is left (the credits), then counts down to autoplay.
const NEXT_UP_AT_S = 45;
const NEXT_UP_COUNTDOWN_S = 10;

// Theater mode (the video fills the window, everything else black) is the default and sticks.
const THEATER_KEY = "playerTheater";
// The bar hides after the mouse rests this long outside it…
const IDLE_MS = 2500;
// …or this long after the player hides its own cursor (mouse resting over the video).
const AFTER_PLAYER_IDLE_MS = 1500;

function loadTheater(): boolean {
  try {
    return localStorage.getItem(THEATER_KEY) !== "0";
  } catch {
    return true;
  }
}

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
}

const barButton =
  "px-2.5 h-7 rounded-lg text-xs font-medium text-[#9a8878] hover:text-[#f0e8dc] bg-white/[0.06] hover:bg-white/[0.12] transition-colors disabled:opacity-40 outline-none focus:ring-2 focus:ring-[#d4845a] focus:text-[#f0e8dc]";

export default function PlayerModal({
  title, label, embedUrl, searching = false, status, subtitles, onClose, rateUrl, next, aside,
}: Props) {
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
  const [theater, setTheater] = useState(loadTheater);
  // Video alone on screen: theater mode, or always on a TV.
  const wide = tv || theater;
  const [barFocused, setBarFocused] = useState(false);
  // Past the credits: offer rating it (until dismissed).
  const [nearEnd, setNearEnd] = useState(false);
  const [rateDismissed, setRateDismissed] = useState(false);
  const close = useCallback(() => onClose(clockRef.current.progress()), [onClose]);

  // Seconds left on the next-episode countdown; null while the card is hidden.
  const [nextUp, setNextUp] = useState<number | null>(null);
  const nextDismissed = useRef(false);
  const nextFired = useRef(false);
  const nextRef = useRef(next);
  nextRef.current = next;
  const nextButtonRef = useRef<HTMLButtonElement>(null);
  const hasNext = Boolean(next);

  useEffect(() => {
    if (!hasNext) return;
    const id = setInterval(() => {
      const left = clockRef.current.remaining();
      const inCredits = left !== null && left <= NEXT_UP_AT_S;
      setNextUp((count) => {
        // Seeking back out of the credits (or "Cancelar") hides it.
        if (!inCredits || nextDismissed.current) return null;
        if (count === null) return NEXT_UP_COUNTDOWN_S;
        // The countdown only runs while the video does (or once it's over).
        return clockRef.current.isPlaying() || (left ?? 1) < 1 ? count - 1 : count;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [hasNext]);

  const playNext = useCallback(() => {
    if (nextFired.current) return;
    nextFired.current = true;
    nextRef.current?.onPlay();
  }, []);

  useEffect(() => {
    if (nextUp !== null && nextUp <= 0) playNext();
  }, [nextUp, playNext]);

  // On a TV, OK should be all it takes: the card arrives with focus on "Assistir agora".
  const nextVisible = nextUp !== null;
  useEffect(() => {
    if (tv && nextVisible && nextButtonRef.current) focusElement(nextButtonRef.current);
  }, [tv, nextVisible]);

  // The bar shows on any activity — mouse moving over our page, the player showing its cursor
  // (mouse moving over the video), a key press — and hides once the mouse rests outside it.
  const [barActive, setBarActive] = useState(true);
  const hoveringBar = useRef(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout>>();
  const scheduleHide = useCallback((ms: number) => {
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      if (!hoveringBar.current) setBarActive(false);
    }, ms);
  }, []);
  // Shows the bar; hides it again after `hideAfter` ms of quiet (null: stay until told otherwise).
  const wakeBar = useCallback((hideAfter: number | null) => {
    setBarActive(true);
    if (hideAfter === null) clearTimeout(idleTimer.current);
    else scheduleHide(hideAfter);
  }, [scheduleHide]);

  const toggleTheater = useCallback(() => {
    setTheater((t) => {
      try {
        localStorage.setItem(THEATER_KEY, t ? "0" : "1");
      } catch {
        // Storage blocked — the choice just won't stick.
      }
      return !t;
    });
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (editing) setEditing(false);
        // In fullscreen, Escape just leaves fullscreen.
        else if (!document.fullscreenElement) close();
      } else if ((e.key === "t" || e.key === "T") && !tv && !isTyping(e.target) && !e.ctrlKey && !e.metaKey && !e.altKey) {
        toggleTheater();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [close, editing, tv, toggleTheater]);

  useEffect(() => {
    if (!rateUrl || tv) return;
    const id = setInterval(() => {
      if ((clockRef.current.progress() ?? 0) >= 0.9) setNearEnd(true);
    }, 1000);
    return () => clearInterval(id);
  }, [rateUrl, tv]);

  useEffect(() => {
    const onKey = () => wakeBar(5000);
    // Browsers also fire mousemove without any movement (when layout changes under a resting
    // cursor — e.g. this very bar fading out); only a real change of position counts.
    let lastX = -1;
    let lastY = -1;
    const onMouse = (e: MouseEvent) => {
      if (e.clientX === lastX && e.clientY === lastY) return;
      lastX = e.clientX;
      lastY = e.clientY;
      wakeBar(IDLE_MS);
    };
    // Capture phase on window: the TV navigation stops arrow keys from propagating further.
    window.addEventListener("keydown", onKey, true);
    document.addEventListener("mousemove", onMouse);
    // Starts visible (so you see the controls exist), then hides itself.
    wakeBar(tv ? 5000 : 4000);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      document.removeEventListener("mousemove", onMouse);
      clearTimeout(idleTimer.current);
    };
  }, [tv, wakeBar]);

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
      if (type === "CURSOR_SHOW") {
        setCursorVisible(true);
        // The mouse is over the video, so it isn't over the bar — even if the browser never told us
        // it left (leaving into a cross-origin iframe doesn't always fire mouseleave).
        hoveringBar.current = false;
        wakeBar(null);
      }
      if (type === "CURSOR_HIDE") {
        setCursorVisible(false);
        wakeBar(AFTER_PLAYER_IDLE_MS);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [wakeBar]);

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

  const showBar = barActive || barFocused || marking !== null || toast !== null || editing;

  return (
    <div data-tv-layer className={`fixed inset-0 z-[60] flex flex-col ${wide ? "bg-black" : "bg-black/95 backdrop-blur-lg"}`}>
      <div className={`flex items-center gap-3 px-4 py-3 ${wide ? "hidden" : ""}`}>
        <div className="flex-1 min-w-0">
          <p className="text-[#f0e8dc] font-bold text-sm truncate">{title}</p>
          <p className="text-[#5a4e46] text-xs">{label}</p>
        </div>
        {embedUrl && (
          <a
            href={embedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#5a4e46] hover:text-[#9a8878] text-xs transition-colors"
          >
            Abrir em nova aba ↗
          </a>
        )}
        <button
          onClick={close}
          className="p-2 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-[#9a8878] hover:text-[#f0e8dc] transition-colors"
          aria-label="Fechar player"
        >
          <svg width="15" height="15" fill="currentColor" viewBox="0 0 24 24">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
          </svg>
        </button>
      </div>

      <div className={`flex-1 min-h-0 flex ${wide ? "" : "gap-5 px-4 pb-4"}`}>
        <div className={`flex-1 min-w-0 flex justify-center ${wide ? "items-center" : "items-start"}`}>
          <div
            ref={stageRef}
            className={`relative w-full max-h-full aspect-video overflow-hidden bg-black [container-type:inline-size] [&:fullscreen]:rounded-none [&:fullscreen]:border-0 ${
              wide ? "max-w-[calc(100vh*16/9)]" : "max-w-[calc((100vh-6rem)*16/9)] rounded-2xl border border-white/[0.06]"
            }`}
          >
            {/* No sandbox: the player refuses to load inside a sandboxed frame — popups it opens are
                closed by extensions/firefox-popup-closer. No fullscreen either: the player's own
                fullscreen would hide our subtitle overlay, so fullscreen goes through the stage. */}
            {embedUrl ? (
              <iframe
                ref={iframeRef}
                src={embedUrl}
                className="w-full h-full"
                allow="autoplay; picture-in-picture; encrypted-media"
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center px-6">
                {searching && (
                  <span className="w-10 h-10 rounded-full border-[3px] border-white/10 border-t-[#d4845a] animate-spin" />
                )}
                <p className="text-sm text-[#9a8878]">{status ?? "Carregando…"}</p>
              </div>
            )}

            <SubtitleLayer
              text={editing ? text || SAMPLE_TEXT : text}
              style={style}
              raised={cursorVisible}
              editing={editing}
              onMove={(position) => updateStyle({ position })}
              onScaleStep={(delta) => updateStyle({ scale: clampScale(style.scale + delta) })}
            />

            {next && nextUp !== null && (
            <div
              className={`absolute bottom-[16%] right-4 z-10 w-72 rounded-2xl overflow-hidden bg-black/85 backdrop-blur border border-white/[0.1] shadow-2xl ${
                tv ? "[zoom:1.6]" : ""
              }`}
            >
              {next.still && (
                <div className="relative aspect-video">
                  <Image src={next.still} alt="" fill sizes="288px" className="object-cover" />
                </div>
              )}
              <div className="p-3 flex flex-col gap-2.5">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#9a8878]">Próximo episódio</p>
                  <p className="text-sm font-semibold text-[#f0e8dc] line-clamp-1">
                    {next.label}{next.name ? ` · ${next.name}` : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    ref={nextButtonRef}
                    onClick={playNext}
                    className="relative flex-1 h-9 rounded-lg overflow-hidden bg-[#d4845a] text-sm font-bold text-white outline-none focus:ring-2 focus:ring-[#f0e8dc]"
                  >
                    <span
                      className="absolute inset-y-0 left-0 bg-white/25 transition-[width] duration-1000 ease-linear"
                      style={{ width: `${((NEXT_UP_COUNTDOWN_S - nextUp) / NEXT_UP_COUNTDOWN_S) * 100}%` }}
                    />
                    <span className="relative flex items-center justify-center gap-1.5">
                      <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                      Assistir agora · {Math.max(0, nextUp)}s
                    </span>
                  </button>
                  <button
                    onClick={() => { nextDismissed.current = true; setNextUp(null); }}
                    className="h-9 px-3 rounded-lg bg-white/[0.08] hover:bg-white/[0.14] text-xs font-semibold text-[#9a8878] hover:text-[#f0e8dc] transition-colors outline-none focus:ring-2 focus:ring-[#d4845a]"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}

          {rateUrl && nearEnd && !rateDismissed && (
            <div className="absolute bottom-[18%] right-4 z-10 flex items-center gap-1 rounded-xl pl-3 pr-1 py-1 bg-black/80 backdrop-blur border border-[#d4845a]/40 shadow-lg">
              <a
                href={rateUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold text-[#f0e8dc] hover:text-[#d4845a] transition-colors"
              >
                Terminou? ★ Avaliar no Letterboxd ↗
              </a>
              <button
                onClick={() => setRateDismissed(true)}
                className="p-1.5 rounded-lg text-[#5a4e46] hover:text-[#f0e8dc] transition-colors"
                aria-label="Dispensar"
              >
                <svg width="10" height="10" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                </svg>
              </button>
            </div>
          )}

          {/* Only the panels themselves take clicks — the strip around them stays clickable for the player. */}
            <div
              className={`pointer-events-none absolute top-3 inset-x-3 flex flex-col items-center gap-2 transition-opacity duration-200 ${
                showBar ? "opacity-100 [&>*]:pointer-events-auto" : "opacity-0"
              } ${tv ? "[zoom:1.8]" : ""}`}
              onFocus={() => setBarFocused(true)}
              onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setBarFocused(false); }}
              onMouseEnter={() => { hoveringBar.current = true; wakeBar(null); }}
              onMouseLeave={() => { hoveringBar.current = false; scheduleHide(IDLE_MS); }}
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
                {!tv && (
                  <button
                    onClick={toggleTheater}
                    className={`${barButton} ${theater ? "!bg-[#d4845a]/25 !text-[#d4845a]" : ""}`}
                    aria-label={theater ? "Sair do modo teatro" : "Modo teatro"}
                    title={theater ? "Sair do modo teatro (T)" : "Modo teatro (T)"}
                  >
                    <svg width="14" height="13" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M19 6H5c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 10H5V8h14v8z" />
                    </svg>
                  </button>
                )}
                {wide && !tv && (
                  <button onClick={close} className={barButton} aria-label="Fechar player" title="Fechar (Esc)">
                    <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                    </svg>
                  </button>
                )}
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

        {!wide && aside && (
          <aside className="hidden lg:block w-[340px] xl:w-[380px] shrink-0 min-h-0 overflow-y-auto pr-1 [scrollbar-width:thin]">
            {aside}
          </aside>
        )}
      </div>
    </div>
  );
}
