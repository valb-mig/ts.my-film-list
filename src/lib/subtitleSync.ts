// Maps subtitle time to player time: player = scale * subtitle + offset. `anchor` is the last
// line the user synced by hand, kept to detect frame-rate drift on the next one.
export interface SubtitleSync {
  scale: number;
  offset: number;
  anchor?: { sub: number; player: number };
}

export const NO_SYNC: SubtitleSync = { scale: 1, offset: 0 };

// Steady drift almost always means the subtitle was timed for another frame rate
// (25 fps PAL vs 23.976/24 fps film).
const FPS_RATIOS = [1, 25 / 23.976, 23.976 / 25, 25 / 24, 24 / 25];
const RATIO_TOLERANCE = 0.006;
// Two marks closer than this (in seconds) can't tell drift apart from reaction-time noise.
const MIN_DRIFT_SPAN = 600;
// People hit "now" a beat after the line starts.
const REACTION_TIME = 0.3;

export function toSubtitleTime(sync: SubtitleSync, playerTime: number): number {
  return (playerTime - sync.offset) / sync.scale;
}

// The user says subtitle line `subTime` is being spoken right now, at `playerTime`. Re-anchors
// the offset on it; if the previous mark is far enough away and the two imply a known frame-rate
// ratio, also fixes the speed. Any other ratio is a cut/edit difference, so only the offset moves.
export function applyMark(sync: SubtitleSync, subTime: number, playerTime: number): SubtitleSync {
  const player = playerTime - REACTION_TIME;
  let scale = sync.scale;
  const prev = sync.anchor;
  if (prev && Math.abs(subTime - prev.sub) >= MIN_DRIFT_SPAN) {
    const measured = (player - prev.player) / (subTime - prev.sub);
    const nearest = FPS_RATIOS.reduce((best, r) => (Math.abs(measured - r) < Math.abs(measured - best) ? r : best));
    if (Math.abs(measured - nearest) < RATIO_TOLERANCE) scale = nearest;
  }
  return { scale, offset: player - scale * subTime, anchor: { sub: subTime, player } };
}

export function nudge(sync: SubtitleSync, seconds: number): SubtitleSync {
  return {
    ...sync,
    offset: sync.offset + seconds,
    anchor: sync.anchor && { ...sync.anchor, player: sync.anchor.player + seconds },
  };
}

const STORAGE_PREFIX = "subsync:";

export function loadSync(key: string): SubtitleSync {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_PREFIX + key) ?? "null");
    if (typeof saved?.scale === "number" && typeof saved?.offset === "number") return saved;
  } catch {
    // Corrupt entry — start over.
  }
  return NO_SYNC;
}

export function saveSync(key: string, sync: SubtitleSync): void {
  try {
    if (sync.scale === 1 && sync.offset === 0) localStorage.removeItem(STORAGE_PREFIX + key);
    else localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(sync));
  } catch {
    // Storage full/blocked — sync just won't persist.
  }
}
