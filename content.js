// Logsmith: finds the login walls, sign-up pop-ups and scroll locks that social sites put over logged-out
// visitors and puts the page back to normal. It works on what the page shows, not on a list of class
// names (those change every few weeks): an overlay counts as a wall when it is a dialog or a fixed layer
// with a short text that asks for an account and carries a login or sign-up control.
(() => {
  "use strict";

  // ───────────── Pure helpers (also used by the tests)

  const SITES = [
    ["instagram", /(^|\.)instagram\.com$/],
    ["tiktok", /(^|\.)tiktok\.com$/],
    ["x", /(^|\.)(x|twitter)\.com$/],
    ["threads", /(^|\.)threads\.(net|com)$/],
    ["facebook", /(^|\.)facebook\.com$/],
    ["reddit", /(^|\.)reddit\.com$/],
    ["pinterest", /(^|\.)pinterest\.com$/],
    ["quora", /(^|\.)quora\.com$/],
    ["linkedin", /(^|\.)linkedin\.com$/]
  ];

  const siteOf = (host) => {
    const hit = SITES.find(([, re]) => re.test(host));
    return hit ? hit[0] : null;
  };

  // The pages where somebody really wants to log in: leave them alone
  const LOGIN_PATH =
    /^\/(?:accounts\/(?:login|emailsignup|signup)|login|log-in|signin|sign-in|signup|sign-up|register|i\/flow\/(?:login|signup)|flow\/(?:login|signup)|auth\/login|checkpoint)(?:\/|$)/i;

  // Words that ask for an account, in the languages of the big sites
  const AUTH_WORDS = [
    "log\\s?in", "login", "sign\\s?in", "sign\\s?up", "create\\s+(?:an?\\s+)?(?:new\\s+)?account", "join\\s+(?:now|us|today)", "register",
    "continue\\s+with", "anmelden", "einloggen", "registrieren", "konto\\s+erstellen", "se\\s+connecter", "connexion",
    "s.inscrire", "cr[ée]er\\s+un\\s+compte", "iniciar\\s+sesi[oó]n", "reg[ií]strate", "crear\\s+(?:una\\s+)?cuenta",
    "accedi", "registrati", "crea\\s+(?:un\\s+)?account", "entrar", "cadastre-se", "criar\\s+(?:uma\\s+)?conta",
    "inloggen", "registreren", "zaloguj", "zarejestruj", "войти", "зарегистрироваться", "регистрация",
    "giri[sş]\\s+yap", "kaydol", "üye\\s+ol", "تسجيل\\s+الدخول", "إنشاء\\s+حساب"
  ];
  const AUTH_RE = new RegExp(`(?:^|[^\\p{L}])(?:${AUTH_WORDS.join("|")})(?![\\p{L}])`, "iu");
  const AUTH_CJK = /ログイン|新規登録|アカウント作成|로그인|가입하|회원가입|登录|登錄|登入|注册|註冊/;
  const authText = (t) => AUTH_RE.test(t) || AUTH_CJK.test(t);

  const AUTH_CONTROL =
    'a[href*="login" i],a[href*="log-in" i],a[href*="signin" i],a[href*="sign-in" i],a[href*="signup" i],a[href*="sign-up" i],' +
    'a[href*="register" i],a[href*="emailsignup" i],a[href*="/flow/" i],a[href*="oauth" i],input[type="password"],' +
    'input[name="username"],input[autocomplete="username"],[data-testid*="login" i],[data-testid*="signup" i],' +
    '[data-e2e*="login" i],[data-e2e*="signup" i],[id*="login" i] button,[class*="login" i] button';

  // Buttons a page shows when a feed stopped loading: pressing them is what a person would do
  const RETRY_RE = new RegExp(
    "(?:^|[^\\p{L}])(?:retry|try\\s+again|load\\s+more|erneut\\s+versuchen|nochmal\\s+versuchen|mehr\\s+laden|r[ée]essayer|charger\\s+plus|" +
      "intentar\\s+de\\s+nuevo|reintentar|cargar\\s+m[aá]s|riprova|carica\\s+altro|tentar\\s+novamente|carregar\\s+mais|" +
      "повторить|загрузить\\s+ещ[ёе]|tekrar\\s+dene)(?![\\p{L}])",
    "iu"
  );
  const RETRY_CJK = /もう一度|再試行|다시 시도|重试|重試/;
  const retryText = (t) => !authText(t) && (RETRY_RE.test(t) || RETRY_CJK.test(t));

  if (typeof module !== "undefined") module.exports = { siteOf, authText, retryText, LOGIN_PATH, SITES };
  if (typeof document === "undefined" || typeof window === "undefined") return;

  // ───────────── State

  if (window.__logsmithLoaded) return;
  window.__logsmithLoaded = true;

  const api = globalThis.chrome ?? globalThis.browser;
  const SITE = siteOf(location.hostname) || "other";
  const WALL = "data-logsmith-wall";
  const UNBLUR = "data-logsmith-unblur";
  const ROOT = document.documentElement;

  let settings = { enabled: true, sites: {}, keepLoading: true };
  let paused = false;
  let removed = 0;
  let lastDismiss = 0;
  let unlocked = false;
  let timer = 0;
  const log = []; // what was hidden, for the debug button

  const isPaused = () => !settings.enabled || settings.sites[SITE] === false;
  // A real log-in page has a form to fill in. When the address says "login" but the page only shows the
  // profile or feed with a prompt on top (the app switched the address by itself), it is still a wall.
  const onLoginPage = () =>
    LOGIN_PATH.test(location.pathname) &&
    [...document.querySelectorAll('input[type="password"],input[name="username"],input[autocomplete="username"],input[name="email"]')].some(shown);

  // ───────────── Finding walls

  const style = (el) => {
    try {
      return getComputedStyle(el);
    } catch {
      return null;
    }
  };

  function nearestLayer(el) {
    for (let e = el; e && e !== document.body && e !== ROOT; e = e.parentElement) {
      const p = (style(e) || {}).position;
      if (p === "fixed" || p === "sticky") return e;
    }
    return null;
  }

  const PENDING_SEL = '[role="dialog"]:not([data-logsmith-ok]),[role="alertdialog"]:not([data-logsmith-ok]),[aria-modal="true"]:not([data-logsmith-ok])';

  function candidates() {
    const set = new Set();
    document
      .querySelectorAll(
        '[role="dialog"],[role="alertdialog"],[aria-modal="true"],dialog[open],[data-testid="sheetDialog"],' +
          '[data-e2e*="login" i],[id*="login-modal" i],[class*="LoginModal" i],[class*="login-modal" i],[class*="LoginContainer" i]'
      )
      .forEach((e) => set.add(e));
    const vw = innerWidth;
    const vh = innerHeight;
    const points = [[0.5, 0.5], [0.5, 0.92], [0.5, 0.06], [0.5, 0.78], [0.15, 0.5], [0.85, 0.5], [0.5, 0.25], [0.9, 0.95]];
    for (const [fx, fy] of points) {
      for (const el of document.elementsFromPoint(vw * fx, vh * fy)) {
        if (el === document.body || el === ROOT) break;
        const layer = nearestLayer(el);
        if (layer) set.add(layer);
      }
    }
    return [...set].filter((e) => !e.hasAttribute(WALL)).slice(0, 24);
  }

  // Pages keep their pop-ups in the DOM, hidden, long before they show them
  function shown(el) {
    const s = style(el);
    if (!s || s.display === "none" || s.visibility === "hidden" || +s.opacity === 0) return false;
    if (s.display === "contents") return [...el.children].some(shown);
    return el.getClientRects().length > 0;
  }

  function bigMedia(el) {
    if (el.querySelector("video")) return true;
    let n = 0;
    for (const m of el.querySelectorAll("img,canvas,picture")) {
      const r = m.getBoundingClientRect();
      if (r.width > 240 && r.height > 240 && ++n >= 2) return true;
    }
    return false;
  }

  function hasAuthControl(el) {
    if (el.querySelector(AUTH_CONTROL)) return true;
    for (const b of el.querySelectorAll('button,[role="button"],a')) {
      const t = (b.innerText || b.getAttribute("aria-label") || "").trim();
      if (t && t.length <= 40 && authText(t)) return true;
    }
    return false;
  }

  // The site's own top bar or navigation, whatever the page calls it (reddit-header-large, nav-bar ...):
  // it carries Log in / Sign up buttons too, but hiding it breaks the page
  const BAR_TAG = /(?:^|-)(?:header|nav|navbar|navigation|topbar|toolbar|masthead|sidebar)(?:-|$)/;
  const BAR_CLASS = /side-?nav|sidebar|side-?bar|nav-?container|nav-?bar|top-?bar|app-?header|site-?header|page-?header|left-?rail|menu-?bar|tab-?bar/i;
  function siteChrome(el) {
    for (let p = el; p && p !== document.body && p !== ROOT; p = p.parentElement) {
      if (BAR_TAG.test(p.tagName.toLowerCase())) return true;
      // the side or top bar of the site, named by its classes (TikTok: DivSideNavContainer, data-e2e="...-nav")
      const names = `${typeof p.className === "string" ? p.className : ""} ${p.id} ${p.getAttribute("data-e2e") || ""} ${p.getAttribute("data-testid") || ""}`;
      if (BAR_CLASS.test(names) && !/modal|dialog|popup|overlay|login-?(?:container|box)$/i.test(names)) return true;
    }
    if (el.querySelector('[role="search"],input[type="search"],search,form[role="search"],[role="navigation"],nav')) return true;
    const s = style(el);
    const r = el.getBoundingClientRect();
    return !!s && (s.position === "fixed" || s.position === "sticky") && r.top <= 2 && r.height <= 140 && r.width >= innerWidth * 0.8;
  }

  // X's bar for visitors: "See <name>'s full profile" with a "Continue to X" button (no login word in it)
  const X_PROMO = /continue to x\b|full profile|weiter zu x\b|zum vollst[aä]ndigen profil|continuer sur x\b/i;

  function isWall(el) {
    if (!shown(el)) return false;
    if (siteChrome(el)) return false;
    if (el.closest('header,nav,[role="banner"],[role="navigation"],[role="menu"],[role="tooltip"],[role="listbox"]')) return false;
    const text = (el.innerText || "").trim();
    if (!text || text.length > 900) return false;
    if (SITE === "x" && text.length <= 240 && X_PROMO.test(text) && !el.querySelector("article,main,video")) return true;
    if (!authText(text)) return false;
    if (el.querySelector('article,main,[role="feed"],[role="main"],[role="article"]')) return false;
    if (bigMedia(el)) return false;
    return hasAuthControl(el);
  }

  // From the element that matched up to the whole layer (wrappers carry the backdrop and the scroll lock)
  function climb(el) {
    let root = el;
    const size = (root.innerText || "").length;
    for (let i = 0; i < 6; i++) {
      const p = root.parentElement;
      if (!p || p === document.body || p === ROOT) break;
      if (p.querySelector('article,main,video,[role="feed"],[role="main"]')) break;
      if ((p.innerText || "").length > size + 40) break;
      root = p;
    }
    return root;
  }

  function covers(el) {
    const s = style(el);
    if (!s || (s.position !== "fixed" && s.position !== "absolute")) return false;
    const r = el.getBoundingClientRect();
    return r.width >= innerWidth * 0.7 && r.height >= innerHeight * 0.7;
  }

  // The dimming layer behind a pop-up: a full-window element without text of its own
  function hideBackdrops(root) {
    let p = root;
    for (let i = 0; i < 3 && p && p !== document.body && p !== ROOT; i++, p = p.parentElement) {
      const parent = p.parentElement;
      if (!parent) break;
      for (const sib of parent.children) {
        if (sib === p || sib.hasAttribute(WALL) || !covers(sib)) continue;
        if ((sib.innerText || "").trim() || sib.querySelector("video,img,canvas,article,main")) continue;
        sib.setAttribute(WALL, "backdrop");
      }
    }
  }

  // A dimming layer that shows up before its pop-up: held back (invisible) the moment it is added. It is hidden
  // for good when a wall is dismissed, and released again when a normal dialog shows up or after 2.5 seconds.
  const HOLD = "data-logsmith-hold";
  const holdTime = new WeakMap();
  const emptyLayer = (el) =>
    el.nodeType === 1 &&
    !el.hasAttribute(WALL) &&
    !el.hasAttribute(HOLD) &&
    !(el.textContent || "").trim() &&
    !el.querySelector("video,img,canvas,svg,input,iframe") &&
    covers(el);
  function holdAdded(records) {
    if (paused || onLoginPage()) return;
    let n = 0;
    for (const rec of records) {
      for (const node of rec.addedNodes) {
        if (node.nodeType !== 1 || n > 40) continue;
        for (const el of [node, ...(node.querySelectorAll ? [...node.querySelectorAll("div,section,aside")].slice(0, 12) : [])]) {
          n++;
          if (emptyLayer(el)) {
            el.setAttribute(HOLD, "");
            holdTime.set(el, performance.now());
            setTimeout(() => schedule(0), 2600);
          }
        }
      }
    }
  }
  function settleHolds(wallSeen) {
    const held = document.querySelectorAll(`[${HOLD}]`);
    if (!held.length) return;
    const now = performance.now();
    const dialogShown = [...document.querySelectorAll("[role=dialog][data-logsmith-ok]")].some(shown);
    for (const el of held) {
      if (wallSeen) {
        el.setAttribute(WALL, "backdrop");
        el.removeAttribute(HOLD);
      } else if (dialogShown || now - (holdTime.get(el) || 0) > 2500) el.removeAttribute(HOLD);
    }
  }

  function tryClose(root) {
    const btn = root.querySelector(
      '[aria-label*="close" i],[aria-label*="schließen" i],[aria-label*="fermer" i],[aria-label*="cerrar" i],[aria-label*="dismiss" i],[data-e2e*="close" i],[data-testid*="close" i]'
    );
    try {
      if (btn) btn.click();
    } catch {
      /* the page removes it anyway or the attribute hides it */
    }
  }

  function dismiss(el) {
    const root = climb(el);
    if (siteChrome(root)) return; // never take the site's own bar with a prompt inside it
    log.push({ tag: root.tagName.toLowerCase(), text: (root.innerText || "").replace(/\s+/g, " ").slice(0, 120), at: Date.now() });
    tryClose(root);
    root.setAttribute(WALL, "wall");
    hideBackdrops(root);
    settleHolds(true);
    removed++;
    lastDismiss = Date.now();
    unlocked = true;
    ROOT.setAttribute("data-logsmith-unlocked", "");
    report();
  }

  // ───────────── Giving the page back

  // The dimming layer can arrive after the pop-up itself: for a few seconds after a wall, empty full-window layers go too
  function sweepBackdrops() {
    if (Date.now() - lastDismiss > 8000) return;
    for (const el of document.elementsFromPoint(innerWidth / 2, innerHeight / 2)) {
      if (el === document.body || el === ROOT) break;
      const layer = nearestLayer(el);
      if (!layer || layer.hasAttribute(WALL) || !covers(layer)) continue;
      if ((layer.innerText || "").trim() || layer.querySelector("video,img,canvas,svg,input,button,a,article,main")) continue;
      layer.setAttribute(WALL, "backdrop");
    }
  }

  // After a wall: content under it is often blurred, inert or click-proof
  function release() {
    if (!unlocked) return;
    sweepBackdrops();
    for (const el of document.querySelectorAll("[inert]")) el.removeAttribute("inert");
    const vw = innerWidth;
    const vh = innerHeight;
    const seen = new Set();
    for (const fx of [0.2, 0.5, 0.8]) {
      for (const fy of [0.2, 0.5, 0.8]) {
        for (const el of document.elementsFromPoint(vw * fx, vh * fy)) {
          for (let e = el; e && e !== ROOT && !seen.has(e); e = e.parentElement) {
            seen.add(e);
            if (e.hasAttribute(WALL)) continue;
            const s = style(e);
            if (!s) continue;
            const blur = /blur\(\s*([\d.]+)px/.exec(s.filter || "");
            if (blur && +blur[1] >= 2) {
              e.style.setProperty("filter", "none", "important");
              e.setAttribute(UNBLUR, "1");
            }
            if (s.pointerEvents === "none" && e.getBoundingClientRect().width >= vw * 0.5) {
              e.style.setProperty("pointer-events", "auto", "important");
              e.setAttribute(UNBLUR, "1");
            }
          }
        }
      }
    }
  }

  function restore() {
    document.querySelectorAll(`[${WALL}]`).forEach((e) => e.removeAttribute(WALL));
    document.querySelectorAll(`[${UNBLUR}]`).forEach((e) => {
      e.style.removeProperty("filter");
      e.style.removeProperty("pointer-events");
      e.removeAttribute(UNBLUR);
    });
    ROOT.removeAttribute("data-logsmith-unlocked");
    unlocked = false;
  }

  // ───────────── Keeping feeds loading
  //
  // Behind a wall, the page often stops asking for more: scrolling was locked, or it shows "Something went wrong"
  // with a Retry button. Logsmith presses Retry like a person would and, when the end of the feed is reached and
  // nothing new appeared, wakes the page's own loader with scroll and resize events. It does not forge requests,
  // change who you are to the site or get around its limits: if the server says no, the feed stays put.

  const retried = new WeakMap();
  let lastActivity = 0;
  let lastHeight = 0;
  let still = 0;
  let nudges = 0;
  let lastNudge = 0;
  let clicksTotal = 0;
  let lastClick = 0;
  let failStreak = 0;

  for (const type of ["scroll", "wheel", "keydown", "touchmove", "pointermove"]) {
    addEventListener(type, () => (lastActivity = Date.now()), { passive: true, capture: true });
  }

  function keepLoading() {
    if (paused || !settings.keepLoading || document.visibilityState === "hidden" || !document.body) return;
    const now = Date.now();
    const height = ROOT.scrollHeight;
    if (height !== lastHeight) {
      if (height > lastHeight) failStreak = 0; // new content: the last press worked
      lastHeight = height;
      still = 0;
      nudges = 0;
    } else still++;

    // 1. Retry buttons, politely: a pause that doubles with every press that brought nothing, and a ceiling
    const gap = Math.min(4000 * 2 ** failStreak, 60000);
    if (!onLoginPage() && clicksTotal < 30 && now - lastClick >= gap) {
      for (const b of document.querySelectorAll('button,[role="button"]')) {
        if (b.disabled || b.closest('header,nav,[role="banner"],[role="navigation"]') || !shown(b)) continue;
        const t = (b.innerText || b.getAttribute("aria-label") || "").trim();
        if (!t || t.length > 30 || !retryText(t)) continue;
        const r = b.getBoundingClientRect();
        if (r.bottom < -innerHeight || r.top > innerHeight * 2) continue;
        const seen = retried.get(b) || 0;
        if (seen >= 6) continue;
        retried.set(b, seen + 1);
        clicksTotal++;
        lastClick = now;
        failStreak++;
        log.push({ tag: "retry", text: t, at: now });
        try {
          b.click();
        } catch {
          /* the page removed it */
        }
        break;
      }
    }

    // 2. End of the feed reached, nothing new for a few seconds, and you are the one scrolling: wake the loader
    const nearEnd = scrollY + innerHeight >= height - innerHeight * 1.2;
    if (nearEnd && still >= 2 && nudges < 4 && now - lastNudge > 1800 && now - lastActivity < 15000) {
      nudges++;
      lastNudge = now;
      log.push({ tag: "nudge", text: "scroll/resize", at: now });
      const el = document.scrollingElement || ROOT;
      for (const target of [window, document, el]) {
        try {
          target.dispatchEvent(new Event("scroll", { bubbles: target !== window }));
        } catch {
          /* ignore */
        }
      }
      try {
        window.dispatchEvent(new Event("resize"));
      } catch {
        /* ignore */
      }
    }
  }

  // ───────────── Opening posts like a fresh page load
  //
  // On Instagram a click on a post inside the app is handled by the page's own script, which shows a log-in
  // prompt, while the same address opened as a fresh page works. So a plain click on a post link is turned
  // into exactly that: a normal navigation to the same address, as if you had pasted it into a new tab.

  const POST_PATHS = {
    // posts, and profiles (/name/: the author above a post); the app's own sections are left to the app
    instagram: new RegExp(
      "^/(?:(?:[^/]+/)?(?:p|reel|reels|tv)/[\\w-]+/?|(?!(?:explore|reels?|accounts|direct|stories|p|tv|about|legal|web|developer|challenge|oauth|emails|session|api|graphql|ajax|nametag|directory|topics|locations)(?:/|$))[\\w.]+/?)$"
    ),
    pinterest: /^\/pin\/[\w-]+\/?$/
  };
  const POST_PATH = POST_PATHS[SITE];
  addEventListener(
    "click",
    (e) => {
      if (!POST_PATH || paused || !e.isTrusted || e.defaultPrevented) return;
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target && e.target.closest && e.target.closest("a[href]");
      if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      let url;
      try {
        url = new URL(a.href, location.href);
      } catch {
        return;
      }
      if (url.origin !== location.origin || !POST_PATH.test(url.pathname)) return;
      if (url.pathname === location.pathname) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      log.push({ tag: "open-post", text: url.pathname, at: Date.now() });
      location.assign(url.href);
    },
    true
  );

  // ───────────── Full screen for videos
  //
  // On X, the full-screen button of a video can be tied to the account. When the page did not go full screen by
  // itself shortly after a click on that button, Logsmith asks the browser for full screen on the player, using
  // the click you just made. This is the browser's own full-screen mode; nothing is sent anywhere.

  const FS_LABEL = /full\s?-?screen|vollbild|plein\s+[ée]cran|pantalla\s+completa|schermo\s+intero|tela\s+cheia|полноэкранн|tam\s+ekran|全画面|전체\s?화면|全屏/i;
  const describe = (el) => ({
    tag: el.tagName.toLowerCase(),
    label: el.getAttribute("aria-label") || el.getAttribute("title") || "",
    testid: el.getAttribute("data-testid") || "",
    role: el.getAttribute("role") || "",
    text: (el.innerText || "").trim().slice(0, 30)
  });
  const clickLog = [];
  const fsMatch = (el) =>
    FS_LABEL.test(el.getAttribute("aria-label") || el.getAttribute("title") || "") ||
    /full.?screen/i.test(el.getAttribute("data-testid") || "") ||
    (el.matches("button,[role=button]") && FS_LABEL.test(el.innerText || ""));

  // The video a control belongs to: the nearest ancestor holding one, else the biggest video on screen
  function videoFor(el) {
    for (let p = el, i = 0; p && p !== document.body && i < 12; p = p.parentElement, i++) {
      const v = p.querySelector("video");
      if (v) return { video: v, box: p };
    }
    let best = null;
    for (const v of document.querySelectorAll("video")) {
      const r = v.getBoundingClientRect();
      const area = Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0)) * Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0));
      if (area > 0 && (!best || area > best.area)) best = { video: v, box: v.parentElement, area };
    }
    return best;
  }

  addEventListener(
    "click",
    (e) => {
      if (paused || !e.isTrusted || !e.target || !e.target.closest) return;
      const chain = [];
      for (let p = e.target, i = 0; p && p !== document.body && i < 5; p = p.parentElement, i++) chain.push(p);
      const link = e.target.closest("a[href]");
      clickLog.push(...chain.slice(0, 2).map(describe), { tag: "->", label: link ? link.getAttribute("href") : "no link", prevented: e.defaultPrevented });
      if (clickLog.length > 9) clickLog.splice(0, clickLog.length - 9);
      if (SITE !== "x") return;
      const ctl = chain.find(fsMatch);
      if (!ctl) return;
      // Already full screen: the button is "exit". If the page did not leave full screen by itself, do it.
      if (document.fullscreenElement) {
        setTimeout(() => {
          if (!document.fullscreenElement) return;
          log.push({ tag: "fullscreen", text: "exit", at: Date.now() });
          try {
            document.exitFullscreen().catch(() => {});
          } catch {
            /* ignore */
          }
        }, 250);
        return;
      }
      const found = videoFor(ctl);
      if (!found) return log.push({ tag: "fullscreen", text: "no video found", at: Date.now() });
      const target = found.box.closest('[data-testid="videoPlayer"],[data-testid="videoComponent"]') || found.box;
      setTimeout(() => {
        if (document.fullscreenElement) return;
        log.push({ tag: "fullscreen", text: "asked for " + target.tagName.toLowerCase(), at: Date.now() });
        const tryGo = (el, next) => el.requestFullscreen ? el.requestFullscreen().catch(next) : next && next();
        tryGo(target, () => tryGo(found.video, (err) => log.push({ tag: "fullscreen", text: "refused: " + (err && err.message), at: Date.now() })));
      }, 250);
    },
    true
  );

  // ───────────── Running

  // Pop-ups are caught before the browser paints them: a mutation schedules a scan for the next animation
  // frame (which runs before painting) instead of after a delay. Under heavy churn scans are at least 60ms apart.
  let raf = 0;
  let lastScanAt = 0;
  function soon() {
    if (raf || timer) return;
    const wait = 60 - (performance.now() - lastScanAt);
    if (wait > 0) return schedule(wait);
    raf = requestAnimationFrame(() => {
      raf = 0;
      scan();
    });
  }

  function scan() {
    timer = 0;
    lastScanAt = performance.now();
    if (paused || document.visibilityState === "hidden" || !document.body) return;
    if (!onLoginPage()) {
      for (const el of candidates()) {
        if (!el.hasAttribute(WALL) && el.isConnected && isWall(el)) dismiss(el);
      }
    }
    release();
    clearPending();
    settleHolds(false);
  }

  // Dialogs stay invisible (see content.css) until they were judged: a wall never gets painted, and a dialog
  // that is not a wall is released as soon as it has content. Nothing stays pending longer than 2.5 seconds.
  const firstSeen = new WeakMap();
  function clearPending() {
    const now = performance.now();
    for (const el of document.querySelectorAll(PENDING_SEL)) {
      if (el.hasAttribute(WALL)) continue;
      if (!firstSeen.has(el)) firstSeen.set(el, now);
      const text = (el.innerText || "").trim();
      // Whatever the finer checks said: a short dialog that asks for an account and shows no content is a wall
      if (text && text.length <= 900 && authText(text) && !onLoginPage() && !siteChrome(el) && !el.querySelector("article,main,[role=feed],[role=main]") && shown(el)) {
        dismiss(climb(el));
        continue;
      }
      const filled = text.length > 0 || el.querySelector("img,svg,video,canvas,input");
      if (filled || onLoginPage() || now - firstSeen.get(el) > 2500) el.setAttribute("data-logsmith-ok", "");
    }
  }

  function schedule(ms) {
    if (!timer) timer = setTimeout(scan, ms);
  }

  let lastReport = "";
  function report() {
    const state = `${paused}|${removed}`;
    if (state === lastReport) return;
    lastReport = state;
    try {
      api.runtime.sendMessage({ type: "logsmith:state", paused, removed }, () => void api.runtime.lastError);
    } catch {
      /* the extension was reloaded */
    }
  }

  function apply() {
    const was = paused;
    paused = isPaused();
    ROOT.setAttribute("data-logsmith", paused ? "off" : "on");
    if (paused && !was) restore();
    if (!paused) schedule(50);
    report();
  }

  function debugInfo() {
    return {
      url: location.href,
      site: SITE,
      paused,
      keepLoading: settings.keepLoading,
      lastClicks: clickLog.slice(-6),
      videos: [...document.querySelectorAll("video")].slice(0, 4).map((v) => {
        const r = v.getBoundingClientRect();
        const chain = [];
        for (let p = v.parentElement, i = 0; p && p !== document.body && i < 6; p = p.parentElement, i++) chain.push(p.tagName.toLowerCase() + (p.getAttribute("data-testid") ? "[" + p.getAttribute("data-testid") + "]" : ""));
        const btns = [...(v.closest('[data-testid="videoPlayer"]') || v.parentElement.parentElement || v).querySelectorAll("button,[role=button]")].slice(0, 12).map((b) => b.getAttribute("aria-label") || b.getAttribute("data-testid") || (b.innerText || "").slice(0, 20));
        return { size: Math.round(r.width) + "x" + Math.round(r.height), ancestors: chain, buttons: btns };
      }),
      fullscreenEnabled: document.fullscreenEnabled,
      clicks: clicksTotal,
      loginPage: onLoginPage(),
      removed,
      hidden: log.slice(-10),
      candidates: paused
        ? []
        : candidates().map((e) => ({
            tag: e.tagName.toLowerCase(),
            role: e.getAttribute("role"),
            text: (e.innerText || "").replace(/\s+/g, " ").slice(0, 120),
            wall: isWall(e)
          }))
    };
  }

  function init() {
    new MutationObserver((records) => {
      holdAdded(records);
      soon();
    }).observe(ROOT, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "class", "role", "aria-modal", "open"]
    });
    // Walls often appear on a timer without any DOM change we would notice in time
    setInterval(() => !paused && schedule(0), 1500);
    setInterval(keepLoading, 1500);
    document.addEventListener("scroll", () => !paused && soon(), { passive: true, capture: true });
    addEventListener("popstate", () => !paused && schedule(200));

    api.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (!msg) return;
      if (msg.type === "logsmith:info") sendResponse({ site: SITE, host: location.hostname, paused, removed });
      if (msg.type === "logsmith:debug") sendResponse(debugInfo());
    });
    api.storage.onChanged.addListener((changes, area) => {
      if (area !== "local" || !(changes.enabled || changes.sites || changes.keepLoading)) return;
      load().then(apply);
    });
    apply();
  }

  function load() {
    return new Promise((resolve) => {
      try {
        api.storage.local.get(["enabled", "sites", "keepLoading"], (res) => {
          void api.runtime.lastError;
          settings = { enabled: res && res.enabled !== false, sites: (res && res.sites) || {}, keepLoading: !res || res.keepLoading !== false };
          resolve();
        });
      } catch {
        resolve();
      }
    });
  }

  // The page's own styles are not there yet at document_start: start once the first nodes exist
  load().then(() => (document.body ? init() : document.addEventListener("DOMContentLoaded", init, { once: true })));
})();
