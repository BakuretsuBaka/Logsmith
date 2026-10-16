// Runs inside the page itself. Single-page sites send you to the login screen on their own after a while
// (history.pushState to /login with nobody having clicked anything). Those automatic jumps are dropped.
// A jump right after a click or key press is never touched, so the Log in buttons keep working.
(() => {
  "use strict";
  if (window.__logsmithGuard) return;
  window.__logsmithGuard = true;

  const LOGIN_PATH =
    /^\/(?:accounts\/(?:login|emailsignup|signup)|login|log-in|signin|sign-in|signup|sign-up|register|i\/flow\/(?:login|signup)|flow\/(?:login|signup)|auth\/login)(?:\/|$)/i;

  const userIsActing = () => {
    try {
      return !!(navigator.userActivation && navigator.userActivation.isActive);
    } catch {
      return false;
    }
  };

  const off = () => document.documentElement.getAttribute("data-logsmith") === "off";

  for (const name of ["pushState", "replaceState"]) {
    const original = history[name];
    history[name] = function (state, title, url) {
      if (url != null && !off() && !userIsActing()) {
        try {
          const u = new URL(url, location.href);
          if (u.origin === location.origin && LOGIN_PATH.test(u.pathname) && !LOGIN_PATH.test(location.pathname)) return;
        } catch {
          /* not a valid URL: let the page deal with it */
        }
      }
      return original.apply(this, arguments);
    };
  }
})();
