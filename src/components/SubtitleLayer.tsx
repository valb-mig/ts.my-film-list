"use client";

import { useRef } from "react";
import {
  clampPosition,
  defaultPosition,
  SUBTITLE_COLORS,
  type SubtitlePosition,
  type SubtitleStyle,
} from "@/lib/subtitleStyle";

interface Props {
  text: string;
  style: SubtitleStyle;
  // The player's controls are showing — the default spot moves up to clear them.
  raised?: boolean;
  // Drag (and wheel-resize) the subtitle. Otherwise the layer lets every click through to the video.
  editing?: boolean;
  onMove?: (position: SubtitlePosition) => void;
  onScaleStep?: (delta: number) => void;
}

const OUTLINE = "0 0 4px #000, 0 0 2px #000, 0 2px 3px #000";

// Covers its positioned parent, which must also set `container-type: inline-size` — the font size
// follows the video's width, so it looks the same in a window, fullscreen or the settings preview.
export default function SubtitleLayer({ text, style, raised = false, editing = false, onMove, onScaleStep }: Props) {
  const layerRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const grab = useRef<{ dx: number; dy: number } | null>(null);
  const position = style.position ?? defaultPosition(raised);

  const pointerPosition = (e: React.PointerEvent): SubtitlePosition => {
    const r = layerRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 };
  };

  const handleDown = (e: React.PointerEvent) => {
    const p = pointerPosition(e);
    // Grabbing the text keeps the same point under the cursor; clicking elsewhere drops it there.
    grab.current = boxRef.current?.contains(e.target as Node)
      ? { dx: position.x - p.x, dy: position.y - p.y }
      : { dx: 0, dy: 0 };
    e.currentTarget.setPointerCapture(e.pointerId);
    onMove?.(clampPosition({ x: p.x + grab.current.dx, y: p.y + grab.current.dy }));
  };

  const handleMove = (e: React.PointerEvent) => {
    if (!grab.current) return;
    const p = pointerPosition(e);
    onMove?.(clampPosition({ x: p.x + grab.current.dx, y: p.y + grab.current.dy }));
  };

  const handleUp = () => { grab.current = null; };

  return (
    <div
      ref={layerRef}
      className={`absolute inset-0 ${editing ? "cursor-move touch-none" : "pointer-events-none"}`}
      onPointerDown={editing ? handleDown : undefined}
      onPointerMove={editing ? handleMove : undefined}
      onPointerUp={handleUp}
      onPointerCancel={handleUp}
      onWheel={editing && onScaleStep ? (e) => onScaleStep(e.deltaY < 0 ? 0.1 : -0.1) : undefined}
    >
      {text && (
        <div
          ref={boxRef}
          className={`absolute w-max max-w-[88%] text-center ${style.position ? "" : "transition-[top] duration-200"} ${
            editing ? "rounded outline-dashed outline-1 outline-offset-4 outline-white/60" : ""
          }`}
          style={{ left: `${position.x}%`, top: `${position.y}%`, transform: "translate(-50%, -100%)" }}
        >
          <p
            className="font-semibold leading-snug whitespace-pre-line"
            style={{
              fontSize: `calc(clamp(14px, 3cqw, 46px) * ${style.scale})`,
              color: SUBTITLE_COLORS[style.color],
              textShadow: style.background ? undefined : OUTLINE,
            }}
          >
            {style.background ? (
              <span className="bg-black/75 px-[0.35em] py-[0.05em] rounded [box-decoration-break:clone] [-webkit-box-decoration-break:clone]">
                {text}
              </span>
            ) : (
              text
            )}
          </p>
        </div>
      )}
    </div>
  );
}
