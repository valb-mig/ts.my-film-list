export interface Cue {
  start: number;
  end: number;
  text: string;
}

const TIME = /(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})/;

function seconds(m: RegExpExecArray): number {
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(m[4].padEnd(3, "0")) / 1000;
}

// Parses SRT (and the cue blocks of WebVTT). Formatting tags are dropped — the overlay renders
// plain text.
export function parseSrt(text: string): Cue[] {
  const cues: Cue[] = [];
  const blocks = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n").split(/\n{2,}/);
  for (const block of blocks) {
    const lines = block.split("\n");
    const timing = lines.findIndex((l) => l.includes("-->"));
    if (timing === -1) continue;
    const [from, to] = lines[timing].split("-->");
    const start = TIME.exec(from);
    const end = TIME.exec(to);
    if (!start || !end) continue;
    const body = lines
      .slice(timing + 1)
      .join("\n")
      .replace(/<[^>]+>/g, "")
      .replace(/\{\\[^}]*\}/g, "")
      .trim();
    if (body) cues.push({ start: seconds(start), end: seconds(end), text: body });
  }
  return cues.sort((a, b) => a.start - b.start);
}

// Release-group/site plugs ("Downloaded from YTS.MX", "Advertise your product … OpenSubtitles.org").
// Real dialogue practically never spells out a domain.
const AD_RE = /\b(?:https?:\/\/|www\.)|\b[a-z0-9-]+\.(?:com|org|net|mx|to|io|tv|me|ag)\b|opensubtitles|\byify\b/i;

export function withoutAds(cues: Cue[]): Cue[] {
  return cues.filter((c) => !AD_RE.test(c.text));
}

// Index of the last cue starting at or before t, or -1.
function lastStartedAt(cues: Cue[], t: number): number {
  let lo = 0;
  let hi = cues.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (cues[mid].start <= t) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}

export function cueAt(cues: Cue[], t: number): Cue | null {
  const i = lastStartedAt(cues, t);
  return i >= 0 && t < cues[i].end ? cues[i] : null;
}

export function nextCueIndex(cues: Cue[], t: number): number {
  return Math.min(lastStartedAt(cues, t) + 1, cues.length - 1);
}
