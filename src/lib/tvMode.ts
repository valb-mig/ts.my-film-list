// TV mode: the TV version (/tv), the site running inside the projector hub (its WebKit exposes
// window.webkit.messageHandlers.hub), or opened with ?tv=1 — remembered for the session so in-app
// navigation keeps it.
export function isTvMode(): boolean {
  if (typeof window === "undefined") return false;
  if (window.location.pathname.startsWith("/tv")) return true;
  try {
    if (new URLSearchParams(window.location.search).has("tv")) sessionStorage.setItem("tvMode", "1");
    if (sessionStorage.getItem("tvMode") === "1") return true;
  } catch {
    // sessionStorage blocked — fall through to hub detection.
  }
  const webkit = (window as { webkit?: { messageHandlers?: { hub?: unknown } } }).webkit;
  return Boolean(webkit?.messageHandlers?.hub);
}
