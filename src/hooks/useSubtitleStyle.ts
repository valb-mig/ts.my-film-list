"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_SUBTITLE_STYLE,
  loadSubtitleStyle,
  onSubtitleStyleChange,
  saveSubtitleStyle,
  type SubtitleStyle,
} from "@/lib/subtitleStyle";

export function useSubtitleStyle(): [SubtitleStyle, (patch: Partial<SubtitleStyle>) => void] {
  const [style, setStyle] = useState<SubtitleStyle>(() =>
    typeof window === "undefined" ? DEFAULT_SUBTITLE_STYLE : loadSubtitleStyle()
  );

  useEffect(() => onSubtitleStyleChange(() => setStyle(loadSubtitleStyle())), []);

  // Merges into what's stored (not this hook's copy), so two open editors can't clobber each other.
  const update = useCallback((patch: Partial<SubtitleStyle>) => {
    saveSubtitleStyle({ ...loadSubtitleStyle(), ...patch });
  }, []);

  return [style, update];
}
