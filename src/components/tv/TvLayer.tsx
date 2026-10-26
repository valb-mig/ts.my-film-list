"use client";

import { useEffect, useRef } from "react";
import { focusElement, initialFocus } from "@/lib/tvNav";

// Back handlers of the open layers, innermost last. The page's Back key asks the last one first.
const stack: { current: () => boolean }[] = [];

export function handleTvBack(): boolean | null {
  const top = stack[stack.length - 1];
  return top ? top.current() : null;
}

interface Props {
  // Return false to let the Back key through (e.g. to the player, which closes itself on Escape).
  onBack: () => boolean;
  className?: string;
  children: React.ReactNode;
}

// A full-screen layer (details, search…): arrows stay inside it, Back goes to `onBack`, and on
// close focus returns to whatever opened it.
export default function TvLayer({ onBack, className = "", children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const handler = useRef(onBack);
  handler.current = onBack;

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    stack.push(handler);
    const frame = requestAnimationFrame(() => {
      const first = ref.current && initialFocus(ref.current);
      if (first) focusElement(first);
    });
    return () => {
      cancelAnimationFrame(frame);
      stack.splice(stack.indexOf(handler), 1);
      if (opener?.isConnected) focusElement(opener);
    };
  }, []);

  return (
    <div ref={ref} data-tv-layer className={`fixed inset-0 ${className}`}>
      {children}
    </div>
  );
}
