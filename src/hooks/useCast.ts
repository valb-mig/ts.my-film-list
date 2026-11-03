"use client";

import { useCallback, useEffect, useState } from "react";

// "Transmitir no projetor": whether the projector hub is open right now (checked while `enabled`,
// every 15 s), its phone-remote page, and sending a title (series: an episode) to it.
export function useCast(enabled: boolean) {
  const [available, setAvailable] = useState(false);
  const [remote, setRemote] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const check = () =>
      fetch("/api/cast")
        .then((r) => r.json())
        .then((d: { available?: boolean; remote?: string | null }) => {
          if (cancelled) return;
          setAvailable(Boolean(d.available));
          setRemote(d.remote ?? null);
        })
        .catch(() => {});
    check();
    const timer = setInterval(check, 15000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [enabled]);

  const cast = useCallback(async (id: string, season?: number, episode?: number) => {
    const res = await fetch("/api/cast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, season, episode }),
    }).catch(() => null);
    if (!res?.ok) setAvailable(false);
    return Boolean(res?.ok);
  }, []);

  return { available, remote, cast };
}
