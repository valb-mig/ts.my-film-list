// Where the subtitle sits, in % of the video area. The point is the bottom center of the text.
export interface SubtitlePosition {
  x: number;
  y: number;
}

export interface SubtitleStyle {
  // Language the player starts with ("" = start with subtitles off).
  lang: string;
  scale: number;
  // null = default spot: bottom center, lifted while the player's controls are showing.
  position: SubtitlePosition | null;
  color: "white" | "yellow";
  background: boolean;
}

export const DEFAULT_SUBTITLE_STYLE: SubtitleStyle = {
  lang: "pt-BR",
  scale: 1,
  position: null,
  color: "white",
  background: false,
};

export const MIN_SCALE = 0.5;
export const MAX_SCALE = 2.5;

export const SUBTITLE_COLORS: Record<SubtitleStyle["color"], string> = {
  white: "#ffffff",
  yellow: "#ffd84d",
};

export function clampScale(scale: number): number {
  return Math.round(Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale)) * 10) / 10;
}

export function clampPosition({ x, y }: SubtitlePosition): SubtitlePosition {
  return { x: Math.min(92, Math.max(8, x)), y: Math.min(98, Math.max(10, y)) };
}

export function defaultPosition(raised: boolean): SubtitlePosition {
  return { x: 50, y: raised ? 85 : 93 };
}

const STORAGE_KEY = "subtitleStyle";
const CHANGE_EVENT = "subtitle-style-change";

export function loadSubtitleStyle(): SubtitleStyle {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    const style = { ...DEFAULT_SUBTITLE_STYLE, ...saved };
    return { ...style, scale: clampScale(Number(style.scale) || 1) };
  } catch {
    return DEFAULT_SUBTITLE_STYLE;
  }
}

export function saveSubtitleStyle(style: SubtitleStyle): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(style));
  } catch {
    // Storage blocked — the change just won't stick.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

// Fires for changes in this tab (settings panel ↔ player) and in other tabs.
export function onSubtitleStyleChange(callback: () => void): () => void {
  const handleStorage = (e: StorageEvent) => { if (e.key === STORAGE_KEY) callback(); };
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener("storage", handleStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener("storage", handleStorage);
  };
}
