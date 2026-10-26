// How to recognize a My Film List tab. The title covers every address it's opened from
// (localhost, the Tailscale link, a LAN IP); the URLs are a fallback in case the title changes.
const APP_TITLE = "My Film List";
// 3100 é o serviço; 3000, o `npm run dev`.
const APP_URLS = [
  "http://localhost:3100/",
  "http://127.0.0.1:3100/",
  "http://localhost:3000/",
  "http://127.0.0.1:3000/",
];

function isAppTab(tab) {
  return tab.title === APP_TITLE || APP_URLS.some((url) => tab.url?.startsWith(url));
}

// Fires for every new tab/window opened by a page — window.open, target="_blank" links and
// forms alike. Only popups coming from inside an iframe (sourceFrameId !== 0) of a My Film List
// tab get closed; the app's own links (IMDb, subtitle downloads, "abrir em nova aba") come from
// the top frame and open normally.
browser.webNavigation.onCreatedNavigationTarget.addListener(async (details) => {
  if (details.sourceFrameId === 0) return;

  let source;
  try {
    source = await browser.tabs.get(details.sourceTabId);
  } catch {
    return;
  }
  if (!isAppTab(source)) return;

  await browser.tabs.remove(details.tabId).catch(() => {});
  // Popups usually steal focus — hand it back to the player.
  await browser.tabs.update(source.id, { active: true }).catch(() => {});
  await browser.windows.update(source.windowId, { focused: true }).catch(() => {});
});
