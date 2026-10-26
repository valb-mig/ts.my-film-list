// Playback position of an embedded player, from what it posts to the parent page. Players in the
// vidsrc family send { type: "PLAYER_EVENT", data: { player_status, player_progress } } on state
// changes and every ~5 s while playing, together with a progress save ({ type: "STORAGE_SET",
// key: "watch_<id>", value: '{"time":…,"timestamp":…}' }). Between reports the clock runs on its own.

// Statuses that stop the clock. "seeked" (and anything unknown) keeps whatever state we were in —
// after a seek the player goes on playing, but its next "playing" report can be 5 s away.
const STOPPED = new Set(["ready", "paused", "pause", "ended", "idle", "error"]);
export class PlayerClock {
  private time = 0;
  private at = 0;
  private playing = false;
  private known = false;
  // Typical gap between reports while playing (ms) — bounds how far we extrapolate, so a pause
  // or stall the player doesn't announce doesn't let subtitles run ahead for long.
  private gap = 5000;
  // Length of what's playing, in seconds, once the player has said.
  private duration = 0;

  // Returns true if the message carried playback info.
  handle(data: unknown): boolean {
    if (!data || typeof data !== "object") return false;
    const d = data as Record<string, unknown>;

    if (d.type === "PLAYER_EVENT" && d.data && typeof d.data === "object") {
      const e = d.data as Record<string, unknown>;
      if (typeof e.player_duration === "number" && e.player_duration > 0) this.duration = e.player_duration;
      if (typeof e.player_progress !== "number") return false;
      const status = String(e.player_status);
      const playing = status === "playing" ? true : STOPPED.has(status) ? false : this.playing;
      this.report(e.player_progress, performance.now(), playing);
      return true;
    }

    if (d.type === "STORAGE_SET" && typeof d.key === "string" && d.key.startsWith("watch_") && typeof d.value === "string") {
      try {
        const v = JSON.parse(d.value);
        if (typeof v.duration === "number" && v.duration > 0) this.duration = v.duration;
        if (typeof v.time !== "number") return false;
        const at = typeof v.timestamp === "number" ? performance.now() - (Date.now() - v.timestamp) : performance.now();
        this.report(v.time, at, this.playing);
        return true;
      } catch {
        return false;
      }
    }

    return false;
  }

  // Current position in seconds, or null until the player has reported anything.
  now(): number | null {
    if (!this.known) return null;
    if (!this.playing) return this.time;
    const elapsed = Math.min(performance.now() - this.at, Math.max(2000, this.gap * 1.6));
    return this.time + elapsed / 1000;
  }

  isPlaying(): boolean {
    return this.playing;
  }

  // Seconds left, or null until the player has reported time and duration.
  remaining(): number | null {
    const now = this.now();
    return now === null || !this.duration ? null : Math.max(0, this.duration - now);
  }

  // How much has been watched, 0–1, or null until the player has reported time and duration.
  progress(): number | null {
    const now = this.now();
    return now === null || !this.duration ? null : Math.min(1, now / this.duration);
  }

  private report(time: number, at: number, playing: boolean) {
    if (this.known && at < this.at) return;
    // PLAYER_EVENT and the watch_ save arrive as a pair carrying the same position.
    if (this.known && playing === this.playing && Math.abs(time - this.time) < 0.05) return;
    if (this.known && this.playing && playing && time > this.time) {
      const gap = at - this.at;
      if (gap < 30_000) this.gap = this.gap * 0.7 + gap * 0.3;
    }
    this.time = time;
    this.at = at;
    this.playing = playing;
    this.known = true;
  }
}
