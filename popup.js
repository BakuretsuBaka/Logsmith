const api = globalThis.chrome ?? globalThis.browser;
const $ = (id) => document.getElementById(id);

const NAMES = {
  instagram: "Instagram", tiktok: "TikTok", x: "X (Twitter)", threads: "Threads", facebook: "Facebook",
  reddit: "Reddit", pinterest: "Pinterest", quora: "Quora", linkedin: "LinkedIn"
};

let settings = { enabled: true, sites: {} };
let tabSite = null;

const save = () => api.storage.local.set({ enabled: settings.enabled, sites: settings.sites });

function switchRow(label, checked, onChange) {
  const row = document.createElement("div");
  row.className = "row";
  const span = document.createElement("span");
  span.textContent = label;
  const wrap = document.createElement("label");
  wrap.className = "switch";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = checked;
  input.addEventListener("change", () => onChange(input.checked));
  const slider = document.createElement("span");
  slider.className = "slider";
  wrap.append(input, slider);
  row.append(span, wrap);
  return row;
}

function render() {
  $("enabled").checked = settings.enabled;
  const list = $("sites");
  list.textContent = "";
  for (const [id, name] of Object.entries(NAMES)) {
    list.append(
      switchRow(name, settings.sites[id] !== false, (on) => {
        settings.sites[id] = on;
        if (id === tabSite) $("site").checked = on;
        save();
      })
    );
  }
}

api.storage.local.get(["enabled", "sites"], (res) => {
  settings = { enabled: !res || res.enabled !== false, sites: (res && res.sites) || {} };
  render();
});

$("enabled").addEventListener("change", (e) => {
  settings.enabled = e.target.checked;
  save();
});

const withTab = (fn) =>
  api.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs && tabs[0];
    if (tab && tab.id != null) fn(tab.id);
  });

withTab((tabId) => {
  api.tabs.sendMessage(tabId, { type: "logsmith:info" }, (info) => {
    void api.runtime.lastError;
    if (!info || !NAMES[info.site]) return;
    tabSite = info.site;
    $("siteRow").hidden = false;
    $("siteLabel").textContent = `On ${NAMES[info.site]}`;
    $("site").checked = settings.sites[info.site] !== false;
    $("status").textContent = info.paused
      ? "Logsmith is off here."
      : info.removed
        ? `Hidden on this page: ${info.removed} wall${info.removed === 1 ? "" : "s"}.`
        : "No wall on this page (yet).";
    $("site").addEventListener("change", (e) => {
      settings.sites[info.site] = e.target.checked;
      save();
      render();
    });
  });
});

$("debug").addEventListener("click", () => {
  withTab((tabId) => {
    api.tabs.sendMessage(tabId, { type: "logsmith:debug" }, (info) => {
      void api.runtime.lastError;
      const text = info ? JSON.stringify(info, null, 2) : "No data: Logsmith is not active on this page.";
      navigator.clipboard.writeText(text).then(
        () => ($("debug").textContent = "Copied to clipboard"),
        () => ($("debug").textContent = "Copy failed")
      );
    });
  });
});
