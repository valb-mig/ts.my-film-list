"use client";

import { useState, useRef, useEffect, RefObject } from "react";

export function useChunkedList<T>(
  list: T[],
  chunkSize = 30
): { visible: T[]; hasMore: boolean; sentinelRef: RefObject<HTMLDivElement> } {
  const [count, setCount] = useState(chunkSize);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCount(chunkSize);
  }, [list, chunkSize]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setCount((c) => Math.min(c + chunkSize, list.length));
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [list.length, chunkSize]);

  return { visible: list.slice(0, count), hasMore: count < list.length, sentinelRef };
}
