"use client";

import { useEffect, useRef } from "react";
import { cycleSelect, focusElement, nextFocus, type Direction } from "@/lib/tvNav";

const BACK_KEYS = new Set(["Escape", "Backspace", "GoBack", "BrowserBack"]);

// Wires the remote: arrows move focus (see lib/tvNav), OK (Enter) activates, Back calls `onBack`.
// `onBack` returns false to let the key through (e.g. to the player, which closes itself on Escape).
export function useTvNav(onBack: () => boolean) {
  const backRef = useRef(onBack);
  backRef.current = onBack;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement instanceof HTMLElement && document.activeElement !== document.body
        ? document.activeElement
        : null;
      const typing = el?.tagName === "INPUT" || el?.tagName === "TEXTAREA";

      if (e.key.startsWith("Arrow")) {
        if (typing && (e.key === "ArrowLeft" || e.key === "ArrowRight")) return;
        e.preventDefault();
        const target = nextFocus(e.key as Direction, el);
        if (target) focusElement(target);
      } else if (e.key === "Enter") {
        if (typing || !el) return;
        e.preventDefault();
        if (el instanceof HTMLSelectElement) cycleSelect(el);
        else el.click();
      } else if (BACK_KEYS.has(e.key)) {
        if (typing && e.key === "Backspace") return;
        if (backRef.current()) e.preventDefault();
      }
    };
    // Capture phase, so focus moves before any page handler sees the arrows.
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);
}
