// Per tab: grey icon while Logsmith is off for the site, and a badge with the number of walls hidden.
const api = globalThis.chrome ?? globalThis.browser;

const paths = (off) => {
  const p = {};
  for (const n of [16, 32, 48]) p[n] = `icons/${off ? "icon-off-" : "icon-"}${n}.png`;
  return p;
};

api.runtime.onMessage.addListener((msg, sender) => {
  if (!msg || msg.type !== "logsmith:state" || !sender.tab || sender.tab.id == null) return;
  const tabId = sender.tab.id;
  const action = api.action;
  if (!action) return;
  const ignore = () => void api.runtime.lastError;
  try {
    action.setIcon({ tabId, path: paths(msg.paused) }, ignore);
    action.setBadgeText({ tabId, text: !msg.paused && msg.removed > 0 ? String(Math.min(msg.removed, 99)) : "" }, ignore);
    action.setBadgeBackgroundColor({ tabId, color: "#e8841a" }, ignore);
  } catch {
    /* the tab is gone */
  }
});
