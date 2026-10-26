// Remote-control navigation for the TV pages. Arrows move focus to the nearest focusable element in
// that direction, inside the topmost open layer ([data-tv-layer]); rows ([data-tv-row]) remember the
// item you left them on, so going up and back down lands where you were (like TV streaming apps).

const FOCUSABLE = 'button:not([disabled]), a[href], input:not([type="hidden"]), select, [data-tv]';
const LAYER = "[data-tv-layer]";
const ROW = "[data-tv-row]";
// A row's block (title + row). Focusing into a row brings its section to the top of the scroller.
const SECTION = "[data-tv-section]";

export type Direction = "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight";

const lastInRow = new WeakMap<Element, HTMLElement>();

function visible(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return false;
  const s = getComputedStyle(el);
  return s.visibility !== "hidden" && s.display !== "none" && s.pointerEvents !== "none";
}

function topLayer(): HTMLElement {
  const layers = Array.from(document.querySelectorAll<HTMLElement>(LAYER)).filter(visible);
  return layers[layers.length - 1] ?? document.body;
}

function candidates(scope: HTMLElement): HTMLElement[] {
  return Array.from(scope.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    // Only the topmost layer counts: skip elements that belong to a nested, deeper layer.
    (el) => visible(el) && el.closest(LAYER) === (scope === document.body ? null : scope)
  );
}

// Where focus starts in a layer: its [data-tv-autofocus] element, else the first focusable one.
export function initialFocus(scope: HTMLElement = topLayer()): HTMLElement | null {
  const items = candidates(scope);
  return items.find((el) => el.hasAttribute("data-tv-autofocus")) ?? items[0] ?? null;
}

export function nextFocus(dir: Direction, from: HTMLElement | null): HTMLElement | null {
  const scope = topLayer();
  const items = candidates(scope);
  if (!from || !items.includes(from)) return initialFocus(scope);

  const a = from.getBoundingClientRect();
  const ax = a.left + a.width / 2;
  const ay = a.top + a.height / 2;
  let best: HTMLElement | null = null;
  let bestScore = Infinity;
  for (const el of items) {
    if (el === from) continue;
    const b = el.getBoundingClientRect();
    const bx = b.left + b.width / 2;
    const by = b.top + b.height / 2;
    let main: number;
    let cross: number;
    if (dir === "ArrowRight") {
      if (bx <= ax + 2 || b.left < a.right - a.width / 2) continue;
      main = b.left - a.right;
      cross = Math.abs(by - ay) * 4;
    } else if (dir === "ArrowLeft") {
      if (bx >= ax - 2 || b.right > a.left + a.width / 2) continue;
      main = a.left - b.right;
      cross = Math.abs(by - ay) * 4;
    } else if (dir === "ArrowDown") {
      if (by <= ay + 2 || b.top < a.bottom - a.height / 2) continue;
      main = b.top - a.bottom;
      cross = Math.abs(bx - ax) * 2;
    } else {
      if (by >= ay - 2 || b.bottom > a.top + a.height / 2) continue;
      main = a.top - b.bottom;
      cross = Math.abs(bx - ax) * 2;
    }
    const score = Math.max(main, 0) + cross;
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }

  // Entering a different row vertically: go back to the item last focused there.
  if (best && (dir === "ArrowUp" || dir === "ArrowDown")) {
    const row = best.closest(ROW);
    const remembered = row && row !== from.closest(ROW) ? lastInRow.get(row) : undefined;
    if (remembered && remembered.isConnected && items.includes(remembered)) best = remembered;
  }
  return best;
}

function scrollParent(el: Element): HTMLElement | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const overflow = getComputedStyle(p).overflowY;
    if ((overflow === "auto" || overflow === "scroll") && p.scrollHeight > p.clientHeight) return p;
  }
  return null;
}

// Focus plus TV-style scrolling: the focused poster slides to the middle of its row, and the row's
// section lines up at the top of the page (the focused row is always the first one you see). The
// zoom on focus isn't part of the layout box, so "scroll just enough" would leave it cut off.
export function focusElement(el: HTMLElement, smooth = true) {
  el.focus({ preventScroll: true });
  const behavior: ScrollBehavior = smooth ? "smooth" : "auto";
  const row = el.closest(ROW);
  if (!row) {
    el.scrollIntoView({ block: "nearest", inline: "nearest", behavior });
    return;
  }
  lastInRow.set(row, el);
  const rowBox = row.getBoundingClientRect();
  const box = el.getBoundingClientRect();
  row.scrollBy({ left: box.left + box.width / 2 - (rowBox.left + rowBox.width / 2), behavior });
  const section = el.closest(SECTION);
  const scroller = section && scrollParent(section);
  if (section && scroller) {
    const top = section.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
    scroller.scrollBy({ top, behavior });
  }
}

// <select> with a remote: OK steps through the options (opening the native popup isn't possible).
export function cycleSelect(el: HTMLSelectElement) {
  if (el.options.length === 0) return;
  const next = (el.selectedIndex + 1) % el.options.length;
  const setValue = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
  setValue?.call(el, el.options[next].value);
  el.dispatchEvent(new Event("change", { bubbles: true }));
}
